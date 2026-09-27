"""
Doğru Konuş (Speak Right) - İnteraktif Kelime Telaffuz Oyunu
============================================================
Çevrim içi İngilizce öğreten bir okul için öğrencilerin telaffuzlarını
geliştirmelerini sağlayan konsol tabanlı eğitim oyunu.

Gereksinimler:
- sounddevice
- scipy
- SpeechRecognition
- googletrans
"""

import os
import sys
import time
import random
import tempfile
from typing import List, Union, Tuple, Optional

# Konsol çıktılarının anlık (unbuffered) görüntülenmesi için
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(line_buffering=True)

# Bağımlılıkların kontrolü ve yüklenmesi
try:
    import sounddevice as sd
    from scipy.io import wavfile
    import speech_recognition as sr
except ImportError as e:
    print(f"❌ Hata: Gerekli bir kütüphane eksik ({e}).")
    sys.exit(1)

try:
    from googletrans import Translator
except Exception as e:
    Translator = None


# ---------------------------------------------------------------------------
# KELİME HAVUZU VE YEDEK SÖZLÜK (FALLBACK DICTIONARY)
# ---------------------------------------------------------------------------

SEVIYEYE_GORE_KELIMELER = {
    "kolay": ["kedi", "köpek", "elma", "süt", "güneş", "kitap", "ev", "su"],
    "orta": ["muz", "okul", "arkadaş", "pencere", "sarı", "bilgisayar", "şehir"],
    "zor": ["teknoloji", "üniversite", "bilgi", "telaffuz", "hayal gücü", "sorumluluk"]
}

# API bağlantı hatalarına karşı yerleşik sözlük yedeği (Fallback Dictionary)
FALLBACK_SOZLUK = {
    "kedi": ["cat"],
    "köpek": ["dog"],
    "elma": ["apple"],
    "süt": ["milk"],
    "güneş": ["sun"],
    "kitap": ["book"],
    "ev": ["house", "home"],
    "su": ["water"],
    "muz": ["banana"],
    "okul": ["school"],
    "arkadaş": ["friend"],
    "pencere": ["window"],
    "sarı": ["yellow"],
    "bilgisayar": ["computer"],
    "şehir": ["city"],
    "teknoloji": ["technology"],
    "üniversite": ["university"],
    "bilgi": ["knowledge", "information"],
    "telaffuz": ["pronunciation"],
    "hayal gücü": ["imagination"],
    "sorumluluk": ["responsibility"]
}

# Seviyelere göre puan katsayıları
SEVIYE_PUANLARI = {
    "kolay": 10,
    "orta": 20,
    "zor": 30
}


# ---------------------------------------------------------------------------
# ÇEVİRİ VE DİLBİLİM MODÜLÜ
# ---------------------------------------------------------------------------

def kelime_ceviri_al(turkce_kelime: str) -> List[str]:
    """
    Türkçe kelimenin İngilizce karşılıklarını getirir.
    Öncelikle googletrans API'sini dener, hata durumunda yerleşik sözlüğü (fallback) kullanır.

    :param turkce_kelime: Çevrilecek Türkçe kelime.
    :return: Kabul edilebilir İngilizce çevirilerin listesi (küçük harfe çevrilmiş).
    """
    kelime_clean = turkce_kelime.strip().lower()
    kabul_edilen_ceviriler = set()

    # 1. Fallback sözlükten muhtemel doğru cevapları ekle
    if kelime_clean in FALLBACK_SOZLUK:
        fallback_val = FALLBACK_SOZLUK[kelime_clean]
        if isinstance(fallback_val, list):
            kabul_edilen_ceviriler.update([w.lower() for w in fallback_val])
        else:
            kabul_edilen_ceviriler.add(fallback_val.lower())

    # 2. Google Translate API ile canlı çeviri dene (eğer kütüphane mevcutsa)
    if Translator is not None:
        try:
            translator = Translator()
            translation = translator.translate(kelime_clean, src='tr', dest='en')
            if translation and translation.text:
                api_ceviri = translation.text.strip().lower()
                kabul_edilen_ceviriler.add(api_ceviri)
        except Exception as err:
            print(f"\n⚠️  [Çeviri Uyarısı] Google Translate API'sine ulaşılamadı ({err}). Yerleşik sözlük kullanılıyor.")

    # Eğer hiçbir şekilde çeviri bulunamadıysa varsayılan boş dönmesin
    return list(kabul_edilen_ceviriler) if kabul_edilen_ceviriler else [kelime_clean]


# ---------------------------------------------------------------------------
# SES KAYIT VE SOKET / STT MODÜLÜ
# ---------------------------------------------------------------------------

