/* ===== SHELL: navigasi (navbar + tab bar iOS), tema, progres scroll, kilau kartu, haptic, loader, reveal, konfeti ===== */
window.SET = {};

const TAB_ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>',
  gift: '<rect x="3" y="8" width="18" height="5" rx="1.5"/><path d="M5 13v7h14v-7M12 8v12M12 8c-2-4-6-3-5 0M12 8c2-4 6-3 5 0"/>',
  bag: '<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1-4 4-6 8-6s7 2 8 6"/>',
  out: '<path d="M10 4H5v16h5M16 8l4 4-4 4M20 12H9"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${TAB_ICONS[n]}</svg>`;

async function initNav() {
  // Bila server/database belum siap, menu tetap harus tampil (anggap pengunjung belum masuk).
  const [me, set] = await Promise.all([
    api("/me").catch(() => ({ role: null, nama: null })),
    api("/settings").catch(() => ({})),
  ]);
  window.SET = set;
  let page = location.pathname.split("/").pop() || "beranda.html";
  if (!page.includes(".")) page += ".html"; // alamat tanpa ekstensi, mis. /pesan
  const links = [["beranda.html", "Beranda", "home"]];
  if (me.role === "admin") links.push(["admin.html", "Dashboard", "grid"]);
  else {
    links.push(["pesan.html", "Buat Parcel", "gift"]);
    if (me.role === "user") links.push(["pesanan.html", "Pesanan", "bag"], ["akun.html", "Akun", "user"]);
  }
  if (!me.role) links.push(["masuk.html", "Masuk", "user"]);

  // Navbar atas (desktop)
  $("#menu").innerHTML =
    links.map(([h, t]) => `<li><a href="${h}" class="${page === h ? "on" : ""}">${t}</a></li>`).join("") +
    (me.role ? `<li><button id="out">Keluar (${esc(me.nama)})</button></li>` : "");
  // Tab bar bawah (mobile)
  $("#tabbar").innerHTML =
    links.map(([h, t, i]) => `<a href="${h}" class="${page === h ? "on" : ""}">${icon(i)}${t}</a>`).join("") +
    (me.role ? `<button id="out2">${icon("out")}Keluar</button>` : "");
  ["#out", "#out2"].forEach((s) => {
    if ($(s))
      $(s).onclick = async () => {
        await api("/logout", "POST");
        location = "beranda.html";
      };
  });

  $$(".brand-name").forEach((e) => (e.textContent = set.toko_nama || "Parcelku"));
  if (set.wa && me.role !== "admin") {
    const a = document.createElement("a");
    a.className = "wa-float";
    a.href = `https://wa.me/${set.wa}`;
    a.target = "_blank";
    a.rel = "noopener";
    a.setAttribute("aria-label", "Chat WhatsApp");
    a.textContent = "💬";
    document.body.append(a);
  }
  return me;
}

/** Lightbox foto. Foto lain di grup yang sama bisa digeser (tombol, klik panah, atau keyboard). */
function lightbox(list, start = 0) {
  let i = start;
  const box = document.createElement("div");
  box.className = "lightbox";
  box.innerHTML = `
    <img alt="Foto parcel">
    ${list.length > 1 ? '<button class="lb-nav prev" aria-label="Sebelumnya">‹</button><button class="lb-nav next" aria-label="Berikutnya">›</button>' : ""}`;
  const img = $("img", box);

  const show = (n) => {
    i = (n + list.length) % list.length;
    img.src = list[i];
    img.style.animation = "none";
    void img.offsetWidth; // restart animasi
    img.style.animation = "";
  };
  const close = () => {
    box.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(i - 1);
    if (e.key === "ArrowRight") show(i + 1);
  };

  box.onclick = (e) => {
    if (e.target.classList.contains("prev")) return show(i - 1);
    if (e.target.classList.contains("next")) return show(i + 1);
    close();
  };
  document.addEventListener("keydown", onKey);
  document.body.append(box);
  show(i);
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-zoom]");
  if (!el) return;
  const group = $$("[data-zoom]", el.closest("#galeri, .examples, .hero-vis") || document).map(
    (x) => x.dataset.zoom,
  );
  const unique = [...new Set(group)];
  lightbox(unique, Math.max(0, unique.indexOf(el.dataset.zoom)));
});

/** Getaran singkat (haptic) di perangkat yang mendukung. */
const tap = (ms = 8) => {
  try {
    navigator.vibrate && navigator.vibrate(ms);
  } catch (e) {}
};
document.addEventListener("click", (e) => {
  if (e.target.closest(".btn,.it,.pk,.dit,.seg button,.tabbar a,.opt label")) tap();
});

