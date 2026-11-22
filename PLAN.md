# CrowdLight — Project Plan & Progress Tracker

> Working name: **CrowdLight**. Change it freely.
> This file is the single source of truth. The AI must read it first, work one phase at a time, and tick boxes (`[x]`) as items are finished.

---

## 0. RULES FOR THE AI EDITOR (read first, always)

1. Work on **one phase at a time**. Do not start the next phase until every box in the current phase is ticked and its **Test** passes.
2. After finishing each task, edit this file and change `[ ]` to `[x]`. Add a one-line note in the **Progress Log** at the bottom.
3. **Do NOT build anything from the "Future Features" list (section 9).** If you think something from it is needed, ask the user first.
4. Stack is fixed: **Node.js + `ws` (raw WebSockets)**. Do **not** use Socket.IO, React, or any frontend framework for the audience page.
5. Keep the audience page **small and fast**: plain HTML + CSS + JS, no frameworks, no external libraries, no large images or video in Version 1. Target is under about 100 KB total, but this is a target, not a hard limit. Always report the real size to the user and let the user decide if it is acceptable.
6. Keep code simple and commented. The user is a college student who must be able to explain every part.
7. Never skip a step. If a step is blocked, write why in the Progress Log and stop to ask.
8. Every message sent between server and phones must follow the protocol in section 4.
9. Before saying a phase is done, tell the user exactly how to test it by hand.
10. **Wait for human verification.** Never tick a phase's **Test** item, and never start the next phase, until the user explicitly replies that the manual test passed.
11. **Never hardcode the WebSocket URL** (e.g. `ws://localhost:3000`). Always derive it from `window.location`: use `wss://` when the page is on HTTPS and `ws://` on HTTP, with the same host. This keeps the code identical on localhost, Cloudflare Tunnel, and Render.

---

## 1. Project Summary

A web-based crowd screen system.

- Audience scans **one QR code**, a web page opens in their phone browser (**no app install**).
- Their phone becomes a full-screen light.
- A **controller** (pad of buttons on a laptop/tablet) changes the color on **all phones at the same moment**.
- Phones use their own mobile data or any WiFi. The server is hosted on the internet.

**Target:** works for ~100 people first, designed so it can scale to 500–1,000 without a rewrite.
**Budget:** $0 to start (free tiers).

---

## 2. Version 1 Scope (build ONLY this)

**Audience phone page**
- Join screen with big "JOIN SHOW" button, reminder: "Set brightness to 100%"
- Wake Lock so the screen stays on
- Full-screen color display
- Auto-reconnect, and catches up to the current effect after reconnecting
- Each phone gets a join number (used for the basic wave)

**Controller page**
- PIN-protected
- Preset color buttons + custom color picker
- Blackout button
- Effects: strobe, fade, pulse/tap-tempo, join-order wave, countdown, text banner
- Live count of connected phones

**Server**
- Node.js + `ws`
- Clock sync (offset estimation) + scheduled commands ("execute at time T")
- Stores current state so late joiners and reconnecting phones catch up

**Extras**
- Load-test script (simulated phones)
- Free deployment

---

## 3. Tech Stack & Folder Structure

| Part | Choice |
|---|---|
| Server | Node.js + `ws` (+ plain `http` or Express for serving files) |
| Audience page | Plain HTML + CSS + vanilla JS (single small page) |
| Controller page | Plain HTML + CSS + vanilla JS |
| QR code | `qrcode` npm package (or any QR generator) |
| Load test | Node script using `ws` |
| Hosting (later) | Laptop + Cloudflare Tunnel → then Render (free) |

```
crowdlight/
├── PLAN.md                 <- this file
├── package.json
├── server/
│   ├── index.js            <- http + WebSocket server
│   ├── state.js            <- current show state
│   └── config.js           <- PIN, port, settings
├── public/
│   ├── audience/
│   │   ├── index.html
│   │   ├── app.js
│   │   └── style.css
│   └── controller/
│       ├── index.html
│       ├── app.js
│       └── style.css
├── tools/
│   ├── loadtest.js         <- simulates many phones
│   └── make-qr.js          <- generates the QR code image
└── README.md
```

