import os
import uuid
from flask import Flask, render_template, request, jsonify, send_from_directory
from translator_engine import (
    record_audio,
    speech_to_text,
    translate_text,
    text_to_speech,
    SUPPORTED_LANGUAGES
)

app = Flask(__name__)
AUDIO_DIR = os.path.join(app.root_path, "static", "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/languages", methods=["GET"])
def get_languages():
    return jsonify({
        "success": True,
        "languages": SUPPORTED_LANGUAGES
    })

@app.route("/api/record-and-translate", methods=["POST"])
def record_and_translate():
    """
    Sunucu mikrofonundan ses kaydı alır, tanır ve çevirir.
    """
    data = request.get_json() or {}
    duration = int(data.get("duration", 5))
    target_lang = data.get("target_lang", "es")
    source_lang = data.get("source_lang", "tr-TR")

    unique_id = str(uuid.uuid4())[:8]
    wav_file = os.path.join(AUDIO_DIR, f"temp_{unique_id}.wav")

    # 1. Ses Kaydı
    try:
        record_audio(output_file=wav_file, duration=duration)
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Mikrofon kaydı başlatılamadı: {str(e)}"
        }), 500

    # 2. Ses Tanıma (STT)
    stt_res = speech_to_text(audio_file=wav_file, language=source_lang)
    if not stt_res.get("success"):
        return jsonify({
            "success": False,
            "error": stt_res.get("error", "Ses tanınamadı.")
        }), 400

    recognized_text = stt_res["text"]

    # 3. Metin Çevirisi
    trans_res = translate_text(recognized_text, target_lang=target_lang)
    if not trans_res.get("success"):
        return jsonify({
            "success": False,
            "original_text": recognized_text,
            "error": trans_res.get("error", "Çeviri başarısız.")
        }), 500

    translated_text = trans_res["translated_text"]

    # 4. Sesli Okuma (TTS)
    mp3_filename = f"speech_{unique_id}.mp3"
    mp3_path = os.path.join(AUDIO_DIR, mp3_filename)
    tts_res = text_to_speech(translated_text, lang=target_lang, output_file=mp3_path)

    audio_url = f"/api/audio/{mp3_filename}" if tts_res.get("success") else None

    return jsonify({
        "success": True,
        "original_text": recognized_text,
        "translated_text": translated_text,
        "source_lang": trans_res.get("source_lang", "tr"),
        "target_lang": target_lang,
        "target_name": trans_res.get("target_name", target_lang),
        "audio_url": audio_url
    })

@app.route("/api/process-audio", methods=["POST"])
def process_audio():
    """
    Tarayıcıdan yüklenen ses dosyasını (wav/webm) işler.
    """
    if 'audio' not in request.files:
        return jsonify({"success": False, "error": "Ses dosyası gönderilmedi."}), 400

    audio_file = request.files['audio']
    target_lang = request.form.get("target_lang", "es")
    source_lang = request.form.get("source_lang", "tr-TR")

    unique_id = str(uuid.uuid4())[:8]
    raw_path = os.path.join(AUDIO_DIR, f"upload_{unique_id}.wav")
    audio_file.save(raw_path)

    # 1. Ses Tanıma
    stt_res = speech_to_text(audio_file=raw_path, language=source_lang)
    if not stt_res.get("success"):
        return jsonify({
            "success": False,
            "error": stt_res.get("error", "Ses tanınamadı.")
        }), 400

    recognized_text = stt_res["text"]

    # 2. Çeviri
    trans_res = translate_text(recognized_text, target_lang=target_lang)
    if not trans_res.get("success"):
        return jsonify({
            "success": False,
            "original_text": recognized_text,
            "error": trans_res.get("error", "Çeviri başarısız.")
        }), 500

    translated_text = trans_res["translated_text"]

    # 3. TTS
    mp3_filename = f"speech_{unique_id}.mp3"
    mp3_path = os.path.join(AUDIO_DIR, mp3_filename)
    tts_res = text_to_speech(translated_text, lang=target_lang, output_file=mp3_path)

    audio_url = f"/api/audio/{mp3_filename}" if tts_res.get("success") else None

    return jsonify({
        "success": True,
        "original_text": recognized_text,
        "translated_text": translated_text,
        "source_lang": trans_res.get("source_lang", "tr"),
        "target_lang": target_lang,
        "target_name": trans_res.get("target_name", target_lang),
        "audio_url": audio_url
    })

@app.route("/api/translate-text", methods=["POST"])
def translate_text_endpoint():
    """
    Doğrudan girilen metni çevirir ve seslendirir.
    """
    data = request.get_json() or {}
    text = data.get("text", "").strip()
    target_lang = data.get("target_lang", "es")

    if not text:
        return jsonify({"success": False, "error": "Lütfen bir metin girin."}), 400

    trans_res = translate_text(text, target_lang=target_lang)
    if not trans_res.get("success"):
        return jsonify({"success": False, "error": trans_res.get("error", "Çeviri başarısız.")}), 500

    translated_text = trans_res["translated_text"]
    unique_id = str(uuid.uuid4())[:8]
    mp3_filename = f"speech_{unique_id}.mp3"
    mp3_path = os.path.join(AUDIO_DIR, mp3_filename)
    tts_res = text_to_speech(translated_text, lang=target_lang, output_file=mp3_path)

    audio_url = f"/api/audio/{mp3_filename}" if tts_res.get("success") else None

    return jsonify({
        "success": True,
        "original_text": text,
        "translated_text": translated_text,
        "target_lang": target_lang,
        "target_name": trans_res.get("target_name", target_lang),
        "audio_url": audio_url
    })

@app.route("/api/audio/<filename>")
def serve_audio(filename):
    return send_from_directory(AUDIO_DIR, filename)

if __name__ == "__main__":
    print("🚀 Sesli Çevirmen Web Sunucusu Başlatılıyor: http://127.0.0.1:5005")
    app.run(host="0.0.0.0", port=5005, debug=True)
