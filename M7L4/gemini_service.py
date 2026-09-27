"""
Doğru Konuş (Speak Right) - Google Gemini AI Servisi
===================================================
Google Gen AI SDK (gemini-2.5-flash) kullanarak dinamik örnek cümleler,
Türkçe çevirileri, telaffuz püf noktaları ve kişiselleştirilmiş geri bildirimler üretir.
"""

import os
import json
from typing import Dict, Any, Optional, Tuple

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Google Gen AI SDK kontrolü
try:
    from google import genai
    from google.genai import types
    HAS_GENAI_LIB = True
except ImportError:
    HAS_GENAI_LIB = False


MODEL_NAME = "gemini-2.5-flash"

# Yerleşik Akıllı Fallback AI Veritabanı (API Anahtarı olmadığında da kusursuz çalışır)
FALLBACK_AI_DATA = {
    "kedi": {
        "example_sentence": "The cat is sleeping peacefully on the warm sofa.",
        "sentence_tr": "Kedi sıcak kanepede huzurla uyuyor.",
        "pronunciation_tip": "'Cat' kelimesindeki 'a' harfi açık Türkçe 'e-a' arası bir sesle telaffuz edilir."
    },
    "köpek": {
        "example_sentence": "My dog loves to run in the green park every morning.",
        "sentence_tr": "Köpeğim her sabah yeşil parkta koşmayı çok sever.",
        "pronunciation_tip": "'Dog' kelimesindeki 'g' harfi yumuşatılmadan net söylenmelidir."
    },
    "elma": {
        "example_sentence": "She eats a fresh red apple for breakfast every day.",
        "sentence_tr": "O her gün kahvaltıda taze kırmızı bir elma yer.",
        "pronunciation_tip": "'Apple' okunurken başındaki 'a' harfi vurgulu, sonundaki 'le' ise 'ıl' gibi kısa okunur."
    },
    "süt": {
        "example_sentence": "Drinking warm milk before bed helps you sleep well.",
        "sentence_tr": "Yatmadan önce ılık süt içmek iyi uyumanıza yardımcı olur.",
        "pronunciation_tip": "'Milk' kelimesindeki 'l' harfi koyu (dark L) telaffuz edilir."
    },
    "güneş": {
        "example_sentence": "The sun is shining brightly in the blue sky today.",
        "sentence_tr": "Güneş bugün mavi gökyüzünde parlak bir şekilde parlıyor.",
        "pronunciation_tip": "'Sun' okunurken 'u' harfi kısa 'a' gibi okunur (san)."
    },
    "kitap": {
        "example_sentence": "I am reading an interesting book about history.",
        "sentence_tr": "Tarih hakkında ilginç bir kitap okuyorum.",
        "pronunciation_tip": "'Book' kelimesindeki çift 'oo' kısa 'u' sesi çıkarır."
    },
    "ev": {
        "example_sentence": "Welcome to our new house near the city center.",
        "sentence_tr": "Şehir merkezine yakın yeni evimize hoş geldiniz.",
        "pronunciation_tip": "'House' okunurken 's' sesi alttan nefes vererek yumuşak çıkarılır."
    },
    "su": {
        "example_sentence": "Please drink enough water throughout the hot day.",
        "sentence_tr": "Lütfen sıcak gün boyunca yeterince su için.",
        "pronunciation_tip": "'Water' Amerikan İngilizcesinde 't' harfi hafif 'd' gibi duyulur (wa-der)."
    },
    "muz": {
        "example_sentence": "Monkeys love to eat sweet yellow bananas.",
        "sentence_tr": "Maymunlar tatlı sarı muzları yemeyi çok sever.",
        "pronunciation_tip": "'Banana' kelimesinde vurgu ikinci hecededir (ba-NA-na)."
    },
    "okul": {
        "example_sentence": "Students walk to school together every morning.",
        "sentence_tr": "Öğrenciler her sabah okula birlikte yürürler.",
        "pronunciation_tip": "'School' kelimesindeki 'sch' Türkçedeki 'sk' sesi gibidir."
    },
    "arkadaş": {
        "example_sentence": "A good friend will always support you in difficult times.",
        "sentence_tr": "İyi bir arkadaş zor zamanlarda her zaman sizi destekler.",
        "pronunciation_tip": "'Friend' okunurken 'i' ve 'e' harfleri birleşip tek kısa 'e' sesi verir."
    },
    "pencere": {
        "example_sentence": "Please open the window to let fresh air into the room.",
        "sentence_tr": "Odaya taze hava girmesi için lütfen pencereyi açın.",
        "pronunciation_tip": "'Window' sonundaki 'ow' sesi 'ou' gibi yuvarlatılır."
    },
    "sarı": {
        "example_sentence": "The yellow sunflowers look beautiful in the garden.",
        "sentence_tr": "Bahçedeki sarı ayçiçekleri çok güzel görünüyor.",
        "pronunciation_tip": "'Yellow' başındaki 'y' harfi Türkçe 'y' sesidir."
    },
    "bilgisayar": {
        "example_sentence": "He uses his computer to code innovative web apps.",
        "sentence_tr": "Yenilikçi web uygulamaları kodlamak için bilgisayarını kullanıyor.",
        "pronunciation_tip": "'Computer' kelimesinde vurgu 'pu' hecesindedir (kom-PU-ter)."
    },
    "şehir": {
        "example_sentence": "Istanbul is a vibrant city connecting two continents.",
        "sentence_tr": "İstanbul iki kıtayı bağlayan canlı bir şehirdir.",
        "pronunciation_tip": "'City' kelimesindeki baş 'c' harfi 's' olarak okunur (si-ti)."
    },
    "teknoloji": {
        "example_sentence": "Modern technology changes our lives very fast.",
        "sentence_tr": "Modern teknoloji hayatımızı çok hızlı değiştiriyor.",
        "pronunciation_tip": "'Technology' kelimesinde 'ch' sesi 'k' olarak okunur (tek-nol-o-ji)."
    },
    "üniversite": {
        "example_sentence": "She studies computer science at a famous university.",
        "sentence_tr": "Ünlü bir üniversitede bilgisayar bilimleri okuyor.",
        "pronunciation_tip": "'University' başındaki 'u' harfi 'yu' olarak telaffuz edilir (yu-ni-ver-si-ty)."
    },
    "bilgi": {
        "example_sentence": "Knowledge is power in the modern digital world.",
        "sentence_tr": "Modern dijital dünyada bilgi güçtür.",
        "pronunciation_tip": "'Knowledge' kelimesindeki baş 'k' harfi okunmaz (nol-ic)."
    },
    "telaffuz": {
        "example_sentence": "Clear pronunciation is key to effective English communication.",
        "sentence_tr": "Açık telaffuz, etkili İngilizce iletişiminin anahtarıdır.",
        "pronunciation_tip": "'Pronunciation' kelimesinde vurgu 'nun' hecesindedir (pro-nun-si-ey-şın)."
    },
    "hayal gücü": {
        "example_sentence": "Great artists use their imagination to create masterpiece art.",
        "sentence_tr": "Büyük sanatçılar şaheserler yaratmak için hayal güçlerini kullanırlar.",
        "pronunciation_tip": "'Imagination' kelimesinde 'g' harfi 'c' sesi verir (i-me-ci-ney-şın)."
    },
    "sorumluluk": {
        "example_sentence": "Taking responsibility for your learning brings fast success.",
        "sentence_tr": "Öğreniminizin sorumluluğunu almak hızlı başarı getirir.",
        "pronunciation_tip": "'Responsibility' kelimesinde vurgu 'bi' hecesindedir (res-pon-si-BI-li-ty)."
    }
}