---

## 4. Protocol (all messages are JSON)

### Phone → Server
| type | fields | meaning |
|---|---|---|
| `hello` | `role: "audience"`, `group: 0` | phone joins (group is always 0 in v1, kept for the future) |
| `ping` | `t0` | clock-sync request (t0 = phone's local time) |

### Controller → Server
| type | fields | meaning |
|---|---|---|
| `hello` | `role: "controller"`, `pin` | controller logs in |
| `cmd` | see commands below | trigger an effect |

### Server → Phone / Controller
| type | fields | meaning |
|---|---|---|
| `welcome` | `id`, `joinNumber` | sent after hello |
| `pong` | `t0`, `ts` | reply to ping (ts = server time) |
| `cmd` | `name`, `params`, `executeAt` | effect to run at server time `executeAt` |
| `state` | `cmd` (the full last command object) | sent on join/reconnect. Shape: `{"type":"state","cmd":{"name":"PULSE","params":{...},"executeAt":1730000000000}}`. The phone passes `msg.cmd` into the **same** `runCommand()` function used for live `cmd` messages. If nothing has run yet, `cmd` is `null`. |
| `stats` | `count` | number of connected phones (to controller) |
| `error` | `message` | e.g. wrong PIN |

### Commands (`cmd.name`)
| name | params | behavior |
|---|---|---|
| `COLOR` | `hex` | solid color |
| `BLACKOUT` | none | pure black `#000000` |
| `STROBE` | `hex`, `intervalMs` | flash on/off |
| `FADE` | `fromHex`, `toHex`, `durationMs` | smooth fade |
| `PULSE` | `hex`, `bpm` | brightness pulses with the beat, phase measured from `executeAt` |
| `WAVE` | `hex`, `speedMs` | ripple across phones. Each phone delays by `(joinNumber % 10) * speedMs` after `executeAt` (a repeating 10-step ripple, so late joiners never wait too long) |
| `COUNTDOWN` | `from` | big number counts down, starting at `executeAt` |
| `TEXT` | `text`, `hex`, `bgHex` | shows text on screen |

**`executeAt` is the one and only start time.** Do NOT add a separate `startAt` field to any command or params.

**Sync rule:** the controller never says "change now". The server adds `executeAt = serverNow + SYNC_BUFFER_MS` and broadcasts. `SYNC_BUFFER_MS` lives in `server/config.js` and defaults to 300. It may need raising to 500+ on weak mobile networks after testing. Each phone converts `executeAt` to local time using its clock offset.

---

## 5. Phased Checklist

### PHASE 1 — Project setup & basic server
- [x] Create folder structure from section 3
- [x] `npm init`, install `ws` (and `qrcode` later)
- [x] `server/config.js` with PORT, controller PIN, and `SYNC_BUFFER_MS` (default 300). Read PIN from env var, default for dev
- [x] `server/index.js`: HTTP server serving `/public`, WebSocket server attached
- [x] Server logs when a client connects/disconnects
- [x] Add a `.gitignore` and a short `README.md` with run instructions

- [x] **Test:** `node server/index.js` starts. Opening `http://localhost:3000/audience/` shows a page. Connect/disconnect shows in server log.

---

### PHASE 2 — Audience page (no sync yet)
- [x] Join screen: title, big "JOIN SHOW" button, "Set brightness to 100%" note
- [x] On tap: request Wake Lock, hide join screen, go full-screen color
- [x] Use `100dvh` so it fills iPhone Safari properly
- [x] In the JOIN tap handler also call `document.documentElement.requestFullscreen?.().catch(() => {})` so Android gets true fullscreen (iPhone silently ignores it)
- [x] WebSocket URL derived from `window.location` (rule 11)
- [x] Connect to WebSocket, send `hello`, receive `welcome` (join number)
- [x] Apply `COLOR` and `BLACKOUT` immediately (sync comes in Phase 3)
- [x] Re-request Wake Lock when the page becomes visible again
- [x] Measure total audience page size (HTML + CSS + JS), report it to the user, and note it in the log. Target: under about 100 KB

- [x] **Test:** two phones/browser tabs open the page, tap JOIN, and both show a color sent manually from the server.

---

### PHASE 3 — Clock sync & scheduled commands
- [x] Phone sends 5 `ping`s on connect (small random delay between them)
- [x] Server replies `pong` with its time `ts`
- [x] Phone computes `RTT = t1 - t0` and `offset = ts - (t0 + RTT/2)` for each sample
- [x] Keep the 2–3 samples with the lowest RTT, average their offsets
- [x] Re-sync every 30 seconds
- [x] Use `performance.now()` for `t0` and `t1` (never mix in `Date.now()`), so `offset` maps `performance.now()` directly to server Unix time: `serverTime = performance.now() + offset`. Use this one formula everywhere on the phone.
- [x] Phone handles `cmd` by waiting until `executeAt` (use `requestAnimationFrame` loop, not just `setTimeout`)
- [x] Server sets `executeAt = now + SYNC_BUFFER_MS` (from `config.js`) on every command

**Test:** two phones (one on WiFi, one on mobile data) side by side change color visibly together.

---

### PHASE 4 — Controller page
- [ ] Controller page asks for PIN, sends it in `hello`
- [ ] Server rejects wrong PIN (`error`) and ignores `cmd` from non-controllers
- [ ] Grid of preset color buttons
- [ ] Custom color picker
- [ ] BLACKOUT button
- [ ] Live "connected phones" counter (updates via `stats`)
- [ ] "Currently Running" status box showing the active effect name and color (easy to forget in a dark room)
- [ ] Layout works on a laptop and a tablet

**Test:** a wrong PIN fails. A correct PIN can change all connected phones. A phone cannot send `cmd` and have it work.

---

### PHASE 5 — Effects
- [ ] `STROBE`
- [ ] `FADE`
- [ ] `PULSE` + tap-tempo button (average gaps between taps → BPM)
- [ ] `WAVE` using `(joinNumber % 10) * speedMs` delay after `executeAt` (repeating 10-step ripple)
- [ ] `COUNTDOWN`
- [ ] `TEXT`
- [ ] Animated effects computed as a function of server time (not accumulated timers), so a lagging phone snaps back into sync
- [ ] Controller buttons for every effect

**Test:** run each effect with 3+ devices and confirm they stay in step for 2+ minutes.

---

### PHASE 6 — Resilience
- [ ] Server stores the current active effect in `state.js`
- [ ] On join/reconnect, server sends `state` and the phone jumps into the running effect at the right moment
- [ ] Phone auto-reconnect with exponential backoff + random jitter
- [ ] Server heartbeat to remove dead connections
- [ ] Server pre-serializes broadcast messages once (not once per client)
- [ ] Standby/Blackout stops the animation loop to save battery

**Test:** turn a phone's WiFi off and on mid-show. It reconnects and rejoins the current effect without a manual refresh.

---

### PHASE 7 — Load test
- [ ] `tools/loadtest.js` spawns N fake phones (arg: count, 20ms stagger between connects)
- [ ] Each fake phone does the 5-ping clock sync and logs delay between `executeAt` and receive time
- [ ] Test at 100, 250, then 500 clients
- [ ] Record results (connect time, message delay, memory use) in the Progress Log
- [ ] Fix any problems found

**Test:** 500 simulated phones connect, stay connected for 10 minutes, and receive every command.

---

### PHASE 8 — QR code & free deployment
- [ ] `tools/make-qr.js` generates a QR image for the audience URL
- [ ] Run locally with a Cloudflare Tunnel and test from phones on mobile data
- [ ] Deploy server to Render free tier (check current free limits on their pricing page first)
- [ ] Set the controller PIN via environment variable (never hardcode the real PIN)
- [ ] Note the "cold start" delay and add a reminder to wake the server 10 minutes before an event
- [ ] Test the full flow on the deployed URL

**Test:** a friend who is not on your WiFi scans the QR and joins using mobile data.

---

### PHASE 9 — Rehearsal & final report
- [ ] Rehearsal with 20–30 real phones (mix of iPhone and Android)
- [ ] Rehearsal in the real venue, checking signal
- [ ] Fix problems found
- [ ] Write the final report: architecture diagram, sync algorithm explanation, load-test graphs, lessons learned
- [ ] Prepare the demo script (what to show, in what order)

---

## 6. Known Risks (keep in mind while coding)

| Risk | Plan |
|---|---|
| Phone screen sleeps | Wake Lock on a user tap; re-request when page is visible again |
| iPhone Safari has no Fullscreen API | Use `100dvh` and a clean full-color page |
| Weak signal / dropped connection | Auto-reconnect with backoff + state catch-up |
| Brightness can't be set by a website | Ask the user on the join screen |
| Many phones joining at once | Keep audience page tiny; add random delay before the first ping |
| Someone hijacks the controller | PIN checked on the server; ignore `cmd` from non-controllers |
| Free server sleeps when idle | Wake it before the event |

---

## 7. Definition of Done for Version 1

- [ ] 100 simulated phones + 10 real phones run a 30-minute show without a manual refresh
- [ ] All effects in section 4 work and stay visibly in sync
- [ ] Controller is PIN-protected
- [ ] Audience page size is small (target under about 100 KB, no frameworks) and the user has approved the final size
- [ ] Works on both iPhone Safari and Android Chrome
- [ ] Deployed on a free host and reachable from mobile data
- [ ] Load test report saved

---

## 8. Scaling Notes (do NOT build now, just keep the code ready)

- Every phone already carries a `group` field (always `0` in v1).
- Messages are plain JSON, so adding fields later is easy.
- To go past ~1,000 phones: move to a ~$5/month server first. Only add Redis pub/sub + multiple servers if you ever pass a few thousand.

---

## 9. FUTURE FEATURES (do NOT build in Version 1)

- Sections (Front/Back, Left/Right) and rows with a picker on the join screen
- Real room-shaped waves using sections/rows
- Images on phone screens (small, preloaded)
- Video playback
- Audio-reactive mode (laptop mic detects beats)
- Device numbers shown on screen
- Saved show scripts (program a show and play it back)
- Multiple controllers / operators
- Custom effects editor
- Show recording and replay
- Event analytics (joins, sync quality)
- Multiple shows/rooms at once
- Custom domain name
- Redis + multi-server scaling

---

## 10. PROGRESS LOG

Add one line per finished task. Format: `YYYY-MM-DD | Phase X | what was done | result/notes`

| Date | Phase | What was done | Notes |
|---|---|---|---|
| 2026-11-22 | Phase 1 | Project setup, folder structure, config.js, index.js (HTTP + WS), .gitignore, README.md | Server starts on port 3000, serves /audience/ and /controller/ |
| 2026-11-22 | Phase 1 | Manual test passed | Verified by user |
| 2026-11-22 | Phase 2 | Audience page built with Wake Lock, fullscreen, dynamic WS, hello/welcome, COLOR/BLACKOUT handling | Total size: 8.24 KB (HTML: 1.04 KB, CSS: 2.68 KB, JS: 4.53 KB) |
| 2026-11-22 | Phase 2 | Manual test passed | Verified by user |
| 2026-11-22 | Phase 3 | Clock sync (5-ping burst, RTT outlier filtering, 30s re-sync) & scheduled executeAt using requestAnimationFrame | Audience size: 12.5 KB (well below 100 KB target) |
