// server/index.js
// CrowdLight HTTP + WebSocket Server

const http = require('http');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { WebSocketServer } = require('ws');
const config = require('./config');
const state = require('./state');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const STATS_FILE = path.join(__dirname, 'stats.json');

// Real-time visitor tracking
let stats = {
  totalVisits: 1000,
  lastUpdated: Date.now()
};

// Load existing stats if available
try {
  if (fs.existsSync(STATS_FILE)) {
    const raw = fs.readFileSync(STATS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed.totalVisits === 'number') {
      stats.totalVisits = Math.max(1000, parsed.totalVisits);
    }
  }
} catch (e) {
  console.warn('[Stats] Could not read stats.json, initializing default:', e.message);
}

// Debounced stats saver to prevent disk churn
let saveTimeout = null;
function recordVisit() {
  stats.totalVisits++;
  stats.lastUpdated = Date.now();
  if (!saveTimeout) {
    saveTimeout = setTimeout(() => {
      saveTimeout = null;
      try {
        fs.writeFile(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8', () => {});
      } catch (err) {
        console.warn('[Stats] Failed to persist stats:', err.message);
      }
    }, 2000);
  }
}

// Supported MIME types for serving static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/**
 * Returns count of currently connected audience clients.
 */
function getAudienceCount() {
  let count = 0;
  wss.clients.forEach((c) => {
    if (c.readyState === 1 && c.role === 'audience') {
      count++;
    }
  });
  return count;
}

/**
 * Broadcasts audience statistics to all authenticated controllers.
 */
function broadcastStatsToControllers() {
  const count = getAudienceCount();
  const payload = JSON.stringify({
    type: 'stats',
    count: count
  });

  wss.clients.forEach((client) => {
    if (client.readyState === 1 && ((client.role === 'controller' && client.authenticated) || client.role === 'simulator')) {
      client.send(payload);
    }
  });
}

/**
 * Broadcast a command object to all connected audience clients AND authenticated controllers.
 */
function broadcastCommand(cmd) {
  const executeAt = cmd.executeAt || (Date.now() + config.SYNC_BUFFER_MS);
  const broadcastCmd = {
    name: cmd.name,
    params: cmd.params || {},
    executeAt: executeAt,
    sender: cmd.sender || null
  };

  // Save current active command in show state
  state.setCurrentState(broadcastCmd);

  const payload = JSON.stringify({
    type: 'cmd',
    name: broadcastCmd.name,
    params: broadcastCmd.params,
    executeAt: broadcastCmd.executeAt,
    sender: broadcastCmd.sender
  });

  let audienceSent = 0;
  let controllerSent = 0;

  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // 1 = OPEN
      if (client.role === 'audience') {
        client.send(payload);
        audienceSent++;
      } else if (client.role === 'controller' && client.authenticated) {
        // Echo command to controllers so their "Currently Running" UI stays in sync
        client.send(payload);
        controllerSent++;
      }
    }
  });

  console.log(`[Broadcast] "${broadcastCmd.name}" -> ${audienceSent} audience & ${controllerSent} controller client(s). executeAt: ${executeAt} (+${config.SYNC_BUFFER_MS}ms)`);
}

/**
 * Handle incoming HTTP requests and serve static files from /public
 */
