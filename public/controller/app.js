// CrowdLight — Controller Page Application
// Plain JavaScript, no frameworks.
// Manages authentication, sends commands, and provides controls for all Version 1 effects.

// DOM Elements
const pinScreen = document.getElementById('pin-screen');
const pinForm = document.getElementById('pin-form');
const pinInput = document.getElementById('pin-input');
const pinError = document.getElementById('pin-error');
const dashboard = document.getElementById('dashboard');

const connDot = document.getElementById('conn-dot');
const connLabel = document.getElementById('conn-label');
const audienceCountEl = document.getElementById('audience-count');

const statusColorSwatch = document.getElementById('status-color-swatch');
const statusEffectName = document.getElementById('status-effect-name');
const statusEffectDetails = document.getElementById('status-effect-details');

const blackoutBtn = document.getElementById('blackout-btn');
const colorButtons = document.querySelectorAll('.color-btn');
const customColorInput = document.getElementById('custom-color-input');
const customColorHex = document.getElementById('custom-color-hex');
const customColorBtn = document.getElementById('custom-color-btn');

// Effect Controls
const tapTempoBtn = document.getElementById('tap-tempo-btn');
const tapBpmDisplay = document.getElementById('tap-bpm-display');
const bpmSlider = document.getElementById('bpm-slider');
const bpmVal = document.getElementById('bpm-val');
const pulseBtn = document.getElementById('pulse-btn');

const strobeWhiteBtn = document.getElementById('strobe-white-btn');
const strobeColorBtn = document.getElementById('strobe-color-btn');

const waveBlueBtn = document.getElementById('wave-blue-btn');
const waveCustomBtn = document.getElementById('wave-custom-btn');

const fadeBlackToRedBtn = document.getElementById('fade-black-to-red');
const fadeBlueToPinkBtn = document.getElementById('fade-blue-to-pink');
const fadeToBlackBtn = document.getElementById('fade-to-black');

const countdownBtns = document.querySelectorAll('.btn-countdown');

const chipBtns = document.querySelectorAll('.chip-btn');
const customTextInput = document.getElementById('custom-text-input');
const sendTextBtn = document.getElementById('send-text-btn');

// Client State
let socket = null;
let currentPin = sessionStorage.getItem('crowdlight_pin') || '';
let selectedColor = '#ef4444'; // Active selected color
let selectedStrobeSpeed = 80;
let selectedWaveSpeed = 120;
let selectedFadeDuration = 1500;

// Tap-Tempo State
let tapTimes = [];
let currentBpm = 120;

// ==========================================
// 1. PIN & Authentication Handlers
// ==========================================
pinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const enteredPin = pinInput.value.trim();
  if (!enteredPin) return;

  currentPin = enteredPin;
  pinError.textContent = '';

  if (socket && socket.readyState === WebSocket.OPEN) {
    sendHello(currentPin);
  } else {
    connectWebSocket();
  }
});

function sendHello(pin) {
  console.log('[Controller] Authenticating with PIN...');
  socket.send(JSON.stringify({
    type: 'hello',
    role: 'controller',
    pin: pin
  }));
}

