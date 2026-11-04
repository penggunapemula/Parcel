/* ==========================================================================
   BERANDA — demo susun parcel (dengan wadah live), galeri, ulasan, info toko
   ========================================================================== */
const DEMO_FALLBACK = [
  { id: 1, ikon: "🧼", nama: "Sabun Cuci Piring", harga: 3000 },
  { id: 2, ikon: "💧", nama: "Air Mineral", harga: 3000 },
  { id: 3, ikon: "☕", nama: "Kopi Sachet", harga: 3000 },
  { id: 4, ikon: "🍪", nama: "Biskuit", harga: 4000 },
  { id: 5, ikon: "🍍", nama: "Nastar", harga: 6000 },
  { id: 6, ikon: "🧀", nama: "Kastengel", harga: 6000 },
];

const PAKET_DEMO = [15000, 25000, 35000];

const demo = {
  items: DEMO_FALLBACK,
  paket: 25000,
  wadah: "nampan",
  pita: "pink",
  kartu: "",
  pick: new Set(),
  view: null,
};

const demoPicked = () => demo.items.filter((i) => demo.pick.has(i.id));
const demoUsed = () => demoPicked().reduce((sum, i) => sum + i.harga, 0);
const demoMinPrice = () => Math.min(...demo.items.map((i) => i.harga));

/* ---------- Demo ---------- */
function drawDemo() {
  const used = demoUsed();
  const left = demo.paket - used;
  const full = used > 0 && left < demoMinPrice();

  // Pilihan paket & wadah
  $("#dPaket").innerHTML = PAKET_DEMO.map(
    (p) => `<button class="${p === demo.paket ? "on" : ""}" data-p="${p}">${rp(p)}</button>`,
  ).join("");
  $("#dWadah").innerHTML = Object.entries(WADAH)
    .map(([k, n]) => `<button class="${k === demo.wadah ? "on" : ""}" data-w="${k}">${n}</button>`)
    .join("");

  $("#dPita").innerHTML = Object.entries(BUNGKUS)
    .map(
      ([k, n]) =>
        `<button class="${k === demo.pita ? "on" : ""}" data-k="${k}"><span class="dotc pita ${k}"></span>${n}</button>`,
    )
    .join("");

  // Daftar barang
  $("#dItems").innerHTML = demo.items
    .map((i) => {
      const on = demo.pick.has(i.id);
      const locked = !on && used + i.harga > demo.paket;
      return `
        <button class="dit ${on ? "on" : ""}" data-id="${i.id}" ${locked ? 'data-lock="1" aria-disabled="true"' : ""}>
          ${pic(i)}
          ${esc(i.nama)}<br><small>${rp(i.harga)}</small>
        </button>`;
    })
    .join("");

  // Wadah live
  const text = full
    ? "Parcelmu sudah jadi! Siap dibungkus dan dikirim 🎉"
    : demo.pick.size
      ? `${demo.pick.size} barang di dalam wadah`
      : "";
  const justDone = demo.view.update({
    wadah: demo.wadah,
    items: demoPicked(),
    pita: demo.pita,
    kartu: demo.kartu,
    full,
    text,
  });
  if (justDone) confetti();

  // Meter & teks
  $("#dBar").style.width = (used / demo.paket) * 100 + "%";
  $("#dBar").classList.toggle("full", full);
  $("#dTxt").textContent = demo.pick.size
    ? `Terpakai ${rp(used)} dari ${rp(demo.paket)} · sisa ${rp(left)}`
    : `Budget ${rp(demo.paket)}. Centang barang di sebelah kiri.`;
  const q = new URLSearchParams({
    paket: demo.paket,
    wadah: demo.wadah,
    pita: demo.pita,
    items: [...demo.pick].join(","),
  });
  if (demo.kartu.trim()) q.set("kartu", demo.kartu.trim());
  $("#dGo").href = `pesan.html?${q}`;
}

function bindDemo() {
  $("#dPaket").onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    demo.paket = +b.dataset.p;
    while (demoUsed() > demo.paket) demo.pick.delete([...demo.pick].pop());
    drawDemo();
  };
  $("#dWadah").onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    demo.wadah = b.dataset.w;
    drawDemo();
  };
  $("#dPita").onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    demo.pita = b.dataset.k;
    drawDemo();
  };
  $("#dKartu").oninput = (e) => {
    demo.kartu = e.target.value;
    drawDemo();
  };
  $("#dAuto").onclick = autoFillDemo;
  $("#dItems").onclick = (e) => {
    const b = e.target.closest(".dit");
    if (!b) return;
    if (b.dataset.lock) {
      b.classList.remove("shake");
      void b.offsetWidth;
      b.classList.add("shake");
      return toast("Budget paket tidak cukup untuk barang ini.");
    }
    const id = +b.dataset.id;
    demo.pick.has(id) ? demo.pick.delete(id) : demo.pick.add(id);
    drawDemo();
  };
  $("#dReset").onclick = () => {
    demo.pick.clear();
    drawDemo();
  };
}

/* ---------- Animasi proses pembuatan (otomatis saat terlihat) ---------- */
const proses = { view: null, timers: [], run: 0 };
const PROSES_KARTU = ["Matur Suksma", "Terima kasih sudah hadir", "Om Swastyastu"];

function prosesSteps() {
  // Pilih barang yang muat paket Rp25.000, urut dari katalog
  const picks = [];
  let sum = 0;
  demo.items.forEach((i) => {
    if (sum + i.harga <= 25000 && picks.length < 7) {
      picks.push(i);
      sum += i.harga;
    }
  });
  return picks;
}