def _get_genai_client(custom_api_key: Optional[str] = None):
    """Gemini Client nesnesi oluşturur."""
    api_key = custom_api_key.strip() if custom_api_key and custom_api_key.strip() else (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))
    if HAS_GENAI_LIB and api_key:
        try:
            return genai.Client(api_key=api_key)
        except Exception as e:
            print(f"⚠️  Gemini Client oluşturma hatası: {e}")
    return None


def verify_gemini_api_key(api_key: str) -> Tuple[bool, str]:
    """
    Girilmiş API Key'in geçerliliğini test etmek için hafif bir deneme çağrısı yapar.
    """
    if not HAS_GENAI_LIB:
        return False, "google-genai kütüphanesi sunucuda kurulu değil."

    if not api_key or not api_key.strip():
        return False, "API Key boş olamaz."

    try:
        client = genai.Client(api_key=api_key.strip())
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents="Test",
            config=types.GenerateContentConfig(max_output_tokens=5)
        )
        if response and response.text is not None:
            return True, "API Key başarıyla doğrulandı! 🎉"
        else:
            return False, "API yanıtı alınamadı."
    except Exception as e:
        err_msg = str(e)
        if "API_KEY_INVALID" in err_msg or "400" in err_msg or "403" in err_msg or "UNAUTHENTICATED" in err_msg:
            return False, "Geçersiz veya yetkisiz API Key. Lütfen kontrol edin."
        return False, f"API Key doğrulama hatası: {err_msg}"


