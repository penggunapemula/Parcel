/* ==========================================================================
   AKUN — profil, banyak alamat (tambah / ubah / hapus / utama), ganti kata sandi
   ========================================================================== */
let ME = {};
let ADDR = [];
let editingId = null; // id alamat yang sedang diubah (null = alamat baru)

/* ---------- Tab ---------- */
const PANES = ["vProfil", "vAlamat", "vAman"];

function showPane(id) {
  PANES.forEach((p) => ($("#" + p).hidden = p !== id));
  $$("#atabs button").forEach((b) => b.classList.toggle("on", b.dataset.v === id));
  history.replaceState(null, "", "#" + id.slice(1).toLowerCase());
}

$$("#atabs button").forEach((b) => (b.onclick = () => showPane(b.dataset.v)));

/* ---------- Profil ---------- */
function fillProfile() {
  $("#avatar").textContent = (ME.nama || "?").trim()[0];
  $("#meNama").textContent = ME.nama;
  $("#meEmail").textContent = `${ME.email || ""} · ${ME.hp || ""}`;
  $("#pNama").value = ME.nama || "";
  $("#pEmail").value = ME.email || "";
  $("#pHp").value = ME.hp || "";
}

$("#fProfil").onsubmit = async (e) => {
  e.preventDefault();
  $("#eProfil").textContent = "";
  try {
    const r = await api("/me", "PATCH", {
      nama: $("#pNama").value,
      email: $("#pEmail").value,
      hp: $("#pHp").value,
    });
    ME = { ...ME, nama: r.nama, email: r.email, hp: r.hp };
    fillProfile();
    toast("Profil diperbarui ✓");
  } catch (x) {
    $("#eProfil").textContent = x.message;
  }
};

/* ---------- Kata sandi & keluar ---------- */
$("#fPw").onsubmit = async (e) => {
  e.preventDefault();
  $("#ePw").textContent = "";
  try {
    await api("/me/password", "POST", { lama: $("#pwLama").value, baru: $("#pwBaru").value });
    e.target.reset();
    toast("Kata sandi diubah ✓");
  } catch (x) {
    $("#ePw").textContent = x.message;
  }
};

$("#logout").onclick = async () => {
  await api("/logout", "POST");
  location = "beranda.html";
};

/* ---------- Daftar alamat ---------- */
const LABEL_IKON = { Rumah: "🏠", Kantor: "🏢" };

function drawAddresses() {
  if (!ADDR.length) {
    $("#addrList").innerHTML = `
      <div class="empty">
        <div class="big">📍</div>
        <h3>Belum ada alamat tersimpan</h3>
        <p class="muted">Tambahkan alamat agar pemesanan berikutnya lebih cepat.</p>
      </div>`;
    return;
  }
  $("#addrList").innerHTML = ADDR.map(
    (a) => `
      <article class="card addr ${a.utama ? "utama" : ""}" data-id="${a.id}">
        <div class="addr-top">
          <span class="addr-label">${LABEL_IKON[a.label] || "📌"} ${esc(a.label)}</span>
          ${a.utama ? '<span class="badge b-ok">Utama</span>' : ""}
        </div>
        <b>${esc(a.penerima)} · ${esc(a.hp)}</b>
        <p>${esc(a.alamat)}</p>
        ${a.catatan ? `<small class="muted">Patokan: ${esc(a.catatan)}</small>` : ""}
        ${
          a.lat
            ? `<small><a href="https://www.google.com/maps?q=${a.lat},${a.lng}" target="_blank" rel="noopener">📍 Lihat di peta</a></small>`
            : ""
        }
        <div class="addr-actions">
          ${a.utama ? "" : '<button class="btn ghost mini a-utama">Jadikan utama</button>'}
          <button class="btn ghost mini a-ubah">Ubah</button>
          <button class="btn ghost mini a-hapus">Hapus</button>
        </div>
      </article>`,
  ).join("");

  $$("#addrList .addr").forEach((card) => {
    const id = +card.dataset.id;
    const addr = ADDR.find((a) => a.id === id);
    const on = (sel, fn) => $(sel, card) && ($(sel, card).onclick = fn);
    on(".a-utama", async () => {
      await api(`/addresses/${id}/utama`, "POST");
      toast("Alamat utama diganti ✓");
      loadAddresses();
    });
    on(".a-ubah", () => openForm(addr));
    on(".a-hapus", async () => {
      if (!confirm(`Hapus alamat "${addr.label}"?`)) return;
      await api(`/addresses/${id}`, "DELETE");
      toast("Alamat dihapus.");
      loadAddresses();
    });
  });
}

