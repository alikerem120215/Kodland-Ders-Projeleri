/**
 * Gemini Vox Main Application Controller
 * Handles Speech-to-Text (Push to Talk), Gemini API Calls,
 * pyttsx3 Audio Playback, Web Audio Analyser, and Settings.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const orbCanvas = document.getElementById('orbCanvas');
  const btnPushToTalk = document.getElementById('btnPushToTalk');
  const liveTranscript = document.getElementById('liveTranscript');
  const audioWaveBars = document.getElementById('audioWaveBars');
  const statusPill = document.getElementById('statusPill');
  const statusText = document.getElementById('statusText');
  const micStateLabel = document.getElementById('micStateLabel');
  const modelBadge = document.getElementById('modelBadge');
  const activeModelLabel = document.getElementById('activeModelLabel');
  
  // Response HUD
  const responseBubble = document.getElementById('responseBubble');
  const responseText = document.getElementById('responseText');
  const btnReplayLast = document.getElementById('btnReplayLast');
  
  // Manual Input Fallback
  const manualInput = document.getElementById('manualInput');
  const btnSendText = document.getElementById('btnSendText');

  // History Drawer
  const chatDrawer = document.getElementById('chatDrawer');
  const btnToggleHistory = document.getElementById('btnToggleHistory');
  const btnCloseDrawer = document.getElementById('btnCloseDrawer');
  const btnClearHistory = document.getElementById('btnClearHistory');
  const drawerMessages = document.getElementById('drawerMessages');
  const historyCount = document.getElementById('historyCount');

  // Settings Modal
  const settingsModal = document.getElementById('settingsModal');
  const btnOpenSettings = document.getElementById('btnOpenSettings');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const inputApiKey = document.getElementById('inputApiKey');
  const btnToggleKeyVisibility = document.getElementById('btnToggleKeyVisibility');
  const speechSpeedSlider = document.getElementById('speechSpeedSlider');
  const speedValueLabel = document.getElementById('speedValueLabel');
  const btnTestVoice = document.getElementById('btnTestVoice');

  // Audio Player
  const ttsAudioPlayer = document.getElementById('ttsAudioPlayer');

  // Initialize Visualizer
  const visualizer = new OrbVisualizer('orbCanvas');

  // App State
  let currentState = 'idle'; // 'idle', 'listening', 'thinking', 'speaking'
  let recognition = null;
  let isRecording = false;
  let recognizedText = '';
  let conversationHistory = [];
  let lastAudioUrl = null;
  let audioContext = null;
  let audioSourceNode = null;
  let analyserNode = null;
  let isAudioConnected = false;

  // Fixed Model: Gemini 3.5 Flash Lite
  const currentModel = 'gemini-3.5-flash-lite';
  let apiKey = localStorage.getItem('gemini_vox_api_key') || '';
  let speechRate = parseInt(localStorage.getItem('gemini_vox_speech_rate') || '175', 10);

  // Initialize UI Values
  inputApiKey.value = apiKey;
  activeModelLabel.textContent = currentModel;
  speechSpeedSlider.value = speechRate;
  speedValueLabel.textContent = speechRate;

  // If no API key is set, automatically open Settings Modal on first visit
  if (!apiKey) {
    setTimeout(() => {
      openSettingsModal();
    }, 600);
  }

  // Web Audio Context Setup (Lazy-loaded on first user gesture)
  function initAudioContext() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioCtx();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    if (!isAudioConnected) {
      try {
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 128;
        analyserNode.smoothingTimeConstant = 0.8;
        
        audioSourceNode = audioContext.createMediaElementSource(ttsAudioPlayer);
        audioSourceNode.connect(analyserNode);
        analyserNode.connect(audioContext.destination);
        
        visualizer.setAnalyser(analyserNode);
        isAudioConnected = true;
      } catch (err) {
        console.warn('Audio node connection notice:', err);
      }
    }
  }

  // Set App State & Update Visuals for J.A.R.V.I.S.
  function setAppState(newState) {
    currentState = newState;
    visualizer.setState(newState);

    statusPill.className = `hud-pill status-${newState}`;
    
    switch (newState) {
      case 'listening':
        statusText.textContent = 'DİNLİYORUM, EFENDİM...';
        micStateLabel.textContent = 'DİNLİYORUM, EFENDİM...';
        btnPushToTalk.classList.add('active-recording');
        audioWaveBars.classList.add('active');
        liveTranscript.classList.add('active-speaking');
        break;

      case 'thinking':
        statusText.textContent = 'VERİLER İŞLENİYOR...';
        micStateLabel.textContent = 'J.A.R.V.I.S. ANALİZ EDİYOR...';
        btnPushToTalk.classList.remove('active-recording');
        audioWaveBars.classList.remove('active');
        liveTranscript.classList.remove('active-speaking');
        liveTranscript.innerHTML = '<span class="placeholder-hint">◈ Analiz ediliyor, hemen aktarıyorum efendim...</span>';
        break;

      case 'speaking':
        statusText.textContent = 'J.A.R.V.I.S. DEVREDE';
        micStateLabel.textContent = 'J.A.R.V.I.S. YANITLIYOR...';
        btnPushToTalk.classList.remove('active-recording');
        audioWaveBars.classList.remove('active');
        break;

      case 'idle':
      default:
        statusText.textContent = 'SİSTEM HAZIR, EFENDİM';
        micStateLabel.textContent = 'BASILI TUTUN VE EMREDİN, EFENDİM';
        btnPushToTalk.classList.remove('active-recording');
        audioWaveBars.classList.remove('active');
        liveTranscript.classList.remove('active-speaking');
        if (!recognizedText) {
          liveTranscript.innerHTML = '<span class="placeholder-hint">&gt;&gt; SESLİ BAĞLANTI İÇİN REAKTÖRE BASILI TUTUN...</span>';
        }
        break;
    }
  }

  // Setup Web Speech API (SpeechRecognition)
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'tr-TR';

    recognition.onstart = () => {
      isRecording = true;
      recognizedText = '';
      setAppState('listening');
      liveTranscript.innerHTML = '<span class="placeholder-hint">Konuşun, dinliyorum...</span>';
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      recognizedText = finalTranscript || interimTranscript;
      if (recognizedText) {
        liveTranscript.textContent = `"${recognizedText}"`;
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        alert('Mikrofon erişim izni verilmedi. Lütfen tarayıcı ayarlarından mikrofona izin verin.');
      }
      setAppState('idle');
      isRecording = false;
    };

    recognition.onend = () => {
      if (isRecording) {
        // Recognition stopped unintentionally, finish and send
        finishRecordingAndSend();
      }
    };
  } else {
    console.warn('Web Speech API is not supported in this browser. Fallback input available.');
    liveTranscript.innerHTML = '<span class="placeholder-hint">Tarayıcınızda Web Speech desteklenmiyor. Aşağıdaki kutudan yazabilirsiniz.</span>';
  }

  // Push-to-Talk Logic (Hold to speak)
  function startRecording(e) {
    if (e) e.preventDefault();
    if (currentState === 'speaking') {
      // Stop current playback if speaking
      ttsAudioPlayer.pause();
    }
    if (isRecording) return;
    
    initAudioContext();

    if (!apiKey) {
      openSettingsModal();
      return;
    }

    if (recognition) {
      try {
        recognition.start();
      } catch (err) {
        console.warn('Recognition start caught:', err);
      }
    } else {
      alert('Tarayıcınız ses tanımayı desteklemiyor. Lütfen aşağıdaki metin kutusunu kullanın.');
    }
  }

  function finishRecordingAndSend(e) {
    if (e) e.preventDefault();
    if (!isRecording) return;
    
    isRecording = false;
    if (recognition) {
      try {
        recognition.stop();
      } catch (err) {}
    }

    const query = recognizedText.trim();
    if (query) {
      sendToGemini(query);
    } else {
      setAppState('idle');
      liveTranscript.innerHTML = '<span class="placeholder-hint">Bir şey duyulmadı. Tekrar denemek için basılı tutun.</span>';
    }
  }

  // Button Event Listeners for Push-to-Talk (Mouse & Touch)
  btnPushToTalk.addEventListener('mousedown', startRecording);
  btnPushToTalk.addEventListener('mouseup', finishRecordingAndSend);
  btnPushToTalk.addEventListener('mouseleave', () => {
    if (isRecording) finishRecordingAndSend();
  });

  btnPushToTalk.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startRecording();
  }, { passive: false });

  btnPushToTalk.addEventListener('touchend', (e) => {
    e.preventDefault();
    finishRecordingAndSend();
  }, { passive: false });

  // Manual Text Input Fallback
  btnSendText.addEventListener('click', () => {
    const text = manualInput.value.trim();
    if (text) {
      initAudioContext();
      manualInput.value = '';
      sendToGemini(text);
    }
  });

  manualInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnSendText.click();
    }
  });

  // Send Prompt to Gemini & Synthesize Speech
  async function sendToGemini(userMessage) {
    setAppState('thinking');
    addMessageToDrawer('user', userMessage);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          apiKey: apiKey,
          model: currentModel,
          history: conversationHistory
        })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Gemini ile bağlantı kurulamadı.');
      }

      const reply = data.reply;
      lastAudioUrl = data.audio_url;

      // Add to conversation history
      conversationHistory.push({ role: 'user', text: userMessage });
      conversationHistory.push({ role: 'assistant', text: reply });
      addMessageToDrawer('assistant', reply, lastAudioUrl);

      // Display response in HUD card
      showResponseBubble(reply);

      // Play pyttsx3 synthesized audio
      if (lastAudioUrl) {
        playAudio(lastAudioUrl);
      } else {
        setAppState('idle');
      }

    } catch (error) {
      console.error('Chat error:', error);
      alert(`Hata: ${error.message}`);
      setAppState('idle');
      liveTranscript.innerHTML = `<span style="color:#ff4757">Hata: ${error.message}</span>`;
    }
  }

  // Play Audio with Visualizer Sync
  function playAudio(audioUrl) {
    initAudioContext();
    ttsAudioPlayer.src = audioUrl;
    ttsAudioPlayer.playbackRate = 1.0;

    ttsAudioPlayer.onplay = () => {
      setAppState('speaking');
    };

    ttsAudioPlayer.onended = () => {
      setAppState('idle');
    };

    ttsAudioPlayer.onerror = (e) => {
      console.error('Audio playback error:', e);
      setAppState('idle');
    };

    ttsAudioPlayer.play().catch(err => {
      console.warn('Autoplay blocked or playback error:', err);
      setAppState('idle');
    });
  }

  // Display Response in Bubble HUD
  function showResponseBubble(text) {
    responseBubble.classList.remove('hidden');
    responseText.textContent = '';
    
    // Typewriter effect
    let charIndex = 0;
    const speed = 18; // ms per char
    
    function type() {
      if (charIndex < text.length) {
        responseText.textContent += text.charAt(charIndex);
        charIndex++;
        setTimeout(type, speed);
      }
    }
    type();
  }

  // Replay Last Response Audio
  btnReplayLast.addEventListener('click', () => {
    if (lastAudioUrl) {
      playAudio(lastAudioUrl);
    }
  });

  // Chat History Drawer Functions
  function addMessageToDrawer(role, text, audioUrl = null) {
    // Remove empty state if present
    const emptyState = drawerMessages.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    
    const content = document.createElement('div');
    content.textContent = text;
    bubble.appendChild(content);

    const meta = document.createElement('div');
    meta.className = 'chat-meta';
    
    const timeSpan = document.createElement('span');
    const now = new Date();
    timeSpan.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    meta.appendChild(timeSpan);

    if (role === 'assistant' && audioUrl) {
      const replayBtn = document.createElement('button');
      replayBtn.className = 'chat-replay-btn';
      replayBtn.innerHTML = '▶ Dinle';
      replayBtn.onclick = () => playAudio(audioUrl);
      meta.appendChild(replayBtn);
    }

    bubble.appendChild(meta);
    drawerMessages.appendChild(bubble);
    drawerMessages.scrollTop = drawerMessages.scrollHeight;

    historyCount.textContent = Math.ceil(conversationHistory.length / 2);
  }

  // Drawer Toggle
  btnToggleHistory.addEventListener('click', () => {
    chatDrawer.classList.toggle('open');
  });

  btnCloseDrawer.addEventListener('click', () => {
    chatDrawer.classList.remove('open');
  });

  btnClearHistory.addEventListener('click', () => {
    if (confirm('Konuşma geçmişi temizlensin mi?')) {
      conversationHistory = [];
      drawerMessages.innerHTML = `
        <div class="empty-state">
          <p>Henüz bir sesli konuşma gerçekleşmedi.</p>
          <span>Aşağıdaki mikrofon tuşuna basılı tutarak konuşabilirsiniz.</span>
        </div>
      `;
      historyCount.textContent = '0';
      responseBubble.classList.add('hidden');
    }
  });

  // Settings Modal Controls
  function openSettingsModal() {
    inputApiKey.value = apiKey;
    settingsModal.classList.remove('hidden');
  }

  function closeSettingsModal() {
    settingsModal.classList.add('hidden');
  }

  btnOpenSettings.addEventListener('click', openSettingsModal);
  btnCloseSettings.addEventListener('click', closeSettingsModal);

  // Toggle API Key Masking
  btnToggleKeyVisibility.addEventListener('click', () => {
    if (inputApiKey.type === 'password') {
      inputApiKey.type = 'text';
      btnToggleKeyVisibility.textContent = '🔒';
    } else {
      inputApiKey.type = 'password';
      btnToggleKeyVisibility.textContent = '👁';
    }
  });

  // Speed Slider
  speechSpeedSlider.addEventListener('input', (e) => {
    speedValueLabel.textContent = e.target.value;
  });

  // Save Settings
  btnSaveSettings.addEventListener('click', () => {
    const key = inputApiKey.value.trim();
    if (!key) {
      alert('Lütfen geçerli bir Gemini API anahtarı girin.');
      return;
    }

    apiKey = key;
    localStorage.setItem('gemini_vox_api_key', apiKey);

    speechRate = parseInt(speechSpeedSlider.value, 10);
    localStorage.setItem('gemini_vox_speech_rate', speechRate.toString());

    closeSettingsModal();
    alert('Ayarlar kaydedildi! Artık mikrofona basılı tutarak konuşabilirsiniz.');
  });

  // Test Voice Button in Modal
  btnTestVoice.addEventListener('click', async () => {
    initAudioContext();
    btnTestVoice.disabled = true;
    btnTestVoice.textContent = 'Oluşturuluyor...';

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Tüm sistemler devrede efendim. Size nasıl yardımcı olabilirim?'
        })
      });
      const d = await res.json();
      if (d.success && d.audio_url) {
        playAudio(d.audio_url);
      } else {
        alert('Ses testi başarısız: ' + (d.error || 'Bilinmeyen hata'));
      }
    } catch (err) {
      alert('Ses oluşturma hatası: ' + err.message);
    } finally {
      btnTestVoice.disabled = false;
      btnTestVoice.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        Sesi Test Et
      `;
    }
  });
});
