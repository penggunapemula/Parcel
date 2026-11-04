/* Dashboard admin: pesanan, ringkasan, katalog, galeri, pengaturan */
const VIEWS = ["vOrders", "vRingkas", "vKatalog", "vVoucher", "vJadwal", "vBayar", "vGaleri", "vSet"];
const TABS = [
  ["aktif", "Aktif"],
  ["baru", "Baru"],
  ["diproses", "Diproses"],
  ["dikemas", "Dikemas"],
  ["kirim", "Siap / Diantar"],
  ["selesai", "Selesai"],
  ["semua", "Semua"],
];
const SET_FIELDS = [
  ["toko_nama", "Nama toko"],
  ["tagline", "Tagline"],
  ["wa", "Nomor WhatsApp (format 62…)"],
  ["bank", "Nama bank"],
  ["rek_no", "Nomor rekening"],
  ["rek_an", "Atas nama rekening"],
  ["jam", "Jam buka"],
  ["alamat_toko", "Alamat toko"],
  ["toko_lat", "Latitude toko"],
  ["toko_lng", "Longitude toko"],
  ["ongkir_dasar", "Ongkir dasar (Rp)"],
  ["ongkir_km_gratis", "Gratis sampai (km)"],
  ["ongkir_per_km", "Tambahan per km (Rp)"],
  ["ongkir_gratis_min", "Gratis ongkir jika belanja ≥ (Rp)"],
  ["kapasitas_harian", "Kapasitas parcel per hari (0 = tanpa batas)"],
  ["min_hari_pesan", "Minimal pesan berapa hari sebelum acara"],
];
const PH =
  '<div class="ph"><span>📦</span><p>Pilih pesanan di daftar untuk melihat detail, chat, dan mengubah status.</p></div>';
const S = { orders: [], items: [], filter: "aktif", q: "", sort: "baru", cur: null, seen: 0, boot: true };
const matches = (o) =>
  ({ aktif: o.status !== "selesai", semua: true, kirim: ["siap", "diantar"].includes(o.status) })[S.filter] ??
  o.status === S.filter;

/* ---------- Notifikasi ---------- */
function beep() {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)(),
      o = c.createOscillator(),
      g = c.createGain();
    o.connect(g);
    g.connect(c.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.2, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.6);
    o.start();
    o.stop(c.currentTime + 0.6);
  } catch (e) {}
}
$("#notif").onclick = async () => {
  beep();
  if ("Notification" in window) {
    const p = await Notification.requestPermission();
    toast(p === "granted" ? "Notifikasi browser aktif." : "Notifikasi browser ditolak.");
  }
};

/* ---------- Tab ---------- */
$$("#vtabs button").forEach(
  (b) =>
    (b.onclick = () => {
      $$("#vtabs button").forEach((x) => x.classList.toggle("on", x === b));
      VIEWS.forEach((v) => ($("#" + v).hidden = v !== b.dataset.v));
      (
        ({
          vRingkas: drawRingkas,
          vKatalog: drawKatalog,
          vVoucher: drawVoucher,
          vJadwal: drawJadwal,
          vBayar: drawBayarAdmin,
          vGaleri: drawGaleri,
          vSet: drawSet,
        })[b.dataset.v] || (() => {})
      )();
    }),
);

