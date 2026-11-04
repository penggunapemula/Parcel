/* ==========================================================================
   LACAK — cari pesanan dengan kode + 4 digit akhir nomor telepon (tanpa login)
   ========================================================================== */
initNav();

const NOW_MSG = {
  baru: "Pesananmu sudah kami terima dan menunggu diproses.",
  diproses: "Pesananmu sedang kami proses.",
  dikemas: "Parcelmu sedang dikemas dengan rapi 🎀",
  siap: "Parcelmu sudah siap diambil di toko 🛍️",
  diantar: "Parcelmu sedang dalam perjalanan 🚚",
  selesai: "Pesanan selesai. Terima kasih sudah memesan! 🙏",
};

const fmtTime = (s) =>
  new Date(s.replace(" ", "T")).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function render(o) {
  const wa = (window.SET && window.SET.wa) || "";
  const msg = encodeURIComponent(`Halo, saya mau tanya pesanan ${o.kode}.`);
  $("#hasil").innerHTML = `
    <header>
      <h2>${esc(o.kode)}</h2>
      <span class="badge ${o.status === "selesai" ? "b-ok" : "b-wait"}">${LABEL[o.status] || o.status}</span>
    </header>
    <p class="sum-line">
      Halo ${esc(o.nama)} · ${o.qty} parcel ${rp(o.paket)} · ${METODE[o.metode]} · dibutuhkan ${tgl(o.tanggal_acara)}
    </p>
    ${trackHTML(o)}
    <div class="now-msg">${NOW_MSG[o.status] || ""}</div>
    <h4>Riwayat</h4>
    <ol class="lt">
      ${[...o.linimasa]
        .reverse()
        .map((l) => `<li><b>${LABEL[l.status] || l.status}</b><small>${fmtTime(l.created)}</small></li>`)
        .join("")}
    </ol>
    <div class="actions">
      ${wa ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${msg}">💬 Tanya admin</a>` : ""}
      <a class="btn ghost" href="masuk.html?next=pesanan.html">Masuk untuk detail & struk</a>
    </div>`;
  $("#hasil").hidden = false;
  $("#hasil").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

$("#fLacak").onsubmit = async (e) => {
  e.preventDefault();
  $("#eLacak").textContent = "";
  $("#hasil").hidden = true;
  const kode = $("#kode").value.trim().toUpperCase();
  history.replaceState(null, "", "?kode=" + encodeURIComponent(kode));
  try {
    render(await api(`/track?kode=${encodeURIComponent(kode)}&hp=${encodeURIComponent($("#hp4").value)}`));
  } catch (x) {
    $("#eLacak").textContent = x.message;
  }
};

const preset = new URLSearchParams(location.search).get("kode");
if (preset) {
  $("#kode").value = preset.toUpperCase();
  $("#hp4").focus();
}
