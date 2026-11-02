/* ==========================================================================
   FX — efek interaktif bersama: parallax hero, tilt 3D wadah, tombol magnetik,
   riak klik, hitung angka, dan kilau kartu mengikuti kursor.
   Semua efek dimatikan otomatis bila pengguna memilih "kurangi gerakan".
   ========================================================================== */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------- Hitung angka naik (data-count) ---------- */
  function countUp(el) {
    const end = +el.dataset.count;
    const suffix = el.dataset.suffix || "";
    if (reduce || !end) return;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 1100);
      el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))) + suffix;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const counter = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      countUp(e.target);
      counter.unobserve(e.target);
    });
  });
  $$("[data-count]").forEach((el) => counter.observe(el));

  /* ---------- Riak saat tombol diklik ---------- */
  document.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest(".btn");
    if (!btn || reduce) return;
    const r = btn.getBoundingClientRect();
    const dot = document.createElement("span");
    dot.className = "ripple";
    dot.style.left = e.clientX - r.left + "px";
    dot.style.top = e.clientY - r.top + "px";
    btn.append(dot);
    setTimeout(() => dot.remove(), 650);
  });

  if (!fine || reduce) return;

  /* ---------- Parallax foto hero mengikuti kursor ---------- */
  const hero = $(".hero");
  const vis = $("#heroVis");
  if (hero && vis) {
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      vis.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      vis.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
    hero.addEventListener("pointerleave", () => {
      vis.style.setProperty("--px", 0);
      vis.style.setProperty("--py", 0);
    });
  }

  /* ---------- Tilt 3D pada wadah parcel ---------- */
  document.addEventListener("pointermove", (e) => {
    const stage = e.target.closest && e.target.closest(".pv-stage");
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    stage.style.transform = `perspective(900px) rotateY(${x * 12}deg) rotateX(${-y * 10}deg)`;
  });
  document.addEventListener("pointerout", (e) => {
    const stage = e.target.closest && e.target.closest(".pv-stage");
    if (stage && !stage.contains(e.relatedTarget)) stage.style.transform = "";
  });

  /* ---------- Tombol besar "magnetik" ---------- */
  $$(".btn.big").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.18;
      const y = (e.clientY - r.top - r.height / 2) * 0.28;
      btn.style.transform = `translate(${x}px, ${y}px)`;
    });
    btn.addEventListener("pointerleave", () => (btn.style.transform = ""));
  });
})();

/* ==========================================================================
   FX tambahan — cahaya kursor & tombol kembali ke atas
   ========================================================================== */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;

  // Cahaya hijau lembut yang mengikuti kursor (hanya desktop)
  if (fine && !reduce) {
    const glow = document.createElement("div");
    glow.className = "cursor-glow";
    document.body.prepend(glow);
    let x = innerWidth / 2;
    let y = innerHeight / 2;
    let tx = x;
    let ty = y;
    addEventListener("pointermove", (e) => {
      tx = e.clientX;
      ty = e.clientY;
    });
    (function loop() {
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      glow.style.transform = `translate(${x - 220}px, ${y - 220}px)`;
      requestAnimationFrame(loop);
    })();
  }

  // Tombol kembali ke atas muncul setelah menggulir
  const up = document.createElement("button");
  up.className = "totop";
  up.type = "button";
  up.setAttribute("aria-label", "Kembali ke atas");
  up.textContent = "↑";
  up.onclick = () => scrollTo({ top: 0, behavior: "smooth" });
  document.body.append(up);
  addEventListener("scroll", () => up.classList.toggle("show", scrollY > 700), { passive: true });
})();
