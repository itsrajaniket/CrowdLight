// public/landing.js
// Interactive 24-Device Stadium Arena Simulator & Landing Page Interactions for CrowdLight

document.addEventListener('DOMContentLoaded', () => {
  // Query all 24 crowd phones in the stadium arena
  const crowdPhones = Array.from(document.querySelectorAll('.crowd-phone')).map(el => {
    return {
      phoneEl: el,
      screenEl: el.querySelector('.crowd-screen'),
      textEl: el.querySelector('.crowd-text'),
      id: parseInt(el.dataset.id, 10) || 0,
      row: parseInt(el.dataset.row, 10) || 0,
      col: parseFloat(el.dataset.col) || 0
    };
  });

  const allSimTriggers = document.querySelectorAll('[data-sim]');
  const activeCueLabel = document.getElementById('sim-active-cue-label');
  const tickerOffset = document.getElementById('sim-ticker-offset');
  const crowdHaze = document.getElementById('crowd-haze');
  const ledWallScreen = document.getElementById('led-wall-screen');
  const ledStageText = document.getElementById('led-stage-text');
  const ledStageSub = document.getElementById('led-stage-sub');

  function clearActiveTriggers() {
    document.querySelectorAll('[data-sim]').forEach(b => b.classList.remove('active'));
  }

  // Animation & interval tracking
  let currentRaf = null;
  let currentInterval = null;
  let currentTimers = [];
  let currentBpm = 128;
  let currentActiveSim = 'wave';
  let isAmbientActive = true;

  // --- Web Audio Synthesizer (Optional sound effects) ---
  let audioCtx = null;
  let soundEnabled = false;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playSynth(freq, type = 'sine', duration = 0.12, gainVal = 0.25) {
    if (!soundEnabled || !audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      if (type === 'triangle') {
        osc.frequency.exponentialRampToValueAtTime(35, audioCtx.currentTime + duration);
      }
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  function setCueLabel(label) {
    if (activeCueLabel) activeCueLabel.textContent = label.toUpperCase();
    if (ledStageText && currentActiveSim !== 'text-flash') {
      ledStageText.textContent = label.toUpperCase();
    }
    if (ledStageSub) {
      ledStageSub.textContent = `100 PHONES IN SYNC • ${currentBpm} BPM`;
    }
    if (tickerOffset) {
      const randomOffset = (0.12 + Math.random() * 0.2).toFixed(2);
      tickerOffset.textContent = `${randomOffset} ms`;
    }
  }

  function stopAllEffects() {
    if (currentRaf) {
      cancelAnimationFrame(currentRaf);
      currentRaf = null;
    }
    if (currentInterval) {
      clearInterval(currentInterval);
      currentInterval = null;
    }
    currentTimers.forEach(id => clearTimeout(id));
    currentTimers = [];

    if (ledWallScreen) {
      ledWallScreen.style.transform = '';
      ledWallScreen.style.backgroundColor = '#060810';
      ledWallScreen.style.boxShadow = '';
      ledWallScreen.style.borderColor = '';
    }
    if (ledStageText) {
      ledStageText.style.color = '#ffffff';
    }

    // Clear text and reset phone bounce/shadows
    crowdPhones.forEach(p => {
      if (p.textEl) p.textEl.textContent = '';
      if (p.phoneEl) p.phoneEl.style.transform = '';
      if (p.screenEl) {
        p.screenEl.style.transition = 'background-color 0.12s ease, box-shadow 0.12s ease';
        p.screenEl.style.boxShadow = 'none';
      }
    });
  }

  // --- Effect: Solid Lockstep Color ---
  function applyColor(hex, name = 'SOLID COLOR') {
    stopAllEffects();
    currentActiveSim = 'color';
    setCueLabel(name);
    playSynth(320, 'sine', 0.1, 0.15);

    if (crowdHaze) {
      crowdHaze.style.setProperty('--haze-c', `${hex}33`);
    }

    if (ledWallScreen) {
      ledWallScreen.style.setProperty('--led-glow', hex);
      ledWallScreen.style.setProperty('--led-wash', `${hex}44`);
      ledWallScreen.style.borderColor = hex;
    }

    crowdPhones.forEach(p => {
      if (p.screenEl) {
        p.screenEl.style.setProperty('--screen-c', hex);
        p.screenEl.style.backgroundColor = hex;
        p.screenEl.style.boxShadow = `0 0 8px ${hex}, 0 0 20px ${hex}88`;
      }
    });
  }

  // --- Effect: Stadium Wave (Ripple traveling across 100 devices) ---
  function applyWave(isSlow = false) {
    stopAllEffects();
    currentActiveSim = 'wave';
    setCueLabel(isSlow ? 'AMBIENT WAVE (LIVE)' : 'STADIUM WAVE');
    const startTime = performance.now();
    const wavePeriod = isSlow ? 3600 : 2200; // Slow ambient sweep (3.6s) or energetic stage sweep (2.2s)

    if (crowdHaze) {
      crowdHaze.style.setProperty('--haze-c', 'rgba(6, 182, 212, 0.22)');
    }

    if (ledWallScreen) {
      ledWallScreen.style.setProperty('--led-glow', '#06b6d4');
      ledWallScreen.style.setProperty('--led-wash', 'rgba(6, 182, 212, 0.35)');
      ledWallScreen.style.borderColor = '#06b6d4';
    }

    function loop(now) {
      const elapsed = now - startTime;

      crowdPhones.forEach(p => {
        if (!p.screenEl) return;

        // Wave travels across 100 devices from left to right with slight rear curve (row)
        const delay = (p.col * (isSlow ? 110 : 70)) + (p.row * (isSlow ? 80 : 50));
        const phase = ((elapsed - delay) % wavePeriod + wavePeriod) % wavePeriod;
        const norm = phase / wavePeriod; // 0 to 1

        // Sharp wave crest using sin^6
        const crest = Math.pow(Math.sin(norm * Math.PI), 6);
        const lightness = 22 + crest * 54; // 22% base to 76% peak brightness
        const hue = 185 + Math.sin(norm * Math.PI) * 75; // Cyan (185) -> Indigo -> Magenta (260)

        p.screenEl.style.transition = 'none';
        p.screenEl.style.backgroundColor = `hsl(${hue}, 95%, ${lightness}%)`;
        p.screenEl.style.boxShadow = crest > 0.2
          ? `0 0 ${Math.round(crest * 10 + 4)}px hsl(${hue}, 95%, 65%), 0 0 ${Math.round(crest * 22)}px hsl(${hue}, 95%, 45%)`
          : `0 0 4px hsl(${hue}, 80%, 25%)`;

        // Subtle jump effect like fans standing in stadium wave
        const lift = crest * -5;
        p.phoneEl.style.transform = `translateY(calc(var(--arc-y, 0px) + ${lift}px)) rotate(var(--arc-rot, 0deg))`;
      });

      currentRaf = requestAnimationFrame(loop);
    }

    currentRaf = requestAnimationFrame(loop);
  }

  // --- Effect: Rainbow Aurora Cascade ---
  function applyRainbow() {
    stopAllEffects();
    currentActiveSim = 'rainbow';
    setCueLabel('RAINBOW AURORA');
    const startTime = performance.now();

    if (crowdHaze) {
      crowdHaze.style.setProperty('--haze-c', 'rgba(168, 85, 247, 0.22)');
    }

    if (ledWallScreen) {
      ledWallScreen.style.setProperty('--led-glow', '#a855f7');
      ledWallScreen.style.setProperty('--led-wash', 'rgba(168, 85, 247, 0.35)');
      ledWallScreen.style.borderColor = '#a855f7';
    }

    function loop(now) {
      const elapsed = now - startTime;

      if (ledWallScreen) {
        const stageHue = Math.round((elapsed * 0.12) % 360);
        ledWallScreen.style.borderColor = `hsl(${stageHue}, 90%, 60%)`;
        ledWallScreen.style.boxShadow = `0 0 24px hsl(${stageHue}, 90%, 50%), inset 0 0 16px hsl(${stageHue}, 90%, 25%)`;
      }

      crowdPhones.forEach(p => {
        if (!p.screenEl) return;
        const hue = Math.round((p.col * 14 + p.row * 24 + elapsed * 0.14) % 360);
        p.screenEl.style.transition = 'none';
        p.screenEl.style.backgroundColor = `hsl(${hue}, 95%, 52%)`;
        p.screenEl.style.boxShadow = `0 0 6px hsl(${hue}, 95%, 60%), 0 0 16px hsl(${hue}, 95%, 45%)`;
      });

      currentRaf = requestAnimationFrame(loop);
    }

    currentRaf = requestAnimationFrame(loop);
  }

  // --- Effect: Beat Pulse (Synchronized bass drops) ---
  function applyPulse() {
    stopAllEffects();
    currentActiveSim = 'pulse';
    setCueLabel(`BEAT PULSE (${currentBpm} BPM)`);
    const periodMs = Math.round(60000 / currentBpm);
    let isPeak = false;

    function beat() {
      isPeak = !isPeak;
      const bg = isPeak ? '#ec4899' : '#140c1c';
      const shadow = isPeak ? '0 0 8px #ec4899, 0 0 22px rgba(236, 72, 153, 0.7)' : 'none';
      const scale = isPeak ? '1.08' : '1.0';

      if (crowdHaze) {
        crowdHaze.style.setProperty('--haze-c', isPeak ? 'rgba(236, 72, 153, 0.35)' : 'rgba(236, 72, 153, 0.05)');
      }

      if (ledWallScreen) {
        ledWallScreen.style.transform = isPeak ? 'scale(1.025)' : 'scale(1.0)';
        ledWallScreen.style.boxShadow = isPeak ? '0 0 32px #ec4899, inset 0 0 16px rgba(236,72,153,0.4)' : '0 0 12px rgba(236,72,153,0.3)';
        ledWallScreen.style.borderColor = isPeak ? '#ec4899' : 'rgba(236,72,153,0.3)';
      }

      if (isPeak) {
        playSynth(130, 'triangle', 0.16, 0.35); // 808 sub kick
      }

      crowdPhones.forEach(p => {
        if (!p.screenEl) return;
        p.screenEl.style.transition = isPeak ? 'background-color 0.04s ease-out' : 'background-color 0.35s ease-in';
        p.screenEl.style.backgroundColor = bg;
        p.screenEl.style.boxShadow = shadow;
        p.phoneEl.style.transform = `translateY(var(--arc-y, 0px)) rotate(var(--arc-rot, 0deg)) scale(${scale})`;
      });
    }

    beat();
    currentInterval = setInterval(beat, periodMs / 2);
  }

  // --- Effect: Arena Strobe (60ms high-speed flash) ---
  function applyStrobe() {
    stopAllEffects();
    currentActiveSim = 'strobe';
    setCueLabel('ARENA STROBE (60MS)');
    let state = false;

    currentInterval = setInterval(() => {
      state = !state;
      const color = state ? '#ffffff' : '#000000';
      const shadow = state ? '0 0 12px #ffffff, 0 0 28px rgba(255, 255, 255, 0.85)' : 'none';

      if (crowdHaze) {
        crowdHaze.style.setProperty('--haze-c', state ? 'rgba(255, 255, 255, 0.35)' : 'transparent');
      }

      if (ledWallScreen) {
        ledWallScreen.style.backgroundColor = state ? '#ffffff' : '#000000';
        ledWallScreen.style.boxShadow = state ? '0 0 44px #ffffff, inset 0 0 20px #ffffff' : 'none';
        ledWallScreen.style.borderColor = state ? '#ffffff' : '#111420';
      }
      if (ledStageText) {
        ledStageText.style.color = state ? '#000000' : '#ffffff';
      }

      if (state) playSynth(800, 'square', 0.02, 0.08);

      crowdPhones.forEach(p => {
        if (!p.screenEl) return;
        p.screenEl.style.transition = 'none';
        p.screenEl.style.backgroundColor = color;
        p.screenEl.style.boxShadow = shadow;
      });
    }, 60);
  }

  // --- Effect: Stadium Countdown (3 -> 2 -> 1 -> GO!) ---
  function applyCountdown() {
    stopAllEffects();
    currentActiveSim = 'countdown';
    setCueLabel('COUNTDOWN 3-2-1');

    const steps = [
      { num: '3', bg: '#f59e0b', shadow: '0 0 18px rgba(245, 158, 11, 0.8)', freq: 440, duration: 1000 },
      { num: '2', bg: '#eab308', shadow: '0 0 18px rgba(234, 179, 8, 0.8)', freq: 554, duration: 1000 },
      { num: '1', bg: '#06b6d4', shadow: '0 0 18px rgba(6, 182, 212, 0.8)', freq: 659, duration: 1000 },
      { num: 'GO!', bg: '#10b981', shadow: '0 0 24px rgba(16, 185, 129, 0.95)', freq: 880, duration: 1500 }
    ];

    function runSequence() {
      let accumTime = 0;
      steps.forEach((step, idx) => {
        const timer = setTimeout(() => {
          playSynth(step.freq, 'sine', 0.25, 0.3);

          if (ledStageText) {
            ledStageText.textContent = step.num;
          }
          if (ledWallScreen) {
            ledWallScreen.style.borderColor = step.bg;
            ledWallScreen.style.boxShadow = step.shadow;
            ledWallScreen.style.transform = 'scale(1.04)';
            setTimeout(() => { if (ledWallScreen) ledWallScreen.style.transform = ''; }, 140);
          }

          crowdPhones.forEach(p => {
            if (!p.screenEl) return;
            p.screenEl.style.transition = 'background-color 0.08s ease';
            p.screenEl.style.backgroundColor = step.bg;
            p.screenEl.style.boxShadow = step.shadow;
            if (p.textEl) p.textEl.textContent = step.num;
            p.phoneEl.style.transform = 'scale(1.08)';
            setTimeout(() => { p.phoneEl.style.transform = ''; }, 140);
          });

          if (idx === steps.length - 1) {
            const loopTimer = setTimeout(runSequence, step.duration);
            currentTimers.push(loopTimer);
          }
        }, accumTime);

        currentTimers.push(timer);
        accumTime += step.duration;
      });
    }

    runSequence();
  }

  // --- Effect: Live Text Flash across Stadium (Full word on every device) ---
  function applyTextFlash(rawText) {
    const text = (rawText || 'LIGHTS').trim().toUpperCase().slice(0, 12);
    stopAllEffects();
    currentActiveSim = 'text-flash';
    setCueLabel(`TEXT FLASH: "${text}"`);
    playSynth(520, 'sine', 0.2, 0.35);

    if (ledStageText) {
      ledStageText.textContent = text;
    }
    if (ledStageSub) {
      ledStageSub.textContent = `FLASH BROADCAST • ALL 100 PHONES`;
    }

    let isFlash = false;
    function cycleFlash() {
      isFlash = !isFlash;
      const bg = isFlash ? '#6366f1' : '#101320';
      const shadow = isFlash ? '0 0 16px rgba(99, 102, 241, 0.9)' : 'none';
      const scale = isFlash ? 'scale(1.06)' : 'scale(1.0)';

      if (ledWallScreen) {
        ledWallScreen.style.backgroundColor = isFlash ? '#4f46e5' : '#060810';
        ledWallScreen.style.boxShadow = isFlash ? '0 0 36px rgba(99, 102, 241, 0.95), inset 0 0 18px rgba(255, 255, 255, 0.4)' : 'none';
        ledWallScreen.style.borderColor = isFlash ? '#818cf8' : '#222538';
        ledWallScreen.style.transform = isFlash ? 'scale(1.03)' : 'scale(1.0)';
      }
      if (ledStageText) {
        ledStageText.style.color = isFlash ? '#ffffff' : '#818cf8';
        ledStageText.textContent = text;
      }

      // Display the full word on EVERY single phone in lockstep unison!
      crowdPhones.forEach(p => {
        if (!p.screenEl) return;
        p.screenEl.style.transition = 'background-color 0.08s ease, box-shadow 0.08s ease';
        p.screenEl.style.backgroundColor = bg;
        p.screenEl.style.boxShadow = shadow;
        p.phoneEl.style.transform = scale;
        if (p.textEl) {
          p.textEl.textContent = isFlash ? text : '';
        }
      });

      if (isFlash) playSynth(440, 'triangle', 0.08, 0.2);
    }

    cycleFlash();
    currentInterval = setInterval(cycleFlash, 650);
  }

  // --- Effect: Stadium Ribbon Marquee ---
  function applyTextMarquee(rawText) {
    const text = `   ${(rawText || 'LIGHTS').trim().toUpperCase()}   `;
    stopAllEffects();
    currentActiveSim = 'marquee';
    setCueLabel(`MARQUEE: "${text.trim()}"`);

    if (ledStageText) {
      ledStageText.textContent = (rawText || 'LIGHTS').trim().toUpperCase();
    }
    if (ledStageSub) {
      ledStageSub.textContent = 'STADIUM RIBBON MARQUEE';
    }

    let scrollPos = 0;
    const tier3 = crowdPhones.filter(p => p.row === 2);
    const otherPhones = crowdPhones.filter(p => p.row !== 2);

    function stepMarquee() {
      tier3.forEach((p, idx) => {
        const charIndex = (scrollPos + idx) % text.length;
        p.screenEl.style.transition = 'background-color 0.1s ease';
        p.screenEl.style.backgroundColor = '#0284c7';
        p.screenEl.style.boxShadow = '0 0 10px rgba(2, 132, 199, 0.6)';
        if (p.textEl) p.textEl.textContent = text[charIndex];
      });

      otherPhones.forEach(p => {
        const hue = Math.round((p.col * 30 + scrollPos * 12) % 360);
        p.screenEl.style.transition = 'none';
        p.screenEl.style.backgroundColor = `hsl(${hue}, 85%, 28%)`;
        p.screenEl.style.boxShadow = 'none';
      });

      scrollPos = (scrollPos + 1) % text.length;
      playSynth(280, 'sine', 0.04, 0.1);
    }

    stepMarquee();
    currentInterval = setInterval(stepMarquee, 280);
  }

  // --- Effect: Instant Blackout ---
  function applyBlackout() {
    stopAllEffects();
    currentActiveSim = 'blackout';
    setCueLabel('BLACKOUT (KILL-SWITCH)');
    playSynth(100, 'sine', 0.08, 0.2);

    if (crowdHaze) {
      crowdHaze.style.setProperty('--haze-c', 'transparent');
    }

    if (ledWallScreen) {
      ledWallScreen.style.backgroundColor = '#000000';
      ledWallScreen.style.boxShadow = 'none';
      ledWallScreen.style.borderColor = '#111420';
    }
    if (ledStageText) {
      ledStageText.textContent = 'BLACKOUT';
      ledStageText.style.color = '#333b50';
    }
    if (ledStageSub) {
      ledStageSub.textContent = 'ALL 100 CHANNELS OFF';
    }

    crowdPhones.forEach(p => {
      if (p.screenEl) {
        p.screenEl.style.transition = 'background-color 0.05s ease';
        p.screenEl.style.backgroundColor = '#000000';
        p.screenEl.style.boxShadow = 'none';
        p.phoneEl.style.transform = '';
      }
    });
  }

  // --- Interactive Phone Click / Touch Shockwave Ripple ---
  crowdPhones.forEach(sourcePhone => {
    sourcePhone.phoneEl.addEventListener('click', (e) => {
      e.stopPropagation();
      isAmbientActive = false;
      initAudio();
      playSynth(600, 'sine', 0.15, 0.3); // High touch ping

      const r0 = sourcePhone.row;
      const c0 = sourcePhone.col;

      crowdPhones.forEach(p => {
        const dx = (p.col - c0) * 0.8;
        const dy = (p.row - r0) * 1.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const delayMs = dist * 45;

        setTimeout(() => {
          if (!p.screenEl) return;
          const origBg = p.screenEl.style.backgroundColor;
          const origShadow = p.screenEl.style.boxShadow;

          p.screenEl.style.transition = 'background-color 0.04s ease-out, box-shadow 0.04s ease-out';
          p.screenEl.style.backgroundColor = '#ffffff';
          p.screenEl.style.boxShadow = '0 0 20px #38bdf8';
          p.phoneEl.style.transform = 'scale(1.12) translateY(-4px)';

          setTimeout(() => {
            p.screenEl.style.transition = 'background-color 0.3s ease-in, box-shadow 0.3s ease-in';
            p.screenEl.style.backgroundColor = origBg;
            p.screenEl.style.boxShadow = origShadow;
            p.phoneEl.style.transform = '';
          }, 180);
        }, delayMs);
      });
    });
  });

  // --- Attach Simulator Stage Trigger Buttons, Swatches & Blackout ---
  allSimTriggers.forEach(btn => {
    btn.addEventListener('click', () => {
      isAmbientActive = false;
      initAudio();
      clearActiveTriggers();
      btn.classList.add('active');

      const simType = btn.dataset.sim;
      if (simType === 'wave') {
        applyWave(false);
        sendLiveCommand('WAVE', { speedMs: 180, hex: '#38bdf8' });
      } else if (simType === 'rainbow') {
        applyRainbow();
        sendLiveCommand('COLOR', { hex: '#6366f1' });
      } else if (simType === 'pulse') {
        applyPulse();
        sendLiveCommand('PULSE', { bpm: currentBpm, hex: '#ec4899' });
      } else if (simType === 'strobe') {
        applyStrobe();
        sendLiveCommand('STROBE', { hex: '#ffffff', intervalMs: 100 });
      } else if (simType === 'countdown') {
        applyCountdown();
        sendLiveCommand('COUNTDOWN', { from: 3 });
      } else if (simType === 'blackout') {
        applyBlackout();
        sendLiveCommand('BLACKOUT');
      } else if (simType === 'color') {
        const color = btn.dataset.color || '#ef4444';
        const label = btn.title ? `SOLID ${btn.title.toUpperCase()}` : 'SOLID COLOR';
        applyColor(color, label);
        sendLiveCommand('COLOR', { hex: color });
      }
    });
  });

  // --- Inline Pro More Controls Toggle ---
  const btnToggleMore = document.getElementById('btn-toggle-more');
  const simMorePanel = document.getElementById('sim-more-panel');
  if (btnToggleMore && simMorePanel) {
    btnToggleMore.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = simMorePanel.hasAttribute('hidden');
      if (isHidden) {
        simMorePanel.removeAttribute('hidden');
        btnToggleMore.classList.add('open');
        btnToggleMore.setAttribute('aria-expanded', 'true');
      } else {
        simMorePanel.setAttribute('hidden', '');
        btnToggleMore.classList.remove('open');
        btnToggleMore.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // --- Tap Tempo Calculator ---
  const btnTapTempo = document.getElementById('btn-tap-tempo');
  const bpmDisplay = document.getElementById('sim-bpm-val');
  let tapTimestamps = [];

  if (btnTapTempo) {
    btnTapTempo.addEventListener('click', () => {
      isAmbientActive = false;
      initAudio();
      playSynth(440, 'triangle', 0.06, 0.25);
      const now = performance.now();
      tapTimestamps.push(now);
      if (tapTimestamps.length > 5) tapTimestamps.shift();

      if (tapTimestamps.length >= 2) {
        const intervals = [];
        for (let i = 1; i < tapTimestamps.length; i++) {
          intervals.push(tapTimestamps[i] - tapTimestamps[i - 1]);
        }
        const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        if (avgMs >= 250 && avgMs <= 2000) {
          currentBpm = Math.round(60000 / avgMs);
          if (bpmDisplay) bpmDisplay.textContent = currentBpm;
          if (currentActiveSim === 'pulse') applyPulse();
        }
      }

      // Visual tap bounce
      btnTapTempo.style.transform = 'scale(0.94)';
      setTimeout(() => { btnTapTempo.style.transform = ''; }, 100);
    });
  }

  // --- Sound Toggle Button ---
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  if (btnSoundToggle) {
    btnSoundToggle.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      if (soundEnabled) {
        initAudio();
        btnSoundToggle.textContent = '🔊 Sound: On';
        btnSoundToggle.classList.add('sound-on');
        playSynth(520, 'sine', 0.15, 0.3);
      } else {
        btnSoundToggle.textContent = '🔇 Sound: Off';
        btnSoundToggle.classList.remove('sound-on');
      }
    });
  }

  // --- Text Flash & Marquee Form Actions ---
  const textInput = document.getElementById('sim-text-input');
  const btnFlashText = document.getElementById('btn-flash-text');
  const btnMarqueeText = document.getElementById('btn-marquee-text');

  if (btnFlashText) {
    btnFlashText.addEventListener('click', () => {
      isAmbientActive = false;
      initAudio();
      clearActiveTriggers();
      const text = textInput?.value || 'LIGHTS';
      applyTextFlash(text);
      sendLiveCommand('TEXT', { text: text, hex: '#ffffff', bgHex: '#6366f1' });
    });
  }

  if (btnMarqueeText) {
    btnMarqueeText.addEventListener('click', () => {
      isAmbientActive = false;
      initAudio();
      clearActiveTriggers();
      const text = textInput?.value || 'LIGHTS';
      applyTextMarquee(text);
      sendLiveCommand('TEXT', { text: text, hex: '#ffffff', bgHex: '#0284c7' });
    });
  }

  // Quick word chips
  document.querySelectorAll('.text-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      isAmbientActive = false;
      initAudio();
      const word = chip.dataset.word || 'LIGHTS';
      if (textInput) textInput.value = word;
      clearActiveTriggers();
      applyTextFlash(word);
      sendLiveCommand('TEXT', { text: word, hex: '#ffffff', bgHex: '#6366f1' });
    });
  });

  // Smooth anchor scrolling for header links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || targetId === '') return;
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // --- Interactive Savings Calculator ---
  const attendeeSlider = document.getElementById('attendee-slider');
  const calcCountDisplay = document.getElementById('calc-attendee-count');
  const calcCostSaved = document.getElementById('calc-cost-saved');
  const calcWastePrevented = document.getElementById('calc-waste-prevented');
  const calcHoursSaved = document.getElementById('calc-hours-saved');

  function updateCalculator(val) {
    const attendees = parseInt(val, 10);
    if (isNaN(attendees)) return;

    if (calcCountDisplay) {
      calcCountDisplay.textContent = `${attendees.toLocaleString()} attendees`;
    }
    if (calcCostSaved) {
      const saved = attendees * 5; // $5 per wristband
      calcCostSaved.textContent = `$${saved.toLocaleString()}`;
    }
    if (calcWastePrevented) {
      calcWastePrevented.textContent = `${attendees.toLocaleString()}`;
    }
    if (calcHoursSaved) {
      const hours = Math.max(1, Math.round((attendees / 1000) * 1.5));
      calcHoursSaved.textContent = `${hours} hrs`;
    }
  }

  if (attendeeSlider) {
    attendeeSlider.addEventListener('input', (e) => {
      updateCalculator(e.target.value);
    });
  }

  // --- Toast Notification Helper ---
  const toast = document.getElementById('toast');
  let toastTimer = null;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // --- Email Copy Button ---
  const btnCopyEmail = document.getElementById('btn-copy-email');
  if (btnCopyEmail) {
    btnCopyEmail.addEventListener('click', () => {
      const email = 'itsrajaniket@gmail.com';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(() => {
          showToast('Email copied to clipboard!');
        }).catch(() => {
          prompt('Copy email:', email);
        });
      } else {
        prompt('Copy email:', email);
      }
    });
  }

  // --- Inquiry Form Submission ---
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('contact-name')?.value || 'Guest';
      const email = document.getElementById('contact-email')?.value || '';
      const purpose = document.getElementById('contact-purpose')?.value || 'General Inquiry';
      const message = document.getElementById('contact-message')?.value || '';

      const subject = encodeURIComponent(`[CrowdLight Demo / Inquiry] ${purpose} - ${name}`);
      const body = encodeURIComponent(
        `Hi Aniket,\n\nName: ${name}\nContact / LinkedIn: ${email}\nInquiry Purpose: ${purpose}\n\nMessage / Requirements:\n${message}\n\nSent from CrowdLight Web Portal`
      );

      showToast('Opening your email client...');
      window.location.href = `mailto:itsrajaniket@gmail.com?subject=${subject}&body=${body}`;
    });
  }

  // --- Live WebSocket Matrix Hub (Synchronizes Real Phones) ---
  let socket = null;
  let socketReconnectTimer = null;
  let realPhoneCount = 0;

  function initSimulatorWebSocket() {
    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.host;
      if (!wsHost) return;

      socket = new WebSocket(`${wsProtocol}//${wsHost}`);

      socket.addEventListener('open', () => {
        console.log('[Simulator Hub] Connected. Authenticating with sandbox PIN...');
        socket.send(JSON.stringify({
          type: 'hello',
          role: 'controller',
          pin: '1234'
        }));
      });

      socket.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'stats') {
            updateRealPhonePresence(msg.count);
          } else if (msg.type === 'cmd') {
            syncRemoteCueToSimulator(msg);
          }
        } catch (err) {
          console.warn('[Simulator Hub] Message error:', err);
        }
      });

      socket.addEventListener('close', () => {
        scheduleReconnect();
      });

      socket.addEventListener('error', () => {
        try { socket.close(); } catch (e) {}
      });
    } catch (err) {
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (socketReconnectTimer) clearTimeout(socketReconnectTimer);
    socketReconnectTimer = setTimeout(() => {
      initSimulatorWebSocket();
    }, 4000);
  }

  function sendLiveCommand(name, params = {}) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'cmd',
        name: name,
        params: params
      }));
    }
  }

  function updateRealPhonePresence(count) {
    realPhoneCount = Math.max(0, parseInt(count, 10) || 0);
    const phoneAnchor = document.getElementById('phone-real-anchor') || document.getElementById('phone-you');
    const realPill = document.getElementById('arena-real-pill');
    const realLabel = document.getElementById('real-phones-label');
    const virtualLabel = document.getElementById('arena-count-label');
    const dockDot = document.getElementById('dock-status-dot');
    const dockTitle = document.getElementById('dock-status-title');
    const dockSub = document.getElementById('dock-status-sub');
    const liveDock = document.getElementById('live-phone-dock');

    if (realPhoneCount > 0) {
      if (phoneAnchor) phoneAnchor.classList.add('real-device-active');
      if (liveDock) liveDock.classList.add('connected');
      if (dockDot) dockDot.classList.add('active');
      if (dockTitle) dockTitle.textContent = `🟢 Phone Linked (${realPhoneCount} Live)`;
      if (dockSub) dockSub.textContent = `Your real phone is receiving all stadium cues in live lockstep!`;
      if (realPill) realPill.classList.add('active');
      if (realLabel) realLabel.textContent = `${realPhoneCount} REAL PHONE${realPhoneCount > 1 ? 'S' : ''} CONNECTED (LIVE)`;
      if (virtualLabel) virtualLabel.textContent = `100 SIMULATED + ${realPhoneCount} REAL`;
    } else {
      if (phoneAnchor) phoneAnchor.classList.remove('real-device-active');
      if (liveDock) liveDock.classList.remove('connected');
      if (dockDot) dockDot.classList.remove('active');
      if (dockTitle) dockTitle.textContent = 'Connect Real Phone';
      if (dockSub) dockSub.textContent = 'Scan with phone to light up as a real device in this matrix!';
      if (realPill) realPill.classList.remove('active');
      if (realLabel) realLabel.textContent = '0 REAL PHONES CONNECTED';
      if (virtualLabel) virtualLabel.textContent = '100 SIMULATED PHONES';
    }
  }

  function syncRemoteCueToSimulator(cmd) {
    if (!cmd || !cmd.name) return;
    const p = cmd.params || {};
    if (cmd.name === 'COLOR') {
      applyColor(p.hex || '#ffffff', 'LIVE COLOR');
    } else if (cmd.name === 'BLACKOUT') {
      applyBlackout();
    } else if (cmd.name === 'STROBE') {
      applyStrobe();
    } else if (cmd.name === 'PULSE') {
      applyPulse();
    } else if (cmd.name === 'WAVE') {
      applyWave(false);
    } else if (cmd.name === 'COUNTDOWN') {
      applyCountdown();
    } else if (cmd.name === 'TEXT') {
      applyTextFlash(p.text || 'LIGHTS');
    }
  }

  // Start it alive: slow looping ambient wave on page load
  applyWave(true);
  initSimulatorWebSocket();
  if (attendeeSlider) updateCalculator(attendeeSlider.value);
});
