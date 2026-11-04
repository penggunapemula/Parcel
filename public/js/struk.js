/* ==========================================================================
   STRUK — halaman struk pesanan: tampilan menarik, barcode Code 39, cetak/PDF
   Alamat: struk.html?id=<id pesanan>
   ========================================================================== */

/* ---------- Barcode Code 39 (bisa dipindai) ---------- */
// Pola 9 elemen: bar, spasi, bar, spasi, ... (w = lebar, n = sempit)
const CODE39 = {
  0: "nnnwwnwnn",
  1: "wnnwnnnnw",
  2: "nnwwnnnnw",
  3: "wnwwnnnnn",
  4: "nnnwwnnnw",
  5: "wnnwwnnnn",
  6: "nnwwwnnnn",
  7: "nnnwnnwnw",
  8: "wnnwnnwnn",
  9: "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "*": "nwnnwnwnn",
};

function barcodeSVG(text) {
  const data = `*${String(text)
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")}*`;
  const wide = 3;
  let x = 0;
  let bars = "";
  [...data].forEach((ch, idx) => {
    [...CODE39[ch]].forEach((w, i) => {
      const width = w === "w" ? wide : 1;
      if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${width}" height="44"/>`;
      x += width;
    });
    if (idx < data.length - 1) x += 1; // celah antar karakter
  });
  return `<svg class="barcode" viewBox="0 0 ${x} 44" preserveAspectRatio="none" role="img" aria-label="Barcode ${esc(text)}">${bars}</svg>`;
}

/* ---------- Bagian-bagian struk ---------- */
const jam = (s) => (s ? s.slice(11, 16) : "");
const tglPendek = (s) =>
  s
    ? new Date(s.replace(" ", "T")).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-";

function stampHTML(o) {
  const lunas = o.paid >= o.total;
  const [teks, cls] = lunas
    ? ["LUNAS", "ok"]
    : o.paid > 0
      ? ["DP DITERIMA", "wait"]
      : o.pay_type === "cod"
        ? ["BAYAR DI TEMPAT", "wait"]
        : ["BELUM BAYAR", "no"];
  return `<div class="stamp ${cls}">${teks}</div>`;
}

function infoRow(label, value) {
  return value ? `<div><small>${label}</small><b>${value}</b></div>` : "";
}

function itemsHTML(o) {
  const list = o.isi && o.isi.length ? o.isi : o.items;
  const nilai = list.reduce((s, i) => s + (i.harga || 0), 0);
  return `
    <section>
      <h4>Isi per parcel · ${list.length} barang</h4>
      <ul class="lines">
        ${list
          .map(
            (i) =>
              `<li><span class="ic">${pic(i)}</span><span class="nm">${esc(i.nama)}</span>${
                i.harga ? `<span class="pr">${rp(i.harga)}</span>` : ""
              }</li>`,
          )
          .join("")}
      </ul>
      ${nilai ? `<div class="mini-total"><span>Nilai isi</span><span>${rp(nilai)}</span></div>` : ""}
    </section>`;
}

function totalsHTML(o) {
  const row = (a, b, cls = "") => `<div class="${cls}"><span>${a}</span><span>${b}</span></div>`;
  let h = row(`Parcel ${rp(o.paket)} × ${o.qty}`, rp(o.subtotal || o.paket * o.qty));
  if (o.metode !== "ambil") h += row("Ongkos kirim", o.ongkir ? rp(o.ongkir) : "Gratis");
  if (o.diskon) h += row(`Voucher ${esc(o.voucher)}`, "−" + rp(o.diskon), "disc");
  h += row("TOTAL", rp(o.total), "grand");
  h += row("Sudah dibayar", rp(o.paid));
  h += row(o.total - o.paid > 0 ? "Sisa pembayaran" : "Sisa", rp(Math.max(0, o.total - o.paid)), "sisa");
  return `<section class="totals">${h}</section>`;
}

function historyHTML(o) {
  if (!o.pembayaran || !o.pembayaran.length) return "";
  return `
    <section>
      <h4>Riwayat pembayaran</h4>
      <ul class="lines">
        ${o.pembayaran
          .map(
            (p) =>
              `<li><span class="nm">${tglPendek(p.created)} · ${jam(p.created)}</span><span class="pr">+${rp(p.jumlah)}</span></li>`,
          )
          .join("")}
      </ul>
    </section>`;
}

function timelineHTML(o) {
  if (!o.linimasa || !o.linimasa.length) return "";
  return `
    <section>
      <h4>Perjalanan pesanan</h4>
      <ol class="tl">
        ${o.linimasa
          .map(
            (l, i) =>
              `<li class="${i === o.linimasa.length - 1 ? "now" : ""}"><b>${LABEL[l.status] || l.status}</b><small>${tglPendek(l.created)} · ${jam(l.created)}</small></li>`,
          )
          .join("")}
      </ol>
    </section>`;
}

function kartuHTML(o) {
  if (!(o.kartu || o.kartu_untuk || o.kartu_dari)) return "";
  return `
    <section class="kartu-box">
      <h4>Kartu ucapan</h4>
      <div class="kmini">${KartuView.html({ untuk: o.kartu_untuk || "", pesan: o.kartu || "", dari: o.kartu_dari || "", gaya: o.kartu_gaya, tema: o.kartu_tema })}</div>
    </section>`;
}