def ses_kaydet(sure: int = 4, örnekleme_orani: int = 44100) -> Optional[str]:
    """
    Kullanıcının sesini mikrofondan kaydeder ve geçici bir WAV dosyasına yazar.

    :param sure: Saniye cinsinden kayıt süresi.
    :param örnekleme_orani: Kayıt örnekleme frekansı (örn: 44100 Hz).
    :return: Oluşturulan geçici WAV dosyasının yolu veya hata durumunda None.
    """
    print("\n🎤 Hazırlanın! Kayıt 1 saniye içinde başlayacak...")
    time.sleep(1)

    print(f"🔴 KAYIT BAŞLADI ({sure} saniye) - Kelimenin İngilizcesini Telaffuz Edin!")
    try:
        # Mikrofondan kayıt alma
        kayit = sd.rec(int(sure * örnekleme_orani), samplerate=örnekleme_orani, channels=1, dtype='int16')
        
        # Geri sayım görselleştirmesi
        for i in range(sure, 0, -1):
            print(f"   ⏱️  Kalan süre: {i} sn", end="\r", flush=True)
            time.sleep(1)
        
        sd.wait()  # Kaydın tamamlanmasını bekle
        print("\n⏹️  Kayıt tamamlandı! Ses işleniyor...\n")

        # Geçici WAV dosyası oluşturma
        temp_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        temp_wav_path = temp_wav.name
        temp_wav.close()

        # Kaydedilen sesi WAV formatında yazma
        wavfile.write(temp_wav_path, örnekleme_orani, kayit)
        return temp_wav_path

    except Exception as e:
        print(f"\n❌ Ses kaydı alınırken bir hata oluştu: {e}")
        return None


