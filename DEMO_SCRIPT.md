# CrowdLight — Live Demonstration Script

This presentation script guides you through demonstrating **CrowdLight** to professors, evaluators, classmates, or event attendees.

---

## ⏱️ Demo Overview
- **Duration:** 5–7 minutes
- **Objective:** Showcase real-time millisecond-level synchronization across multiple mobile devices with zero app installation.
- **Required Equipment:**
  - 1 Presenter Laptop (running CrowdLight server & controller)
  - 1 Presenter Phone or Projector showing the audience view
  - Audience members with smartphones (mix of iOS & Android)

---

## 🎬 Stage 1: The Hook & Introduction (1 Minute)

### 🎙️ Talking Points:
> *"At concerts, sporting arenas, and festivals, you often see performers hand out expensive LED wristbands or ask audiences to download 100MB mobile apps that struggle with weak cellular signal.*
>
> *Today, I'm presenting **CrowdLight**: a zero-install, web-based crowd screen system. By simply scanning a single QR code, any smartphone instantly becomes a synchronized pixel in a stadium-sized light show — running on raw WebSockets with millisecond-accurate NTP clock synchronization."*

### 🖥️ Action:
1. Show the generated QR code on the projector or laptop screen (`http://<your-ip>:3000/qr.png` or terminal QR).
2. Invite 5–20 attendees to open their phone cameras and scan the code.

---

## 📱 Stage 2: The Audience Experience (1.5 Minutes)

### 🎙️ Talking Points:
> *"Notice three key engineering decisions on the audience phone:*
> 1. *Zero Install & Fast Load: The entire page payload is under **19 KB** — less than a single medium image. Even on congested 3G venue networks, it loads in under 300 milliseconds.*
> 2. *User Guidance: The join screen reminds users to maximize screen brightness.*
> 3. *Screen Wake Lock & Fullscreen: Tapping 'JOIN SHOW' requests the browser's Wake Lock API so screens never sleep during the show, and auto-adapts across iOS Safari using dynamic viewport units (`100dvh`) and Android native fullscreen."*

### 🖥️ Action:
1. Everyone taps **"JOIN SHOW"**.
2. Show that all audience screens turn black in standby, awaiting the show director.

---

## 🎛️ Stage 3: The Controller & Security (1.5 Minutes)

### 🎙️ Talking Points:
> *"Now let's switch to the Show Director's pad. In an event setting, security is critical. The controller is protected by a PIN handshake.*
>
> *If an audience member tries to inspect network packets or send unauthorized commands from their browser console, the server's role verification rejects them immediately.*
>
> *Notice our live counter: it currently displays **X Phones Online**, updated instantly over WebSockets whenever a device connects or disconnects."*

### 🖥️ Action:
1. Open the Controller (`/controller/`).
2. Show entering a wrong PIN (`0000`) -> Server rejects: `Invalid PIN`.
3. Enter correct PIN (`1234`) -> Dashboard unlocks immediately.
4. Point out the live **"Phones Online"** counter matching the room.

---

## ✨ Stage 4: Synchronized Visual Effects (2 Minutes)

### 1. Solid Color Switches
- **Action:** Tap **Red**, **Blue**, **Green**.
- **Explanation:** *"Solid color changes switch across all screens simultaneously with zero visible lag."*

### 2. Audio-Synced Beat Pulse & Tap-Tempo
- **Action:** Tap the **TAP TEMPO** button to the rhythm of ambient music (e.g. 128 BPM), then click **Start Pulse**.
- **Explanation:** *"Rather than accumulating timer drift with `setInterval`, CrowdLight renders each frame as a pure mathematical function of synchronized server time (`serverTime - executeAt`). Even if a phone drops frames, it instantly snaps back to the exact beat phase."*

### 3. Crowd Wave (10-Step Ripple)
- **Action:** Click **Blue Ocean Wave**.
- **Explanation:** *"Each phone takes its assigned sequential join number modulo 10 and ripples across the audience in a 10-step harmonic cascade."*

### 4. Countdown to Drop
- **Action:** Click **5 SECONDS Countdown**.
- **Explanation:** *"All phones synchronize to display giant numbers counting down: 5, 4, 3, 2, 1, followed by a white screen burst and emoji!"*

### 5. Crowd Callout (Text Banner)
- **Action:** Click **"LOUDER!"** or type a custom message and hit send.
- **Explanation:** *"Instant high-contrast typographic callout across every screen in the venue."*

### 6. Blackout
- **Action:** Hit **BLACKOUT**.
- **Explanation:** *"Instant silence. Notice that blackout stops all active rendering loops to conserve phone battery."*

---

## 🛡️ Stage 5: Resilience & Network Recovery (1 Minute)

### 🎙️ Talking Points:
> *"What happens when someone walks into a dead zone or drops WiFi? Let's test it."*

### 🖥️ Action:
1. Turn on a continuous effect (e.g. **Pulse**).
2. Put one demo phone into **Airplane Mode** (or turn off WiFi).
3. The phone detects the disconnect and begins auto-reconnecting with exponential backoff and jitter.
4. Turn WiFi back on.
5. The phone reconnects, requests the server's current show state, and immediately snaps back into the pulse at the exact ongoing beat without requiring a page reload!

---

## 📊 Stage 6: Technical Conclusion & Q&A

### Key Metrics to Highlight:
- **Payload:** ~19 KB total (HTML + CSS + vanilla JS)
- **Concurrency:** Benchmarked to 500 simultaneous phones with 100% sync and zero drops
- **Latency Buffer:** Packets arrive ~295ms ahead of the 300ms execution target
- **Cost:** $0 budget using Node.js, raw WebSockets, and free-tier infrastructure

---

### Suggested Q&A Responses:
- **Q: Why raw WebSockets instead of Socket.IO or Firebase?**
  *A: Socket.IO adds ~80KB of client overhead, complex protocol framing, and fallback polling. Raw WebSockets gives us full control over packet serialization, sub-millisecond round-trip times, and a tiny 19KB client footprint.*
- **Q: How does the server handle clock drift between different phones?**
  *A: We implement an NTP-style 5-ping filter on connect. We calculate round-trip time (`t1 - t0`), reject jitter outliers, and map `performance.now()` directly to server Unix timestamp. Periodic re-sync runs every 30 seconds.*
- **Q: How does it scale beyond 500 phones?**
  *A: Because broadcast packets are pre-serialized once in memory, a single $5/month VPS can handle 1,000–2,000 concurrent sockets. Beyond that, Redis pub/sub can distribute load across multiple stateless Node instances.*
