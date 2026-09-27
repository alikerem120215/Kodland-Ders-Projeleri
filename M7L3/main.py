import sounddevice as sd
import numpy as np
import scipy.io.wavfile as wav
import speech_recognition as sr
from googletrans import Translator
from gtts import gTTS
import os

duration = 5  # kayıt saniyeleri
sample_rate = 44100
target_language = 'es' # 'es' İspanyolca kodudur (en: İngilizce, de: Almanca, fr: Fransızca vb.)

print("🎙️ Şimdi konuşun (5 saniye)...")
recording = sd.rec(
    int(duration * sample_rate), # kaydedilecek örnek sayısı
    samplerate=sample_rate,      # örnekleme hızı
    channels=1,                  # 1, mono kayıt anlamına gelir.
    dtype="int16"                # kayıtlı örnekler için veri türü
)
sd.wait()  # kayıt bitene kadar beklemek

wav.write("output.wav", sample_rate, recording)
print("✅ Kayıt tamamlandı, şimdi tanıma işlemi devam ediyor...")

recognizer = sr.Recognizer()
try:
    with sr.AudioFile("output.wav") as source:
        audio = recognizer.record(source)
    
    # Türkçe ses tanıma
    text = recognizer.recognize_google(audio, language="tr-TR")
    print(f"🗣️ Algılanan Metin: {text}")
    
    # googletrans ile Çeviri
    translator = Translator()
    translated = translator.translate(text, dest=target_language)
    
    print("-" * 50)
    print(f"🌍 {target_language.upper()} Çevirisi:", translated.text)
    print("-" * 50)

    # Sesli Okuma (Text-to-Speech)
    os.makedirs("audio_output", exist_ok=True)
    tts_path = f"audio_output/translated_{target_language}.mp3"
    tts = gTTS(text=translated.text, lang=target_language)
    tts.save(tts_path)
    print(f"🔊 Çeviri ses dosyası oluşturuldu: {tts_path}")

except sr.UnknownValueError:
    print("❌ Ses anlaşılamadı, lütfen tekrar deneyin.")
except sr.RequestError as e:
    print(f"❌ Google Speech Recognition servisine ulaşılamadı: {e}")
except Exception as e:
    print(f"❌ Bir hata oluştu: {e}")