def get_gemini_word_info(turkce_kelime: str, english_word: str, api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Türkçe kelime ve İngilizce karşılığı için Gemini 2.5 Flash ile örnek cümle,
    Türkçe çevirisi ve telaffuz tavsiyesi üretir.
    """
    kelime_clean = turkce_kelime.strip().lower()
    client = _get_genai_client(api_key)

    if client:
        try:
            prompt = f"""
            Sen İngilizce öğreten bir yapay zeka dil koçusun.
            Türkçe Kelime: '{turkce_kelime}'
            İngilizce Çevirisi: '{english_word}'

            Lütfen bu kelime için aşağıdaki bilgileri içeren geçerli bir JSON yanıtı üret:
            1. "example_sentence": İngilizce kelimenin kullanıldığı doğal, anlaşılır bir örnek cümle.
            2. "sentence_tr": Bu İngilizce cümlenin Türkçe çevirisi.
            3. "pronunciation_tip": Türk konuşmacılar için bu İngilizce kelimenin telaffuzunda dikkat edilmesi gereken 1 cümlelik pratik püf nokta.

            Yanıtı SADECE JSON formatında ver, başka açıklama yazma.
            """

            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.3
                )
            )

            if response and response.text:
                data = json.loads(response.text)
                return {
                    "source": "gemini-2.5-flash",
                    "example_sentence": data.get("example_sentence"),
                    "sentence_tr": data.get("sentence_tr"),
                    "pronunciation_tip": data.get("pronunciation_tip")
                }
        except Exception as err:
            print(f"⚠️  Gemini API çağrı hatası ({err}). Fallback verisi kullanılıyor.")

    # Fallback / Yerleşik veritabanı kullanımı
    if kelime_clean in FALLBACK_AI_DATA:
        fb = FALLBACK_AI_DATA[kelime_clean]
        return {
            "source": "fallback-ai",
            "example_sentence": fb["example_sentence"],
            "sentence_tr": fb["sentence_tr"],
            "pronunciation_tip": fb["pronunciation_tip"]
        }

    # Varsayılan şablon
    return {
        "source": "fallback-template",
        "example_sentence": f"I use the word '{english_word}' when speaking English.",
        "sentence_tr": f"İngilizce konuşurken '{english_word}' kelimesini kullanırım.",
        "pronunciation_tip": f"'{english_word}' kelimesini harfleri net şekilde duyulacak biçimde söyleyin."
    }


def get_gemini_feedback(turkce_kelime: str, english_word: str, user_input: str, is_correct: bool, api_key: Optional[str] = None) -> str:
    """
    Kullanıcının verdiği cevaba göre Gemini AI kişiselleştirilmiş 1 cümlelik koçluk dönütü üretir.
    """
    client = _get_genai_client(api_key)

    if client:
        try:
            durum = "doğru" if is_correct else "yanlış"
            prompt = f"""
            Sen sevimli ve motive edici bir İngilizce öğretmenisin.
            Soru Kelimesi: '{turkce_kelime}' (Doğru İngilizce: '{english_word}')
            Öğrencinin Yanıtı: '{user_input}'
            Sonuç: {durum}

            Lütfen öğrenciye 1 cümlelik Türkçe motive edici veya geliştirici bir AI dil koçu önerisi yaz.
            """

            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=prompt
            )

            if response and response.text:
                return response.text.strip()
        except Exception as e:
            print(f"⚠️  Gemini Feedback hatası: {e}")

    if is_correct:
        return f"Harika telaffuz/cevap! '{english_word.capitalize()}' kelimesini mükemmel kullandınız."
    else:
        return f"Üzülmeyin! Doğru karşılık '{english_word.capitalize()}', bir sonraki denemede başaracaksınız."