function payHowHTML(o) {
  const sisa = o.total - o.paid;
  const m = o.bayar;
  if (sisa <= 0 || !m) return "";
  if (m.tipe === "cash") {
    return `
      <section class="payhow">
        <h4>Cara pembayaran</h4>
        <p>Bayar <b>tunai ${rp(sisa)}</b> saat parcel ${o.metode === "ambil" ? "diambil di toko" : "diterima"}.</p>
      </section>`;
  }
  const nominal = o.pay_type === "dp" && o.paid === 0 ? Math.ceil(o.total / 2) : sisa;
  const detail =
    m.tipe === "qris"
      ? m.qris_foto
        ? `<img class="qr" src="/uploads/${m.qris_foto}" alt="Kode QRIS">`
        : "<small>Minta kode QRIS ke admin lewat chat.</small>"
      : `<div class="bank"><b>${esc(m.bank || m.nama)}</b> <span id="rek">${esc(m.no_rek || "")}</span> <button type="button" class="btn ghost mini" id="copyRek">Salin</button></div>
         <small>a.n. ${esc(m.atas_nama || "")}</small>`;
  return `
    <section class="payhow">
      <h4>Cara pembayaran · ${esc(m.nama)}</h4>
      <p>Bayar <b>${rp(nominal)}</b>${m.tipe === "qris" ? " dengan scan QRIS:" : " ke:"}</p>
      ${detail}
      <small>Setelah membayar, unggah bukti di halaman Pesanan Saya.</small>
    </section>`;
}

function paperHTML(o, set) {
  return `
    <div class="zig top"></div>
    <div class="inner">
      <header class="shop">
        <span class="mark">🎁</span>
        <h1>${esc(set.toko_nama || "Parcelku")}</h1>
        <p>${esc(set.tagline || "")}</p>
        <small>${esc(set.alamat_toko || "")}</small>
      </header>

      <div class="kodebox">
        <small>KODE PESANAN</small>
        <strong>${esc(o.kode)}</strong>
        ${barcodeSVG(o.kode)}
        ${stampHTML(o)}
      </div>

      <section class="meta">
        ${infoRow("Pelanggan", esc(o.nama))}
        ${infoRow("WhatsApp", esc(o.hp))}
        ${infoRow("Tanggal pesan", tglPendek(o.created) + " · " + jam(o.created))}
        ${infoRow("Dibutuhkan", tgl(o.tanggal_acara))}
        ${infoRow("Pengambilan", METODE[o.metode])}
        ${infoRow("Pembayaran", esc(o.bayar_nama || "-"))}
        ${infoRow("Wadah", WADAH[o.wadah] || "Nampan hijau emas")}
        ${infoRow("Pita", `<span class="dotc pita ${o.bungkus}"></span> ${BUNGKUS[o.bungkus] || ""}`)}
        ${infoRow("Status", LABEL[o.status] || o.status)}
        ${o.alamat ? `<div class="wide"><small>Alamat</small><b>${esc(o.alamat)}</b></div>` : ""}
      </section>

      ${itemsHTML(o)}
      ${totalsHTML(o)}
      ${historyHTML(o)}
      ${payHowHTML(o)}
      ${kartuHTML(o)}
      ${timelineHTML(o)}
      ${o.catatan ? `<section><h4>Catatan</h4><p class="note">${esc(o.catatan)}</p></section>` : ""}

      <footer class="thanks">
        <p class="script">Matur suksma</p>
        <p>Terima kasih sudah memesan di ${esc(set.toko_nama || "Parcelku")}.</p>
        <small>Simpan struk ini sebagai bukti pesanan · dicetak ${new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</small>
      </footer>
    </div>
    <div class="zig bottom"></div>`;
}

/* ---------- Aksi ---------- */
function bindActions(o, set) {
  $("#print").onclick = () => window.print();

  // Ukuran: lebar (A5/layar) atau struk kecil 80 mm untuk printer thermal
  $$("#size button").forEach((b) => {
    b.onclick = () => {
      $$("#size button").forEach((x) => x.classList.toggle("on", x === b));
      const thermal = b.dataset.size === "thermal";
      document.body.classList.toggle("thermal", thermal);
      let tag = $("#pageSize");
      if (!tag) {
        tag = document.createElement("style");
        tag.id = "pageSize";
        document.head.append(tag);
      }
      tag.textContent = thermal ? "@page { size: 80mm auto; margin: 3mm; }" : "@page { margin: 10mm; }";
    };
  });

  $("#share").onclick = () => {
    const sisa = Math.max(0, o.total - o.paid);
    const text = `🧾 Struk ${o.kode} · ${set.toko_nama || "Parcelku"}\nParcel ${rp(o.paket)} × ${o.qty}\nTotal ${rp(o.total)} · ${sisa ? "Sisa " + rp(sisa) : "LUNAS ✓"}\nDibutuhkan ${tgl(o.tanggal_acara)}`;
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
  };

  const copy = $("#copyRek");
  if (copy) {
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText($("#rek").textContent);
        toast("Nomor rekening disalin");
      } catch (e) {
        toast("Salin manual: " + $("#rek").textContent);
      }
    };
  }
}

/* ---------- Inisialisasi ---------- */
(async () => {
  const id = +new URLSearchParams(location.search).get("id");
  const paper = $("#paper");
  try {
    const [me, set] = await Promise.all([api("/me"), api("/settings").catch(() => ({}))]);
    if (!me.role)
      return (location = "masuk.html?next=" + encodeURIComponent(location.pathname + location.search));
    if (me.role === "admin") $("#back").href = "admin.html";
    const o = await api(`/orders/${id}`);
    document.title = `Struk ${o.kode} - Parcelku`;
    paper.innerHTML = paperHTML(o, set);
    bindActions(o, set);
  } catch (e) {
    paper.innerHTML = `<div class="inner"><p style="text-align:center">${esc(e.message || "Struk tidak ditemukan.")}</p></div>`;
  }
})();