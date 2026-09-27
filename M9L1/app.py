import os
import sys
import uuid
import json
import time
import subprocess
import urllib.request
import urllib.error
from flask import Flask, request, jsonify, send_file, send_from_directory

app = Flask(__name__, static_folder='static', static_url_path='')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIO_CACHE_DIR = os.path.join(BASE_DIR, 'audio_cache')
os.makedirs(AUDIO_CACHE_DIR, exist_ok=True)

# Helper function to synthesize text using pyttsx3 or macOS say
def synthesize_speech(text, rate=175):
    temp_id = uuid.uuid4().hex[:12]
    aiff_path = os.path.join(AUDIO_CACHE_DIR, f"{temp_id}.aiff")
    wav_path = os.path.join(AUDIO_CACHE_DIR, f"{temp_id}.wav")

    # Try native macOS 'say' with Cem voice first (male voice for J.A.R.V.I.S.)
    try:
        cmd = ['say', '-v', 'Cem', '-r', str(rate), text, '-o', aiff_path]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if res.returncode == 0 and os.path.exists(aiff_path):
            success = True
    except Exception as e:
        print(f"macOS say failed: {e}", file=sys.stderr)

    # If say failed or voice not found, fallback to pyttsx3 looking for Cem
    if not success:
        try:
            import pyttsx3
            engine = pyttsx3.init()
            voices = engine.getProperty('voices')
            for v in voices:
                if 'cem' in v.id.lower() or 'cem' in v.name.lower():
                    engine.setProperty('voice', v.id)
                    break
            else:
                for v in voices:
                    if 'tr-tr' in v.id.lower() or 'turkish' in v.name.lower():
                        engine.setProperty('voice', v.id)
                        break
            engine.setProperty('rate', rate)
            engine.save_to_file(text, aiff_path)
            engine.runAndWait()
            if os.path.exists(aiff_path):
                success = True
        except Exception as e:
            print(f"pyttsx3 failed: {e}", file=sys.stderr)

    if not success or not os.path.exists(aiff_path):
        raise RuntimeError("Speech synthesis failed")

    # Convert AIFF to standard PCM WAVE for browser playback
    try:
        conv_res = subprocess.run(
            ['afconvert', '-f', 'WAVE', '-d', 'LEI16@24000', aiff_path, wav_path],
            capture_output=True,
            text=True,
            timeout=10
        )
        if conv_res.returncode != 0:
            raise RuntimeError(f"afconvert failed: {conv_res.stderr}")
    finally:
        if os.path.exists(aiff_path):
            try:
                os.remove(aiff_path)
            except Exception:
                pass

    return f"{temp_id}.wav"


@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/api/status', methods=['GET'])
def status():
    return jsonify({
        "status": "online",
        "service": "J.A.R.V.I.S. Tactical AI Interface",
        "protocol": "Mark VII Neural Network",
        "tts_engine": "pyttsx3 / macOS Cem (TR)"
    })


@app.route('/api/audio/<filename>', methods=['GET'])
def get_audio(filename):
    # Security check: only allow alphanumeric and .wav
    safe_name = os.path.basename(filename)
    if not safe_name.endswith('.wav'):
        return jsonify({"error": "Invalid file format"}), 400
    file_path = os.path.join(AUDIO_CACHE_DIR, safe_name)
    if not os.path.exists(file_path):
        return jsonify({"error": "Audio file not found"}), 404
    return send_file(file_path, mimetype='audio/wav')


@app.route('/api/tts', methods=['POST'])
def tts_endpoint():
    data = request.get_json(force=True, silent=True) or {}
    text = (data.get('text') or '').strip()
    if not text:
        return jsonify({"error": "Metin belirtilmedi"}), 400

    try:
        wav_file = synthesize_speech(text)
        return jsonify({
            "success": True,
            "audio_url": f"/api/audio/{wav_file}"
        })
    except Exception as e:
        return jsonify({"error": f"Ses sentezleme hatası: {str(e)}"}), 500


