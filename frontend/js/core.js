/* ===== CORE: helper, konstanta, API, dan potongan tampilan bersama ===== */
const $ = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => [...e.querySelectorAll(s)];
const rp = (n) => "Rp" + Number(n).toLocaleString("id-ID");
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const LABEL = {
  baru: "Pesanan Diterima",
  diproses: "Diproses",
  dikemas: "Dikemas",
  siap: "Siap Diambil",
  diantar: "Sedang Diantar",
  selesai: "Selesai",
};
const ICON = { baru: "📝", diproses: "🧑‍🍳", dikemas: "🎀", siap: "🛍️", diantar: "🚚", selesai: "✅" };
const FLOW = {
  ambil: ["baru", "diproses", "dikemas", "siap", "selesai"],
  antar: ["baru", "diproses", "dikemas", "diantar", "selesai"],
  cod: ["baru", "diproses", "dikemas", "diantar", "selesai"],
};
const METODE = { ambil: "Ambil ke toko", antar: "Antar ke rumah", cod: "COD (antar & bayar di tempat)" };
const BUNGKUS = { pink: "Rose", emas: "Emas", hijau: "Hijau", putih: "Putih" };
const TIPE_BAYAR = { qris: "QRIS", transfer: "Transfer bank", ewallet: "E-wallet", cash: "Tunai (cash)" };
const BAYAR_IKON = { qris: "🔳", transfer: "🏦", ewallet: "📱", cash: "💵" };
const WADAH = { nampan: "Nampan hijau emas", bulat: "Keranjang bulat" };

/* ---------- API ---------- */
async function request(url, opt) {
  const r = await fetch("/api" + url, opt);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Terjadi kesalahan, coba lagi.");
  return d;
}
const api = (url, method = "GET", body) =>
  request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
const apiForm = (url, form, method = "POST") => request(url, { method, body: form });

/* ---------- Toast ---------- */
function toast(text) {
  let el = $("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.append(el);
  }
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 3200);
}

/* ---------- Gambar ---------- */
const photoUrl = (f) => "/uploads/" + f;
const pic = (item, cls = "") =>
  `<div class="pic ${cls}">${
    item.foto
      ? `<img src="${photoUrl(item.foto)}" alt="${esc(item.nama)}" loading="lazy">`
      : `<span class="emo">${item.ikon}</span>`
  }</div>`;

/** Kecilkan foto di browser sebelum diunggah agar cepat dan hemat kuota. */
function resizeImage(file, max = 1200) {
  return new Promise((resolve, reject) => {
    const img = new Image(),
      url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)),
        c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal memproses foto."))), "image/jpeg", 0.85);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => reject(new Error("File bukan gambar yang valid."));
    img.src = url;
  });
}
async function uploadPhoto(url, file, extra = {}) {
  const f = new FormData();
  f.append("file", await resizeImage(file), "foto.jpg");
  Object.entries(extra).forEach(([k, v]) => f.append(k, v));
  return apiForm(url, f);
}

/* ---------- Format & potongan tampilan ---------- */
const mapsUrl = (o) =>
  o.lat
    ? `https://www.google.com/maps?q=${o.lat},${o.lng}`
    : `https://www.google.com/maps/search/${encodeURIComponent(o.alamat || "")}`;
const tgl = (s) =>
  s
    ? new Date(s + "T00:00:00").toLocaleDateString("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-";
const daysLeft = (s) => Math.ceil((new Date(s + "T00:00:00") - new Date().setHours(0, 0, 0, 0)) / 864e5);

function paymentText(o) {
  if (o.paid >= o.total) return { t: "Lunas ✓", c: "b-ok" };
  if (o.paid > 0) return { t: `DP ${rp(o.paid)} · sisa ${rp(o.total - o.paid)}`, c: "b-wait" };
  return o.pay_type === "cod"
    ? { t: "Bayar di tempat (COD)", c: "b-wait" }
    : { t: "Menunggu pembayaran", c: "b-new" };
}
function trackHTML(o) {
  const f = FLOW[o.metode],
    i = f.indexOf(o.status);
  return (
    '<div class="track">' +
    f
      .map(
        (s, n) =>
          `<div class="tstep ${n < i ? "done" : n === i ? "now" : ""}"><i>${n < i ? "✓" : n + 1}</i>${LABEL[s]}</div>`,
      )
      .join("") +
    "</div>"
  );
}
const starsRO = (n) =>
  `<span class="stars-ro" aria-label="${n} dari 5">${"★".repeat(n)}${"☆".repeat(5 - n)}</span>`;
