# CrowdLight

Web-based crowd screen system. Audiences scan a single QR code to turn their phone screens into synchronized multi-color lights coordinated in real-time from a controller pad.

## Requirements
- Node.js (v18 or higher recommended)

## Installation
```bash
npm install
```

## Running the Server
```bash
npm start
# or
node server/index.js
```

Default URLs:
- **Audience page:** [http://localhost:3000/audience/](http://localhost:3000/audience/)
- **Controller page:** [http://localhost:3000/controller/](http://localhost:3000/controller/)

## Configuration
Configuration values are loaded from environment variables with safe development defaults:
- `PORT`: Server port (default: `3000`)
- `CONTROLLER_PIN`: Controller login PIN (default: `1234`)
- `SYNC_BUFFER_MS`: Server time buffer added to scheduled commands (default: `300`)
