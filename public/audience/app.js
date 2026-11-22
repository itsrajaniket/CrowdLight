// CrowdLight — Audience Page Application
// Plain JavaScript, no frameworks, zero external dependencies.
// Frame-accurate synchronized effects computed as pure functions of server time.

// DOM Elements
const lightScreen = document.getElementById('light-screen');
const textOverlay = document.getElementById('text-overlay');
const joinScreen = document.getElementById('join-screen');
const joinBtn = document.getElementById('join-btn');
const statusText = document.getElementById('status-text');

// Client State
let hasJoined = false;
let myId = null;
let myJoinNumber = 0;
let wakeLock = null;
let socket = null;

// Clock Synchronization State (Phase 3)
// serverTime = performance.now() + clockOffset
let clockOffset = 0;
let isSynced = false;
let syncSamples = [];
const TOTAL_SYNC_SAMPLES = 5;

// Scheduling & Animation State
let pendingCommand = null;
let scheduleWaitId = null;
let activeAnimId = null;
let currentCommand = null;

/**
 * Returns estimated server Unix timestamp in milliseconds.
 */
function getServerTime() {
  return performance.now() + clockOffset;
}

// ==========================================
// 1. Color Interpolation & Manipulation Helpers
// ==========================================
function hexToRgb(hex) {
  let clean = (hex || '#000000').replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16) || 0;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function rgbToHex(r, g, b) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${clamp(r)}${clamp(g)}${clamp(b)}`;
}

function lerpColor(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t
  );
}

function scaleBrightness(hex, factor) {
  const c = hexToRgb(hex);
  return rgbToHex(c.r * factor, c.g * factor, c.b * factor);
}

// ==========================================
// 2. Wake Lock Management
// ==========================================
async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('[WakeLock] Screen wake lock active');
      wakeLock.addEventListener('release', () => {
        console.log('[WakeLock] Screen wake lock released');
        wakeLock = null;
      });
    } catch (err) {
      console.warn('[WakeLock] Request failed:', err.message);
    }
  }
}

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && hasJoined && !wakeLock) {
    console.log('[WakeLock] Tab visible again, re-requesting wake lock');
    await requestWakeLock();
  }
});

// ==========================================
// 3. JOIN Button Handler
// ==========================================
joinBtn.addEventListener('click', async () => {
  hasJoined = true;

  // Request fullscreen on Android (safely ignored by iOS Safari)
  try {
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen().catch(() => {});
    }
  } catch (_) {}

  // Request screen Wake Lock so phone doesn't sleep
  await requestWakeLock();

  // Hide join screen overlay
  joinScreen.classList.add('hidden');
});

// ==========================================
// 4. Command Scheduler (Frame-Accurate)
// ==========================================
function scheduleCommand(cmd) {
  if (!cmd || !cmd.name) return;

  const currentServerTime = getServerTime();
  const executeAt = cmd.executeAt || currentServerTime;

  // If clock not synced or executeAt is already in the past, run immediately
  if (!isSynced || executeAt <= currentServerTime) {
    startCommandExecution(cmd);
    return;
  }

  // Cancel prior pending schedule check
  if (scheduleWaitId) {
    cancelAnimationFrame(scheduleWaitId);
    scheduleWaitId = null;
  }

  pendingCommand = cmd;

  function waitLoop() {
    if (!pendingCommand) return;

    const remaining = pendingCommand.executeAt - getServerTime();
    if (remaining <= 0) {
      const toRun = pendingCommand;
      pendingCommand = null;
      scheduleWaitId = null;
      startCommandExecution(toRun);
    } else {
      scheduleWaitId = requestAnimationFrame(waitLoop);
    }
  }

  scheduleWaitId = requestAnimationFrame(waitLoop);
}

// ==========================================
// 5. Effect Execution (Pure Server Time Functions)
// ==========================================
function startCommandExecution(cmd) {
  currentCommand = cmd;

  // Stop any active animated effect loop
  if (activeAnimId) {
    cancelAnimationFrame(activeAnimId);
    activeAnimId = null;
  }

  // Reset text overlay by default
  textOverlay.textContent = '';
  textOverlay.style.color = '#ffffff';

  const params = cmd.params || {};

  switch (cmd.name) {
    case 'COLOR':
      lightScreen.style.backgroundColor = params.hex || '#ffffff';
      break;

    case 'BLACKOUT':
      lightScreen.style.backgroundColor = '#000000';
      break;

    case 'STROBE': {
      const hex = params.hex || '#ffffff';
      const intervalMs = params.intervalMs || 120;

      function renderStrobe() {
        const elapsed = Math.max(0, getServerTime() - cmd.executeAt);
        const phase = (elapsed % intervalMs) / intervalMs;
        // On for first half of interval, off for second half
        lightScreen.style.backgroundColor = (phase < 0.5) ? hex : '#000000';
        activeAnimId = requestAnimationFrame(renderStrobe);
      }
      activeAnimId = requestAnimationFrame(renderStrobe);
      break;
    }

    case 'FADE': {
      const fromHex = params.fromHex || '#000000';
      const toHex = params.toHex || '#ffffff';
      const durationMs = params.durationMs || 2000;

      function renderFade() {
        const elapsed = Math.max(0, getServerTime() - cmd.executeAt);
        const progress = Math.min(1, elapsed / durationMs);
        lightScreen.style.backgroundColor = lerpColor(fromHex, toHex, progress);

        if (progress < 1) {
          activeAnimId = requestAnimationFrame(renderFade);
        } else {
          activeAnimId = null; // Reached target color, stop animation loop to save battery
        }
      }
      activeAnimId = requestAnimationFrame(renderFade);
      break;
    }

    case 'PULSE': {
      const hex = params.hex || '#ffffff';
      const bpm = params.bpm || 120;
      const beatPeriodMs = 60000 / bpm;

      function renderPulse() {
        const elapsed = Math.max(0, getServerTime() - cmd.executeAt);
        const phase = (elapsed % beatPeriodMs) / beatPeriodMs;
        // Sharp beat drop at phase 0, exponential decay
        const brightness = Math.pow(1 - phase, 2.2);
        lightScreen.style.backgroundColor = scaleBrightness(hex, brightness);
        activeAnimId = requestAnimationFrame(renderPulse);
      }
      activeAnimId = requestAnimationFrame(renderPulse);
      break;
    }

    case 'WAVE': {
      // Repeating 10-step ripple: Each phone delays by (joinNumber % 10) * speedMs
      const hex = params.hex || '#3b82f6';
      const speedMs = params.speedMs || 180;
      const totalCycle = 10 * speedMs;
      const stepIndex = myJoinNumber % 10;
      const myOffset = stepIndex * speedMs;
      const waveSpan = speedMs * 1.5;

      function renderWave() {
        const elapsed = Math.max(0, getServerTime() - cmd.executeAt);
        const cyclePos = elapsed % totalCycle;
        const diff = (cyclePos - myOffset + totalCycle) % totalCycle;

        if (diff < waveSpan) {
          const intensity = 1 - (diff / waveSpan);
          lightScreen.style.backgroundColor = scaleBrightness(hex, intensity);
        } else {
          lightScreen.style.backgroundColor = '#000000';
        }
        activeAnimId = requestAnimationFrame(renderWave);
      }
      activeAnimId = requestAnimationFrame(renderWave);
      break;
    }

    case 'COUNTDOWN': {
      const from = parseInt(params.from, 10) || 5;

      function renderCountdown() {
        const elapsed = Math.max(0, getServerTime() - cmd.executeAt);
        const secondsPassed = Math.floor(elapsed / 1000);
        const count = from - secondsPassed;
        const subSec = (elapsed % 1000) / 1000;

        if (count > 0) {
          textOverlay.textContent = count;
          textOverlay.style.color = '#ffffff';
          // Background flashes on each second tick
          const flash = Math.max(0, 1 - subSec * 3);
          lightScreen.style.backgroundColor = scaleBrightness('#dc2626', 0.2 + 0.8 * flash);
          activeAnimId = requestAnimationFrame(renderCountdown);
        } else if (count === 0) {
          textOverlay.textContent = 'GO!';
          textOverlay.style.color = '#000000';
          lightScreen.style.backgroundColor = '#ffffff';
          activeAnimId = requestAnimationFrame(renderCountdown);
        } else if (count >= -1) {
          textOverlay.textContent = '🔥';
          lightScreen.style.backgroundColor = '#ffffff';
          activeAnimId = requestAnimationFrame(renderCountdown);
        } else {
          // Finished countdown
          textOverlay.textContent = '';
          lightScreen.style.backgroundColor = '#000000';
          activeAnimId = null;
        }
      }
      activeAnimId = requestAnimationFrame(renderCountdown);
      break;
    }

    case 'TEXT': {
      const text = params.text || '';
      const hex = params.hex || '#ffffff';
      const bgHex = params.bgHex || '#000000';
      lightScreen.style.backgroundColor = bgHex;
      textOverlay.textContent = text;
      textOverlay.style.color = hex;
      break;
    }

    default:
      console.warn('[Command] Unknown effect name:', cmd.name);
  }
}

// ==========================================
// 6. Clock Synchronization (NTP-Style)
// ==========================================
function startClockSync() {
  syncSamples = [];
  sendPing();
}

function sendPing() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const t0 = performance.now();
  socket.send(JSON.stringify({ type: 'ping', t0 }));
}

function handlePong(msg) {
  const t1 = performance.now();
  const t0 = msg.t0;
  const ts = msg.ts; // Server Unix timestamp

  const rtt = t1 - t0;
  const sampleOffset = ts - (t0 + (rtt / 2));
  syncSamples.push({ rtt, offset: sampleOffset });

  if (syncSamples.length < TOTAL_SYNC_SAMPLES) {
    const delay = 30 + Math.random() * 50;
    setTimeout(sendPing, delay);
  } else {
    // Sort by lowest RTT (least network jitter)
    syncSamples.sort((a, b) => a.rtt - b.rtt);
    const bestSamples = syncSamples.slice(0, 3);
    const avgOffset = bestSamples.reduce((sum, s) => sum + s.offset, 0) / bestSamples.length;

    clockOffset = avgOffset;
    isSynced = true;

    console.log(`[ClockSync] Synced! Best RTT: ${bestSamples[0].rtt.toFixed(1)}ms | Offset: ${clockOffset.toFixed(1)}ms`);

    if (!hasJoined && myJoinNumber) {
      statusText.textContent = `Connected (Device #${myJoinNumber}) • Sync: ±${(bestSamples[0].rtt / 2).toFixed(0)}ms`;
    }
  }
}

