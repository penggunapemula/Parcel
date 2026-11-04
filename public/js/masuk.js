/* ==========================================================================
   MASUK — login & daftar pelanggan (email + kata sandi + nomor telepon), serta login admin
   ========================================================================== */
initNav();
const params = new URLSearchParams(location.search);
const next = params.get("next");

/* ---------- Ganti form (Masuk / Daftar / Admin) ---------- */
const FORMS = ["fLogin", "fDaftar", "fAdmin"];

function showForm(id) {
  FORMS.forEach((f) => ($("#" + f).hidden = f !== id));
  $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === id));
}

$$("#tabs button").forEach((b) => (b.onclick = () => showForm(b.dataset.t)));
$$("[data-go]").forEach((a) => {
  a.onclick = (e) => {
    e.preventDefault();
    showForm(a.dataset.go);
  };
});
if (params.get("tab") === "daftar") showForm("fDaftar");

/* ---------- Tampilkan / sembunyikan kata sandi ---------- */
$$(".eye").forEach((btn) => {
  btn.onclick = () => {
    const input = btn.previousElementSibling;
    input.type = input.type === "password" ? "text" : "password";
  };
});

/* ---------- Penunjuk kekuatan kata sandi ---------- */
$("#dPw").oninput = (e) => {
  const v = e.target.value;
  let score = 0;
  if (v.length >= 8) score++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
  if (/\d/.test(v)) score++;
  if (/[^A-Za-z0-9]/.test(v) || v.length >= 12) score++;
  if (!v) score = 0;
  $("#strength").dataset.s = score;
  $("#strengthTxt").textContent = v ? ["", "Lemah", "Cukup", "Bagus", "Kuat"][score] || "Lemah" : "";
};

const done = () => (location = next || "pesan.html");

/* ---------- Kirim form ---------- */
$("#fLogin").onsubmit = async (e) => {
  e.preventDefault();
  $("#e1").textContent = "";
  try {
    await api("/login", "POST", { email: $("#lEmail").value, password: $("#lPw").value });
    done();
  } catch (x) {
    $("#e1").textContent = x.message;
  }
};

$("#fDaftar").onsubmit = async (e) => {
  e.preventDefault();
  $("#e3").textContent = "";
  try {
    await api("/register", "POST", {
      nama: $("#dNama").value,
      email: $("#dEmail").value,
      hp: $("#dHp").value,
      password: $("#dPw").value,
    });
    done();
  } catch (x) {
    $("#e3").textContent = x.message;
  }
};

$("#fAdmin").onsubmit = async (e) => {
  e.preventDefault();
  try {
    await api("/admin/login", "POST", { password: $("#pw").value });
    location = "admin.html";
  } catch (x) {
    $("#e2").textContent = x.message;
  }
};
