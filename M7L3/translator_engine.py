import os
import sounddevice as sd
import numpy as np
import scipy.io.wavfile as wav
import speech_recognition as sr
from googletrans import Translator, LANGUAGES
from gtts import gTTS

# Target languages dictionary mapping language codes to display names
SUPPORTED_LANGUAGES = {
    'es': 'İspanyolca (Español)',
    'en': 'İngilizce (English)',
    'de': 'Almanca (Deutsch)',
    'fr': 'Fransızca (Français)',
    'it': 'İtalyanca (Italiano)',
    'ru': 'Rusça (Русский)',
    'ja': 'Japonca (日本語)',
    'ar': 'Arapça (العربية)',
    'zh-cn': 'Çince (Basitleştirilmiş)',
    'pt': 'Portekizce (Português)'
}

def record_audio(output_file="output.wav", duration=5, sample_rate=44100):
    """
    Mikrofondan belirtilen süre boyunca ses kaydeder ve wav dosyası olarak kaydeder.
    """
    print(f"🎤 Şimdi konuşun... ({duration} saniye)")
    recording = sd.rec(
        int(duration * sample_rate),
        samplerate=sample_rate,
        channels=1,
        dtype="int16"
    )
    sd.wait()
    wav.write(output_file, sample_rate, recording)
    print("✅ Kayıt tamamlandı.")
    return output_file

def speech_to_text(audio_file="output.wav", language="tr-TR"):
    """
    Kaydedilmiş wav dosyasını SpeechRecognition ile metne dönüştürür.
    """
    recognizer = sr.Recognizer()
    if not os.path.exists(audio_file):
        return {"success": False, "error": "Ses dosyası bulunamadı."}
    
    try:
        with sr.AudioFile(audio_file) as source:
            audio = recognizer.record(source)
        
        print("🔍 Tanıma işlemi devam ediyor...")
        text = recognizer.recognize_google(audio, language=language)
        print(f"🗣️ Algılanan Metin: {text}")
        return {"success": True, "text": text}
    except sr.UnknownValueError:
        return {"success": False, "error": "Ses anlaşılamadı. Lütfen daha net konuşun."}
    except sr.RequestError as e:
        return {"success": False, "error": f"Google Speech Recognition servisine ulaşılamadı: {e}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def translate_text(text, target_lang="es", source_lang="auto"):
    """
    googletrans kütüphanesini kullanarak metni hedef dile çevirir.
    """
    try:
        translator = Translator()
        if source_lang == "auto":
            translated = translator.translate(text, dest=target_lang)
        else:
            translated = translator.translate(text, dest=target_lang, src=source_lang)
        
        target_name = SUPPORTED_LANGUAGES.get(target_lang, target_lang.upper())
        print(f"🌍 {target_name}'ya çeviri: {translated.text}")
        
        return {
            "success": True,
            "original_text": text,
            "translated_text": translated.text,
            "source_lang": translated.src,
            "target_lang": target_lang,
            "target_name": target_name
        }
    except Exception as e:
        print(f"❌ Çeviri hatası: {e}")
        return {"success": False, "error": f"Çeviri hatası: {str(e)}"}

def text_to_speech(text, lang="es", output_file="static/audio/translation.mp3"):
    """
    gTTS kullanarak metni ses dosyasına dönüştürür.
    """
    try:
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        # gtts uses language code, e.g., 'es' for Spanish
        # map zh-cn to zh-CN if needed
        gtts_lang = 'zh-CN' if lang == 'zh-cn' else lang
        
        tts = gTTS(text=text, lang=gtts_lang, slow=False)
        tts.save(output_file)
        print(f"🔊 Ses dosyası oluşturuldu: {output_file}")
        return {"success": True, "file_path": output_file}
    except Exception as e:
        print(f"⚠️ Ses oluşturma hatası: {e}")
        return {"success": False, "error": str(e)}
