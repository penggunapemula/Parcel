/* ==========================================================================
   KARTU — komponen kartu ucapan custom (pratinjau di form, pesanan, struk, admin)

   Pemakaian:
     KartuView.html({ untuk, pesan, dari, gaya: "elegan"|"tulisan"|"modern", tema: "krem"|"hijau"|"putih" })
   ========================================================================== */
const KartuView = (() => {
  const GAYA = { elegan: "Elegan", tulisan: "Tulisan tangan", modern: "Modern" };
  const TEMA = { krem: "Krem", hijau: "Hijau", putih: "Putih" };

  /** Hiasan bunga kamboja kecil di bagian atas kartu. */
  const ORN = `
    <svg viewBox="-50 -50 100 100" aria-hidden="true">
      ${[0, 72, 144, 216, 288]
        .map(
          (r) =>
            `<ellipse cx="0" cy="-20" rx="13" ry="24" transform="rotate(${r})" fill="currentColor" opacity=".9"/>`,
        )
        .join("")}
      <circle r="9" fill="#c9a24b"/>
    </svg>`;

  const safe = (t) =>
    String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /** Kembalikan HTML kartu. Bagian kosong tampil sebagai petunjuk samar. */
  function html({ untuk = "", pesan = "", dari = "", gaya = "elegan", tema = "krem" } = {}) {
    const g = GAYA[gaya] ? gaya : "elegan";
    const t = TEMA[tema] ? tema : "krem";
    const part = (cls, text, hint) =>
      text.trim()
        ? `<${cls[0]} class="${cls[1]}">${safe(text)}</${cls[0]}>`
        : `<${cls[0]} class="${cls[1]} ph">${hint}</${cls[0]}>`;

    return `
      <div class="kartu g-${g} t-${t}">
        <span class="k-orn">${ORN}</span>
        <small class="k-label">Untuk</small>
        ${part(["b", "k-untuk"], untuk, "Nama penerima")}
        ${part(["p", "k-pesan"], pesan, "Tulis ucapanmu di sini")}
        <span class="k-dari">${dari.trim() ? `Dari <b>${safe(dari)}</b>` : '<span class="ph">Nama pengirim</span>'}</span>
        <em class="k-brand">Parcelku</em>
      </div>`;
  }

  return { html, GAYA, TEMA };
})();
