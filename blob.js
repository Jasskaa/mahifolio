// ================================================================
// 3D liquid blob — lives only in the Hero, behind the name.
// Continuously flowing organic surface (time-based noise) that
// reacts to the mouse: hovering makes it bulge toward the cursor
// and churn faster; a click sends a little pulse through it.
// No scroll-linked behaviour — it just sits there.
// ================================================================

(function () {
  "use strict";

  // ---------- Compact 3D simplex noise (public-domain, Stefan Gustavson) ----------
  function SimplexNoise(seed) {
    this.p = new Uint8Array(256);
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    let s = seed || 1;
    const rand = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let i = 0; i < 256; i++) this.p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = this.p[i]; this.p[i] = this.p[j]; this.p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }
  SimplexNoise.grad3 = [
    [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
    [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
    [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
  ];
  SimplexNoise.prototype.noise3D = function (xin, yin, zin) {
    const grad3 = SimplexNoise.grad3;
    const permMod12 = this.permMod12, perm = this.perm;
    const F3 = 1 / 3, G3 = 1 / 6;
    let n0, n1, n2, n3;
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const X0 = i - t, Y0 = j - t, Z0 = k - t;
    const x0 = xin - X0, y0 = yin - Y0, z0 = zin - Z0;
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1=1;j1=0;k1=0; i2=1;j2=1;k2=0; }
      else if (x0 >= z0) { i1=1;j1=0;k1=0; i2=1;j2=0;k2=1; }
      else { i1=0;j1=0;k1=1; i2=1;j2=0;k2=1; }
    } else {
      if (y0 < z0) { i1=0;j1=0;k1=1; i2=0;j2=1;k2=1; }
      else if (x0 < z0) { i1=0;j1=1;k1=0; i2=0;j2=1;k2=1; }
      else { i1=0;j1=1;k1=0; i2=1;j2=1;k2=0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2*G3, y2 = y0 - j2 + 2*G3, z2 = z0 - k2 + 2*G3;
    const x3 = x0 - 1 + 3*G3, y3 = y0 - 1 + 3*G3, z3 = z0 - 1 + 3*G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
    if (t0 < 0) n0 = 0; else { const gi0 = permMod12[ii+perm[jj+perm[kk]]]; t0*=t0; n0 = t0*t0*(grad3[gi0][0]*x0+grad3[gi0][1]*y0+grad3[gi0][2]*z0); }
    let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    if (t1 < 0) n1 = 0; else { const gi1 = permMod12[ii+i1+perm[jj+j1+perm[kk+k1]]]; t1*=t1; n1 = t1*t1*(grad3[gi1][0]*x1+grad3[gi1][1]*y1+grad3[gi1][2]*z1); }
    let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    if (t2 < 0) n2 = 0; else { const gi2 = permMod12[ii+i2+perm[jj+j2+perm[kk+k2]]]; t2*=t2; n2 = t2*t2*(grad3[gi2][0]*x2+grad3[gi2][1]*y2+grad3[gi2][2]*z2); }
    let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    if (t3 < 0) n3 = 0; else { const gi3 = permMod12[ii+1+perm[jj+1+perm[kk+1]]]; t3*=t3; n3 = t3*t3*(grad3[gi3][0]*x3+grad3[gi3][1]*y3+grad3[gi3][2]*z3); }
    return 32 * (n0 + n1 + n2 + n3);
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function init() {
    const stage = document.getElementById("blob-stage");
    const canvas = document.getElementById("blob-canvas");
    if (!stage || !canvas || typeof THREE === "undefined") return;

    const noise = new SimplexNoise(7);

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 4.6); // pulled back for headroom: the magnet
    // drift + bulge + scale pulse must never reach the frustum edge, or the
    // sphere gets hard-clipped by perspective culling (looks like a flat cut)

    // Runtime-generated pink matcap (no external texture file)
    const matcapCanvas = document.createElement("canvas");
    matcapCanvas.width = 256; matcapCanvas.height = 256;
    const mctx = matcapCanvas.getContext("2d");
    const grad = mctx.createRadialGradient(96, 90, 10, 128, 128, 150);
    grad.addColorStop(0, "#FFE6F0");
    grad.addColorStop(0.35, "#F088B0");
    grad.addColorStop(0.7, "#D6488A");
    grad.addColorStop(1, "#8A2A5C");
    mctx.fillStyle = grad;
    mctx.fillRect(0, 0, 256, 256);
    const matcapTexture = new THREE.CanvasTexture(matcapCanvas);

    const geometry = new THREE.IcosahedronGeometry(1, 5);
    const posAttr = geometry.attributes.position;
    const baseDirs = [];
    for (let i = 0; i < posAttr.count; i++) {
      const v = new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).normalize();
      baseDirs.push(v);
    }

    const material = new THREE.MeshMatcapMaterial({ matcap: matcapTexture, color: 0xffffff });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // ---------- Pointer interaction ----------
    let pointerX = 0, pointerY = 0;      // normalized -1..1, target
    let dispX = 0, dispY = 0;            // smoothed/displayed
    let hoverTarget = 0, hover = 0;      // 0..1, smoothed
    let clickPulse = 0;                  // decays after a click

    function setPointerFromEvent(e) {
      const rect = stage.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      pointerX = clamp((e.clientX - cx) / (rect.width / 2), -1.4, 1.4);
      pointerY = clamp(-(e.clientY - cy) / (rect.height / 2), -1.4, 1.4);
    }

    stage.addEventListener("pointermove", (e) => {
      setPointerFromEvent(e);
      hoverTarget = 1;
    });
    stage.addEventListener("pointerenter", (e) => { setPointerFromEvent(e); hoverTarget = 1; });
    stage.addEventListener("pointerleave", () => { hoverTarget = 0; });
    stage.addEventListener("pointerdown", () => { clickPulse = 1; stage.classList.add("is-grabbing"); });
    window.addEventListener("pointerup", () => { stage.classList.remove("is-grabbing"); });

    // ---------- Shape/flow parameters ----------
    // Kept deliberately modest: this whole surface sits close to the
    // frustum edge once you add the magnet drift on top, so amplitude
    // here is a direct trade-off against clipping — see resize()/tick().
    const BASE_NOISE_AMP = 0.08;
    const BASE_NOISE_FREQ = 1.3;
    const FLOW_SPEED = 0.14;

    function applyShape(time) {
      const hoverAmp = 0.09 * hover;          // extra turbulence while hovered
      const hoverFreq = 0.8 * hover;          // faster-feeling grain while hovered
      const pulse = clickPulse * 0.2;
      const amp = BASE_NOISE_AMP + hoverAmp;
      const freq = BASE_NOISE_FREQ + hoverFreq;

      // mouse "poke" direction on the visible hemisphere
      const mx = dispX, my = dispY;
      const mz = Math.sqrt(Math.max(0, 1 - Math.min(1, mx * mx + my * my)));
      const mouseDir = new THREE.Vector3(mx, my, mz).normalize();

      for (let i = 0; i < posAttr.count; i++) {
        const dir = baseDirs[i];

        // two octaves — a slow big wave plus a faster small ripple on top —
        // reads as a liquid surface instead of a single smooth wobble
        const n1 = noise.noise3D(
          dir.x * freq + time * FLOW_SPEED,
          dir.y * freq - time * FLOW_SPEED * 0.7,
          dir.z * freq + time * FLOW_SPEED * 0.5
        );
        const n2 = noise.noise3D(
          dir.x * freq * 2.4 - time * FLOW_SPEED * 1.6,
          dir.y * freq * 2.4 + time * FLOW_SPEED * 1.1,
          dir.z * freq * 2.4 - time * FLOW_SPEED * 1.3
        );

        let radius = 1 + (n1 * 0.72 + n2 * 0.28) * amp;

        // bulge toward the cursor while hovering
        if (hover > 0.001) {
          const align = clamp(dir.dot(mouseDir), 0, 1);
          const bulge = Math.pow(align, 3.2) * 0.16 * hover;
          radius += bulge;
        }

        // click ripple: a soft ring pulse expanding from center
        if (pulse > 0.001) {
          radius += Math.sin(dir.length() * 6 - clickPulse * 6) * pulse * 0.25;
        }

        posAttr.setXYZ(i, dir.x * radius, dir.y * radius, dir.z * radius);
      }
      posAttr.needsUpdate = true;
      geometry.computeVertexNormals();
    }

    function resize() {
      const rect = stage.getBoundingClientRect();
      const size = Math.max(rect.width, 1);
      renderer.setSize(size, size, false);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);

    // ---------- Idle motion + render loop ----------
    let t0 = performance.now();
    function tick(now) {
      const dt = (now - t0) / 1000;
      t0 = now;
      const time = now / 1000;

      // smooth the interactive values so nothing snaps
      hover = lerp(hover, hoverTarget, 1 - Math.pow(0.001, dt));
      dispX = lerp(dispX, pointerX, 1 - Math.pow(0.0005, dt));
      dispY = lerp(dispY, pointerY, 1 - Math.pow(0.0005, dt));
      clickPulse = Math.max(0, clickPulse - dt * 1.4);

      const idleSpeed = 0.16 + hover * 0.22; // spins a bit faster while hovered
      mesh.rotation.y += dt * idleSpeed;
      mesh.rotation.x = Math.sin(time / 2.6) * 0.08;

      // magnet pull: the whole blob drifts toward the cursor while hovered,
      // on top of its gentle idle bob. Kept small and clamped on purpose —
      // the camera sits back further than you'd expect (see above)
      // specifically so this never reaches the frustum edge and clips.
      const MAGNET_STRENGTH = 0.16;
      mesh.position.x = clamp(dispX * MAGNET_STRENGTH * hover, -0.18, 0.18);
      mesh.position.y = Math.sin(time / 2.2) * 0.05 + clamp(dispY * MAGNET_STRENGTH * hover, -0.18, 0.18);

      const s = 1 + hover * 0.06 + clickPulse * 0.05;
      mesh.scale.setScalar(s);

      applyShape(time);

      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    stage.classList.add("is-loaded");
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
