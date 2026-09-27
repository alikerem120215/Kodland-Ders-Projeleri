document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const micBtn = document.getElementById("micBtn");
    const statusMessage = document.getElementById("statusMessage");
    const timerDisplay = document.getElementById("timer");
    const visualizer = document.getElementById("visualizer");
    const sourceLangSelect = document.getElementById("sourceLang");
    const targetLangSelect = document.getElementById("targetLang");
    const originalTextDisplay = document.getElementById("originalTextDisplay");
    const translatedTextDisplay = document.getElementById("translatedTextDisplay");
    const targetBadge = document.getElementById("targetBadge");
    const playAudioBtn = document.getElementById("playAudioBtn");
    const audioPlayer = document.getElementById("audioPlayer");
    const copyOriginalBtn = document.getElementById("copyOriginalBtn");
    const copyTranslatedBtn = document.getElementById("copyTranslatedBtn");
    const toggleTextInput = document.getElementById("toggleTextInput");
    const textInputBody = document.getElementById("textInputBody");
    const manualText = document.getElementById("manualText");
    const translateTextBtn = document.getElementById("translateTextBtn");
    const historyList = document.getElementById("historyList");

    let currentAudioUrl = null;
    let isRecording = false;
    let countdownInterval = null;
    const historyData = [];

    // Target Language Selector update badge
    targetLangSelect.addEventListener("change", () => {
        const selectedOption = targetLangSelect.options[targetLangSelect.selectedIndex].text;
        targetBadge.innerHTML = `<i class="fa-solid fa-language"></i> ${selectedOption.split(' ')[1] || selectedOption}`;
    });

    // Toggle Manual Text Accordion
    toggleTextInput.addEventListener("click", () => {
        const isHidden = textInputBody.style.display === "none";
        textInputBody.style.display = isHidden ? "flex" : "none";
        const icon = toggleTextInput.querySelector(".toggle-icon");
        icon.className = isHidden ? "fa-solid fa-chevron-up toggle-icon" : "fa-solid fa-chevron-down toggle-icon";
    });

    // Handle Microphone Click
    micBtn.addEventListener("click", async () => {
        if (isRecording) return;
        startRecordingProcess();
    });

    async function startRecordingProcess() {
        isRecording = true;
        micBtn.classList.add("recording");
        visualizer.classList.add("active");
        statusMessage.textContent = "🎙️ Konuşun... Kayıt alınıyor (5 saniye)";
        statusMessage.style.color = "var(--accent)";
        timerDisplay.style.display = "inline-block";

        let secondsLeft = 5;
        timerDisplay.textContent = `00:0${secondsLeft}`;

        countdownInterval = setInterval(() => {
            secondsLeft--;
            if (secondsLeft >= 0) {
                timerDisplay.textContent = `00:0${secondsLeft}`;
            }
            if (secondsLeft === 0) {
                clearInterval(countdownInterval);
                statusMessage.textContent = "⚙️ Tanımlanıyor ve Çevriliyor...";
                statusMessage.style.color = "var(--primary)";
            }
        }, 1000);

        try {
            const response = await fetch("/api/record-and-translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    duration: 5,
                    source_lang: sourceLangSelect.value,
                    target_lang: targetLangSelect.value
                })
            });

            const data = await response.json();
            stopRecordingState();

            if (data.success) {
                displayResults(data);
                addToHistory(data.original_text, data.translated_text, data.target_name);
            } else {
                statusMessage.textContent = `❌ ${data.error || 'Bir hata oluştu.'}`;
                statusMessage.style.color = "var(--danger)";
            }

        } catch (err) {
            stopRecordingState();
            statusMessage.textContent = "❌ Sunucu bağlantı hatası oluştu.";
            statusMessage.style.color = "var(--danger)";
            console.error(err);
        }
    }

    function stopRecordingState() {
        isRecording = false;
        micBtn.classList.remove("recording");
        visualizer.classList.remove("active");
        timerDisplay.style.display = "none";
        clearInterval(countdownInterval);
    }

    // Handle Manual Text Translation
    translateTextBtn.addEventListener("click", async () => {
        const text = manualText.value.trim();
        if (!text) {
            alert("Lütfen çevrilmesini istediğiniz bir metin girin.");
            return;
        }

        statusMessage.textContent = "⚡ Metin çevriliyor...";
        statusMessage.style.color = "var(--accent)";

        try {
            const response = await fetch("/api/translate-text", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: text,
                    target_lang: targetLangSelect.value
                })
            });

            const data = await response.json();
            if (data.success) {
                displayResults(data);
                addToHistory(data.original_text, data.translated_text, data.target_name);
                statusMessage.textContent = "✅ Metin çevirisi tamamlandı!";
                statusMessage.style.color = "var(--success)";
            } else {
                statusMessage.textContent = `❌ ${data.error}`;
                statusMessage.style.color = "var(--danger)";
            }
        } catch (err) {
            statusMessage.textContent = "❌ Çeviri sırasında bir hata oluştu.";
            statusMessage.style.color = "var(--danger)";
        }
    });

    // Display Results Function
    function displayResults(data) {
        originalTextDisplay.innerHTML = `<p>${escapeHtml(data.original_text)}</p>`;
        translatedTextDisplay.innerHTML = `<p>${escapeHtml(data.translated_text)}</p>`;

        if (data.audio_url) {
            currentAudioUrl = data.audio_url;
            audioPlayer.src = currentAudioUrl;
            playAudioBtn.disabled = false;

            // Auto-play translation audio
            audioPlayer.play().catch(e => console.log("Otomatik oynatma engellendi:", e));
        } else {
            playAudioBtn.disabled = true;
        }

        statusMessage.textContent = "✅ Çeviri tamamlandı!";
        statusMessage.style.color = "var(--success)";
    }

    // Play Audio Button
    playAudioBtn.addEventListener("click", () => {
        if (currentAudioUrl) {
            audioPlayer.play();
        }
    });

    // Copy to Clipboard
    copyOriginalBtn.addEventListener("click", () => {
        const text = originalTextDisplay.innerText;
        if (text && text !== "Henüz ses kaydı alınmadı...") {
            navigator.clipboard.writeText(text);
            showCopyFeedback(copyOriginalBtn);
        }
    });

    copyTranslatedBtn.addEventListener("click", () => {
        const text = translatedTextDisplay.innerText;
        if (text && text !== "Çeviri sonucu burada görünecek...") {
            navigator.clipboard.writeText(text);
            showCopyFeedback(copyTranslatedBtn);
        }
    });

    function showCopyFeedback(button) {
        const originalIcon = button.innerHTML;
        button.innerHTML = '<i class="fa-solid fa-check" style="color: var(--success);"></i>';
        setTimeout(() => {
            button.innerHTML = originalIcon;
        }, 1500);
    }

    // History Functionality
    function addToHistory(original, translated, targetName) {
        historyData.unshift({ original, translated, targetName });

        if (historyList.querySelector(".empty-history")) {
            historyList.innerHTML = "";
        }

        const itemEl = document.createElement("div");
        itemEl.className = "history-item";
        itemEl.innerHTML = `
            <div>
                <div class="orig">🗣️ ${escapeHtml(original)}</div>
                <div class="trans">🌍 (${targetName}): ${escapeHtml(translated)}</div>
            </div>
            <button class="icon-btn history-play-btn" title="Tekrar Dinle">
                <i class="fa-solid fa-volume-low"></i>
            </button>
        `;

        itemEl.querySelector(".history-play-btn").addEventListener("click", () => {
            translatedTextDisplay.innerHTML = `<p>${escapeHtml(translated)}</p>`;
            originalTextDisplay.innerHTML = `<p>${escapeHtml(original)}</p>`;
        });

        historyList.prepend(itemEl);
    }

    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
});
