// ================================================================
// Hero particle field — small pink dots that scatter away from the
// cursor and drift back to their resting spot. Pure Canvas 2D, no
// external libraries, lives only in the Hero (behind the name, never
// blocks clicks — pointer-events stays off the canvas).
// ================================================================

(function () {
  "use strict";

  const canvas = document.getElementById("particles-canvas");
  const hero = document.getElementById("hero");
  if (!canvas || !hero) return;

  const ctx = canvas.getContext("2d");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const COLORS = ["#F6B3CD", "#F088B0", "#EC6A9C", "#D6488A"];
  const REPEL_RADIUS = 110;
  const REPEL_STRENGTH = 2.6;
  const SPRING = 0.02;
  const DAMPING = 0.88;

  let width = 0, height = 0, dpr = 1;
  let particles = [];
  let mouse = { x: -9999, y: -9999, active: false };
  let rafId = null;

  function particleCount(w, h) {
    const area = w * h;
    const density = w < 640 ? 9000 : 6500; // fewer particles on small screens
    return Math.max(24, Math.min(150, Math.round(area / density)));
  }

  function buildParticles() {
    const count = particleCount(width, height);
    particles = new Array(count).fill(0).map(() => {
      const ox = Math.random() * width;
      const oy = Math.random() * height;
      return {
        ox, oy,
        x: ox, y: oy,
        vx: 0, vy: 0,
        r: 1.4 + Math.random() * 2.2,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        alpha: 0.35 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.5
      };
    });
  }

  function resize() {
    const rect = hero.getBoundingClientRect();
    width = Math.max(rect.width, 1);
    height = Math.max(rect.height, 1);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildParticles();
  }

  function updateMouseFromClient(clientX, clientY) {
    const rect = hero.getBoundingClientRect();
    mouse.x = clientX - rect.left;
    mouse.y = clientY - rect.top;
  }

  hero.addEventListener("mousemove", (e) => {
    updateMouseFromClient(e.clientX, e.clientY);
    mouse.active = true;
  });
  hero.addEventListener("mouseleave", () => { mouse.active = false; });
  hero.addEventListener(
    "touchmove",
    (e) => {
      if (!e.touches || !e.touches.length) return;
      updateMouseFromClient(e.touches[0].clientX, e.touches[0].clientY);
      mouse.active = true;
    },
    { passive: true }
  );
  hero.addEventListener("touchend", () => { mouse.active = false; });

  function drawFrame(time) {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // gentle idle drift around the resting position
      const idleX = p.ox + Math.cos(time / 1000 * p.speed + p.phase) * 2.5;
      const idleY = p.oy + Math.sin(time / 1000 * p.speed + p.phase) * 2.5;

      if (mouse.active) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        if (dist < REPEL_RADIUS) {
          const force = (1 - dist / REPEL_RADIUS) * REPEL_STRENGTH;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }
      }

      // spring back toward the (idly drifting) resting position
      p.vx += (idleX - p.x) * SPRING;
      p.vy += (idleY - p.y) * SPRING;

      p.vx *= DAMPING;
      p.vy *= DAMPING;
      p.x += p.vx;
      p.y += p.vy;

      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    rafId = requestAnimationFrame(drawFrame);
  }

  function drawStatic() {
    ctx.clearRect(0, 0, width, height);
    particles.forEach((p) => {
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.arc(p.ox, p.oy, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function start() {
    resize();
    if (prefersReducedMotion) {
      drawStatic();
    } else {
      rafId = requestAnimationFrame(drawFrame);
    }
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      if (prefersReducedMotion) drawStatic();
    }, 150);
  });

  if (document.readyState === "complete" || document.readyState === "interactive") {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start);
  }
})();