@app.route('/api/chat', methods=['POST'])
def chat_endpoint():
    data = request.get_json(force=True, silent=True) or {}
    user_message = (data.get('message') or '').strip()
    api_key = (data.get('apiKey') or '').strip()
    conversation_history = data.get('history') or []

    if not api_key:
        return jsonify({"error": "Lütfen Gemini API anahtarınızı girin."}), 400
    if not user_message:
        return jsonify({"error": "Mesaj boş olamaz."}), 400

    # User specified: direct Gemini 3.5 Flash Lite
    # Candidate models in priority order:
    candidate_models = [
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash",
        "gemini-3.8-flash",
        "gemini-1.5-flash"
    ]

    # Prepare Gemini API request payload for J.A.R.V.I.S.
    system_instruction = (
        "Sen Tony Stark'ın efsanevi yapay zekası J.A.R.V.I.S.'sin (Just A Rather Very Intelligent System). "
        "Kullanıcı senin efendin (Sir / Efendim). "
        "Kişiliğin: Son derece asil, kibar, saygılı, zeki, sadık, sakin ve hafif ince nükteli bir İngiliz beyefendisi/kâhyası tonundasın. "
        "Hitap: Kullanıcıya hitap ederken mutlaka 'Efendim' veya uygun yerlerde 'Sir' ifadesini kullan. "
        "Cevap tarzın: Doğrudan seslendirilmeye (TTS) uygun, akıcı, net, kısa ve öz olmalı. "
        "Gereksiz emoji, markdown listeleri, madde işaretleri veya karmaşık semboller kullanma; konuşma dilinde doğal ve zarif cümleler kur. "
        "Örnek üslup: 'Emredersiniz efendim, sistem verilerini derliyorum.', 'Hemen ilgileniyorum efendim.', 'Tüm protokoller devrede efendim.'"
    )

    contents = []
    # Add recent history if provided
    for h in conversation_history[-6:]:
        role = "user" if h.get("role") == "user" else "model"
        parts = [{"text": h.get("text", "")}]
        contents.append({"role": role, "parts": parts})

    contents.append({"role": "user", "parts": [{"text": user_message}]})

    payload = {
        "contents": contents,
        "systemInstruction": {
            "parts": [{"text": system_instruction}]
        },
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 600
        }
    }

    gemini_reply = ""
    used_model = candidate_models[0]
    last_error_msg = ""

    # Try candidate models until success
    for m in candidate_models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={api_key}"
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=25) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                candidates = res_data.get('candidates', [])
                if candidates and 'content' in candidates[0]:
                    parts = candidates[0]['content'].get('parts', [])
                    gemini_reply = "".join(p.get('text', '') for p in parts)
                    used_model = m
                    break
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8')
            try:
                err_json = json.loads(error_body)
                last_error_msg = err_json.get('error', {}).get('message', str(e))
            except Exception:
                last_error_msg = str(e)
            
            # If invalid API key (403 or PERMISSION_DENIED), do not retry other models
            if e.code == 400 and "API_KEY_INVALID" in last_error_msg:
                return jsonify({"error": f"Geçersiz API Anahtarı: {last_error_msg}"}), 400
            if e.code == 403:
                return jsonify({"error": f"Yetki Hatası: {last_error_msg}"}), 403
            
            # Continue to next model if model not found or deprecated
            continue
        except Exception as e:
            last_error_msg = str(e)
            continue

    if not gemini_reply:
        if last_error_msg:
            return jsonify({"error": f"Gemini API Hatası: {last_error_msg}"}), 400
        gemini_reply = "Üzgünüm, şu anda yanıt oluşturamadım. Lütfen tekrar dener misiniz?"

    # Generate speech with pyttsx3/TTS
    audio_filename = None
    try:
        # Strip some markdown characters for cleaner speech
        speech_text = gemini_reply.replace('*', '').replace('#', '').replace('`', '').strip()
        audio_filename = synthesize_speech(speech_text)
    except Exception as e:
        print(f"TTS generation error: {e}", file=sys.stderr)

    return jsonify({
        "success": True,
        "reply": gemini_reply,
        "audio_url": f"/api/audio/{audio_filename}" if audio_filename else None,
        "model_used": used_model
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"Starting Gemini Vox Web App on http://127.0.0.1:{port}")
    app.run(host='127.0.0.1', port=port, debug=False)
