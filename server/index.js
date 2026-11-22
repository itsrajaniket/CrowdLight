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
 * Broadcast a command object to all connected audience clients and record in state.
 */
function broadcastCommand(cmd) {
  const executeAt = cmd.executeAt || (Date.now() + config.SYNC_BUFFER_MS);
  const broadcastCmd = {
    name: cmd.name,
    params: cmd.params || {},
    executeAt: executeAt
  };

  state.setCurrentState(broadcastCmd);

  const payload = JSON.stringify({
    type: 'cmd',
    name: broadcastCmd.name,
    params: broadcastCmd.params,
    executeAt: broadcastCmd.executeAt
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client.role === 'audience') { // 1 = OPEN
      client.send(payload);
      sentCount++;
    }
  });

  console.log(`[Broadcast] Command "${broadcastCmd.name}" sent to ${sentCount} audience client(s) with executeAt: ${executeAt} (+${config.SYNC_BUFFER_MS}ms).`);
}

/**
 * Handle incoming HTTP requests and serve static files from /public
 */
const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let reqPath = decodeURI(urlObj.pathname);

  // Manual test HTTP endpoint for triggering colors
  if (reqPath === '/api/test-color') {
    const hex = urlObj.searchParams.get('hex') || '#e11d48'; // Default rose red
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

  // Root redirect/landing
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/audience/index.html';
  }

  // Handle directory requests with trailing slash
  if (reqPath === '/audience' || reqPath === '/audience/') {
    reqPath = '/audience/index.html';
  } else if (reqPath === '/controller' || reqPath === '/controller/') {
    reqPath = '/controller/index.html';
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

  console.log(`[WebSocket] Client #${clientId} connected from ${ip}. Total connected: ${wss.clients.size}`);

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (err) {
      console.log(`[WebSocket] Client #${clientId} sent non-JSON message:`, data.toString());
      return;
    }

    // Handle clock-sync ping from phone
    if (msg.type === 'ping') {
      ws.send(JSON.stringify({
        type: 'pong',
        t0: msg.t0,
        ts: Date.now()
      }));
      return;
    }

    // Handle handshake hello from phone / audience
    if (msg.type === 'hello') {
      if (msg.role === 'audience') {
        ws.role = 'audience';
        ws.joinNumber = ++joinNumberCounter;
        console.log(`[Audience] Client #${clientId} registered as Audience #${ws.joinNumber}`);

        // 1. Reply welcome
        ws.send(JSON.stringify({
          type: 'welcome',
          id: clientId,
          joinNumber: ws.joinNumber
        }));

        // 2. Send current state so client catches up
        const curState = state.getCurrentState();
        ws.send(JSON.stringify({
          type: 'state',
          cmd: curState.cmd
        }));
      } else if (msg.role === 'controller') {
        // Will be expanded in Phase 4
        ws.role = 'controller';
        console.log(`[Controller] Client #${clientId} connected.`);
      }
    }
  });

  ws.on('close', () => {
    console.log(`[WebSocket] Client #${clientId} (${ws.role || 'unknown'}) disconnected. Total connected: ${wss.clients.size}`);
  });

  ws.on('error', (err) => {
    console.error(`[WebSocket] Client #${clientId} error:`, err.message);
  });
});

// Start listening
server.listen(config.PORT, () => {
  console.log(`=========================================`);
  console.log(`CrowdLight Server started on port ${config.PORT}`);
  console.log(`Audience URL:   http://localhost:${config.PORT}/audience/`);
  console.log(`Controller URL: http://localhost:${config.PORT}/controller/`);
  console.log(`Sync Buffer:    ${config.SYNC_BUFFER_MS}ms`);
  console.log(`-----------------------------------------`);
  console.log(`Interactive test commands in terminal:`);
  console.log(`  Press Enter or type 'c' / 'color' to broadcast next color`);
  console.log(`  Type 'color #hex' to set specific color`);
  console.log(`  Type 'b' or 'blackout' for blackout`);
  console.log(`Or visit: http://localhost:${config.PORT}/api/test-color?hex=%23ff0000`);
  console.log(`=========================================`);
});

// Setup terminal input reader for manual testing (when run in an interactive terminal)
if (process.stdin.isTTY) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const testColors = ['#e11d48', '#2563eb', '#16a34a', '#f59e0b', '#9333ea', '#ffffff'];
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
