/* Halaman Pesanan Saya: pelacak, bukti bayar, chat, ulasan, struk, pesan ulang */
const HINT = {
  baru: "Admin sedang memeriksa pesananmu.",
  diproses: "Pesananmu sedang disiapkan.",
  dikemas: "Parcel sedang dikemas rapi.",
  siap: "Parcel siap! Silakan ambil ke toko.",
  diantar: "Kurir sedang mengantar parcelmu.",
  selesai: "Pesanan selesai. Terima kasih!",
};
let OPEN = new Set(),
  SIG = "",
  FILTER = "aktif",
  PREV = null,
  DATA = [];

function countdown(o) {
  if (o.status === "selesai" || !o.tanggal_acara) return "";
  const d = daysLeft(o.tanggal_acara);
  return d < 0 ? "Lewat tanggal" : d === 0 ? "Hari ini" : `${d} hari lagi`;
}
/** Rincian harga: subtotal, ongkir, voucher. */
function rincian(o) {
  if (!o.subtotal) return "";
  return `<div class="rinci"><div><span>Subtotal</span><span>${rp(o.subtotal)}</span></div>${o.metode !== "ambil" ? `<div><span>Ongkir</span><span>${o.ongkir ? rp(o.ongkir) : "Gratis"}</span></div>` : ""}${o.diskon ? `<div><span>Voucher ${esc(o.voucher)}</span><span class="ok">−${rp(o.diskon)}</span></div>` : ""}</div>`;
}
function cardHTML(o) {
  const p = paymentText(o),
    f = FLOW[o.metode],
    pct = (f.indexOf(o.status) / (f.length - 1)) * 100;
  const needProof = o.paid < o.total && o.pay_type !== "cod";
  return `<article class="card ${o.status === "selesai" ? "done-card" : ""}" data-id="${o.id}">
  <div class="head"><div><h3>${ICON[o.status]} ${o.kode}</h3><p class="muted">Parcel ${rp(o.paket)} × ${o.qty} · ${METODE[o.metode]}</p></div>
   <div style="text-align:right"><b>${rp(o.total)}</b><br><span class="badge ${p.c}">${p.t}</span></div></div>
  ${trackHTML(o)}<div class="pbar"><i style="width:${pct}%"></i></div><div class="info">${HINT[o.status]}</div>
  ${rincian(o)}
  <div class="thumbs">${o.items.map((i) => `<span title="${esc(i.nama)}">${pic(i)}</span>`).join("")}</div>
  <div class="meta"><div><small>Dibutuhkan tanggal</small>${tgl(o.tanggal_acara)} <span class="muted">${countdown(o)}</span></div>
   <div><small>Pembayaran</small>${esc(o.bayar_nama || "-")}</div>
    <div><small>Wadah</small>${WADAH[o.wadah] || "Nampan hijau emas"}</div>
    <div><small>Pita</small><span class="dotc pita ${o.bungkus}"></span> ${BUNGKUS[o.bungkus] || "Pink"}</div>
   </div>
  ${o.kartu || o.kartu_untuk ? `<details class="kdet"><summary>💌 Lihat kartu ucapan</summary><div class="kmini">${KartuView.html({ untuk: o.kartu_untuk || "", pesan: o.kartu || "", dari: o.kartu_dari || "", gaya: o.kartu_gaya, tema: o.kartu_tema })}</div></details>` : ""}
  ${o.alamat ? `<p class="muted">📍 ${esc(o.alamat)} <a href="${mapsUrl(o)}" target="_blank" rel="noopener">Peta</a></p>` : ""}
  ${
    o.pay_type !== "cod"
      ? `<div class="proof">${o.bukti ? `<img src="${photoUrl(o.bukti)}" alt="Bukti bayar" data-zoom="${photoUrl(o.bukti)}">` : '<span style="font-size:2rem">🧾</span>'}
   <div style="flex:1"><b>Bukti pembayaran</b><p class="muted">${o.bukti ? "Sudah diunggah. Admin akan memeriksanya." : needProof ? "Transfer lalu unggah fotonya di sini." : "Pembayaran sudah lunas."}</p></div>
   ${needProof ? `<label class="btn ghost mini" style="margin:0">${o.bukti ? "Ganti" : "Unggah"} bukti<input type="file" accept="image/*" class="bk"></label>` : ""}</div>`
      : ""
  }
  <div class="acts"><button class="btn ghost cbtn">💬 Chat admin${o.unread ? `<span class="dot">${o.unread}</span>` : ""}</button>
   <button class="btn ghost strk">🖨️ Struk</button><a class="btn ghost" href="pesan.html?ulang=${o.id}">🔁 Pesan lagi</a></div>
  <div class="chatbox" hidden></div>
  ${o.status === "selesai" ? `<div class="revbox">${o.rating ? `Ulasanmu: ${starsRO(o.rating)} Terima kasih!` : `<b>Bagaimana parcelnya?</b><div class="stars" data-r="0">${[1, 2, 3, 4, 5].map((n) => `<button data-n="${n}" aria-label="${n} bintang">★</button>`).join("")}</div><textarea rows="2" placeholder="Tulis ulasan singkat (opsional)"></textarea><button class="btn mini sendrev">Kirim ulasan</button>`}</div>` : ""}
  </article>`;
}
function bind(a) {
  const id = +a.dataset.id,
    o = DATA.find((x) => x.id === id),
    box = $(".chatbox", a);
  const open = () => {
    box.hidden = false;
    Chat(box, id, "user");
    OPEN.add(id);
  };
  $(".cbtn", a).onclick = () =>
    box.hidden ? open() : ((box.hidden = true), (box.innerHTML = ""), OPEN.delete(id));
  $(".strk", a).onclick = () => (location = `struk.html?id=${o.id}`);
  const bk = $(".bk", a);
  if (bk)
    bk.onchange = async () => {
      try {
        await uploadPhoto(`/orders/${id}/bukti`, bk.files[0]);
        toast("Bukti terkirim. Terima kasih!");
        SIG = "";
        load();
      } catch (e) {
        toast(e.message);
      }
    };
  const stars = $(".stars", a);
  if (stars) {
    $$("button", stars).forEach(
      (b) =>
        (b.onclick = () => {
          stars.dataset.r = b.dataset.n;
          $$("button", stars).forEach((x) => x.classList.toggle("on", +x.dataset.n <= +b.dataset.n));
        }),
    );
    $(".sendrev", a).onclick = async () => {
      if (!+stars.dataset.r) return toast("Pilih bintang dulu.");
      try {
        await api(`/orders/${id}/review`, "POST", { rating: +stars.dataset.r, teks: $("textarea", a).value });
        toast("Terima kasih atas ulasanmu 💗");
        SIG = "";
        load();
      } catch (e) {
        toast(e.message);
      }
    };
  }
  if (OPEN.has(id)) open();
}
function render() {
  const list = DATA.filter(
    (o) => FILTER === "semua" || (FILTER === "aktif" ? o.status !== "selesai" : o.status === "selesai"),
  );
  if (!list.length) {
    $("#list").innerHTML =
      `<div class="card empty"><h3>${DATA.length ? "Tidak ada pesanan di tab ini" : "Belum ada pesanan"}</h3><p class="muted">Susun parcel pertamamu, hanya beberapa klik.</p><br><a class="btn" href="pesan.html">Buat parcel</a></div>`;
    return;
  }
  $("#list").innerHTML = list.map(cardHTML).join("");
  $$("article").forEach(bind);
}
async function load() {
  DATA = await api("/orders");
  const sig = JSON.stringify(DATA);
  if (sig === SIG) return;
  SIG = sig;
  if (PREV)
    DATA.forEach((o) => {
      if (PREV[o.id] && PREV[o.id] !== o.status) toast(`${ICON[o.status]} ${o.kode}: ${LABEL[o.status]}`);
    });
  PREV = Object.fromEntries(DATA.map((o) => [o.id, o.status]));
  render();
}
$$("#fl button").forEach(
  (b) =>
    (b.onclick = () => {
      FILTER = b.dataset.k;
      $$("#fl button").forEach((x) => x.classList.toggle("on", x === b));
      render();
    }),
);
(async () => {
  const me = await initNav();
  if (me.role !== "user") return (location = "masuk.html?next=pesanan.html");
  load();
  setInterval(load, 8000);
})();
