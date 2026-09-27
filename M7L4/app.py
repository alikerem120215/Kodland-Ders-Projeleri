"""
Doğru Konuş (Speak Right) - Duolingo & Google Gemini AI Flask Web Sunucusu
========================================================================
Çoklu egzersiz modları, Can/XP sistemi ve Gemini 2.5 Flash AI Dil Koçu backend servisi.
"""

import os
import tempfile
import random
from flask import Flask, render_template, request, jsonify

from dogru_konus import (
    SEVIYEYE_GORE_KELIMELER,
    FALLBACK_SOZLUK,
    SEVIYE_PUANLARI,
    kelime_ceviri_al,
    sesten_metne_cevir,
    gecici_dosya_sil
)

from gemini_service import get_gemini_word_info, get_gemini_feedback, verify_gemini_api_key

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB limit


def _get_request_api_key():
    """İstek başlıklarından veya gövdeden özel Gemini API Key'ini çeker."""
    header_key = request.headers.get('X-Gemini-API-Key')
    if header_key and header_key.strip():
        return header_key.strip()
    
    if request.is_json and request.json:
        json_key = request.json.get('api_key')
        if json_key and json_key.strip():
            return json_key.strip()
            
    arg_key = request.args.get('api_key')
    if arg_key and arg_key.strip():
        return arg_key.strip()

    return None


def _tum_ingilizce_kelimeleri_topla() -> list:
    """Tüm seviyelerdeki kelimelerin İngilizce çeviri havuzunu oluşturur."""
    havuz = set()
    for seviye, kelimeler in SEVIYEYE_GORE_KELIMELER.items():
        for k in kelimeler:
            ceviriler = kelime_ceviri_al(k)
            havuz.update(ceviriler)
    return list(havuz)


@app.route('/')
def index():
    """Ana web arayüzünü sunar."""
    return render_template('index.html')


@app.route('/api/verify-key', methods=['POST'])
def verify_key():
    """
    Girilmiş Gemini API Key'ini doğrular.
    """
    data = request.get_json(silent=True) or request.form
    api_key = data.get('api_key', '').strip() if data else ''

    if not api_key:
        api_key = _get_request_api_key() or ''

    is_valid, message = verify_gemini_api_key(api_key)
    if is_valid:
        return jsonify({"status": "success", "message": message})
    else:
        return jsonify({"status": "error", "message": message}), 400


@app.route('/api/word', methods=['GET'])
def get_word():
    """
    Rastgele bir kelime ve çoktan seçmeli mod için 4 adet şık üretir.
    """
    seviye = request.args.get('level', 'kolay').lower()
    istenen_mod = request.args.get('mode', 'mixed').lower()

    if seviye not in SEVIYEYE_GORE_KELIMELER:
        seviye = 'kolay'

    modlar = ['speak', 'write', 'choice', 'listen']
    aktif_mod = istenen_mod if istenen_mod in modlar else random.choice(modlar)

    kelime_listesi = SEVIYEYE_GORE_KELIMELER[seviye]
    turkce_kelime = random.choice(kelime_listesi)
    dogru_ceviriler = kelime_ceviri_al(turkce_kelime)
    ana_dogru_ceviri = dogru_ceviriler[0] if dogru_ceviriler else turkce_kelime

    tum_ceviriler = _tum_ingilizce_kelimeleri_topla()
    yanlis_siklar = [c for c in tum_ceviriler if c.lower() not in [d.lower() for d in dogru_ceviriler]]
    
    random.shuffle(yanlis_siklar)
    secilen_yanlislar = yanlis_siklar[:3]
    
    siklar = secilen_yanlislar + [ana_dogru_ceviri]
    random.shuffle(siklar)

    return jsonify({
        "status": "success",
        "word": turkce_kelime,
        "level": seviye,
        "mode": aktif_mod,
        "primary_translation": ana_dogru_ceviri,
        "options": siklar,
        "points_reward": SEVIYE_PUANLARI.get(seviye, 10)
    })


@app.route('/api/gemini/word-info', methods=['GET'])
def gemini_word_info():
    """
    Google Gemini 2.5 Flash ile kelime için örnek cümle, çeviri ve telaffuz ipucu üretir.
    Query params:
    - word: Türkçe kelime
    - english: İngilizce karşılığı
    """
    turkce_kelime = request.args.get('word', '').strip()
    english_word = request.args.get('english', '').strip()
    api_key = _get_request_api_key()

    if not turkce_kelime or not english_word:
        return jsonify({"status": "error", "message": "Kelime parametreleri eksik."}), 400

    ai_data = get_gemini_word_info(turkce_kelime, english_word, api_key=api_key)
    return jsonify({
        "status": "success",
        "word": turkce_kelime,
        "english": english_word,
        "ai": ai_data
    })


