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

  // Animation & interval tracking
  let currentRaf = null;
  let currentInterval = null;
  let currentTimers = [];

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
  function applyColor(hex) {
    stopAllEffects();
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

  // --- Effect: Beat Pulse (128 BPM synchronized bass drops) ---
  function applyPulse() {
    stopAllEffects();
    const periodMs = Math.round(60000 / 128); // ~469ms
    let isPeak = false;

    function beat() {
      isPeak = !isPeak;
      const bg = isPeak ? '#ec4899' : '#140c1c';
      const shadow = isPeak ? '0 0 16px rgba(236, 72, 153, 0.85)' : 'none';
      const scale = isPeak ? 'scale(1.06)' : 'scale(1.0)';

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
    let state = false;

    currentInterval = setInterval(() => {
      state = !state;
      const color = state ? '#ffffff' : '#000000';
      const shadow = state ? '0 0 20px rgba(255, 255, 255, 0.95)' : 'none';

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

    const steps = [
      { num: '3', bg: '#f59e0b', shadow: '0 0 18px rgba(245, 158, 11, 0.8)', duration: 1000 },
      { num: '2', bg: '#eab308', shadow: '0 0 18px rgba(234, 179, 8, 0.8)', duration: 1000 },
      { num: '1', bg: '#06b6d4', shadow: '0 0 18px rgba(6, 182, 212, 0.8)', duration: 1000 },
      { num: 'GO!', bg: '#10b981', shadow: '0 0 24px rgba(16, 185, 129, 0.95)', duration: 1500 }
    ];

    function runSequence() {
      let accumTime = 0;
      steps.forEach((step, idx) => {
        const timer = setTimeout(() => {
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

  // --- Effect: Instant Blackout ---
  function applyBlackout() {
    stopAllEffects();
    crowdPhones.forEach(p => {
      if (p.screenEl) {
        p.screenEl.style.transition = 'background-color 0.05s ease';
        p.screenEl.style.backgroundColor = '#000000';
        p.screenEl.style.boxShadow = 'none';
      }
    });
  }

  // Attach simulator button event listeners
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
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
        applyColor(color);
      }
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
