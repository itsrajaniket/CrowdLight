// Controller app.js
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${wsProtocol}//${window.location.host}`;

console.log('[Controller] Connecting to WebSocket at:', wsUrl);
const ws = new WebSocket(wsUrl);

ws.addEventListener('open', () => {
  console.log('[Controller] Connected to CrowdLight server');
});

ws.addEventListener('close', () => {
  console.log('[Controller] Disconnected from CrowdLight server');
});
