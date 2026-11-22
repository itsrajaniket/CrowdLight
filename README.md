# CrowdLight

CrowdLight is a web-based crowd screen system. Audiences scan a single QR code to transform their mobile phone screens into synchronized multi-color light displays, choreographed in real time from a controller pad with zero app installs.

---

## 🌐 Live Production Deployment

CrowdLight is live and accessible globally:
- **Audience Display (for phones):** [https://crowdlight-4u52.onrender.com/audience/](https://crowdlight-4u52.onrender.com/audience/)
- **Controller Showpad (for you):** [https://crowdlight-4u52.onrender.com/controller/](https://crowdlight-4u52.onrender.com/controller/)
- **High-Res Venue QR Code:** [https://crowdlight-4u52.onrender.com/qr.png](https://crowdlight-4u52.onrender.com/qr.png)

---

## 🚀 Quick Start (Local)

### 1. Requirements
- Node.js (v18 or higher recommended)
- Modern mobile or desktop web browser

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Server
```bash
npm start
# or: node server/index.js
```

Default local endpoints:
- **Audience Display:** [http://localhost:3000/audience/](http://localhost:3000/audience/)
- **Controller Showpad:** [http://localhost:3000/controller/](http://localhost:3000/controller/) *(Default PIN: `1234`)*
- **Audience QR Code:** [http://localhost:3000/qr.png](http://localhost:3000/qr.png)

---

## 📱 Generating QR Codes
To generate terminal ASCII and image files (`PNG` & `SVG`) for any URL:

```bash
# Default (localhost):
node tools/make-qr.js

# For a public tunnel or Render domain:
node tools/make-qr.js https://my-crowdlight.onrender.com/audience/
```
The resulting `qr.png` is saved in `public/qr.png` and can be projected on a large screen or printed on cards.

---

## 🌐 Testing Over Mobile Data (Cloudflare Quick Tunnel)
You can test phones on cellular data (4G/5G) right from your laptop without deploying or port forwarding:

1. In a terminal, run:
   ```bash
   npx cloudflared tunnel --url http://localhost:3000
   ```
2. Cloudflare will print a temporary secure HTTPS URL, such as:
   `https://random-words.trycloudflare.com`
3. Generate the QR code for your mobile URL:
   ```bash
   node tools/make-qr.js https://random-words.trycloudflare.com/audience/
   ```
4. Scan the QR code with any phone on cellular mobile data (disconnect WiFi).
5. Open `https://random-words.trycloudflare.com/controller/` on your laptop/tablet, enter PIN `1234`, and change colors!

---

## ☁️ Free Cloud Deployment (Render)

Render provides free hosting with full native WebSocket and TLS (`https://` & `wss://`) support.

### Deployment Steps:
1. Push this repository to GitHub or GitLab.
2. Sign up / log in to [Render.com](https://render.com/).
3. Click **New +** -> **Web Service**.
4. Connect your `crowdlight` repository.
5. Set the build and runtime settings:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** `Free`
6. Add Environment Variables in the **Environment** tab:
   - `CONTROLLER_PIN`: *Set your private 4-digit show PIN (e.g. `8391`). Never commit your production PIN to Git!*
   - `SYNC_BUFFER_MS`: `400` *(400ms recommended for cellular networks)*
7. Click **Deploy Web Service**.
8. Once deployed, Render provides an HTTPS URL (e.g. `https://crowdlight-xyz.onrender.com`).
9. Generate your final venue QR code:
   ```bash
   node tools/make-qr.js https://crowdlight-xyz.onrender.com/audience/
   ```

### ⚠️ Important: Handling Free Tier Cold Starts
- Render's free tier automatically puts idle services to sleep after 15 minutes of inactivity.
- Waking up from sleep takes ~50 seconds ("cold start").
- **Crucial Event Reminder:** Always open your Render URL in a browser **10 minutes before your show or rehearsal begins** to pre-warm the server so audience members experience instant join speeds!

---

## ⚙️ Configuration Reference

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP & WebSocket port (Render sets this automatically) |
| `CONTROLLER_PIN` | `1234` | PIN code required to unlock the controller |
| `SYNC_BUFFER_MS` | `300` | Network sync buffer added to server time for `executeAt` |

---

## 🧪 Load Testing (Simulating Up to 500 Phones)
You can stress test the server by simulating hundreds of phones:

```bash
# Simulate 100 phones:
node tools/loadtest.js 100

# Simulate 500 phones:
node tools/loadtest.js 500
```
Each simulated client performs full 5-ping NTP clock sync and logs command execution lead times.