function reveal() {
  const io = new IntersectionObserver(
    (es) =>
      es.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      }),
    { threshold: 0.12 },
  );
  $$(".rv").forEach((el) => io.observe(el));
}

function confetti() {
  const c = document.createElement("canvas");
  c.id = "confetti";
  document.body.append(c);
  const x = c.getContext("2d");
  c.width = innerWidth;
  c.height = innerHeight;
  const cols = ["#1f8a4c", "#c9a24b", "#0f3d26", "#2aa35c", "#e6c36e"];
  const P = Array.from({ length: 130 }, () => ({
    x: innerWidth / 2,
    y: innerHeight * 0.45,
    vx: (Math.random() - 0.5) * 16,
    vy: -Math.random() * 15 - 4,
    s: 5 + Math.random() * 7,
    r: Math.random() * 6,
    c: cols[(Math.random() * 5) | 0],
  }));
  let f = 0;
  (function tick() {
    x.clearRect(0, 0, c.width, c.height);
    P.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.4;
      p.vx *= 0.99;
      p.r += 0.2;
      x.save();
      x.translate(p.x, p.y);
      x.rotate(p.r);
      x.fillStyle = p.c;
      x.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.6);
      x.restore();
    });
    if (++f < 150) requestAnimationFrame(tick);
    else c.remove();
  })();
}

/** Animasi: salin elemen `from` lalu terbangkan ke elemen `to` (mis. barang masuk ke kotak parcel). */
function flyTo(from, to) {
  if (!from || !to || matchMedia("(prefers-reduced-motion:reduce)").matches) return;
  const a = from.getBoundingClientRect(),
    b = to.getBoundingClientRect();
  if (b.bottom < 0 || b.top > innerHeight) return;
  const g = from.cloneNode(true);
  g.className += " fly";
  Object.assign(g.style, {
    left: a.left + "px",
    top: a.top + "px",
    width: a.width + "px",
    height: a.height + "px",
  });
  document.body.append(g);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2),
    dy = b.top + b.height / 2 - (a.top + a.height / 2);
  g.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) scale(.3)`, opacity: 0.2 },
    ],
    { duration: 650, easing: "cubic-bezier(.5,0,.2,1)" },
  ).onfinish = () => g.remove();
}

/* ---------- PWA: daftarkan service worker & tombol "Pasang aplikasi" ---------- */
let installPrompt = null;
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  const btn = document.querySelector("#pwaInstall");
  if (btn) btn.hidden = false;
});
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
document.addEventListener("click", async (e) => {
  if (!e.target.closest("#pwaInstall") || !installPrompt) return;
  e.preventDefault();
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  document.querySelector("#pwaInstall").hidden = true;
});

(function shell() {
  const nav = $("#navbar"),
    prog = $("#prog");
  const onScroll = () => {
    if (nav) nav.classList.toggle("scrolled", scrollY > 20);
    if (prog) {
      prog.style.width =
        (scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)) * 100 + "%";
    }
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (matchMedia("(hover:hover)").matches && !matchMedia("(prefers-reduced-motion:reduce)").matches) {
    document.addEventListener("pointermove", (e) => {
      const card = e.target.closest && e.target.closest(".card");
      if (card) {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", e.clientX - r.left + "px");
        card.style.setProperty("--my", e.clientY - r.top + "px");
      }
      const c = e.target.closest && e.target.closest(".tilt");
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.style.transform = `perspective(900px) rotateY(${((e.clientX - r.left) / r.width - 0.5) * 7}deg) rotateX(${-((e.clientY - r.top) / r.height - 0.5) * 7}deg) translateY(-3px)`;
    });
    document.addEventListener("pointerout", (e) => {
      const c = e.target.closest && e.target.closest(".tilt");
      if (c && !c.contains(e.relatedTarget)) c.style.transform = "";
    });
  }

  try {
    if (sessionStorage.intro) return;
    sessionStorage.intro = 1;
  } catch (e) {
    return;
  }
  const l = document.createElement("div");
  l.className = "loader";
  l.innerHTML =
    '<div class="loader-card"><div class="mark">🎁</div><b id="lc">0</b><div class="loader-bar"><i id="lb"></i></div></div>';
  document.body.append(l);
  let n = 0;
  const t = setInterval(() => {
    n = Math.min(100, n + 7);
    $("#lc").textContent = n;
    $("#lb").style.width = n + "%";
    if (n >= 100) {
      clearInterval(t);
      setTimeout(() => {
        l.classList.add("off");
        setTimeout(() => l.remove(), 700);
      }, 150);
    }
  }, 45);
})();
