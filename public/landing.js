// public/landing.js
// Interactive Live Phone Simulator & Landing Page Interactions for CrowdLight

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const screens = [
    document.getElementById('sim-screen-1'),
    document.getElementById('sim-screen-2'),
    document.getElementById('sim-screen-3')
  ];

  const texts = [
    document.getElementById('sim-text-1'),
    document.getElementById('sim-text-2'),
    document.getElementById('sim-text-3')
  ];

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

    // Clear text
    texts.forEach(t => {
      if (t) t.textContent = '';
    });

    // Reset transition
    screens.forEach(s => {
      if (s) {
        s.style.transition = 'background-color 0.08s ease';
      }
    });
  }

  // --- Effect: Solid Color ---
  function applyColor(hex) {
    stopAllEffects();
    screens.forEach(s => {
      if (s) s.style.backgroundColor = hex;
    });
  }

  // --- Effect: Beat Pulse (128 BPM synchronized) ---
  function applyPulse() {
    stopAllEffects();
    const periodMs = Math.round(60000 / 128); // ~469ms
    let isPeak = false;

    function beat() {
      isPeak = !isPeak;
      const bg = isPeak ? '#ec4899' : '#1e1026';
      screens.forEach(s => {
        if (s) {
          s.style.transition = isPeak ? 'background-color 0.03s ease-out' : 'background-color 0.35s ease-in';
          s.style.backgroundColor = bg;
        }
      });
    }

    beat();
    currentInterval = setInterval(beat, periodMs / 2);
  }

  // --- Effect: Harmonic Crowd Wave (sequential stagger across 3 phones) ---
  function applyWave() {
    stopAllEffects();
    const startTime = performance.now();
    const wavePeriod = 2400; // 2.4s per cycle

    function loop(now) {
      const elapsed = now - startTime;
      
      screens.forEach((s, idx) => {
        if (!s) return;
        // Stagger phase by 400ms per device
        const deviceTime = elapsed - (idx * 400);
        // Compute hue sweeping across color spectrum (180 to 320: Cyan -> Blue -> Magenta)
        const progress = ((deviceTime % wavePeriod) + wavePeriod) % wavePeriod;
        const normalized = progress / wavePeriod; // 0 to 1
        
        // Crest brightness modulation
        const lightness = 40 + Math.sin(normalized * Math.PI * 2) * 25; // 15% to 65%
        const hue = 200 + Math.sin(normalized * Math.PI * 2) * 60; // 140 to 260
        s.style.transition = 'none';
        s.style.backgroundColor = `hsl(${hue}, 95%, ${lightness}%)`;
      });

      currentRaf = requestAnimationFrame(loop);
    }

    currentRaf = requestAnimationFrame(loop);
  }

  // --- Effect: Strobe (60ms rapid alternating) ---
  function applyStrobe() {
    stopAllEffects();
    let state = false;
    currentInterval = setInterval(() => {
      state = !state;
      const color = state ? '#ffffff' : '#000000';
      screens.forEach(s => {
        if (s) {
          s.style.transition = 'none';
          s.style.backgroundColor = color;
        }
      });
    }, 60);
  }

  // --- Effect: Synchronized Countdown (3 -> 2 -> 1 -> GO!) ---
  function applyCountdown() {
    stopAllEffects();

    const steps = [
      { num: '3', bg: '#f59e0b', duration: 1000 },
      { num: '2', bg: '#eab308', duration: 1000 },
      { num: '1', bg: '#06b6d4', duration: 1000 },
      { num: 'GO!', bg: '#10b981', duration: 1500 }
    ];

    function runSequence() {
      let accumTime = 0;
      steps.forEach((step, idx) => {
        const timer = setTimeout(() => {
          screens.forEach(s => {
            if (s) {
              s.style.transition = 'background-color 0.1s ease';
              s.style.backgroundColor = step.bg;
            }
          });
          texts.forEach(t => {
            if (t) t.textContent = step.num;
          });

          // After GO!, loop sequence again
          if (idx === steps.length - 1) {
            const loopTimer = setTimeout(() => {
              runSequence();
            }, step.duration);
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
    screens.forEach(s => {
      if (s) {
        s.style.transition = 'background-color 0.05s ease';
        s.style.backgroundColor = '#000000';
      }
    });
  }

  // Attach simulator button event listeners
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const simType = btn.dataset.sim;
      if (simType === 'color') {
        const color = btn.dataset.color || '#ef4444';
        applyColor(color);
      } else if (simType === 'pulse') {
        applyPulse();
      } else if (simType === 'wave') {
        applyWave();
      } else if (simType === 'strobe') {
        applyStrobe();
      } else if (simType === 'countdown') {
        applyCountdown();
      } else if (simType === 'blackout') {
        applyBlackout();
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

  // Initialize with initial active state
  applyColor('#ef4444');
  if (attendeeSlider) updateCalculator(attendeeSlider.value);
});