def sesten_metne_cevir(wav_dosya_yolu: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Geçici WAV dosyasındaki sesi Speech Recognition kütüphanesi kullanarak metne dönüştürür.

    :param wav_dosya_yolu: İşlenecek WAV dosyasının yolu.
    :return: (Tanınan Metin, Hata Mesajı) çifti.
    """
    recognizer = sr.Recognizer()

    try:
        with sr.AudioFile(wav_dosya_yolu) as source:
            # Gürültü ayarlaması (isteğe bağlı ama tanımayı iyileştirir)
            recognizer.adjust_for_ambient_noise(source, duration=0.2)
            audio_data = recognizer.record(source)

        # Google Speech-to-Text API (en-US dili ile)
        metin = recognizer.recognize_google(audio_data, language='en-US')
        return metin.strip().lower(), None

    except sr.UnknownValueError:
        return None, "Ses anlaşılamadı. Lütfen kelimeyi daha net ve yüksek sesle telaffuz edin."
    except sr.RequestError as e:
        return None, f"Konuşma tanıma servisine ulaşılamadı: {e}"
    except Exception as e:
        return None, f"Beklenmeyen bir ses tanıma hatası: {e}"


def gecici_dosya_sil(dosya_yolu: Optional[str]) -> None:
    """
    Oluşturulan geçici dosyayı güvenli bir şekilde sistemden siler.
    """
    if dosya_yolu and os.path.exists(dosya_yolu):
        try:
            os.remove(dosya_yolu)
        except Exception as e:
            print(f"⚠️  Geçici dosya silinirken uyarı: {e}")


# ---------------------------------------------------------------------------
# OYUN MANTIĞI VE KULLANICI ARAYÜZÜ
# ---------------------------------------------------------------------------

def zorluk_seviyesi_sec() -> str:
    """
    Kullanıcıdan geçerli bir zorluk seviyesi seçmesini ister.
    """
    seviyeler = {"1": "kolay", "2": "orta", "3": "zor"}
    
    while True:
        print("\n--- ZORLUK SEVİYESİ SEÇİMİ ---")
        print("1. Kolay (Kedi, Elma, Ev...) [10 Puan]")
        print("2. Orta  (Muz, Okul, Bilgisayar...) [20 Puan]")
        print("3. Zor   (Teknoloji, Telaffuz, Sorumluluk...) [30 Puan]")
        
        secim = input("Lütfen bir seviye seçin (1-3 veya kolay/orta/zor): ").strip().lower()
        
        if secim in seviyeler:
            return seviyeler[secim]
        elif secim in SEVIYEYE_GORE_KELIMELER:
            return secim
        else:
            print("❌ Geçersiz seçim! Lütfen '1', '2', '3' veya 'kolay', 'orta', 'zor' yazın.")


def tur_oyna(seviye: str) -> int:
    """
    Tek bir oyun turunu çalıştırır.
    
    :param seviye: Seçilen zorluk seviyesi.
    :return: Kazanılan puan (Doğruysa SEVIYE_PUANLARI[seviye], yanlışsa 0).
    """
    # Seviyeye uygun rastgele kelime seçimi
    kelime_havuzu = SEVIYEYE_GORE_KELIMELER[seviye]
    turkce_kelime = random.choice(kelime_havuzu)
    
    # Kelimenin doğru çevirilerini al
    dogru_ceviriler = kelime_ceviri_al(turkce_kelime)
    
    print("\n" + "="*50)
    print(f"📌 SORU: '{turkce_kelime.upper()}' kelimesinin İngilizcesi nedir?")
    print("="*50)
    input("👉 Mikrofona konuşmaya hazır olduğunuzda ENTER tuşuna basın...")

    # 1. Ses kaydı al (4 saniye)
    wav_path = ses_kaydet(sure=4)
    
    if not wav_path:
        print("❌ Ses kaydı alınamadı. Tur geçiliyor.")
        return 0

    # 2. Sesten metne dönüştür ve geçici dosyayı sil (try/finally garantisi ile)
    try:
        algilanan_metin, hata_mesaji = sesten_metne_cevir(wav_path)
    finally:
        gecici_dosya_sil(wav_path)

    # 3. Sonuçların Değerlendirilmesi
    if hata_mesaji:
        print(f"\n❌ TELAFUZ ALGILANAMADI: {hata_mesaji}")
        print(f"💡 Doğru İngilizce Telaffuz/Çeviri: {', '.join([c.capitalize() for c in dogru_ceviriler])}")
        return 0

    print(f"🎧 Algılanan Telaffuzunuz: '{algilanan_metin.capitalize()}'")

    # Karşılaştırma (Büyük/küçük harf duyarsız .lower())
    if algilanan_metin in dogru_ceviriler:
        kazanilan_puan = SEVIYE_PUANLARI[seviye]
        print(f"\n🎉 TEBRİKLER! TELAFUZ DOĞRU! ✅")
        print(f"➕ Kazandığınız Puan: +{kazanilan_puan}")
        return kazanilan_puan
    else:
        print(f"\n❌ MAALESEF YANLIŞ VEYA EKSİK TELAFUZ!")
        print(f"🗣️  Sizin Söylediğiniz : {algilanan_metin.capitalize()}")
        print(f"💡 Beklenen Çeviri(ler): {', '.join([c.capitalize() for c in dogru_ceviriler])}")
        return 0


def ana_oyun_dongusu():
    """
    Doğru Konuş (Speak Right) ana oyun döngüsü ve menü yönetimi.
    """
    print("\n" + "🎓"*25)
    print("   DOĞRU KONUŞ (SPEAK RIGHT) - İNGİLİZCE TELAFFUZ OYUNU")
    print("🎓"*25)
    print("İngilizce kelime telaffuzunuzu geliştirin ve puanları toplayın!\n")

    toplam_puan = 0
    toplam_soru = 0
    dogru_cevap = 0

    mevcut_seviye = zorluk_seviyesi_sec()
    print(f"\n✅ Seçilen Zorluk Seviyesi: {mevcut_seviye.upper()}")

    while True:
        print("\n" + "-"*40)
        print(f"📊 Mevcut Skor: {toplam_puan} Puan | Doğru: {dogru_cevap}/{toplam_soru} | Seviye: {mevcut_seviye.upper()}")
        print("-"*40)
        print("1. Yeni Kelime İle Oyna")
        print("2. Zorluk Seviyesini Değiştir")
        print("3. Çıkış Ve Özet Gör")

        secim = input("\nSeçiminiz (1-3): ").strip()

        if secim == "1":
            toplam_soru += 1
            puan = tur_oyna(mevcut_seviye)
            toplam_puan += puan
            if puan > 0:
                dogru_cevap += 1
        elif secim == "2":
            mevcut_seviye = zorluk_seviyesi_sec()
            print(f"\n✅ Yeni Zorluk Seviyesi: {mevcut_seviye.upper()}")
        elif secim == "3":
            print("\n" + "🏁"*20)
            print("OYUN SONLANDIRILDI - PERFORMANS ÖZETİ")
            print("🏁"*20)
            print(f"🎯 Toplam Soru Sayısı  : {toplam_soru}")
            print(f"✅ Doğru Telaffuz Sayısı: {dogru_cevap}")
            if toplam_soru > 0:
                basari_orani = (dogru_cevap / toplam_soru) * 100
                print(f"📈 Başarı Oranı        : %{basari_orani:.1f}")
            print(f"🏆 Toplam Puan         : {toplam_puan}")
            print("\nDoğru Konuş (Speak Right) uygulamasını kullandığınız için teşekkür ederiz! 👋\n")
            break
        else:
            print("❌ Geçersiz seçim! Lütfen 1, 2 veya 3 yazın.")


if __name__ == "__main__":
    try:
        ana_oyun_dongusu()
    except KeyboardInterrupt:
        print("\n\n👋 Oyundan çıkıldı. İyi günler!")
        sys.exit(0)
