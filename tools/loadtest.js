// tools/loadtest.js
// Simulates N concurrent audience phones connecting, performing NTP clock sync,
// receiving broadcast commands, and calculating synchronization metrics.

const { WebSocket } = require('ws');

const COUNT = parseInt(process.argv[2], 10) || 100;
const URL = process.argv[3] || 'ws://localhost:3000';
const DURATION_SEC = parseInt(process.env.TEST_DURATION, 10) || 0; // 0 = run until stopped
const STAGGER_MS = 20;

console.log(`=========================================`);
console.log(`CrowdLight Load Test`);
console.log(`Simulating: ${COUNT} phones`);
console.log(`Target URL: ${URL}`);
console.log(`Stagger:    ${STAGGER_MS}ms per connection`);
if (DURATION_SEC > 0) {
  console.log(`Duration:   ${DURATION_SEC} seconds`);
}
console.log(`=========================================`);

let connectedCount = 0;
let syncedCount = 0;
let totalCommandsReceived = 0;
let errorCount = 0;
const rtts = [];
const leadTimes = []; // Time packet arrived before executeAt (buffer margin)
const clients = [];

const startTime = Date.now();

function createClient(index) {
  const ws = new WebSocket(URL);
  let clockOffset = 0;
  let isSynced = false;
  const syncSamples = [];

  function sendPing() {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping', t0: performance.now() }));
    }
  }

  ws.on('open', () => {
    connectedCount++;
    ws.send(JSON.stringify({
      type: 'hello',
      role: 'audience',
      group: 0
    }));
    sendPing();
  });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (_) {
      return;
    }

    if (msg.type === 'pong') {
      const t1 = performance.now();
      const rtt = t1 - msg.t0;
      const offset = msg.ts - (msg.t0 + (rtt / 2));
      syncSamples.push({ rtt, offset });

      if (syncSamples.length < 5) {
        setTimeout(sendPing, 30 + Math.random() * 40);
      } else {
        syncSamples.sort((a, b) => a.rtt - b.rtt);
        const best = syncSamples.slice(0, 3);
        clockOffset = best.reduce((acc, s) => acc + s.offset, 0) / best.length;
        isSynced = true;
        syncedCount++;
        rtts.push(best[0].rtt);
      }
    } else if (msg.type === 'cmd') {
      totalCommandsReceived++;
      if (isSynced && msg.executeAt) {
        const currentServerTime = performance.now() + clockOffset;
        const margin = msg.executeAt - currentServerTime;
        leadTimes.push(margin);
      }
    }
  });

  ws.on('error', (err) => {
    errorCount++;
  });

  ws.on('close', () => {
    connectedCount--;
  });

  clients.push(ws);
}

// Staggered client connection
let currentIndex = 0;
const connectInterval = setInterval(() => {
  if (currentIndex < COUNT) {
    createClient(currentIndex++);
  } else {
    clearInterval(connectInterval);
    const rampDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Ramp-up complete] Spawned ${COUNT} clients in ${rampDuration}s.`);
  }
}, STAGGER_MS);

// Periodic status monitor
const monitorInterval = setInterval(() => {
  const mem = process.memoryUsage();
  const avgRtt = rtts.length > 0 ? (rtts.reduce((a, b) => a + b, 0) / rtts.length).toFixed(1) : 0;
  const recentLeads = leadTimes.slice(-COUNT);
  const avgLead = recentLeads.length > 0 ? (recentLeads.reduce((a, b) => a + b, 0) / recentLeads.length).toFixed(1) : 'N/A';

  console.log(`[Stats] Online: ${connectedCount}/${COUNT} | Synced: ${syncedCount} | Cmds: ${totalCommandsReceived} | Avg RTT: ${avgRtt}ms | Lead Margin: ${avgLead}ms | Memory: ${(mem.rss / 1024 / 1024).toFixed(1)}MB`);
}, 3000);

function printSummary() {
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  const avgRtt = rtts.length > 0 ? (rtts.reduce((a, b) => a + b, 0) / rtts.length).toFixed(2) : 0;
  const minRtt = rtts.length > 0 ? Math.min(...rtts).toFixed(2) : 0;
  const maxRtt = rtts.length > 0 ? Math.max(...rtts).toFixed(2) : 0;
  const avgLead = leadTimes.length > 0 ? (leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length).toFixed(2) : 'N/A';
  const mem = process.memoryUsage();

  console.log(`\n================ LOAD TEST REPORT ================`);
  console.log(`Total Simulated Phones: ${COUNT}`);
  console.log(`Successfully Connected: ${syncedCount}/${COUNT}`);
  console.log(`Errors / Disconnects:   ${errorCount}`);
  console.log(`Total Test Duration:    ${totalDuration}s`);
  console.log(`Ping RTT (min/avg/max): ${minRtt}ms / ${avgRtt}ms / ${maxRtt}ms`);
  console.log(`Avg Command Lead Margin:${avgLead}ms (ahead of executeAt)`);
  console.log(`Client Process RSS:     ${(mem.rss / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Heap Used:              ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`);
  console.log(`==================================================\n`);
}

function shutdown() {
  clearInterval(connectInterval);
  clearInterval(monitorInterval);
  printSummary();
  clients.forEach(c => {
    try { c.close(); } catch (_) {}
  });
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

if (DURATION_SEC > 0) {
  setTimeout(shutdown, DURATION_SEC * 1000);
}