// ==========================================
// 2. Dashboard Status Updates
// ==========================================
function updateActiveStatus(cmd) {
  if (!cmd || !cmd.name) {
    statusColorSwatch.style.backgroundColor = '#000000';
    statusEffectName.textContent = 'STANDBY';
    statusEffectDetails.textContent = 'Waiting for first command...';
    return;
  }

  statusEffectName.textContent = cmd.name;
  const p = cmd.params || {};

  switch (cmd.name) {
    case 'COLOR':
      statusColorSwatch.style.backgroundColor = p.hex || '#ffffff';
      statusEffectDetails.textContent = `Solid Color: ${p.hex || '#ffffff'}`;
      break;

    case 'BLACKOUT':
      statusColorSwatch.style.backgroundColor = '#000000';
      statusEffectDetails.textContent = 'Blackout / Screen Off';
      break;

    case 'STROBE':
      statusColorSwatch.style.backgroundColor = p.hex || '#ffffff';
      statusEffectDetails.textContent = `Strobe: ${p.hex} (${p.intervalMs}ms)`;
      break;

    case 'FADE':
      statusColorSwatch.style.backgroundColor = p.toHex || '#ffffff';
      statusEffectDetails.textContent = `Fade ${p.fromHex} → ${p.toHex} (${p.durationMs}ms)`;
      break;

    case 'PULSE':
      statusColorSwatch.style.backgroundColor = p.hex || '#ffffff';
      statusEffectDetails.textContent = `Pulse: ${p.hex} @ ${p.bpm} BPM`;
      break;

    case 'WAVE':
      statusColorSwatch.style.backgroundColor = p.hex || '#3b82f6';
      statusEffectDetails.textContent = `10-Step Wave: ${p.hex} (${p.speedMs}ms/step)`;
      break;

    case 'COUNTDOWN':
      statusColorSwatch.style.backgroundColor = '#dc2626';
      statusEffectDetails.textContent = `Countdown from ${p.from}`;
      break;

    case 'TEXT':
      statusColorSwatch.style.backgroundColor = p.bgHex || '#000000';
      statusEffectDetails.textContent = `Text: "${p.text}"`;
      break;

    default:
      statusEffectDetails.textContent = JSON.stringify(p);
  }
}

// ==========================================
// 3. Command Dispatcher
// ==========================================
function sendCommand(name, params = {}) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    alert('Controller is disconnected from the server.');
    return;
  }

  const payload = {
    type: 'cmd',
    name: name,
    params: params
  };

  console.log('[Controller] Dispatching:', payload);
  socket.send(JSON.stringify(payload));
}

// ==========================================
// 4. Solid Colors & Blackout
// ==========================================
colorButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const hex = btn.getAttribute('data-hex');
    selectedColor = hex;
    sendCommand('COLOR', { hex: hex });
  });
});

blackoutBtn.addEventListener('click', () => {
  sendCommand('BLACKOUT');
});

customColorInput.addEventListener('input', () => {
  customColorHex.textContent = customColorInput.value;
  selectedColor = customColorInput.value;
});

customColorBtn.addEventListener('click', () => {
  sendCommand('COLOR', { hex: customColorInput.value });
});

// ==========================================
// 5. Pulse & Tap-Tempo
// ==========================================
tapTempoBtn.addEventListener('click', () => {
  const now = performance.now();

  // Clear taps older than 2.5 seconds
  tapTimes = tapTimes.filter(t => now - t < 2500);
  tapTimes.push(now);

  if (tapTimes.length >= 2) {
    const diffs = [];
    for (let i = 1; i < tapTimes.length; i++) {
      diffs.push(tapTimes[i] - tapTimes[i - 1]);
    }
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const computedBpm = Math.round(60000 / avgDiff);
    currentBpm = Math.max(50, Math.min(220, computedBpm));

    tapBpmDisplay.textContent = `${currentBpm} BPM`;
    bpmSlider.value = currentBpm;
    bpmVal.textContent = currentBpm;
  }
});

bpmSlider.addEventListener('input', () => {
  currentBpm = parseInt(bpmSlider.value, 10);
  bpmVal.textContent = currentBpm;
  tapBpmDisplay.textContent = `${currentBpm} BPM`;
});

pulseBtn.addEventListener('click', () => {
  sendCommand('PULSE', {
    hex: selectedColor,
    bpm: currentBpm
  });
});

// ==========================================
// 6. Strobe Controls
// ==========================================
document.querySelectorAll('[data-strobe-speed]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-strobe-speed]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedStrobeSpeed = parseInt(btn.getAttribute('data-strobe-speed'), 10);
  });
});

strobeWhiteBtn.addEventListener('click', () => {
  sendCommand('STROBE', { hex: '#ffffff', intervalMs: selectedStrobeSpeed });
});

strobeColorBtn.addEventListener('click', () => {
  sendCommand('STROBE', { hex: selectedColor, intervalMs: selectedStrobeSpeed });
});