/** Tampilkan langkah ke-n (0..3) sebagai keadaan akhir langkah tersebut. */
function showProsesStep(n, wadah, pita, kartu) {
  const items = prosesSteps();
  const shown = n === 0 ? [] : items;
  proses.view.update({
    wadah,
    pita,
    kartu: n >= 3 ? kartu : "",
    items: shown,
    full: n >= 2,
    text: [
      "Wadah kosong siap diisi",
      "Barang masuk satu per satu",
      "Dibungkus dengan plastik, bunga, dan pita",
      "Kartu ucapan terpasang. Selesai! 🎉",
    ][n],
  });
  $$("#pSteps button").forEach((b) => {
    const k = +b.dataset.s;
    b.parentElement.classList.toggle("now", k === n);
    b.parentElement.classList.toggle("done", k < n);
  });
}

function playProses() {
  proses.timers.forEach(clearTimeout);
  proses.timers = [];
  const run = ++proses.run;
  const wadah = run % 2 ? "nampan" : "bulat";
  const pita = ["pink", "emas", "hijau", "putih"][run % 4];
  const kartu = PROSES_KARTU[run % PROSES_KARTU.length];
  const at = (ms, fn) => proses.timers.push(setTimeout(fn, ms));

  proses.view.update({ wadah, pita, items: [], full: false, text: "" });
  showProsesStep(0, wadah, pita, kartu);

  // Barang masuk satu per satu
  const items = prosesSteps();
  items.forEach((_, k) => {
    at(900 + k * 420, () => {
      proses.view.update({
        wadah,
        pita,
        items: items.slice(0, k + 1),
        full: false,
        text: "Barang masuk satu per satu",
      });
      $$("#pSteps li").forEach((li, idx) => li.classList.toggle("now", idx === 1));
      $$("#pSteps li")[0].classList.add("done");
    });
  });
  const t = 900 + items.length * 420;
  at(t + 500, () => showProsesStep(2, wadah, pita, kartu));
  at(t + 2200, () => {
    showProsesStep(3, wadah, pita, kartu);
    confetti();
  });
}

function bindProses() {
  proses.view = ParcelView.mount($("#pStage"));
  $("#pPlay").onclick = playProses;
  $("#pSteps").onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    proses.timers.forEach(clearTimeout);
    showProsesStep(+b.dataset.s, "nampan", "pink", PROSES_KARTU[0]);
  };

  // Mulai otomatis saat bagian ini terlihat
  const seen = new IntersectionObserver(
    (entries) => {
      if (!entries[0].isIntersecting) return;
      seen.disconnect();
      playProses();
    },
    { threshold: 0.4 },
  );
  seen.observe($("#proses"));
}

/** Isi otomatis: acak barang sampai budget hampir habis. */
function autoFillDemo() {
  demo.pick.clear();
  const pool = [...demo.items].sort(() => Math.random() - 0.5);
  let guard = 0;
  while (guard++ < 40) {
    const next = pool.find((i) => !demo.pick.has(i.id) && demoUsed() + i.harga <= demo.paket);
    if (!next) break;
    demo.pick.add(next.id);
  }
  drawDemo();
}

/* ---------- Galeri tambahan dari admin ---------- */
async function loadGallery() {
  const rows = await api("/gallery").catch(() => []);
  $("#gal").innerHTML = rows
    .map(
      (x) => `
      <figure data-zoom="${photoUrl(x.foto)}">
        <img src="${photoUrl(x.foto)}" alt="${esc(x.caption || "Parcel seserahan")}" loading="lazy">
        ${x.caption ? `<figcaption><b>${esc(x.caption)}</b></figcaption>` : ""}
      </figure>`,
    )
    .join("");
}

/* ---------- Ulasan ---------- */
async function loadReviews() {
  const r = await api("/reviews").catch(() => null);
  if (!r || !r.count) return;

  $("#fRate").textContent = r.avg + "★";
  $("#fRateL").textContent = `dari ${r.count} ulasan`;
  if (!r.items.length) return;

  $("#ulasan").hidden = false;
  $("#rvSum").textContent = `Rating rata-rata ${r.avg} dari ${r.count} ulasan.`;
  $("#rvs").innerHTML = r.items
    .map(
      (x) => `<div class="card">${starsRO(x.rating)}<p>${esc(x.teks)}</p><small>${esc(x.nama)}</small></div>`,
    )
    .join("");
}

/* ---------- Inisialisasi ---------- */
(async () => {
  await initNav();
  reveal();

  // Info toko
  const s = window.SET;
  $("#fTag").textContent = s.tagline || "";
  $("#fJam").textContent = "🕒 " + (s.jam || "");
  $("#fAlamat").textContent = "📍 " + (s.alamat_toko || "");
  $("#fWa").href = "https://wa.me/" + (s.wa || "");
  $("#tagline").textContent = s.tagline || "Parcel seserahan custom";

  // Barang dari katalog
  try {
    const items = await api("/items");
    if (items.length) {
      demo.items = items.slice(0, 12);
      $("#fItems").textContent = items.length + "+";
    }
  } catch (e) {
    /* pakai data cadangan */
  }

  demo.view = ParcelView.mount($("#dStage"), {
    onRemove: (id) => {
      demo.pick.delete(id);
      drawDemo();
    },
  });
  bindDemo();
  bindProses();
  drawDemo();
  loadGallery();
  loadReviews();
})();
