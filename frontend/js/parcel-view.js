/* ==========================================================================
   PARCEL VIEW — peraga wadah parcel yang terisi langsung saat barang dicentang.
   Dipakai di Beranda (demo) dan halaman Buat Parcel.

   Pemakaian:
     const view = ParcelView.mount(document.querySelector("#stage"), { onRemove: (id) => {} });
     view.update({ wadah: "nampan", items: [...], pita: "pink", kartu: "", full: false });

   Saat `full: true` (budget sudah penuh) parcel "dibungkus": plastik bening,
   bunga kamboja, pita, dan kartu ucapan muncul sebagai hasil jadi.
   ========================================================================== */
const ParcelView = (() => {
  const PITA = { pink: "#e79bb0", emas: "#c9a24b", hijau: "#1f8a4c", putih: "#f1f5f2" };

  /** Bunga kamboja (frangipani) dalam SVG sederhana: 5 kelopak putih + inti emas. */
  const FLOWER = `
    <svg viewBox="-50 -50 100 100" aria-hidden="true">
      ${[0, 72, 144, 216, 288]
        .map(
          (r) =>
            `<ellipse cx="0" cy="-22" rx="14" ry="26" transform="rotate(${r})" fill="#fff" stroke="#e4f5ea" stroke-width="1.5"/>`,
        )
        .join("")}
      <circle r="10" fill="#c9a24b"/>
      <circle r="5" fill="#e6c36e"/>
    </svg>`;

  function template() {
    return `
      <div class="pv-stage">
        <div class="pv-fan"></div>
        <div class="pv-wadah">
          <div class="pv-grid"></div>
          <p class="pv-empty">Centang barang,<br>isinya langsung tampil di sini</p>
        </div>
        <div class="pv-film"></div>
        <div class="pv-deco">
          <span class="pv-flower">${FLOWER}</span>
          <span class="pv-bow"><i></i><i></i><b></b><u></u><u></u></span>
          <span class="pv-tag"><small>Hasil jadi</small><b class="pv-kartu">Matur Suksma</b></span>
        </div>
      </div>
      <p class="pv-note" aria-live="polite"></p>`;
  }

  function mount(root, opts = {}) {
    root.classList.add("pv");
    root.innerHTML = template();

    const grid = root.querySelector(".pv-grid");
    const note = root.querySelector(".pv-note");
    const kartuEl = root.querySelector(".pv-kartu");
    const tokens = new Map(); // id -> elemen

    /** Buat satu token barang (foto bila ada, emoji bila tidak). */
    function makeToken(item) {
      const el = document.createElement("div");
      el.className = "pv-tok";
      el.title = item.nama + (opts.onRemove ? " (klik untuk keluarkan)" : "");
      if (opts.onRemove) {
        el.classList.add("removable");
        el.onclick = () => opts.onRemove(item.id);
      }
      el.style.setProperty("--rot", ((item.id % 5) - 2) * 1.6 + "deg");
      el.innerHTML = item.foto
        ? `<img src="/uploads/${item.foto}" alt="${esc(item.nama)}">`
        : `<span class="pv-emo">${item.ikon}</span>`;
      el.insertAdjacentHTML("beforeend", `<small>${esc(item.nama)}</small>`);
      return el;
    }

    function update({ wadah = "nampan", items = [], pita = "pink", kartu = "", full = false, text = "" }) {
      root.dataset.wadah = wadah;
      root.style.setProperty("--c", PITA[pita] || PITA.pink);
      kartuEl.textContent = kartu.trim() || "Matur Suksma";

      // Jumlah kolom menyesuaikan banyaknya barang supaya selalu muat.
      const k = items.length <= 4 ? 2 : items.length <= 9 ? 3 : 4;
      grid.style.setProperty("--k", k);

      // Hapus token yang sudah tidak dipilih (dengan animasi keluar).
      const ids = new Set(items.map((i) => i.id));
      tokens.forEach((el, id) => {
        if (ids.has(id)) return;
        tokens.delete(id);
        el.classList.add("out");
        setTimeout(() => el.remove(), 260);
      });

      // Tambah token baru (animasi masuk), urutan mengikuti urutan pilihan.
      items.forEach((item) => {
        if (tokens.has(item.id)) return;
        const el = makeToken(item);
        tokens.set(item.id, el);
        grid.append(el);
      });

      root.classList.toggle("has-items", items.length > 0);
      const wasFull = root.classList.contains("done");
      root.classList.toggle("done", full && items.length > 0);
      note.textContent = text;
      return full && !wasFull; // true saat baru saja jadi (untuk memicu konfeti)
    }

    return { update, el: root };
  }

  return { mount };
})();
