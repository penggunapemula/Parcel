/* Dashboard admin: pesanan, ringkasan, katalog, galeri, pengaturan */
const VIEWS = ["vOrders", "vRingkas", "vKatalog", "vVoucher", "vBayar", "vGaleri", "vSet"];
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

function printLabel(o) {
  const w = open("", "_blank", "width=420,height=620");
  if (!w) return toast("Izinkan pop-up untuk mencetak.");
  w.document.write(
    `<title>Label ${o.kode}</title><body style="font-family:sans-serif;padding:20px"><div style="border:3px dashed #000;padding:18px;border-radius:12px"><h1 style="margin:0">${esc(o.kode)}</h1><p style="font-size:20px"><b>${esc(o.nama)}</b><br>${esc(o.hp)}</p><p>Parcel ${rp(o.paket)} × ${o.qty} · ${METODE[o.metode]}<br>Total ${rp(o.total)} (ongkir ${rp(o.ongkir || 0)})<br>Butuh: ${tgl(o.tanggal_acara)} · Pita ${BUNGKUS[o.bungkus] || ""}</p><p>${o.items.map((i) => i.ikon + " " + esc(i.nama)).join("<br>")}</p>${o.kartu ? `<p><b>Kartu:</b> ${esc(o.kartu)}</p>` : ""}${o.alamat ? `<p><b>Alamat:</b><br>${esc(o.alamat)}</p>` : ""}${o.catatan ? `<p><i>${esc(o.catatan)}</i></p>` : ""}<p><b>${paymentText(o).t}</b></p></div>`,
  );
  w.document.close();
  setTimeout(() => w.print(), 300);
}
function show(id) {
  const o = S.orders.find((x) => x.id === id);
  if (!o) return;
  S.cur = id;
  const p = paymentText(o),
    f = FLOW[o.metode],
    nx = f[f.indexOf(o.status) + 1];
  $("#detail").innerHTML = `<h2>${o.kode} ${urgency(o)}</h2><p class="muted">Dipesan ${esc(o.created)}</p>
  <h3>Pelanggan</h3><p><b>${esc(o.nama)}</b> · <a href="https://wa.me/${o.hp.replace(/^0/, "62")}" target="_blank" rel="noopener">${esc(o.hp)} (WhatsApp)</a></p>
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
  <button class="btn ghost nextb" id="print">🖨️ Cetak label pengiriman</button><button class="btn ghost nextb" id="struk">🧾 Lihat struk</button><h3>Chat dengan pelanggan</h3><div id="chat"></div>`;
  $("#panel").classList.add("open");
  drawOrders();
  Chat($("#chat"), id, "admin");
  $("#full").onclick = () => ($("#paid").value = o.total);
  $("#savePay").onclick = () => saveOrder(id, { paid: +$("#paid").value }, "Pembayaran disimpan.");
  $("#saveSt").onclick = () => saveOrder(id, { status: $("#st").value }, "Status diperbarui.");
  if (nx) $("#nextSt").onclick = () => saveOrder(id, { status: nx }, "Status: " + LABEL[nx]);
  $("#print").onclick = () => printLabel(o);
  $("#struk").onclick = () => window.open(`struk.html?id=${o.id}`, "_blank");
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
function drawRingkas() {
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
