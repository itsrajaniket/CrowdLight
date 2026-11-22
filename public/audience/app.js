// CrowdLight — Audience Page Application
// Plain JavaScript, no external libraries.
// Features: Wake Lock, Fullscreen, Clock Sync (NTP-style offset estimation),
// and frame-accurate scheduled command execution via requestAnimationFrame.

// DOM Elements
const lightScreen = document.getElementById('light-screen');
const joinScreen = document.getElementById('join-screen');
const joinBtn = document.getElementById('join-btn');
const statusText = document.getElementById('status-text');

// Client State
let hasJoined = false;
let myId = null;
let myJoinNumber = null;
let wakeLock = null;
let socket = null;

// Clock Synchronization State (Phase 3)
// Formula: serverTime = performance.now() + clockOffset
let clockOffset = 0;
let isSynced = false;
let syncSamples = [];
const TOTAL_SYNC_SAMPLES = 5;

// Scheduling State
let pendingCommand = null;
let animFrameId = null;

/**
 * Returns current estimated server Unix timestamp in milliseconds.
 * Always derived from performance.now() + clockOffset.
 */
function getServerTime() {
  return performance.now() + clockOffset;
}

// ==========================================
// 1. Wake Lock Management
// ==========================================
async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('[WakeLock] Screen wake lock acquired');
      wakeLock.addEventListener('release', () => {
        console.log('[WakeLock] Screen wake lock released');
        wakeLock = null;
      });
    } catch (err) {
      console.warn('[WakeLock] Request failed:', err.message);
    }
  }
}

// Re-request wake lock when page becomes visible again
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && hasJoined && !wakeLock) {
    console.log('[WakeLock] Tab visible again, re-requesting wake lock');
    await requestWakeLock();
  }
});

// ==========================================
// 2. JOIN Action Handler
// ==========================================
joinBtn.addEventListener('click', async () => {
  hasJoined = true;

  // Request native fullscreen on Android (silently ignored by iOS Safari)
  try {
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen().catch(() => {});
    }
  } catch (_) {}

  // Request screen Wake Lock so phone doesn't sleep
  await requestWakeLock();

  // Hide join screen overlay and reveal full-screen light
  joinScreen.classList.add('hidden');
});

// ==========================================
// 3. Command Execution & Scheduling (Phase 3)
// ==========================================

/**
 * Schedules a command to execute at its designated server time `executeAt`.
 * Uses requestAnimationFrame loop for frame-accurate execution.
 */
function scheduleCommand(cmd) {
  if (!cmd || !cmd.name) return;

  const currentServerTime = getServerTime();
  const executeAt = cmd.executeAt || currentServerTime;

  // If clock is not yet synced, or executeAt has already passed, run immediately
  if (!isSynced || executeAt <= currentServerTime) {
    executeCommandNow(cmd);
    return;
  }

  // Cancel any prior waiting check
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  pendingCommand = cmd;

  function waitLoop() {
    if (!pendingCommand) return;

    const remainingMs = pendingCommand.executeAt - getServerTime();

    if (remainingMs <= 0) {
      // Reached the target execution time
      const toRun = pendingCommand;
      pendingCommand = null;
      animFrameId = null;
      executeCommandNow(toRun);
    } else {
      // Continue polling on each display refresh frame
      animFrameId = requestAnimationFrame(waitLoop);
    }
  }

  animFrameId = requestAnimationFrame(waitLoop);
}

/**
 * Applies the visual effect to the screen immediately.
 */
function executeCommandNow(cmd) {
  const currentServerTime = getServerTime();
  const latencyDiff = (currentServerTime - (cmd.executeAt || currentServerTime)).toFixed(1);
  console.log(`[Execute] ${cmd.name} at server time: ${currentServerTime.toFixed(1)}ms (diff: ${latencyDiff}ms)`);

  switch (cmd.name) {
    case 'COLOR':
      if (cmd.params && cmd.params.hex) {
        lightScreen.style.backgroundColor = cmd.params.hex;
      }
      break;

    case 'BLACKOUT':
      lightScreen.style.backgroundColor = '#000000';
      break;

    default:
      console.log('[Execute] Unhandled command:', cmd.name);
  }
}

// ==========================================
// 4. Clock Synchronization (NTP-Style)
// ==========================================

/**
 * Initiates a burst of 5 pings with randomized spacing.
 */
function startClockSync() {
  syncSamples = [];
  sendPing();
}

function sendPing() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;

  // t0 is measured strictly with performance.now()
  const t0 = performance.now();
  socket.send(JSON.stringify({ type: 'ping', t0 }));
}

function handlePong(msg) {
  const t1 = performance.now();
  const t0 = msg.t0;
  const ts = msg.ts; // Server Unix timestamp (Date.now())

  // Round Trip Time
  const rtt = t1 - t0;
  // Offset maps performance.now() to server Unix timestamp
  // offset = ts - (t0 + RTT / 2)
  const sampleOffset = ts - (t0 + (rtt / 2));

  syncSamples.push({ rtt, offset: sampleOffset });

  if (syncSamples.length < TOTAL_SYNC_SAMPLES) {
    // Small random delay (30ms - 80ms) between pings to avoid network bunching
    const delay = 30 + Math.random() * 50;
    setTimeout(sendPing, delay);
  } else {
    // 1. Sort samples by RTT ascending (packets with smallest RTT have least network jitter)
    syncSamples.sort((a, b) => a.rtt - b.rtt);

    // 2. Take the best 3 samples with the lowest RTT
    const bestSamples = syncSamples.slice(0, 3);
    const avgOffset = bestSamples.reduce((sum, s) => sum + s.offset, 0) / bestSamples.length;

    clockOffset = avgOffset;
    isSynced = true;

    const minRtt = bestSamples[0].rtt.toFixed(1);
    console.log(`[ClockSync] Synced! Best RTT: ${minRtt}ms | Offset: ${clockOffset.toFixed(1)}ms`);

    // Update join screen status text if still visible
    if (!hasJoined && myJoinNumber) {
      statusText.textContent = `Connected (Device #${myJoinNumber}) • Sync: ±${(bestSamples[0].rtt / 2).toFixed(0)}ms`;
    }
  }
}

// Re-synchronize clock every 30 seconds
setInterval(() => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log('[ClockSync] Periodic 30s re-sync starting...');
    startClockSync();
  }
}, 30000);

// ==========================================
// 5. WebSocket Connection (Rule 11: Dynamic URL)
// ==========================================
function connectWebSocket() {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}`;

  console.log('[Audience] Connecting to:', wsUrl);
  socket = new WebSocket(wsUrl);

  socket.addEventListener('open', () => {
    console.log('[Audience] WebSocket connected. Starting hello & clock sync...');
    statusText.textContent = 'Connected. Syncing clock...';

    // 1. Send hello handshake (Protocol Section 4)
    socket.send(JSON.stringify({
      type: 'hello',
      role: 'audience',
      group: 0
    }));

    // 2. Start initial 5-ping clock synchronization
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
        myJoinNumber = msg.joinNumber;
        console.log(`[Audience] Welcome received. ID: ${myId}, Join #: ${myJoinNumber}`);
        statusText.textContent = `Connected (Device #${myJoinNumber})`;
        break;

      case 'state':
        // If there is an active command when joining, schedule or catch up to it
        if (msg.cmd) {
          console.log('[Audience] Catching up to state:', msg.cmd);
          scheduleCommand(msg.cmd);
        }
        break;

      case 'cmd':
        scheduleCommand(msg);
        break;

      default:
        console.log('[Audience] Message:', msg.type);
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

// Start connection on page load
connectWebSocket();
