// ============================================
// 3D COMIC FOREST — Interactive Attendees
// - Multi-CDN fallback loader untuk Three.js
// - Drag orbit, scroll zoom
// - Attendee guysung (bobbing) dengan balon komik
// ============================================

(function () {
  "use strict";

  const THREE_CDNS = [
    "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
    "https://unpkg.com/three@0.128.0/build/three.min.js",
    "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"
  ];

  const MAX_ATTENDEES = 150;
  const AUTO_ROTATE_SPEED = 0.12;
  const REFRESH_INTERVAL_MS = 30000;

  // Isi dengan URL Web App dari Google Apps Script (doGet) yang mengembalikan
  // [{ name, message }] dari Google Sheet.
  const GUESTBOOK_DATA_URL =
    "https://script.google.com/macros/s/AKfycbzh4TS1I41RnHn5NFmEGXO7jzdgQbBxF0USHKswwe32H_r7c1OkM7RDztCsXtmcuo17Tg/exec";

  const $status = () => document.getElementById("forest-status");

  function setStatus(message, isError) {
    const el = $status();
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("hidden", !message);
    el.classList.toggle("error", !!isError);
  }

  function webglAvailable() {
    try {
      const canvas = document.createElement("canvas");
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
      );
    } catch (e) {
      return false;
    }
  }

  // Load Three.js dari daftar CDN secara berurutan (fallback)
  function loadThree(index, onReady, onFail) {
    if (typeof THREE !== "undefined") { onReady(); return; }
    if (index >= THREE_CDNS.length) { onFail(); return; }

    setStatus("Loading 3D engine...");
    const script = document.createElement("script");
    script.src = THREE_CDNS[index];
    script.async = false;
    script.onload = () => { setStatus(""); onReady(); };
    script.onerror = () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      setTimeout(() => loadThree(index + 1, onReady, onFail), 0);
    };
    document.head.appendChild(script);
  }

  // ============================================
  // INIT 3D
  // ============================================
  function init3D() {
    const container = document.getElementById("canvas-container");
    const attendeeCountElement = document.getElementById("attendee-count");

    if (!container) return;

    // ---------- Scene ----------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa0d8ef);
    scene.fog = new THREE.FogExp2(0xa0d8ef, 0.012);

    // ---------- Camera ----------
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 5, 25);

    // ---------- Renderer ----------
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch (err) {
      setStatus("WebGL gagal diinisialisasi: " + err.message, true);
      return;
    }

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // ---------- Lights ----------
    const ambient = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 0.6);
    sun.position.set(20, 40, 20);
    sun.castShadow = true;
    scene.add(sun);

    // ---------- Ground ----------
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220),
      new THREE.MeshToonMaterial({ color: 0x4e8752 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // ---------- Trees ----------
    const trunkColors = [0x5a3d28, 0x6b4a2f, 0x4f3321];
    const foliageColors = [0x2e6f40, 0x3a7d44, 0x1f5f33];

    function createTree(x, z) {
      const group = new THREE.Group();

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.6, 4, 8),
        new THREE.MeshToonMaterial({
          color: trunkColors[(Math.random() * trunkColors.length) | 0]
        })
      );
      trunk.position.y = 2;
      trunk.castShadow = true;
      group.add(trunk);

      const foliageMaterial = new THREE.MeshToonMaterial({
        color: foliageColors[(Math.random() * foliageColors.length) | 0]
      });

      const cone1 = new THREE.Mesh(
        new THREE.ConeGeometry(2.5, 4, 8),
        foliageMaterial
      );
      cone1.position.y = 4.5;
      cone1.castShadow = true;
      group.add(cone1);

      const cone2 = new THREE.Mesh(
        new THREE.ConeGeometry(2, 3.5, 8),
        foliageMaterial
      );
      cone2.position.y = 6;
      cone2.castShadow = true;
      group.add(cone2);

      const scale = 0.8 + Math.random() * 0.5;
      group.scale.set(scale, scale, scale);
      group.position.set(x, 0, z);
      group.rotation.y = Math.random() * Math.PI * 2;

      return group;
    }

    for (let i = 0; i < 80; i++) {
      const x = (Math.random() - 0.5) * 130;
      const z = (Math.random() - 0.5) * 130;
      if (x * x + z * z < 170) continue; // lapangan di tengah tetap bersih
      scene.add(createTree(x, z));
    }

    // ---------- Comic Person Texture ----------
    const shirtColors = ["#e74c3c", "#3498db", "#9b59b6", "#f1c40f", "#e67e22", "#2ecc71"];

    function wrapText(ctx, text, maxWidth) {
      const words = text.split(/\s+/);
      const lines = [];
      let line = "";
      for (let i = 0; i < words.length; i++) {
        const candidate = line ? line + " " + words[i] : words[i];
        if (ctx.measureText(candidate).width > maxWidth && line) {
          lines.push(line);
          line = words[i];
        } else {
          line = candidate;
        }
      }
      if (line) lines.push(line);
      return lines;
    }

    function createComicPersonTexture(name, message) {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // --- Speech bubble ---
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 6;

      const bx = 40, by = 40, bw = 432, bh = 200, radius = 20;
      ctx.beginPath();
      ctx.moveTo(bx + radius, by);
      ctx.lineTo(bx + bw - radius, by);
      ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + radius);
      ctx.lineTo(bx + bw, by + bh - radius);
      ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - radius, by + bh);
      ctx.lineTo(bx + bw / 2 + 30, by + bh);
      ctx.lineTo(bx + bw / 2 - 30, by + bh);
      ctx.lineTo(bx + radius, by + bh);
      ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - radius);
      ctx.lineTo(bx, by + radius);
      ctx.quadraticCurveTo(bx, by, bx + radius, by);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // --- Name ---
      ctx.fillStyle = "#000000";
      ctx.textAlign = "center";
      ctx.font = 'bold 26px "Comic Sans MS", "Comic Sans", cursive, sans-serif';
      ctx.fillText(name.substring(0, 18), canvas.width / 2, 85);

      // --- Message (auto-wrap + auto-shrink) ---
      const shortMessage = message.substring(0, 120);
      let lines = [];
      for (let i = 0; i < [20, 16, 14].length; i++) {
        const size = [20, 16, 14][i];
        ctx.font = size + 'px "Comic Sans MS", "Comic Sans", cursive, sans-serif';
        lines = wrapText(ctx, shortMessage, bw - 50);
        if (lines.length <= 4) break;
      }
      lines = lines.slice(0, 4);

      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], canvas.width / 2, 122 + i * 28);
      }

      // --- Little character ---
      const cx = canvas.width / 2;
      const cy = 395;
      const shirtColor = shirtColors[(Math.random() * shirtColors.length) | 0];

      ctx.lineWidth = 5;
      ctx.strokeStyle = "#000000";

      ctx.fillStyle = "#ffdbac";
      ctx.beginPath();
      ctx.arc(cx, cy - 40, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(cx - 7, cy - 45, 3, 0, Math.PI * 2);
      ctx.arc(cx + 7, cy - 45, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy - 40, 12, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();

      ctx.fillStyle = shirtColor;
      ctx.beginPath();
      ctx.moveTo(cx - 20, cy - 15);
      ctx.lineTo(cx + 20, cy - 15);
      ctx.lineTo(cx + 25, cy + 40);
      ctx.lineTo(cx - 25, cy + 40);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - 10, cy + 40);
      ctx.lineTo(cx - 10, cy + 90);
      ctx.moveTo(cx + 10, cy + 40);
      ctx.lineTo(cx + 10, cy + 90);
      ctx.stroke();

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    }

    // ---------- Attendee System ----------
    const processedMessages = new Set();
    const attendees = [];

    function updateCounter() {
      if (attendeeCountElement) {
        attendeeCountElement.innerText = String(attendees.length);
      }
    }

    function addAttendee(name, message) {
      name = (name || "").trim().substring(0, 18);
      message = (message || "").trim().substring(0, 120);
      if (!name || !message) return;

      const key = name + "\u0000" + message;
      if (processedMessages.has(key)) return;
      processedMessages.add(key);

      const texture = createComicPersonTexture(name, message);
      if (!texture) return;

      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(material);

      const angle = Math.random() * Math.PI * 2;
      const distance = 5 + Math.random() * 24;

      sprite.userData = {
        home: new THREE.Vector3(
          Math.sin(angle) * distance,
          3.5,
          Math.cos(angle) * distance - 5
        ),
        phase: Math.random() * Math.PI * 2
      };
      sprite.position.copy(sprite.userData.home);
      sprite.scale.set(6, 6, 1);

      scene.add(sprite);
      attendees.push(sprite);
      updateCounter();

      // Batasi jumlah textur di memori
      if (attendees.length > MAX_ATTENDEES) {
        const oldest = attendees.shift();
        scene.remove(oldest);
        oldest.material.map.dispose();
        oldest.material.dispose();
        updateCounter();
      }
    }

    // ---------- Load dari Google Sheet (Apps Script doGet) ----------
    const refreshButton = document.getElementById("refresh-btn");
    let refreshTimer = null;

    async function loadAttendees() {
      if (!GUESTBOOK_DATA_URL || GUESTBOOK_DATA_URL.indexOf("XXXX") !== -1) {
        setStatus("GUESTBOOK_DATA_URL belum diisi di script.js", true);
        return;
      }
      if (refreshButton) refreshButton.classList.add("loading");
      try {
        const response = await fetch(
          GUESTBOOK_DATA_URL + "?t=" + Date.now(),
          { cache: "no-store" }
        );
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.json();
        if (Array.isArray(data)) {
          for (let i = 0; i < data.length; i++) {
            addAttendee(data[i].name, data[i].message);
          }
        }
      } catch (err) {
        setStatus("Gagal memuat pesan dari Google Sheet: " + err.message, true);
      } finally {
        if (refreshButton) refreshButton.classList.remove("loading");
      }
    }

    if (refreshButton) refreshButton.addEventListener("click", loadAttendees);

    // Muat awal + auto-refresh berkala
    setTimeout(loadAttendees, 500);
    refreshTimer = setInterval(loadAttendees, REFRESH_INTERVAL_MS);

    // ---------- Camera Controls (drag + scroll) ----------
    let yaw = 0;
    let pitch = 0.35;
    let pitchTarget = 0.35;
    let zoom = 32;
    let zoomTarget = 32;
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let lastInteraction = 0;

    const domElement = renderer.domElement;

    domElement.addEventListener("pointerdown", (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      lastInteraction = performance.now();
      if (domElement.setPointerCapture) {
        try { domElement.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      }
    });

    domElement.addEventListener("pointermove", (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      yaw -= dx * 0.005;
      pitchTarget = Math.max(0.05, Math.min(1.2, pitchTarget + dy * 0.005));
      lastInteraction = performance.now();
    });

    const endDrag = () => { isDragging = false; };
    domElement.addEventListener("pointerup", endDrag);
    domElement.addEventListener("pointercancel", endDrag);

    domElement.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        zoomTarget = Math.max(14, Math.min(70, zoomTarget + e.deltaY * 0.015));
        lastInteraction = performance.now();
      },
      { passive: false }
    );

    // ---------- Animation Loop ----------
    const clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const time = clock.elapsedTime;

      pitch += (pitchTarget - pitch) * Math.min(1, dt * 8);
      zoom += (zoomTarget - zoom) * Math.min(1, dt * 8);

      // Auto-rotate lembut saat tidak disentuh
      if (performance.now() - lastInteraction > 2500) {
        yaw += dt * AUTO_ROTATE_SPEED;
      }

      camera.position.x = Math.sin(yaw) * zoom * Math.cos(pitch);
      camera.position.y = 4 + Math.sin(pitch) * zoom;
      camera.position.z = Math.cos(yaw) * zoom * Math.cos(pitch);
      camera.lookAt(0, 2, 0);

      // Bob (naik-turun) attendees
      for (let i = 0; i < attendees.length; i++) {
        attendees[i].position.y =
          attendees[i].userData.home.y +
          Math.sin(time * 1.4 + attendees[i].userData.phase) * 0.25;
      }

      renderer.render(scene, camera);
    }

    // ---------- Responsive ----------
    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
  }

  // ============================================
  // BOOT
  // ============================================
  function boot() {
    if (!webglAvailable()) {
      setStatus("Browser ini tidak mendukung WebGL.", true);
      return;
    }
    init3D();
  }

  window.addEventListener("DOMContentLoaded", () => {
    loadThree(
      0,
      boot,
      () => setStatus("Gagal memuat Three.js. CDN diblokir / offline.", true)
    );
  });
})();