// Re-sync every 30 seconds
setInterval(() => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log('[ClockSync] Periodic 30s re-sync starting...');
    startClockSync();
  }
}, 30000);

// ==========================================
// 7. WebSocket Connection (Rule 11: Dynamic URL)
// ==========================================
function connectWebSocket() {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}`;

  console.log('[Audience] Connecting to:', wsUrl);
  socket = new WebSocket(wsUrl);

  socket.addEventListener('open', () => {
    console.log('[Audience] WebSocket open. Sending hello...');
    statusText.textContent = 'Connected. Syncing clock...';

    socket.send(JSON.stringify({
      type: 'hello',
      role: 'audience',
      group: 0
    }));

    startClockSync();
  });

  socket.addEventListener('message', (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch (e) {
      console.warn('[Audience] Non-JSON message received:', event.data);
      return;
    }

    switch (msg.type) {
      case 'pong':
        handlePong(msg);
        break;

      case 'welcome':
        myId = msg.id;
        myJoinNumber = msg.joinNumber || 0;
        console.log(`[Audience] Welcome received. ID: ${myId}, Join #: ${myJoinNumber}`);
        statusText.textContent = `Connected (Device #${myJoinNumber})`;
        break;

      case 'state':
        if (msg.cmd) {
          console.log('[Audience] Catching up to state:', msg.cmd);
          scheduleCommand(msg.cmd);
        }
        break;

      case 'cmd':
        scheduleCommand(msg);
        break;

      default:
        console.log('[Audience] Received message:', msg.type);
    }
  });

  socket.addEventListener('close', () => {
    console.log('[Audience] Connection closed. Reconnecting in 2s...');
    statusText.textContent = 'Disconnected. Reconnecting...';
    socket = null;
    isSynced = false;
    setTimeout(connectWebSocket, 2000);
  });

  socket.addEventListener('error', (err) => {
    console.error('[Audience] WebSocket error:', err);
  });
}

// Start connection on load
connectWebSocket();