// ==========================================
// 7. Wave (Ripple) Controls
// ==========================================
document.querySelectorAll('[data-wave-speed]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-wave-speed]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedWaveSpeed = parseInt(btn.getAttribute('data-wave-speed'), 10);
  });
});

waveBlueBtn.addEventListener('click', () => {
  sendCommand('WAVE', { hex: '#3b82f6', speedMs: selectedWaveSpeed });
});

waveCustomBtn.addEventListener('click', () => {
  sendCommand('WAVE', { hex: selectedColor, speedMs: selectedWaveSpeed });
});

// ==========================================
// 8. Smooth Fade Controls
// ==========================================
document.querySelectorAll('[data-fade-duration]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-fade-duration]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedFadeDuration = parseInt(btn.getAttribute('data-fade-duration'), 10);
  });
});

fadeBlackToRedBtn.addEventListener('click', () => {
  sendCommand('FADE', { fromHex: '#000000', toHex: '#ef4444', durationMs: selectedFadeDuration });
});

fadeBlueToPinkBtn.addEventListener('click', () => {
  sendCommand('FADE', { fromHex: '#3b82f6', toHex: '#ec4899', durationMs: selectedFadeDuration });
});

fadeToBlackBtn.addEventListener('click', () => {
  sendCommand('FADE', { fromHex: selectedColor, toHex: '#000000', durationMs: selectedFadeDuration });
});

// ==========================================
// 9. Countdown Controls
// ==========================================
countdownBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const from = parseInt(btn.getAttribute('data-from'), 10) || 5;
    sendCommand('COUNTDOWN', { from: from });
  });
});

// ==========================================
// 10. Text Banner Controls
// ==========================================
chipBtns.forEach(chip => {
  chip.addEventListener('click', () => {
    const text = chip.getAttribute('data-text');
    sendCommand('TEXT', { text: text, hex: '#ffffff', bgHex: '#000000' });
  });
});

sendTextBtn.addEventListener('click', () => {
  const text = customTextInput.value.trim();
  if (text) {
    sendCommand('TEXT', { text: text, hex: '#ffffff', bgHex: '#000000' });
  }
});

customTextInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    sendTextBtn.click();
  }
});

// ==========================================
// 11. WebSocket Connection (Rule 11: Dynamic URL)
// ==========================================
function connectWebSocket() {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}`;

  console.log('[Controller] Connecting to:', wsUrl);
  socket = new WebSocket(wsUrl);

  socket.addEventListener('open', () => {
    console.log('[Controller] WebSocket open.');
    connDot.className = 'dot connected';
    connLabel.textContent = 'Connected';

    if (currentPin) {
      sendHello(currentPin);
    }
  });

  socket.addEventListener('message', (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch (e) {
      console.warn('[Controller] Non-JSON message received:', event.data);
      return;
    }

    switch (msg.type) {
      case 'welcome':
        console.log('[Controller] Authenticated successfully!');
        sessionStorage.setItem('crowdlight_pin', currentPin);
        pinScreen.classList.add('hidden');
        dashboard.classList.remove('hidden');
        pinError.textContent = '';
        break;

      case 'error':
        console.warn('[Controller] Server error:', msg.message);
        pinError.textContent = msg.message;
        pinScreen.classList.remove('hidden');
        dashboard.classList.add('hidden');
        sessionStorage.removeItem('crowdlight_pin');
        break;

      case 'stats':
        audienceCountEl.textContent = msg.count;
        break;

      case 'state':
        updateActiveStatus(msg.cmd);
        break;

      case 'cmd':
        updateActiveStatus(msg);
        break;

      default:
        console.log('[Controller] Received:', msg);
    }
  });

  socket.addEventListener('close', () => {
    console.log('[Controller] Disconnected. Reconnecting in 2s...');
    connDot.className = 'dot disconnected';
    connLabel.textContent = 'Disconnected';
    setTimeout(connectWebSocket, 2000);
  });

  socket.addEventListener('error', (err) => {
    console.error('[Controller] WebSocket error:', err);
  });
}

// Start connection on load
connectWebSocket();
