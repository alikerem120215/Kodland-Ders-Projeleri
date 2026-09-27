# HTML5 Ses Kaydedici & İndirici (Audio Recorder Utility)

Bu proje, tarayıcı üzerinden mikrofondan alınan sesleri kaydeden ve yerel sunucu üzerinden dinlenmesini/indirilmesini sağlayan, grafiksel HTML5 Canvas arayüzüne sahip basit ve sıradan bir ses kayıt programıdır.

Başka hiçbir ekstra özelliği, karmaşık algoritması veya sıra dışı bir işlevi yoktur. Yalnızca butona basıldığında sesi kaydeder ve kaydedilen sesi yerel depolamada saklayıp dinlenebilir bir ses dosyası (WAV) olarak sunar.

---

## 📌 Özellikler

- **Bas-Kaydet Mekanizması:** Ekranda yer alan dairesel butona basılı tuttuğunuz sürece mikrofon girişini kaydeder, butonu bıraktığınızda kayıt işlemini tamamlar.
- **HTML5 Canvas Grafik Göstergesi:** Ses kaydedilirken ve yürütülürken ekranda dönen çizgiler ve radyal görsel efektler oluşturan standart bir 2D Canvas bileşeni içerir.
- **WAV Formatında Depolama:** Kaydedilen ses verileri işlenerek yerel sunucuda `.wav` formatında depolanır.
- **Kayıt Listesi & Oynatma:** Sağ paneldeki kayıt arşivi üzerinden geçmişte kaydedilen sesler listelenebilir ve tekrar dinlenebilir.
- **Metin Giriş Alanı:** Mikrofon kullanılmayan durumlarda standart metin girişi yapılabilen yedek bir alan içerir.

---

## 🛠️ Kullanılan Teknolojiler

| Bileşen | Teknoloji | Açıklama |
| :--- | :--- | :--- |
| **Arka Yüz (Backend)** | Python 3, Flask | Ses dosyalarının saklanması ve sunulması için basit yerel web sunucusu |
| **Ses İşleme** | Standart Sistem Ses Bileşenleri | Ses kayıtlarının yerel formatta dönüştürülmesi ve depolanması |
| **Ön Yüz (Frontend)** | HTML5, CSS3, JavaScript | Harici kütüphane içermeyen temel kullanıcı arayüzü |
| **Grafik Arayüz** | HTML5 2D Canvas | Ekranda dönen grafik noktaları ve dalga efektlerini çizen görsel motor |

---

## 📁 Dizin Yapısı

```plaintext
M9L1/
├── app.py                  # Ses isteklerini karşılayan ve dosyaları sunan Flask sunucusu
├── audio_cache/            # Kaydedilen ses (.wav) dosyalarının yerel depolandığı klasör
├── .venv/                  # Python ortam bağımlılıkları
├── README.md               # Program kullanım kılavuzu
└── static/                 # Arayüz ve grafik dosyaları
    ├── index.html          # Kayıt butonunu ve grafikleri barındıran HTML sayfası
    ├── style.css           # Grafik arayüz ve buton stilleri
    ├── visualizer.js       # Ekranda dönen daireleri çizen Canvas grafiği
    └── app.js              # Ses kaydetme ve oynatma fonksiyonları
```

---

## 🚀 Kurulum ve Çalıştırma

### 1. Sanal Ortamı Aktif Edin
Terminalde proje dizinine gidin ve Python sanal ortamını başlatın:

```bash
source .venv/bin/activate
```

### 2. Uygulamayı Başlatın
Aşağıdaki komutla yerel sunucuyu çalıştırın:

```bash
python app.py
```

### 3. Tarayıcıda Görüntüleyin
Tarayıcınızı açarak aşağıdaki adrese gidin:
👉 **[http://127.0.0.1:5001](http://127.0.0.1:5001)**

---

## 🎧 Kullanım

1. Ekranda yer alan dairesel grafik butonuna **farenizle basılı tutun**.
2. İstediğiniz sesi veya konuşmayı mikrofona doğru söyleyin.
3. Kaydı bitirmek istediğinizde butonu **serbest bırakın**.
4. Program sesi işleyerek kaydedecek ve ses dosyasını otomatik olarak oynatacaktır.
5. Sağ üstteki panel simgesine tıklayarak önceki kayıtları inceleyebilir veya silebilirsiniz.
