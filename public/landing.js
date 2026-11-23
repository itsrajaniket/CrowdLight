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

  const buttons = document.querySelectorAll('.sim-btn');
  const activeCueLabel = document.getElementById('sim-active-cue-label');
  const tickerOffset = document.getElementById('sim-ticker-offset');

  // Animation & interval tracking
  let currentRaf = null;
  let currentInterval = null;
  let currentTimers = [];
  let currentBpm = 128;
  let currentActiveSim = 'wave';

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

    crowdPhones.forEach(p => {
      if (p.screenEl) {
        p.screenEl.style.backgroundColor = hex;
        p.screenEl.style.boxShadow = `0 0 12px ${hex}88`;
      }
    });
  }

  // --- Effect: Stadium Wave (Ripple traveling across 24 devices) ---
  function applyWave() {
    stopAllEffects();
    currentActiveSim = 'wave';
    setCueLabel('STADIUM WAVE');
    const startTime = performance.now();
    const wavePeriod = 2000; // 2.0s per stadium sweep

    function loop(now) {
      const elapsed = now - startTime;

      crowdPhones.forEach(p => {
        if (!p.screenEl) return;

        // Wave travels from left (col 0) to right (col 8) with slight rear curve (row)
        const delay = (p.col * 160) + (p.row * 60);
        const phase = ((elapsed - delay) % wavePeriod + wavePeriod) % wavePeriod;
        const norm = phase / wavePeriod; // 0 to 1

        // Sharp wave crest using sin^6
        const crest = Math.pow(Math.sin(norm * Math.PI), 6);
        const lightness = 22 + crest * 54; // 22% base to 76% peak brightness
        const hue = 185 + Math.sin(norm * Math.PI) * 75; // Cyan (185) -> Indigo -> Magenta (260)

        p.screenEl.style.transition = 'none';
        p.screenEl.style.backgroundColor = `hsl(${hue}, 95%, ${lightness}%)`;
        p.screenEl.style.boxShadow = crest > 0.25 ? `0 0 ${Math.round(crest * 18)}px hsl(${hue}, 95%, 65%)` : 'none';

        // Subtle jump effect like fans standing in stadium wave
        const lift = crest * -5;
        p.phoneEl.style.transform = `translateY(${lift}px)`;
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

    function loop(now) {
      const elapsed = now - startTime;

      crowdPhones.forEach(p => {
        if (!p.screenEl) return;
        const hue = Math.round((p.col * 36 + p.row * 16 + elapsed * 0.14) % 360);
        p.screenEl.style.transition = 'none';
        p.screenEl.style.backgroundColor = `hsl(${hue}, 95%, 52%)`;
        p.screenEl.style.boxShadow = `0 0 10px hsl(${hue}, 95%, 52%)`;
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
      const shadow = isPeak ? '0 0 16px rgba(236, 72, 153, 0.85)' : 'none';
      const scale = isPeak ? 'scale(1.06)' : 'scale(1.0)';

      if (isPeak) {
        playSynth(130, 'triangle', 0.16, 0.35); // 808 sub kick
      }

      crowdPhones.forEach(p => {
        if (!p.screenEl) return;
        p.screenEl.style.transition = isPeak ? 'background-color 0.04s ease-out' : 'background-color 0.35s ease-in';
        p.screenEl.style.backgroundColor = bg;
        p.screenEl.style.boxShadow = shadow;
        p.phoneEl.style.transform = scale;
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
      const shadow = state ? '0 0 20px rgba(255, 255, 255, 0.95)' : 'none';

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

  // --- Effect: Live Text Flash across Stadium ---
  function applyTextFlash(rawText) {
    const text = (rawText || 'COLDPLAY').trim().toUpperCase().slice(0, 12);
    stopAllEffects();
    currentActiveSim = 'text-flash';
    setCueLabel(`TEXT FLASH: "${text}"`);
    playSynth(520, 'sine', 0.2, 0.35);

    // Tier 3 (Upper bowl, row 2) has 9 phones: index 0 to 8
    const tier3 = crowdPhones.filter(p => p.row === 2);
    const tier2 = crowdPhones.filter(p => p.row === 1);
    const tier1 = crowdPhones.filter(p => p.row === 0);

    let isFlash = false;
    function cycleFlash() {
      isFlash = !isFlash;
      const bg = isFlash ? '#6366f1' : '#141724';
      const shadow = isFlash ? '0 0 16px rgba(99, 102, 241, 0.85)' : 'none';

      // Distribute characters across Tier 3
      tier3.forEach((p, idx) => {
        p.screenEl.style.transition = 'background-color 0.08s ease';
        p.screenEl.style.backgroundColor = isFlash ? '#3b82f6' : '#141724';
        p.screenEl.style.boxShadow = shadow;
        if (p.textEl) {
          // If word fits within 9 chars, center it across Tier 3
          const offset = Math.max(0, Math.floor((9 - text.length) / 2));
          const charIdx = idx - offset;
          p.textEl.textContent = (isFlash && charIdx >= 0 && charIdx < text.length) ? text[charIdx] : '';
        }
      });

      // Tier 2 and Tier 1 flash harmonized energetic beat colors
      [...tier2, ...tier1].forEach(p => {
        p.screenEl.style.transition = 'background-color 0.08s ease';
        p.screenEl.style.backgroundColor = isFlash ? '#a855f7' : '#141724';
        p.screenEl.style.boxShadow = shadow;
        if (p.textEl) p.textEl.textContent = '';
      });

      if (isFlash) playSynth(440, 'triangle', 0.08, 0.2);
    }

    cycleFlash();
    currentInterval = setInterval(cycleFlash, 650);
  }

  // --- Effect: Stadium Ribbon Marquee ---
  function applyTextMarquee(rawText) {
    const text = `   ${(rawText || 'COLDPLAY').trim().toUpperCase()}   `;
    stopAllEffects();
    currentActiveSim = 'marquee';
    setCueLabel(`MARQUEE: "${text.trim()}"`);

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
      initAudio();
      playSynth(600, 'sine', 0.15, 0.3); // High touch ping

      const r0 = sourcePhone.row;
      const c0 = sourcePhone.col;

      crowdPhones.forEach(p => {
        const dx = p.col - c0;
        const dy = (p.row - r0) * 1.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const delayMs = dist * 75;

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

  // --- Attach Simulator Stage Trigger Buttons ---
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      initAudio();
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const simType = btn.dataset.sim;
      if (simType === 'wave') {
        applyWave();
      } else if (simType === 'rainbow') {
        applyRainbow();
      } else if (simType === 'pulse') {
        applyPulse();
      } else if (simType === 'strobe') {
        applyStrobe();
      } else if (simType === 'countdown') {
        applyCountdown();
      } else if (simType === 'blackout') {
        applyBlackout();
      } else if (simType === 'color') {
        const color = btn.dataset.color || '#ef4444';
        const label = btn.textContent.trim();
        applyColor(color, label);
      }
    });
  });

  // --- Tap Tempo Calculator ---
  const btnTapTempo = document.getElementById('btn-tap-tempo');
  const bpmDisplay = document.getElementById('sim-bpm-val');
  let tapTimestamps = [];

  if (btnTapTempo) {
    btnTapTempo.addEventListener('click', () => {
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
      initAudio();
      buttons.forEach(b => b.classList.remove('active'));
      const text = textInput?.value || 'COLDPLAY';
      applyTextFlash(text);
    });
  }

  if (btnMarqueeText) {
    btnMarqueeText.addEventListener('click', () => {
      initAudio();
      buttons.forEach(b => b.classList.remove('active'));
      const text = textInput?.value || 'COLDPLAY';
      applyTextMarquee(text);
    });
  }

  // Quick word chips
  document.querySelectorAll('.text-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      initAudio();
      const word = chip.dataset.word || 'COLDPLAY';
      if (textInput) textInput.value = word;
      buttons.forEach(b => b.classList.remove('active'));
      applyTextFlash(word);
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

  // Initialize with Stadium Wave running immediately on load
  applyWave();
  if (attendeeSlider) updateCalculator(attendeeSlider.value);
});
