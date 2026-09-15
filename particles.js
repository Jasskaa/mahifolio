// ================================================================
// Hero portrait particles — samples Manheer's photo into a field of
// tiny colored squares that assemble into the portrait near the
// bottom of the Hero on load. Only the particles the cursor actually
// passes over drift slowly away from it (each in a slightly random
// direction, not all toward/away from a single point) — everything
// else stays put. 3 seconds after a particle was last touched it
// glides gently back home on its own. Subtle on purpose, not a big
// explosion. Desktop only (mobile shows the CTA buttons instead —
// see styles.css), never blocks clicks (canvas sits behind the name,
// which has pointer-events:none).
// ================================================================

(function () {
  "use strict";

  const hero = document.getElementById("hero");
  const canvas = document.getElementById("particles-canvas");
  if (!hero || !canvas) return;

  const MOBILE_QUERY = "(max-width: 720px)";
  if (window.matchMedia(MOBILE_QUERY).matches) return; // hidden on mobile, skip entirely

  const ctx = canvas.getContext("2d");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const GAP = 2.8;                // spacing between sampled pixels
  const ALPHA_THRESHOLD = 120;
  const IDLE_AMP = 1.3;           // subtle constant drift while resting

  const ENTRANCE_DURATION = 850;  // ms — fast, crisp assemble-in on load
  const ENTRANCE_SPREAD = 70;

  const RADIUS = 70;              // only particles this close to the cursor react
  const PUSH_FORCE = 0.32;        // gentle nudge away from the cursor
  const JITTER = 0.9;             // rad — random spread so the push isn't a clean uniform ring
  const FRICTION = 0.965;         // close to 1 = long, slow, floaty drift
  const RETURN_DELAY = 3000;      // ms after last being touched before it starts heading home
  const RETURN_EASE = 0.02;       // very slow glide back to rest

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  let W = 0, H = 0, dpr = 1;
  let particles = [];
  let mouse = { x: -9999, y: -9999 };

  let phase = "entrance"; // "entrance" | "live" (idle/displaced/returning are all per-particle after this)
  let phaseStart = 0;
  let started = false;
  let rafId = null;

  const img = new Image();

  function buildParticles() {
    const rect = hero.getBoundingClientRect();
    W = Math.max(rect.width, 1);
    H = Math.max(rect.height, 1);
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // resting portrait box: big, centered, flush with the bottom edge
    const boxW = Math.min(560, W * 0.42);
    const boxH = boxW * (img.naturalHeight / img.naturalWidth || 418 / 420);
    const offsetX = (W - boxW) / 2;
    const offsetY = H - boxH;

    const off = document.createElement("canvas");
    off.width = Math.round(boxW);
    off.height = Math.round(boxH);
    const octx = off.getContext("2d");
    octx.clearRect(0, 0, off.width, off.height);
    octx.drawImage(img, 0, 0, off.width, off.height);
    const data = octx.getImageData(0, 0, off.width, off.height).data;

    particles = [];
    for (let y = 0; y < off.height; y += GAP) {
      for (let x = 0; x < off.width; x += GAP) {
        const idx = (Math.floor(y) * off.width + Math.floor(x)) * 4;
        const a = data[idx + 3];
        if (a < ALPHA_THRESHOLD) continue; // skip transparent background
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        const ox = x + offsetX, oy = y + offsetY;
        const sx = ox + (Math.random() - 0.5) * ENTRANCE_SPREAD * 2;
        const sy = oy + (Math.random() - 0.5) * ENTRANCE_SPREAD * 2;
        particles.push({
          ox, oy,                 // resting position (forms the portrait)
          ex: sx, ey: sy,         // entrance start position
          x: sx, y: sy,           // live position
          vx: 0, vy: 0,
          color: `rgb(${r},${g},${b})`,
          size: Math.random() * 1.1 + 1.7,
          phase: Math.random() * Math.PI * 2,
          speed: 0.15 + Math.random() * 0.2,
          jitter: (Math.random() - 0.5) * JITTER, // fixed personal randomness to the push angle
          disturbedAt: -Infinity
        });
      }
    }
  }

  function setMouseFromClient(clientX, clientY) {
    const rect = hero.getBoundingClientRect();
    mouse.x = clientX - rect.left;
    mouse.y = clientY - rect.top;
  }

  hero.addEventListener("mousemove", (e) => setMouseFromClient(e.clientX, e.clientY));
  hero.addEventListener("mouseleave", () => { mouse.x = -9999; mouse.y = -9999; });
  hero.addEventListener(
    "touchmove",
    (e) => {
      if (!e.touches || !e.touches.length) return;
      setMouseFromClient(e.touches[0].clientX, e.touches[0].clientY);
    },
    { passive: true }
  );
  hero.addEventListener("touchend", () => { mouse.x = -9999; mouse.y = -9999; });

  function stepParticle(p, now) {
    const dx = p.x - mouse.x;
    const dy = p.y - mouse.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

    if (dist < RADIUS) {
      const angle = Math.atan2(dy, dx) + p.jitter;
      const strength = (1 - dist / RADIUS) * PUSH_FORCE;
      p.vx += Math.cos(angle) * strength;
      p.vy += Math.sin(angle) * strength;
      p.disturbedAt = now;
    }

    const idleOx = p.ox + Math.cos(now / 1000 * p.speed + p.phase) * IDLE_AMP;
    const idleOy = p.oy + Math.sin(now / 1000 * p.speed + p.phase) * IDLE_AMP;

    if (now - p.disturbedAt > RETURN_DELAY) {
      // long since touched: slow glide back to its resting spot
      p.vx += (idleOx - p.x) * RETURN_EASE;
      p.vy += (idleOy - p.y) * RETURN_EASE;
    }
    // else: recently touched — just drift on its own momentum, no pull yet

    p.vx *= FRICTION;
    p.vy *= FRICTION;
    p.x += p.vx;
    p.y += p.vy;
  }

  function drawFrame(now) {
    ctx.clearRect(0, 0, W, H);

    if (phase === "entrance") {
      const t = Math.min(1, (now - phaseStart) / ENTRANCE_DURATION);
      const eased = easeOutCubic(t);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x = p.ex + (p.ox - p.ex) * eased;
        p.y = p.ey + (p.oy - p.ey) * eased;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      if (t >= 1) phase = "live";
      rafId = requestAnimationFrame(drawFrame);
      return;
    }

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      stepParticle(p, now);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }

    rafId = requestAnimationFrame(drawFrame);
  }

  function drawStatic() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.ox, p.oy, p.size, p.size);
    });
  }

  function start() {
    if (started) return;
    started = true;
    buildParticles();
    hero.classList.add("is-loaded");
    if (prefersReducedMotion) {
      drawStatic();
    } else {
      phase = "entrance";
      phaseStart = performance.now();
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(drawFrame);
    }
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.matchMedia(MOBILE_QUERY).matches) return; // canvas is display:none
      if (!started) return;
      buildParticles();
      phase = "live";
      if (prefersReducedMotion) drawStatic();
    }, 150);
  });

  img.onload = start;
  img.onerror = () => { /* keep the static <img> fallback visible */ };
  img.src = "assets/particles-source.png";
})();
