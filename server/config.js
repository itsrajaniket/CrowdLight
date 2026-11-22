// server/config.js
// Configuration settings for CrowdLight server

module.exports = {
  // HTTP & WebSocket server port
  PORT: parseInt(process.env.PORT, 10) || 3000,

  // Controller login PIN (read from env, default for development)
  CONTROLLER_PIN: process.env.CONTROLLER_PIN || '1234',

  // Network synchronization buffer in milliseconds (added to server time for executeAt)
  SYNC_BUFFER_MS: parseInt(process.env.SYNC_BUFFER_MS, 10) || 300,
};
