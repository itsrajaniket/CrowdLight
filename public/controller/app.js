// CrowdLight — Controller Page Application
// Plain JavaScript, no frameworks.
// Manages authentication, sends commands, and reflects live audience statistics.

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

// Client State
let socket = null;
let currentPin = sessionStorage.getItem('crowdlight_pin') || '';

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

  if (cmd.name === 'COLOR') {
    const hex = (cmd.params && cmd.params.hex) ? cmd.params.hex : '#ffffff';
    statusColorSwatch.style.backgroundColor = hex;
    statusEffectDetails.textContent = `Solid Color: ${hex}`;
  } else if (cmd.name === 'BLACKOUT') {
    statusColorSwatch.style.backgroundColor = '#000000';
    statusEffectDetails.textContent = 'Blackout / Screen Off';
  } else {
    statusEffectDetails.textContent = JSON.stringify(cmd.params || {});
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

  console.log('[Controller] Sending command:', payload);
  socket.send(JSON.stringify(payload));
}

// Preset color buttons
colorButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const hex = btn.getAttribute('data-hex');
    sendCommand('COLOR', { hex: hex });
  });
});

// Blackout button
blackoutBtn.addEventListener('click', () => {
  sendCommand('BLACKOUT');
});

// Custom color picker
customColorInput.addEventListener('input', () => {
  customColorHex.textContent = customColorInput.value;
});

customColorBtn.addEventListener('click', () => {
  sendCommand('COLOR', { hex: customColorInput.value });
});

// ==========================================
// 4. WebSocket Connection (Rule 11: Dynamic URL)
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

    // If we have a saved PIN, authenticate immediately
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
        // If wrong PIN, reveal PIN screen
        pinScreen.classList.remove('hidden');
        dashboard.classList.add('hidden');
        sessionStorage.removeItem('crowdlight_pin');
        break;

      case 'stats':
        console.log('[Controller] Audience stats updated:', msg.count);
        audienceCountEl.textContent = msg.count;
        break;

      case 'state':
        console.log('[Controller] Received show state:', msg.cmd);
        updateActiveStatus(msg.cmd);
        break;

      case 'cmd':
        console.log('[Controller] Active effect broadcast:', msg);
        updateActiveStatus(msg);
        break;

      default:
        console.log('[Controller] Received message:', msg);
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

// Start connection on page load
connectWebSocket();