/* ---------- Pesanan ---------- */
function urgency(o) {
  if (o.status === "selesai" || !o.tanggal_acara) return "";
  const d = daysLeft(o.tanggal_acara);
  return `<span class="badge ${d <= 2 ? "b-new" : "b-wait"}">${d < 0 ? "Lewat" : d === 0 ? "Hari ini" : "H-" + d}</span>`;
}
function drawOrders() {
  const O = S.orders,
    n = (s) => O.filter((o) => o.status === s).length;
  $("#stats").innerHTML =
    `<div class="stat"><b>${n("baru")}</b>Pesanan baru</div><div class="stat"><b>${O.filter((o) => !["baru", "selesai"].includes(o.status)).length}</b>Sedang dikerjakan</div><div class="stat"><b>${n("selesai")}</b>Selesai</div><div class="stat"><b>${rp(O.reduce((a, o) => a + o.paid, 0))}</b>Uang masuk</div>`;
  $("#filters").innerHTML = TABS.map(
    ([k, t]) =>
      `<button class="${S.filter === k ? "on" : ""}" data-k="${k}">${t}${k === "baru" && n("baru") ? ` (${n("baru")})` : ""}</button>`,
  ).join("");
  $$("#filters button").forEach(
    (b) =>
      (b.onclick = () => {
        S.filter = b.dataset.k;
        drawOrders();
      }),
  );
  let list = O.filter(
    (o) => matches(o) && (!S.q || (o.nama + o.kode + o.hp + (o.email || "")).toLowerCase().includes(S.q)),
  );
  if (S.sort === "acara")
    list = [...list].sort((a, b) => (a.tanggal_acara || "9").localeCompare(b.tanggal_acara || "9"));
  $("#list").innerHTML = list.length
    ? list
        .map((o) => {
          const p = paymentText(o);
          return `<div class="card row ${o.status === "baru" ? "fresh" : ""} ${o.id === S.cur ? "sel" : ""}" data-id="${o.id}" tabindex="0">${o.unread ? '<span class="udot" title="Chat belum dibaca"></span>' : ""}
     <div><b>${o.kode} · ${esc(o.nama)}</b><br><span class="muted">Parcel ${rp(o.paket)} × ${o.qty} · ${METODE[o.metode]}</span><div class="thumbs">${o.items
       .slice(0, 6)
       .map((i) => pic(i))
       .join("")}</div></div>
     <div><span class="badge ${p.c}">${p.t}</span><span class="badge b-new">${LABEL[o.status]}</span>${urgency(o)}</div></div>`;
        })
        .join("")
    : '<p class="muted">Tidak ada pesanan yang cocok.</p>';
  $$(".row").forEach((r) => {
    r.onclick = () => show(+r.dataset.id);
    r.onkeydown = (e) => e.key === "Enter" && show(+r.dataset.id);
  });
}
$("#cari").oninput = (e) => {
  S.q = e.target.value.toLowerCase();
  drawOrders();
};
$("#urut").onchange = (e) => {
  S.sort = e.target.value;
  drawOrders();
};