const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let reqPath = decodeURI(urlObj.pathname);

  // Manual test HTTP endpoint for triggering colors
  if (reqPath === '/api/test-color') {
    const hex = urlObj.searchParams.get('hex') || '#e11d48';
    broadcastCommand({
      name: 'COLOR',
      params: { hex: hex.startsWith('#') ? hex : `#${hex}` }
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', command: 'COLOR', hex }));
    return;
  }

  if (reqPath === '/api/test-blackout') {
    broadcastCommand({
      name: 'BLACKOUT',
      params: {}
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', command: 'BLACKOUT' }));
    return;
  }

  // Real-time visitor analytics counter endpoint
  if (reqPath === '/api/visits') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({ totalVisits: stats.totalVisits }));
    return;
  }

  // Root landing page
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  // Handle directory requests with trailing slash
  if (reqPath === '/audience' || reqPath === '/audience/') {
    reqPath = '/audience/index.html';
  } else if (reqPath === '/controller' || reqPath === '/controller/') {
    reqPath = '/controller/index.html';
  }

  // Track page visits on main HTML entrypoints
  if (reqPath === '/index.html' || reqPath === '/audience/index.html' || reqPath === '/controller/index.html') {
    recordVisit();
  }

  const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  // Security check: ensure path is within PUBLIC_DIR
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

// Attach WebSocket server to the existing HTTP server
const wss = new WebSocketServer({ server });

let clientCounter = 0;
let joinNumberCounter = 0;

wss.on('connection', (ws, req) => {
  const clientId = ++clientCounter;
  const ip = req.socket.remoteAddress;

  ws.clientId = clientId;
  ws.role = 'unknown';
  ws.authenticated = false;
  ws.isAlive = true;

  // Heartbeat pong listener
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  console.log(`[WebSocket] Client #${clientId} connected from ${ip}. Total connections: ${wss.clients.size}`);

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (err) {
      console.log(`[WebSocket] Client #${clientId} sent non-JSON message:`, data.toString());
      return;
    }

    // 1. Clock-sync ping from audience phone
    if (msg.type === 'ping') {
      ws.send(JSON.stringify({
        type: 'pong',
        t0: msg.t0,
        ts: Date.now()
      }));
      return;
    }

    // 2. Handshake hello
    if (msg.type === 'hello') {
      if (msg.role === 'audience') {
        ws.role = 'audience';
        ws.joinNumber = ++joinNumberCounter;
        console.log(`[Audience] Client #${clientId} registered as Audience #${ws.joinNumber}`);

        // Send welcome
        ws.send(JSON.stringify({
          type: 'welcome',
          id: clientId,
          joinNumber: ws.joinNumber
        }));

        // Send current show state so late joiner catches up
        const curState = state.getCurrentState();
        ws.send(JSON.stringify({
          type: 'state',
          cmd: curState.cmd
        }));

        // Update controllers with new audience count
        broadcastStatsToControllers();
      } else if (msg.role === 'simulator') {
        ws.role = 'simulator';
        ws.authenticated = true;
        console.log(`[Simulator Hub] Client #${clientId} registered for demo sync.`);

        // Send welcome
        ws.send(JSON.stringify({
          type: 'welcome',
          id: clientId
        }));

        // Send live audience stats
        ws.send(JSON.stringify({
          type: 'stats',
          count: getAudienceCount()
        }));

        // Send current show state
        ws.send(JSON.stringify({
          type: 'state',
          cmd: state.getCurrentState().cmd
        }));
      } else if (msg.role === 'controller') {
        ws.role = 'controller';

        // Validate PIN
        if (String(msg.pin) === String(config.CONTROLLER_PIN)) {
          ws.authenticated = true;
          console.log(`[Controller] Client #${clientId} authenticated successfully.`);

          // Send welcome
          ws.send(JSON.stringify({
            type: 'welcome',
            id: clientId
          }));

          // Send live audience stats
          ws.send(JSON.stringify({
            type: 'stats',
            count: getAudienceCount()
          }));

          // Send current show state
          ws.send(JSON.stringify({
            type: 'state',
            cmd: state.getCurrentState().cmd
          }));
        } else {
          ws.authenticated = false;
          console.warn(`[Controller] Client #${clientId} failed PIN authentication.`);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid PIN. Access denied.'
          }));
        }
      }
      return;
    }

    // 3. Command execution request (Phase 4 Security: Authenticated controllers or simulator)
    if (msg.type === 'cmd') {
      const isAuthorized = (ws.role === 'controller' && ws.authenticated) || (ws.role === 'simulator' && ws.authenticated);
      if (!isAuthorized) {
        console.warn(`[Security] Client #${clientId} (role: ${ws.role}) unauthorized attempt to send cmd "${msg.name}". Ignored.`);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Unauthorized: only authenticated controllers can trigger commands.'
        }));
        return;
      }

      console.log(`[Controller] Command received from Client #${clientId}:`, msg.name, msg.params);
      broadcastCommand(msg);
      return;
    }
  });

  ws.on('close', () => {
    console.log(`[WebSocket] Client #${clientId} (${ws.role}) disconnected. Total connections: ${wss.clients.size}`);
    if (ws.role === 'audience') {
      broadcastStatsToControllers();
    }
  });

  ws.on('error', (err) => {
    console.error(`[WebSocket] Client #${clientId} error:`, err.message);
  });
});

// Periodic server heartbeat to detect and terminate dead connections
const HEARTBEAT_INTERVAL = 30000;
const heartbeatTimer = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log(`[Heartbeat] Terminating inactive connection Client #${ws.clientId} (${ws.role})`);
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

wss.on('close', () => {
  clearInterval(heartbeatTimer);
});

function getLocalIp() {
  const os = require('os');
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Start listening
server.listen(config.PORT, () => {
  const localIp = getLocalIp();
  console.log(`=========================================`);
  console.log(`CrowdLight Server started on port ${config.PORT}`);
  console.log(`Local PC URL:   http://localhost:${config.PORT}/audience/`);
  console.log(`Phone WiFi URL: http://${localIp}:${config.PORT}/audience/`);
  console.log(`Controller URL: http://localhost:${config.PORT}/controller/`);
  console.log(`Controller PIN: ${config.CONTROLLER_PIN}`);
  console.log(`Sync Buffer:    ${config.SYNC_BUFFER_MS}ms`);
  console.log(`=========================================`);
});

// Setup terminal input reader for manual testing (when run in an interactive terminal)
if (process.stdin.isTTY) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const testColors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ffffff'];
  let testColorIdx = 0;

  rl.on('line', (line) => {
    const input = line.trim().toLowerCase();
    if (input === 'b' || input === 'blackout') {
      broadcastCommand({ name: 'BLACKOUT', params: {} });
    } else if (input.startsWith('color ') || input.startsWith('c ')) {
      const hex = input.split(' ')[1];
      broadcastCommand({ name: 'COLOR', params: { hex: hex.startsWith('#') ? hex : `#${hex}` } });
    } else if (input === 'c' || input === 'color' || input === '') {
      const hex = testColors[testColorIdx % testColors.length];
      testColorIdx++;
      broadcastCommand({ name: 'COLOR', params: { hex } });
    }
  });
}
