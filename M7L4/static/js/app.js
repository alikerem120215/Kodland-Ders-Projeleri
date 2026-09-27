/**
 * Doğru Konuş (Speak Right) - Gemini 2.5 Flash & Duolingo Client Application
 * AI Language Coach & Multi-Mode Audio Engine
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- GAMIFICATION & ENGINE STATE ---
    let hearts = 5;
    let streak = 0;
    let xp = 0;

    let currentLevel = 'kolay';
    let requestedMode = 'mixed';
    let activeMode = 'speak'; // speak | write | choice | listen

    let currentWord = '';
    let primaryTranslation = '';
    let currentOptions = [];
    let wordPoints = 10;

    let currentAiExampleSentence = '';
    let currentAiSentenceTr = '';

    let isRecording = false;
    let audioContext = null;
    let mediaStream = null;
    let audioProcessor = null;
    let pcmSamples = [];
    let countdownInterval = null;

    // --- DOM ELEMENTS ---
    const heartsCountEl = document.getElementById('hearts-count');
    const heartsBadge = document.querySelector('.stat-badge.hearts');
    const streakCountEl = document.getElementById('streak-count');
    const xpTextEl = document.getElementById('xp-text');
    const xpFillEl = document.getElementById('xp-fill');

    // API Key DOM Elements
    const apiKeyBtn = document.getElementById('api-key-btn');
    const apiKeyStatusEl = document.getElementById('api-key-status');
    const apiKeyModal = document.getElementById('apikey-modal');
    const apiKeyInput = document.getElementById('api-key-input');
    const toggleKeyVisibilityBtn = document.getElementById('toggle-key-visibility-btn');
    const eyeIcon = document.getElementById('eye-icon');
    const modalAlertBox = document.getElementById('modal-alert-box');
    const modalAlertIcon = document.getElementById('modal-alert-icon');
    const modalAlertMsg = document.getElementById('modal-alert-msg');
    const saveKeyBtn = document.getElementById('save-key-btn');
    const clearKeyBtn = document.getElementById('clear-key-btn');
    const closeKeyModalBtn = document.getElementById('close-key-modal-btn');

    const diffPills = document.querySelectorAll('.diff-pill');
    const modeTabs = document.querySelectorAll('.mode-tab');
    const exerciseTypeBadge = document.getElementById('exercise-type-badge');
    const ttsBtn = document.getElementById('tts-btn');

    const promptTextEl = document.getElementById('prompt-text');
    const targetWordEl = document.getElementById('target-word');

    // Gemini AI Card Elements
    const aiExampleSentenceEl = document.getElementById('ai-example-sentence');
    const aiSentenceTrEl = document.getElementById('ai-sentence-tr');
    const aiTipTextEl = document.getElementById('ai-tip-text');
    const aiSpeakSentenceBtn = document.getElementById('ai-speak-sentence-btn');

    // Exercise Containers
    const containerSpeak = document.getElementById('container-speak');
    const containerWrite = document.getElementById('container-write');
    const containerChoice = document.getElementById('container-choice');
    const containerListen = document.getElementById('container-listen');

    // Inputs & Buttons
    const micBtn = document.getElementById('mic-btn');
    const micIcon = document.getElementById('mic-icon');
    const waveformBox = document.getElementById('waveform-box');
    const statusText = document.getElementById('status-text');
    const timerBadge = document.getElementById('timer-badge');

    const typeInput = document.getElementById('type-input');
    const submitTypeBtn = document.getElementById('submit-type-btn');

    const optionsGrid = document.getElementById('options-grid');

    const bigListenBtn = document.getElementById('big-listen-btn');
    const listenInput = document.getElementById('listen-input');
    const submitListenBtn = document.getElementById('submit-listen-btn');

    // Bottom Banner & Modal
    const bottomBanner = document.getElementById('bottom-banner');
    const bannerIconBox = document.getElementById('banner-icon-box');
    const bannerTitle = document.getElementById('banner-title');
    const bannerDesc = document.getElementById('banner-desc');
    const aiFeedbackBadge = document.getElementById('ai-feedback-badge');
    const aiFeedbackTextEl = document.getElementById('ai-feedback-text');
    const continueBtn = document.getElementById('continue-btn');

    const gameoverModal = document.getElementById('gameover-modal');
    const finalXpEl = document.getElementById('final-xp');
    const finalStreakEl = document.getElementById('final-streak');
    const restartBtn = document.getElementById('restart-btn');

    // --- API KEY HELPER & STATE ---
    function getStoredApiKey() {
        return localStorage.getItem('gemini_api_key') || '';
    }

    function getApiKeyHeaders() {
        const key = getStoredApiKey();
        const headers = {};
        if (key) {
            headers['X-Gemini-API-Key'] = key;
        }
        return headers;
    }

    function updateApiKeyBadgeUI() {
        const key = getStoredApiKey();
        if (key) {
            apiKeyStatusEl.textContent = 'API Key: Aktif 🔑';
            apiKeyBtn.classList.add('active');
        } else {
            apiKeyStatusEl.textContent = 'API Key Gir 🔑';
            apiKeyBtn.classList.remove('active');
        }
    }

    function showModalAlert(type, message) {
        modalAlertBox.className = `modal-alert ${type}`;
        modalAlertIcon.className = type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-triangle-exclamation';
        modalAlertMsg.textContent = message;
        modalAlertBox.classList.remove('hidden');
    }

    function hideModalAlert() {
        modalAlertBox.classList.add('hidden');
    }

    // --- INITIALIZATION ---
    updateApiKeyBadgeUI();
    fetchNewQuestion();

    // --- API KEY MODAL EVENT LISTENERS ---
    apiKeyBtn.addEventListener('click', () => {
        apiKeyInput.value = getStoredApiKey();
        hideModalAlert();
        apiKeyModal.classList.remove('hidden');
    });

    closeKeyModalBtn.addEventListener('click', () => {
        apiKeyModal.classList.add('hidden');
    });

    apiKeyModal.addEventListener('click', (e) => {
        if (e.target === apiKeyModal) {
            apiKeyModal.classList.add('hidden');
        }
    });

    toggleKeyVisibilityBtn.addEventListener('click', () => {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            eyeIcon.className = 'fa-solid fa-eye-slash';
        } else {
            apiKeyInput.type = 'password';
            eyeIcon.className = 'fa-solid fa-eye';
        }
    });

    saveKeyBtn.addEventListener('click', async () => {
        const inputKey = apiKeyInput.value.trim();
        if (!inputKey) {
            showModalAlert('error', 'Lütfen geçerli bir API Key girin.');
            return;
        }

        saveKeyBtn.disabled = true;
        saveKeyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Test Ediliyor...';

        try {
            const res = await fetch('/api/verify-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: inputKey })
            });

            const data = await res.json();

            if (res.ok && data.status === 'success') {
                localStorage.setItem('gemini_api_key', inputKey);
                updateApiKeyBadgeUI();
                showModalAlert('success', data.message || 'API Key başarıyla doğrulandı ve kaydedildi!');
                
                // Mevcut kelimenin AI koç bilgilerini yenile
                if (currentWord && primaryTranslation) {
                    fetchGeminiAiInfo(currentWord, primaryTranslation);
                }
            } else {
                showModalAlert('error', data.message || 'API Key doğrulanamadı.');
            }
        } catch (err) {
            console.error('API Key doğrulama hatası:', err);
            showModalAlert('error', 'Sunucu ile iletişim kurulamadı.');
        } finally {
            saveKeyBtn.disabled = false;
            saveKeyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Test Et & Kaydet';
        }
    });

    clearKeyBtn.addEventListener('click', () => {
        localStorage.removeItem('gemini_api_key');
        apiKeyInput.value = '';
        updateApiKeyBadgeUI();
        showModalAlert('success', 'API Key temizlendi. Sistem varsayılan modda çalışacak.');
        if (currentWord && primaryTranslation) {
            fetchGeminiAiInfo(currentWord, primaryTranslation);
        }
    });

    // --- OTHER EVENT LISTENERS ---
    diffPills.forEach(pill => {
        pill.addEventListener('click', () => {
            diffPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentLevel = pill.dataset.level;
            fetchNewQuestion();
        });
    });

    modeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            modeTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            requestedMode = tab.dataset.mode;
            fetchNewQuestion();
        });
    });

    // TTS Word Play
    ttsBtn.addEventListener('click', () => {
        if (primaryTranslation) {
            speakEnglishWord(primaryTranslation);
        }
    });

    // Gemini AI Example Sentence Play
    aiSpeakSentenceBtn.addEventListener('click', () => {
        if (currentAiExampleSentence) {
            speakEnglishWord(currentAiExampleSentence);
        }
    });

    // Speak Mode Mic Button
    micBtn.addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    // Write Mode Submit
    submitTypeBtn.addEventListener('click', () => {
        const userText = typeInput.value.trim();
        if (userText) {
            evaluateTextAnswer(userText);
        }
    });

    typeInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter' && typeInput.value.trim()) {
            evaluateTextAnswer(typeInput.value.trim());
        }
    });

    // Listen Mode Controls
    bigListenBtn.addEventListener('click', () => {
        if (primaryTranslation) {
            speakEnglishWord(primaryTranslation);
        }
    });

    submitListenBtn.addEventListener('click', () => {
        const userText = listenInput.value.trim();
        if (userText) {
            evaluateTextAnswer(userText);
        }
    });

    listenInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter' && listenInput.value.trim()) {
            evaluateTextAnswer(listenInput.value.trim());
        }
    });

    // Continue Button
    continueBtn.addEventListener('click', () => {
        bottomBanner.classList.add('hidden');
        if (hearts <= 0) {
            showGameOverModal();
        } else {
            fetchNewQuestion();
        }
    });

    // Restart Button
    restartBtn.addEventListener('click', () => {
        hearts = 5;
        streak = 0;
        xp = 0;
        updateGamificationUI();
        gameoverModal.classList.add('hidden');
        fetchNewQuestion();
    });

    // --- FETCH QUESTION & GEMINI AI DATA ---
    async function fetchNewQuestion() {
        try {
            targetWordEl.textContent = 'Yükleniyor...';
            typeInput.value = '';
            listenInput.value = '';
            bottomBanner.classList.add('hidden');

            const response = await fetch(`/api/word?level=${currentLevel}&mode=${requestedMode}`);
            const data = await response.json();

            if (data.status === 'success') {
                currentWord = data.word;
                activeMode = data.mode;
                primaryTranslation = data.primary_translation;
                currentOptions = data.options || [];
                wordPoints = data.points_reward;

                renderExerciseUI();

                // Gemini AI Dil Koçu Bilgilerini Çek
                fetchGeminiAiInfo(currentWord, primaryTranslation);
            }
        } catch (err) {
            console.error('Soru yükleme hatası:', err);
            targetWordEl.textContent = 'Bağlantı Hatası!';
        }
    }

    async function fetchGeminiAiInfo(word, english) {
        try {
            aiExampleSentenceEl.textContent = 'Gemini AI örnek cümle hazırlıyor...';
            aiSentenceTrEl.textContent = '...';
            aiTipTextEl.textContent = 'Telaffuz ipucu yükleniyor...';

            const res = await fetch(`/api/gemini/word-info?word=${encodeURIComponent(word)}&english=${encodeURIComponent(english)}`, {
                headers: getApiKeyHeaders()
            });
            const data = await res.json();

            if (data.status === 'success' && data.ai) {
                currentAiExampleSentence = data.ai.example_sentence || `I like the word ${english}.`;
                currentAiSentenceTr = data.ai.sentence_tr || `İngilizce '${english}' kelimesini seviyorum.`;

                aiExampleSentenceEl.textContent = `"${currentAiExampleSentence}"`;
                aiSentenceTrEl.textContent = currentAiSentenceTr;
                aiTipTextEl.textContent = data.ai.pronunciation_tip || `'${english}' kelimesini net telaffuz edin.`;
            }
        } catch (err) {
            console.error('Gemini AI bilgi çekme hatası:', err);
            aiExampleSentenceEl.textContent = `"${english.capitalize()} is an important word."`;
            aiSentenceTrEl.textContent = `'${english.capitalize()}' önemli bir kelimedir.`;
            aiTipTextEl.textContent = `'${english.capitalize()}' kelimesini dikkatli söyleyin.`;
        }
    }

    function renderExerciseUI() {
        containerSpeak.classList.add('hidden');
        containerWrite.classList.add('hidden');
        containerChoice.classList.add('hidden');
        containerListen.classList.add('hidden');

        targetWordEl.textContent = currentWord;

        if (activeMode === 'speak') {
            exerciseTypeBadge.innerHTML = '<i class="fa-solid fa-microphone"></i> TELAFFUZ ET (SPEAK)';
            promptTextEl.textContent = 'Bu kelimenin İngilizce karşılığını mikrofona konuşun:';
            containerSpeak.classList.remove('hidden');
        } else if (activeMode === 'write') {
            exerciseTypeBadge.innerHTML = '<i class="fa-solid fa-pen-keyboard"></i> YAZMA (WRITE)';
            promptTextEl.textContent = 'Bu Türkçe kelimenin İngilizce çevirisini yazın:';
            containerWrite.classList.remove('hidden');
            setTimeout(() => typeInput.focus(), 100);
        } else if (activeMode === 'choice') {
            exerciseTypeBadge.innerHTML = '<i class="fa-solid fa-list-check"></i> ÇOKTAN SEÇMELİ (CHOICE)';
            promptTextEl.textContent = 'Doğru İngilizce çeviriyi seçin:';
            renderChoiceOptions(currentOptions);
            containerChoice.classList.remove('hidden');
        } else if (activeMode === 'listen') {
            exerciseTypeBadge.innerHTML = '<i class="fa-solid fa-headphones"></i> DİNLE VE YAZ (LISTEN)';
            promptTextEl.textContent = 'Ses butonuna basarak dinleyin ve İngilizce yazın:';
            targetWordEl.textContent = '🔊 ???';
            containerListen.classList.remove('hidden');
            setTimeout(() => listenInput.focus(), 100);
            speakEnglishWord(primaryTranslation);
        }
    }

    function renderChoiceOptions(options) {
        optionsGrid.innerHTML = '';
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'option-card';
            btn.textContent = capitalize(opt);
            btn.addEventListener('click', () => evaluateTextAnswer(opt));
            optionsGrid.appendChild(btn);
        });
    }

    // --- EVALUATION & GEMINI FEEDBACK ---
    async function evaluateTextAnswer(userText) {
        try {
            const headers = { 'Content-Type': 'application/json', ...getApiKeyHeaders() };
            const response = await fetch('/api/evaluate-text', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    word: currentWord,
                    user_text: userText,
                    level: currentLevel
                })
            });

            const data = await response.json();
            handleResult(data);
        } catch (err) {
            console.error('Doğrulama hatası:', err);
        }
    }

    async function uploadAndEvaluateSpeech(wavBlob) {
        const formData = new FormData();
        formData.append('audio', wavBlob, 'speech.wav');
        formData.append('word', currentWord);
        formData.append('level', currentLevel);

        try {
            const response = await fetch('/api/evaluate', {
                method: 'POST',
                headers: getApiKeyHeaders(),
                body: formData
            });

            const data = await response.json();
            handleResult(data);
        } catch (err) {
            console.error('Ses değerlendirme hatası:', err);
            statusText.textContent = 'Sunucuya ulaşılamadı!';
        }
    }


    function handleResult(data) {
        if (data.is_correct) {
            streak++;
            xp += data.points || wordPoints;

            bannerIconBox.innerHTML = '<i class="fa-solid fa-check"></i>';
            bottomBanner.className = 'bottom-banner correct';
            bannerTitle.textContent = 'TEBRİKLER! 🎉';
            bannerDesc.textContent = `Doğru Cevap! +${data.points || wordPoints} XP Kazanıldı (Seri: 🔥 ${streak})`;

            speakEnglishWord(primaryTranslation);
        } else {
            streak = 0;
            hearts = Math.max(0, hearts - 1);
            heartsBadge.classList.add('shake');
            setTimeout(() => heartsBadge.classList.remove('shake'), 600);

            bannerIconBox.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            bottomBanner.className = 'bottom-banner wrong';
            bannerTitle.textContent = 'ÜZGÜNÜM, MAALESEF YANLIŞ! 💔';
            
            const expected = data.correct_translations ? data.correct_translations.map(capitalize).join(', ') : capitalize(primaryTranslation);
            bannerDesc.textContent = `Doğru Çeviri: ${expected}`;
        }

        if (data.ai_feedback) {
            aiFeedbackTextEl.textContent = data.ai_feedback;
            aiFeedbackBadge.classList.remove('hidden');
        }

        updateGamificationUI();
        bottomBanner.classList.remove('hidden');
    }

    function updateGamificationUI() {
        heartsCountEl.textContent = hearts;
        streakCountEl.textContent = streak;
        xpTextEl.textContent = `${xp} XP`;
        const fillPercent = Math.min(100, (xp % 100));
        xpFillEl.style.width = `${fillPercent}%`;
    }

    function showGameOverModal() {
        finalXpEl.textContent = `${xp} XP`;
        finalStreakEl.textContent = `${streak} 🔥`;
        gameoverModal.classList.remove('hidden');
    }

    // --- WEB SPEECH SYNTHESIS (TTS) ---
    function speakEnglishWord(text) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    }

    // --- SPEAK MODE RECORDING (AUDIO CONTEXT) ---
    async function startRecording() {
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });

            const source = audioContext.createMediaStreamSource(mediaStream);
            audioProcessor = audioContext.createScriptProcessor(4096, 1, 1);
            pcmSamples = [];

            audioProcessor.onaudioprocess = (e) => {
                if (!isRecording) return;
                const inputData = e.inputBuffer.getChannelData(0);
                for (let i = 0; i < inputData.length; i++) {
                    pcmSamples.push(inputData[i]);
                }
            };

            source.connect(audioProcessor);
            audioProcessor.connect(audioContext.destination);

            isRecording = true;
            micBtn.classList.add('recording');
            micIcon.className = 'fa-solid fa-square';
            waveformBox.classList.add('active');
            statusText.textContent = 'Dinleniyor... Konuşun!';
            timerBadge.classList.remove('hidden');

            let timeLeft = 4;
            timerBadge.textContent = `${timeLeft}s`;

            countdownInterval = setInterval(() => {
                timeLeft--;
                if (timeLeft > 0) {
                    timerBadge.textContent = `${timeLeft}s`;
                } else {
                    stopRecording();
                }
            }, 1000);

        } catch (err) {
            console.error('Mikrofon erişim hatası:', err);
            alert('Mikrofona erişilemedi. Lütfen tarayıcınızdan mikrofon izni verin.');
        }
    }

    function stopRecording() {
        if (!isRecording) return;
        isRecording = false;

        clearInterval(countdownInterval);
        timerBadge.classList.add('hidden');

        micBtn.classList.remove('recording');
        micIcon.className = 'fa-solid fa-microphone';
        waveformBox.classList.remove('active');

        if (audioProcessor && audioContext) {
            audioProcessor.disconnect();
            audioContext.close();
        }

        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }

        statusText.textContent = 'Ses işleniyor ve analiz ediliyor...';

        const wavBlob = encodeWavBlob(pcmSamples, 16000);
        uploadAndEvaluateSpeech(wavBlob);
    }

    function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    // --- 16-BIT PCM WAV ENCODER ---
    function encodeWavBlob(samples, sampleRate) {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, samples.length * 2, true);

        let offset = 44;
        for (let i = 0; i < samples.length; i++, offset += 2) {
            let s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        return new Blob([view], { type: 'audio/wav' });
    }

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
});