async function printLabel(o) {
  const w = open("", "_blank", "width=480,height=760"); // dibuka dulu agar tidak diblokir pop-up
  if (!w) return toast("Izinkan pop-up untuk mencetak.");
  const set = window.SET || (await api("/settings").catch(() => ({})));
  const toko = esc(set.toko_nama || "Parcelku");
  const antar = o.metode !== "ambil";
  const lunas = o.total - o.paid <= 0;
  const css = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&family=Dancing+Script:wght@600&display=swap');
@page{size:100mm auto;margin:3mm}
*{box-sizing:border-box;margin:0}
body{padding:14px;background:#eef3ef;font:13px/1.45 'Plus Jakarta Sans',system-ui,sans-serif;color:#10241a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.card{position:relative;overflow:hidden;border-radius:18px;background:#fff;box-shadow:0 10px 30px rgba(16,36,26,.18)}
.top{position:relative;padding:16px 18px 20px;background:linear-gradient(135deg,#0f5a33,#25a15c);color:#fff}
.top::after{content:"";position:absolute;right:-30px;top:-30px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.1)}
.brand{display:flex;align-items:center;gap:8px;font-weight:800;letter-spacing:.04em}.brand i{font-style:normal;font-size:20px}
.kode{margin-top:10px;font-size:34px;font-weight:800;letter-spacing:.05em;line-height:1}
.badge{position:absolute;right:16px;top:16px;z-index:1;padding:5px 12px;border-radius:99px;background:#f2c14e;color:#3b2a00;font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.cut{position:relative;height:0;border-top:2px dashed #cfd9d2;margin:0 14px}
.cut::before,.cut::after{content:"";position:absolute;top:-11px;width:20px;height:20px;border-radius:50%;background:#eef3ef}
.cut::before{left:-24px}.cut::after{right:-24px}
.sec{padding:13px 18px}
.lbl{margin-bottom:4px;font-size:9.5px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#b0862a}
.to{font-size:22px;font-weight:800;line-height:1.15}.hp{margin-top:2px;font-size:16px;font-weight:700;color:#0f5a33}
.addr{margin-top:6px;padding:8px 10px;border-radius:10px;background:#f1f6f2}
.info{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px}
.info small{display:block;font-size:9.5px;color:#6b7d72;text-transform:uppercase;letter-spacing:.06em}.info b{font-size:13px}
.chips{display:flex;flex-wrap:wrap;gap:6px}.chips span{padding:4px 10px;border-radius:99px;background:#f1f6f2;border:1px solid #dbe7de;font-weight:600;font-size:12px}
.msg{padding:10px 14px;border-radius:12px;background:#fff8e6;border:1px solid #f0dfa8;font:600 19px/1.25 'Dancing Script',cursive;text-align:center;color:#5b4410}
.note{font-style:italic;color:#4d5f54}
.foot{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 16px;background:#f6faf7}
.tot small{display:block;font-size:9.5px;color:#6b7d72;text-transform:uppercase;letter-spacing:.08em}.tot b{font-size:20px;font-weight:800}
.stamp{padding:5px 14px;border:3px double currentColor;border-radius:9px;font-weight:800;letter-spacing:.1em;transform:rotate(-5deg);color:${lunas ? "#0f7a3f" : "#b5471d"}}
.thx{padding:8px 18px 14px;text-align:center;font:600 16px 'Dancing Script',cursive;color:#0f5a33}`;
  const info = (a, b) => `<div><small>${a}</small><b>${b}</b></div>`;
  w.document.write(`<!doctype html><meta charset="utf-8"><title>Label ${esc(o.kode)}</title><style>${css}</style><body><div class="card">
<div class="top"><div class="brand"><i>🎁</i>${toko}</div><span class="badge">${antar ? "🚚 Antar" : "🏪 Ambil di toko"}</span><div class="kode">${esc(o.kode)}</div></div>
<div class="sec"><p class="lbl">Kepada</p><div class="to">${esc(o.nama)}</div><div class="hp">📞 ${esc(hp0(o.hp))}</div>${o.alamat ? `<div class="addr">📍 ${esc(o.alamat)}</div>` : ""}</div>
<div class="cut"></div>
<div class="sec info">${info("Parcel", rp(o.paket) + " × " + o.qty)}${info("Dibutuhkan", tgl(o.tanggal_acara))}${info("Pita", BUNGKUS[o.bungkus] || "-")}${info("Wadah", WADAH[o.wadah] || "Nampan")}</div>
<div class="sec"><p class="lbl">Isi parcel</p><div class="chips">${o.items.map((i) => `<span>${i.ikon} ${esc(i.nama)}</span>`).join("")}</div></div>
${o.kartu ? `<div class="sec"><p class="lbl">Kartu ucapan</p><div class="msg">“${esc(o.kartu)}”</div></div>` : ""}
${o.catatan ? `<div class="sec"><p class="lbl">Catatan</p><p class="note">${esc(o.catatan)}</p></div>` : ""}
<div class="foot"><div class="tot"><small>Total${antar ? " · ongkir " + rp(o.ongkir || 0) : ""}</small><b>${rp(o.total)}</b></div><div class="stamp">${lunas ? "LUNAS ✓" : "SISA " + rp(o.total - o.paid)}</div></div>
<div class="thx">Terima kasih sudah memesan 💚</div></div>`);
  w.document.close();
  setTimeout(() => w.print(), 700);
}
function show(id) {
  const o = S.orders.find((x) => x.id === id);
  if (!o) return;
  S.cur = id;
  const p = paymentText(o),
    f = FLOW[o.metode],
    nx = f[f.indexOf(o.status) + 1];
  $("#detail").innerHTML = `<h2>${o.kode} ${urgency(o)}</h2><p class="muted">Dipesan ${esc(o.created)}</p>
  <h3>Pelanggan</h3><p><b>${esc(o.nama)}</b> · <a href="https://wa.me/${o.hp.replace(/^0/, "62")}" target="_blank" rel="noopener">${esc(hp0(o.hp))} (WhatsApp)</a></p>
  <h3>Pesanan</h3><p>Parcel ${rp(o.paket)} × ${o.qty} = ${rp(o.subtotal || o.total)}${o.metode !== "ambil" ? `<br>Ongkir ${o.ongkir ? rp(o.ongkir) : "Gratis"}` : ""}${o.diskon ? `<br>Voucher ${esc(o.voucher)} −${rp(o.diskon)}` : ""}<br><b>Total ${rp(o.total)}</b></p><div class="dgrid">${o.items.map((i) => `<div title="${esc(i.nama)}">${pic(i)}</div>`).join("")}</div>
  <div class="chips">${o.items.map((i) => `<span class="chip">${esc(i.nama)}</span>`).join("")}</div>
  <p>📅 Dibutuhkan <b>${tgl(o.tanggal_acara)}</b> · Wadah <b>${WADAH[o.wadah] || "Nampan"}</b> · Pita <span class="dotc pita ${o.bungkus}"></span> ${BUNGKUS[o.bungkus] || ""}</p>
  ${o.kartu || o.kartu_untuk ? `<details class="kdet" open><summary>💌 Kartu ucapan (${KartuView.GAYA[o.kartu_gaya] || "Elegan"} · ${KartuView.TEMA[o.kartu_tema] || "Krem"})</summary><div class="kmini">${KartuView.html({ untuk: o.kartu_untuk || "", pesan: o.kartu || "", dari: o.kartu_dari || "", gaya: o.kartu_gaya, tema: o.kartu_tema })}</div></details>` : ""}${o.catatan ? `<p class="muted">Catatan: ${esc(o.catatan)}</p>` : ""}
  <h3>Pengambilan: ${METODE[o.metode]}</h3>${o.alamat ? `<p>📍 ${esc(o.alamat)} <a href="${mapsUrl(o)}" target="_blank" rel="noopener">Buka peta</a></p>` : '<p class="muted">Pelanggan ambil sendiri ke toko.</p>'}
  ${o.metode === "cod" ? '<p class="muted">COD: konfirmasi lokasi dan jam antar lewat chat di bawah.</p>' : ""}
  <h3>Pembayaran (pilihan: ${o.pay_type === "dp" ? "DP 50%" : o.pay_type === "lunas" ? "Lunas" : "Bayar di tempat"})</h3><p><span class="badge ${p.c}">${p.t}</span></p>
  ${o.bukti ? `<p class="muted">Bukti transfer dari pelanggan:</p><img class="bukti" src="${photoUrl(o.bukti)}" alt="Bukti bayar" data-zoom="${photoUrl(o.bukti)}">` : ""}
  <div class="pay" style="margin-top:10px"><input type="number" id="paid" min="0" max="${o.total}" value="${o.paid}" aria-label="Nominal sudah dibayar"><button class="btn ghost" id="full">Lunas</button><button class="btn" id="savePay">Simpan</button></div>
  <h3>Status pesanan</h3>${nx ? `<button class="btn nextb" id="nextSt">Lanjut: ${LABEL[nx]}</button>` : '<p class="muted">Pesanan sudah selesai.</p>'}
  <div class="ctl" style="margin-top:8px"><select id="st" aria-label="Status">${f.map((s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${LABEL[s]}</option>`).join("")}</select><button class="btn ghost" id="saveSt">Atur manual</button></div>
  <button class="btn ghost nextb" id="print">🖨️ Cetak label pengiriman</button><button class="btn ghost nextb" id="struk">🧾 Lihat struk</button><button class="btn ghost nextb" id="wa">💬 Kirim update WhatsApp</button><h3>Chat dengan pelanggan</h3><div id="chat"></div>`;
  $("#panel").classList.add("open");
  drawOrders();
  Chat($("#chat"), id, "admin");
  $("#full").onclick = () => ($("#paid").value = o.total);
  $("#savePay").onclick = () => saveOrder(id, { paid: +$("#paid").value }, "Pembayaran disimpan.");
  $("#saveSt").onclick = () => saveOrder(id, { status: $("#st").value }, "Status diperbarui.");
  if (nx) $("#nextSt").onclick = () => saveOrder(id, { status: nx }, "Status: " + LABEL[nx]);
  $("#print").onclick = () => printLabel(o);
  $("#struk").onclick = () => window.open(`struk.html?id=${o.id}`, "_blank");
  $("#wa").onclick = () => {
    const kata = {
      baru: "sudah kami terima dan akan segera diproses",
      diproses: "sedang kami proses",
      dikemas: "sedang dikemas dengan rapi 🎀",
      siap: "sudah siap diambil di toko 🛍️",
      diantar: "sedang dalam perjalanan ke alamatmu 🚚",
      selesai: "sudah selesai. Terima kasih sudah memesan! 🙏",
    };
    const sisa = Math.max(0, o.total - o.paid);
    const text = `Halo ${o.nama}, pesanan ${o.kode} ${kata[o.status] || ""}.${sisa ? `\nSisa pembayaran ${rp(sisa)}.` : ""}\nTerima kasih 🎁`;
    window.open(`https://wa.me/${o.hp}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };
}
async function saveOrder(id, body, msg) {
  try {
    await api("/orders/" + id, "PATCH", body);
    toast(msg);
    await loadOrders();
    show(id);
  } catch (e) {
    toast(e.message);
  }
}
$("#detail").innerHTML = PH;
$("#close").onclick = () => {
  $("#panel").classList.remove("open");
  $("#detail").innerHTML = PH;
  S.cur = null;
  drawOrders();
};

/* ---------- Ringkasan ---------- */
/* ---------- Kartu angka penting ---------- */
function drawKpis() {
  const today = new Date();
  const ym = today.toLocaleDateString("sv-SE").slice(0, 7);
  const iso = (d) => d.toLocaleDateString("sv-SE");
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 6);
  const aktif = S.orders.filter((o) => o.status !== "selesai");
  const kpi = [
    [
      "💰",
      "Uang masuk bulan ini",
      rp(S.orders.filter((o) => o.created.slice(0, 7) === ym).reduce((a, o) => a + o.paid, 0)),
    ],
    ["📦", "Pesanan aktif", aktif.length],
    [
      "🎁",
      "Parcel 7 hari ke depan",
      aktif
        .filter((o) => o.tanggal_acara >= iso(today) && o.tanggal_acara <= iso(in7))
        .reduce((a, o) => a + o.qty, 0),
    ],
    ["⏳", "Belum lunas", aktif.filter((o) => o.paid < o.total && o.pay_type !== "cod").length],
  ];
  $("#kpis").innerHTML = kpi
    .map(
      ([ic, label, val]) =>
        `<div class="kpi card"><span class="ic">${ic}</span><b>${val}</b><small>${label}</small></div>`,
    )
    .join("");
}

function drawRingkas() {
  drawKpis();
  const days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - 6 + i);
      return d;
    }),
    key = (d) => d.toLocaleDateString("sv-SE");
  const sums = days.map((d) =>
      S.orders.filter((o) => o.created.slice(0, 10) === key(d)).reduce((a, o) => a + o.paid, 0),
    ),
    mx = Math.max(1, ...sums);
  $("#chart").innerHTML = days
    .map(
      (d, i) =>
        `<div class="col"><b>${sums[i] ? Math.round(sums[i] / 1000) + "rb" : ""}</b><i style="height:${(sums[i] / mx) * 78}%"></i>${d.toLocaleDateString("id-ID", { weekday: "short" })}</div>`,
    )
    .join("");
  const act = S.orders.filter((o) => o.status !== "selesai"),
    cnt = {};
  let parcels = 0;
  act.forEach((o) => {
    parcels += o.qty;
    o.items.forEach((i) => {
      const k = i.ikon + " " + i.nama;
      cnt[k] = (cnt[k] || 0) + o.qty;
    });
  });
  const price = (n) => (S.items.find((i) => i.ikon + " " + i.nama === n) || {}).harga || 0,
    rows = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
  $("#rekapInfo").textContent = `Dari ${act.length} pesanan aktif (${parcels} parcel) yang belum selesai.`;
  $("#rekap").innerHTML = rows.length
    ? rows
        .map(
          ([n, c]) =>
            `<div class="rk"><span>${esc(n)}</span><span><b>${c} pcs</b> <span class="muted">≈ ${rp(c * price(n))}</span></span></div>`,
        )
        .join("") +
      `<div class="rtot"><span>Perkiraan modal belanja</span><span>${rp(rows.reduce((a, [n, c]) => a + c * price(n), 0))}</span></div>`
    : '<p class="muted">Belum ada pesanan aktif.</p>';
}

/* ---------- Katalog ---------- */
function drawKatalog() {
  $("#kats").innerHTML = [...new Set(S.items.map((i) => i.kategori))]
    .map((k) => `<option value="${esc(k)}">`)
    .join("");
  $("#kat").innerHTML = S.items
    .map(
      (
        i,
      ) => `<div class="card kcard ${i.aktif ? "" : "off"}" data-id="${i.id}"><div class="kh"><div ${i.foto ? `data-zoom="${photoUrl(i.foto)}"` : ""} style="width:64px">${pic(i)}</div><div>${esc(i.nama)}<small>${esc(i.kategori)}</small></div></div>
   <div class="kf"><input type="number" value="${i.harga}" min="500" max="35000" aria-label="Harga ${esc(i.nama)}"><button class="btn mini sv">Simpan</button></div>
   <div class="krow"><label class="btn ghost mini">📷 ${i.foto ? "Ganti foto" : "Upload foto"}<input type="file" accept="image/*" class="fo"></label>${i.foto ? '<button class="btn ghost mini rf">Hapus foto</button>' : ""}<label class="sw" title="Tampil di katalog"><input type="checkbox" class="tg" ${i.aktif ? "checked" : ""}><span></span></label></div></div>`,
    )
    .join("");
  $$(".kcard").forEach((c) => {
    const id = +c.dataset.id,
      it = S.items.find((x) => x.id === id);
    $(".sv", c).onclick = () =>
      editItem(() => api("/items/" + id, "PATCH", { harga: +$("input", c).value }), "Harga disimpan.");
    $(".tg", c).onchange = (e) =>
      editItem(
        () => api("/items/" + id, "PATCH", { aktif: e.target.checked }),
        e.target.checked ? "Ditampilkan." : "Disembunyikan.",
      );
    $(".fo", c).onchange = (e) =>
      editItem(() => uploadPhoto(`/items/${id}/foto`, e.target.files[0]), "Foto tersimpan.");
    if ($(".rf", c))
      $(".rf", c).onclick = () => editItem(() => api(`/items/${id}/foto`, "DELETE"), "Foto dihapus.");
  });
}
async function editItem(fn, msg) {
  try {
    await fn();
    toast(msg);
    S.items = await api("/items?all=1");
    drawKatalog();
  } catch (e) {
    toast(e.message);
  }
}
$("#fItem").onsubmit = async (e) => {
  e.preventDefault();
  await editItem(
    () =>
      api("/items", "POST", {
        ikon: $("#iIkon").value,
        nama: $("#iNama").value,
        kategori: $("#iKat").value,
        harga: +$("#iHarga").value,
      }),
    "Barang ditambahkan.",
  );
  e.target.reset();
};

/* ---------- Voucher ---------- */
const vDesc = (v) =>
  ({
    persen: `Diskon ${v.nilai}%${v.maks_diskon ? ` (maks ${rp(v.maks_diskon)})` : ""}`,
    nominal: `Potongan ${rp(v.nilai)}`,
    ongkir: "Gratis ongkir",
  })[v.tipe];
async function drawVoucher() {
  const list = await api("/vouchers").catch(() => []);
  $("#vlist").innerHTML = list.length
    ? list
        .map(
          (
            v,
          ) => `<div class="card kcard ${v.aktif ? "" : "off"}" data-id="${v.id}"><div class="kh"><div class="vk">${esc(v.kode)}</div></div>
    <div>${vDesc(v)}</div><small class="muted">${v.min_belanja ? "Min. belanja " + rp(v.min_belanja) + " · " : ""}Dipakai ${v.dipakai}${v.kuota ? "/" + v.kuota : ""}${v.sampai ? " · s/d " + tgl(v.sampai) : ""}</small>
    <div class="krow" style="justify-content:space-between"><label class="sw"><input type="checkbox" class="vt" ${v.aktif ? "checked" : ""}><span></span></label><button class="btn ghost mini vd">Hapus</button></div></div>`,
        )
        .join("")
    : '<p class="muted">Belum ada voucher.</p>';
  $$("#vlist .kcard").forEach((c) => {
    const id = +c.dataset.id;
    $(".vt", c).onchange = async (e) => {
      await api("/vouchers/" + id, "PATCH", { aktif: e.target.checked });
      toast(e.target.checked ? "Voucher aktif." : "Voucher nonaktif.");
      drawVoucher();
    };
    $(".vd", c).onclick = async () => {
      if (confirm("Hapus voucher ini?")) {
        await api("/vouchers/" + id, "DELETE");
        toast("Voucher dihapus.");
        drawVoucher();
      }
    };
  });
}
$("#fVou").onsubmit = async (e) => {
  e.preventDefault();
  try {
    await api("/vouchers", "POST", {
      kode: $("#vKode").value,
      tipe: $("#vTipe").value,
      nilai: +$("#vNilai").value || 0,
      min_belanja: +$("#vMin").value || 0,
      maks_diskon: +$("#vMaks").value || 0,
      kuota: +$("#vKuota").value || 0,
      sampai: $("#vSampai").value || null,
    });
    toast("Voucher dibuat.");
    e.target.reset();
    drawVoucher();
  } catch (x) {
    toast(x.message);
  }
};

/* ---------- Kalender produksi: beban parcel per tanggal ---------- */
let calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let capacity = 0;

async function drawJadwal() {
  const set = await api("/settings").catch(() => ({}));
  capacity = +set.kapasitas_harian || 0;
  const y = calMonth.getFullYear();
  const m = calMonth.getMonth();
  $("#calTitle").textContent = calMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  $("#calInfo").textContent = capacity
    ? `Kapasitas ${capacity} parcel per hari. Ketuk tanggal untuk melihat pesanannya.`
    : "Kapasitas harian belum diatur (Pengaturan > Kapasitas parcel per hari). Ketuk tanggal untuk melihat pesanannya.";

  // Kumpulkan pesanan per tanggal (sebelum yang sudah selesai pun tetap dihitung sebagai beban hari itu)
  const byDay = {};
  S.orders.forEach((o) => {
    if (!o.tanggal_acara) return;
    (byDay[o.tanggal_acara] = byDay[o.tanggal_acara] || []).push(o);
  });

  const first = new Date(y, m, 1);
  const offset = (first.getDay() + 6) % 7; // Senin = 0
  const days = new Date(y, m + 1, 0).getDate();
  const todayIso = new Date().toLocaleDateString("sv-SE");
  let cells = ""
    .padStart(offset, ".")
    .split("")
    .map(() => '<div class="cd empty"></div>')
    .join("");
  for (let d = 1; d <= days; d++) {
    const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const list = byDay[iso] || [];
    const qty = list.reduce((a, o) => a + o.qty, 0);
    const ratio = capacity ? qty / capacity : 0;
    const level = !qty
      ? ""
      : capacity
        ? ratio >= 1
          ? "l4"
          : ratio >= 0.7
            ? "l3"
            : ratio >= 0.4
              ? "l2"
              : "l1"
        : "l1";
    cells += `<button class="cd ${level} ${iso === todayIso ? "today" : ""}" data-d="${iso}">
      <span class="n">${d}</span>${qty ? `<b>${qty}</b><small>${list.length} pesanan</small>` : ""}</button>`;
  }
  $("#cal").innerHTML = cells;

  $$("#cal .cd[data-d]").forEach((cell) => {
    cell.onclick = () => {
      $$("#cal .cd").forEach((x) => x.classList.remove("sel"));
      cell.classList.add("sel");
      showDay(cell.dataset.d, byDay[cell.dataset.d] || []);
    };
  });
  $("#calDay").hidden = true;
}

function showDay(iso, list) {
  const total = list.reduce((a, o) => a + o.qty, 0);
  $("#calDay").hidden = false;
  $("#calDay").innerHTML = `
    <h3>${tgl(iso)}</h3>
    <p class="muted">${list.length} pesanan · ${total} parcel${capacity ? ` · sisa kuota ${Math.max(0, capacity - total)}` : ""}</p>
    ${
      list.length
        ? list
            .map(
              (o) => `<div class="rk" data-id="${o.id}">
                <span><b>${o.kode}</b> · ${esc(o.nama)} · ${o.qty} parcel</span>
                <span><span class="badge b-wait">${LABEL[o.status]}</span> <button class="btn ghost mini open">Buka</button></span>
              </div>`,
            )
            .join("")
        : '<p class="muted">Belum ada pesanan di tanggal ini.</p>'
    }`;
  $$("#calDay .rk").forEach((row) => {
    $(".open", row).onclick = () => {
      $('#vtabs button[data-v="vOrders"]').click();
      show(+row.dataset.id);
    };
  });
}

$("#calPrev").onclick = () => {
  calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1);
  drawJadwal();
};
$("#calNext").onclick = () => {
  calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1);
  drawJadwal();
};

/* ---------- Metode pembayaran ---------- */
let pmEdit = null; // id metode yang sedang diubah

function resetPmForm() {
  pmEdit = null;
  $("#fBayar").reset();
  $("#pmTitle").textContent = "Tambah metode pembayaran";
  $("#pmBatal").hidden = true;
}

async function drawBayarAdmin() {
  const list = await api("/payment-methods?semua=1").catch(() => []);
  $("#pmAdmin").innerHTML = list
    .map(
      (m) => `
      <div class="card kcard ${m.aktif ? "" : "off"}" data-id="${m.id}">
        <div class="kh"><b>${BAYAR_IKON[m.tipe]} ${esc(m.nama)}</b><span class="badge b-ok">${TIPE_BAYAR[m.tipe]}</span></div>
        <small class="muted">${esc(m.keterangan || "")}</small>
        ${m.no_rek ? `<div>${esc(m.bank || "")} <b>${esc(m.no_rek)}</b> a.n. ${esc(m.atas_nama || "-")}</div>` : ""}
        ${m.tipe === "qris" ? (m.qris_foto ? `<img src="/uploads/${m.qris_foto}" alt="QRIS" style="width:140px;border-radius:12px">` : '<small class="muted">Belum ada gambar QRIS.</small>') : ""}
        <div class="krow" style="justify-content:space-between">
          <label class="sw"><input type="checkbox" class="pt" ${m.aktif ? "checked" : ""}><span></span></label>
          <span class="krow">
            ${m.tipe === "qris" ? '<label class="btn ghost mini" style="margin:0;cursor:pointer">Unggah QRIS<input type="file" class="pq" accept="image/*" hidden></label>' : ""}
            <button class="btn ghost mini pe">Ubah</button><button class="btn ghost mini pd">Hapus</button>
          </span>
        </div>
      </div>`,
    )
    .join("");

  $$("#pmAdmin .kcard").forEach((card) => {
    const id = +card.dataset.id;
    const m = list.find((x) => x.id === id);
    const body = (aktif) => ({
      nama: m.nama,
      tipe: m.tipe,
      keterangan: m.keterangan,
      bank: m.bank,
      no_rek: m.no_rek,
      atas_nama: m.atas_nama,
      urut: m.urut,
      aktif,
    });
    $(".pt", card).onchange = async (e) => {
      await api("/payment-methods/" + id, "PATCH", body(e.target.checked ? 1 : 0));
      toast(e.target.checked ? "Metode aktif." : "Metode dinonaktifkan.");
      drawBayarAdmin();
    };
    $(".pe", card).onclick = () => {
      pmEdit = id;
      $("#pmTitle").textContent = "Ubah metode pembayaran";
      $("#pmTipe").value = m.tipe;
      $("#pmNama").value = m.nama;
      $("#pmBank").value = m.bank || "";
      $("#pmNo").value = m.no_rek || "";
      $("#pmAn").value = m.atas_nama || "";
      $("#pmKet").value = m.keterangan || "";
      $("#pmBatal").hidden = false;
      $("#fBayar").scrollIntoView({ behavior: "smooth", block: "center" });
    };
    $(".pd", card).onclick = async () => {
      if (!confirm(`Hapus metode "${m.nama}"?`)) return;
      const r = await api("/payment-methods/" + id, "DELETE");
      toast(r.nonaktif ? "Sudah dipakai pesanan, jadi hanya dinonaktifkan." : "Metode dihapus.");
      drawBayarAdmin();
    };
    if ($(".pq", card)) {
      $(".pq", card).onchange = async (e) => {
        const fd = new FormData();
        fd.append("file", e.target.files[0]);
        const res = await fetch(`/api/payment-methods/${id}/qris`, { method: "POST", body: fd });
        toast(res.ok ? "Gambar QRIS diunggah ✓" : "Gambar harus JPG/PNG/WEBP maksimal 6 MB.");
        drawBayarAdmin();
      };
    }
  });
}

$("#fBayar").onsubmit = async (e) => {
  e.preventDefault();
  const body = {
    tipe: $("#pmTipe").value,
    nama: $("#pmNama").value,
    bank: $("#pmBank").value,
    no_rek: $("#pmNo").value,
    atas_nama: $("#pmAn").value,
    keterangan: $("#pmKet").value,
    aktif: 1,
  };
  try {
    await (pmEdit ? api("/payment-methods/" + pmEdit, "PATCH", body) : api("/payment-methods", "POST", body));
    toast("Metode pembayaran disimpan ✓");
    resetPmForm();
    drawBayarAdmin();
  } catch (x) {
    toast(x.message);
  }
};
$("#pmBatal").onclick = resetPmForm;

/* ---------- Galeri ---------- */
async function drawGaleri() {
  const g = await api("/gallery").catch(() => []);
  $("#gal").innerHTML = g.length
    ? g
        .map(
          (x) =>
            `<div class="card gcard"><img src="${photoUrl(x.foto)}" alt="${esc(x.caption)}" data-zoom="${photoUrl(x.foto)}" loading="lazy"><p>${esc(x.caption) || '<span class="muted">Tanpa keterangan</span>'}</p><button class="btn ghost mini" data-del="${x.id}">Hapus</button></div>`,
        )
        .join("")
    : '<p class="muted">Belum ada foto. Unggah foto parcel pertamamu.</p>';
  $$("[data-del]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (confirm("Hapus foto ini?")) {
          await api("/gallery/" + b.dataset.del, "DELETE");
          toast("Foto dihapus.");
          drawGaleri();
        }
      }),
  );
}
$("#fGal").onsubmit = async (e) => {
  e.preventDefault();
  try {
    await uploadPhoto("/gallery", $("#gFile").files[0], { caption: $("#gCap").value });
    toast("Foto ditambahkan ke galeri.");
    e.target.reset();
    drawGaleri();
  } catch (x) {
    toast(x.message);
  }
};

/* ---------- Pengaturan ---------- */
function drawSet() {
  const s = window.SET;
  $("#fSet").innerHTML =
    SET_FIELDS.map(
      ([k, l]) =>
        `<div><label for="s_${k}">${l}</label><input id="s_${k}" value="${esc(s[k] || "")}" maxlength="120"></div>`,
    ).join("") +
    '<button type="button" class="btn ghost" id="geoToko">📍 Pakai lokasiku sebagai lokasi toko</button><button class="btn">Simpan pengaturan</button>';
  $("#geoToko").onclick = () => {
    if (!navigator.geolocation) return toast("Peramban tidak mendukung lokasi.");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        $("#s_toko_lat").value = p.coords.latitude.toFixed(6);
        $("#s_toko_lng").value = p.coords.longitude.toFixed(6);
        toast("Lokasi terisi. Klik Simpan pengaturan.");
      },
      () => toast("Lokasi tidak bisa diambil."),
    );
  };
}
$("#fSet").onsubmit = async (e) => {
  e.preventDefault();
  try {
    await api("/settings", "PUT", Object.fromEntries(SET_FIELDS.map(([k]) => [k, $("#s_" + k).value])));
    window.SET = await api("/settings");
    toast("Pengaturan disimpan.");
  } catch (x) {
    toast(x.message);
  }
};

/* ---------- Muat data berkala ---------- */
async function loadOrders() {
  try {
    S.orders = await api("/orders");
  } catch (e) {
    return;
  }
  const maxId = Math.max(0, ...S.orders.map((o) => o.id));
  if (!S.boot && maxId > S.seen) {
    const n = S.orders.find((o) => o.id === maxId);
    beep();
    toast(`Pesanan baru ${n.kode} dari ${n.nama}`);
    if ("Notification" in window && Notification.permission === "granted")
      new Notification("Pesanan baru " + n.kode, { body: `${n.nama} · ${rp(n.total)}` });
  }
  S.seen = maxId;
  S.boot = false;
  drawOrders();
  if (!$("#vRingkas").hidden) drawRingkas();
}
(async () => {
  const me = await initNav();
  if (me.role !== "admin") return (location = "masuk.html");
  S.items = await api("/items?all=1");
  await loadOrders();
  setInterval(loadOrders, 8000);
})();