@app.route('/api/evaluate-text', methods=['POST'])
def evaluate_text():
    """
    Yazma ve Çoktan Seçmeli cevap doğrulaması yapar ve Gemini AI dönütü ekler.
    """
    data = request.get_json(silent=True) or request.form
    turkce_kelime = data.get('word', '').strip()
    user_text = data.get('user_text', '').strip().lower()
    seviye = data.get('level', 'kolay').lower()
    api_key = _get_request_api_key()

    if not turkce_kelime or not user_text:
        return jsonify({"status": "error", "message": "Eksik parametre."}), 400

    dogru_ceviriler = kelime_ceviri_al(turkce_kelime)
    dogru_ceviriler_clean = [c.strip().lower() for c in dogru_ceviriler]

    is_correct = user_text in dogru_ceviriler_clean
    kazanilan_puan = SEVIYE_PUANLARI.get(seviye, 10) if is_correct else 0

    ana_ingilizce = dogru_ceviriler[0] if dogru_ceviriler else turkce_kelime
    ai_feedback = get_gemini_feedback(turkce_kelime, ana_ingilizce, user_text, is_correct, api_key=api_key)

    return jsonify({
        "status": "success",
        "is_correct": is_correct,
        "user_text": user_text,
        "word": turkce_kelime,
        "correct_translations": dogru_ceviriler,
        "points": kazanilan_puan,
        "ai_feedback": ai_feedback,
        "message": "Harika! Doğru cevap 🎉" if is_correct else "Maalesef yanlış cevap. ❌"
    })


@app.route('/api/evaluate', methods=['POST'])
def evaluate_speech():
    """
    Telaffuz (Speak) modu için WAV ses dosyasını analiz eder ve Gemini AI dönütü ekler.
    """
    if 'audio' not in request.files:
        return jsonify({"status": "error", "message": "Ses dosyası yüklenmedi."}), 400

    audio_file = request.files['audio']
    turkce_kelime = request.form.get('word', '').strip()
    seviye = request.form.get('level', 'kolay').lower()
    api_key = _get_request_api_key()

    if not turkce_kelime:
        return jsonify({"status": "error", "message": "Kelime parametresi eksik."}), 400

    dogru_ceviriler = kelime_ceviri_al(turkce_kelime)
    dogru_ceviriler_clean = [c.strip().lower() for c in dogru_ceviriler]

    temp_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    temp_wav_path = temp_wav.name
    temp_wav.close()

    try:
        audio_file.save(temp_wav_path)
        algilanan_metin, hata_mesaji = sesten_metne_cevir(temp_wav_path)

        if hata_mesaji:
            return jsonify({
                "status": "fail",
                "is_correct": False,
                "recognized_text": None,
                "message": hata_mesaji,
                "correct_translations": dogru_ceviriler,
                "points": 0
            })

        algilanan_metin_clean = algilanan_metin.strip().lower()
        is_correct = algilanan_metin_clean in dogru_ceviriler_clean
        kazanilan_puan = SEVIYE_PUANLARI.get(seviye, 10) if is_correct else 0

        ana_ingilizce = dogru_ceviriler[0] if dogru_ceviriler else turkce_kelime
        ai_feedback = get_gemini_feedback(turkce_kelime, ana_ingilizce, algilanan_metin, is_correct, api_key=api_key)

        return jsonify({
            "status": "success",
            "is_correct": is_correct,
            "recognized_text": algilanan_metin,
            "word": turkce_kelime,
            "correct_translations": dogru_ceviriler,
            "points": kazanilan_puan,
            "ai_feedback": ai_feedback,
            "message": "Telaffuz harika! 🎉" if is_correct else "Telaffuz tam eşleşmedi. ❌"
        })

    except Exception as e:
        return jsonify({"status": "error", "message": f"Sunucu hatası: {str(e)}"}), 500

    finally:
        gecici_dosya_sil(temp_wav_path)



if __name__ == '__main__':
    print("🚀 Google Gemini 2.5 Flash Destekli Doğru Konuş Web Sunucusu Başlatılıyor...")
    print("🌐 Uygulama adresi: http://127.0.0.1:5050")
    app.run(host='0.0.0.0', port=5050, debug=True)