async function loadAddresses() {
  ADDR = await api("/addresses").catch(() => []);
  drawAddresses();
}

/* ---------- Form alamat (modal) ---------- */
let coords = { lat: null, lng: null };
let label = "Rumah";

function setLabel(l) {
  const preset = ["Rumah", "Kantor", "Lainnya"].includes(l) ? l : "Lainnya";
  $$("#labelSeg button").forEach((b) => b.classList.toggle("on", b.dataset.l === preset));
  $("#aLabel").hidden = preset !== "Lainnya";
  label = l;
  if (preset === "Lainnya") $("#aLabel").value = l === "Lainnya" ? "" : l;
}

$$("#labelSeg button").forEach((b) => (b.onclick = () => setLabel(b.dataset.l)));

function showCoords() {
  $("#aGpsTxt").innerHTML = coords.lat
    ? `✓ Lokasi tersimpan. <a href="https://www.google.com/maps?q=${coords.lat},${coords.lng}" target="_blank" rel="noopener">Lihat di peta</a>`
    : "Titik lokasi membantu kurir dan menghitung ongkir sesuai jarak.";
}

function openForm(addr = null) {
  editingId = addr ? addr.id : null;
  $("#addrTitle").textContent = addr ? "Ubah alamat" : "Tambah alamat";
  $("#aPenerima").value = addr ? addr.penerima : ME.nama || "";
  $("#aHp").value = addr ? addr.hp : ME.hp || "";
  $("#aAlamat").value = addr ? addr.alamat : "";
  $("#aCatatan").value = addr ? addr.catatan || "" : "";
  $("#aUtama").checked = addr ? !!addr.utama : ADDR.length === 0;
  coords = { lat: addr ? addr.lat : null, lng: addr ? addr.lng : null };
  setLabel(addr ? addr.label : "Rumah");
  $("#eAddr").textContent = "";
  showCoords();
  $("#addrModal").hidden = false;
}

const closeForm = () => ($("#addrModal").hidden = true);
$("#addAddr").onclick = () => openForm();
$("#aBatal").onclick = closeForm;
$("#addrModal").onclick = (e) => {
  if (e.target.id === "addrModal") closeForm();
};

$("#aGps").onclick = () => {
  if (!navigator.geolocation) return toast("Peramban tidak mendukung lokasi.");
  $("#aGpsTxt").textContent = "Mencari lokasi…";
  navigator.geolocation.getCurrentPosition(
    (p) => {
      coords = { lat: p.coords.latitude, lng: p.coords.longitude };
      showCoords();
    },
    () => ($("#aGpsTxt").textContent = "Lokasi tidak bisa diambil. Tulis alamat lengkap saja."),
    { enableHighAccuracy: true, timeout: 10000 },
  );
};

$("#fAddr").onsubmit = async (e) => {
  e.preventDefault();
  $("#eAddr").textContent = "";
  const chosen = $("#labelSeg .on").dataset.l;
  const body = {
    label: chosen === "Lainnya" ? $("#aLabel").value.trim() || "Lainnya" : chosen,
    penerima: $("#aPenerima").value,
    hp: $("#aHp").value,
    alamat: $("#aAlamat").value,
    catatan: $("#aCatatan").value,
    lat: coords.lat,
    lng: coords.lng,
    utama: $("#aUtama").checked,
  };
  try {
    await (editingId ? api(`/addresses/${editingId}`, "PUT", body) : api("/addresses", "POST", body));
    closeForm();
    toast(editingId ? "Alamat diperbarui ✓" : "Alamat disimpan ✓");
    loadAddresses();
  } catch (x) {
    $("#eAddr").textContent = x.message;
  }
};

/* ---------- Inisialisasi ---------- */
(async () => {
  ME = await initNav();
  if (ME.role !== "user") return (location = "masuk.html?next=akun.html");
  fillProfile();
  await loadAddresses();
  const hash = location.hash.slice(1);
  const pane = PANES.find((p) => p.slice(1).toLowerCase() === hash);
  if (pane) showPane(pane);
})();
