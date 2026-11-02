/* ==========================================================================
   PESAN — halaman Buat Parcel: susun isi, wadah, detail, pengambilan, pembayaran, kirim
   ========================================================================== */
const PAKET = [
  [15000, "Hemat", "Untuk tamu umum"],
  [25000, "Favorit", "Paling banyak dipilih"],
  [35000, "Premium", "Isi paling lengkap"],
];

// Status halaman
const S = {
  paket: 0,
  pick: new Set(), // id barang terpilih (urut sesuai pilihan)
  cat: "Semua",
  q: "",
  pita: "pink",
  wadah: "nampan",
  addrId: null, // id alamat tersimpan yang dipilih (null = tulis alamat lain)
  bayar: null, // kode metode pembayaran terpilih
  kgaya: "elegan",
  ktema: "krem",
  lat: null,
  lng: null,
  quote: null,
  voucher: "",
};
let ITEMS = [];
let ADDR = []; // alamat tersimpan pelanggan
let AV = { kapasitas: 0, min_hari: 0, terpakai: {} }; // jadwal & kuota harian
let METHODS = []; // metode pembayaran aktif
let ME = {};
let stage; // instance ParcelView
let wasFull = false;

/* ---------- Helper ---------- */
const val = (name) => document.querySelector(`input[name=${name}]:checked`)?.value;
const picked = () => [...S.pick].map((id) => ITEMS.find((i) => i.id === id)).filter(Boolean);
const used = () => picked().reduce((sum, i) => sum + i.harga, 0);
const minPrice = () => Math.min(...ITEMS.map((i) => i.harga));
/** Parcel dianggap "penuh" bila sudah ada isi dan sisa budget tidak cukup untuk barang termurah. */
const isFull = () => S.paket > 0 && S.pick.size > 0 && S.paket - used() < minPrice();

/* ---------- Render: paket, kategori, wadah, pita ---------- */
function drawPaket() {
  $("#paket").innerHTML = PAKET.map(
    ([p, nama, desc]) => `
      <button type="button" class="pk ${S.paket === p ? "on" : ""}" data-p="${p}">
        <b>${rp(p)}</b>${nama}<br><small class="muted">${desc}</small>
      </button>`,
  ).join("");

  $$(".pk").forEach((btn) => {
    btn.onclick = () => {
      S.paket = +btn.dataset.p;
      // Buang barang terakhir bila isi melebihi paket baru
      while (used() > S.paket) S.pick.delete([...S.pick].pop());
      draw();
      refreshQuote();
    };
  });
}

function drawCats() {
  const cats = ["Semua", ...new Set(ITEMS.map((i) => i.kategori))];
  $("#cats").innerHTML = cats
    .map((k) => `<button type="button" class="${S.cat === k ? "on" : ""}" data-k="${k}">${k}</button>`)
    .join("");
  $$("#cats button").forEach((btn) => {
    btn.onclick = () => {
      S.cat = btn.dataset.k;
      drawCats();
      drawItems();
    };
  });
}

function drawWadah() {
  $("#wadah").innerHTML = Object.entries(WADAH)
    .map(([k, n]) => `<button type="button" class="${S.wadah === k ? "on" : ""}" data-k="${k}">${n}</button>`)
    .join("");
  $$("#wadah button").forEach((btn) => {
    btn.onclick = () => {
      S.wadah = btn.dataset.k;
      drawWadah();
      drawStage();
    };
  });
}

function drawPita() {
  $("#pita").innerHTML = Object.entries(BUNGKUS)
    .map(
      ([k, n]) =>
        `<button type="button" class="${S.pita === k ? "on" : ""}" data-k="${k}"><span class="dotc pita ${k}"></span>${n}</button>`,
    )
    .join("");
  $$("#pita button").forEach((btn) => {
    btn.onclick = () => {
      S.pita = btn.dataset.k;
      drawPita();
      drawStage();
    };
  });
}

/* ---------- Render: kartu ucapan custom ---------- */
const kartuData = () => ({
  untuk: $("#kUntuk").value,
  pesan: $("#kartu").value,
  dari: $("#kDari").value,
  gaya: S.kgaya,
  tema: S.ktema,
});

function drawKartu() {
  const seg = (id, opts, cur, key) => {
    $(id).innerHTML = Object.entries(opts)
      .map(([k, n]) => `<button type="button" class="${k === cur ? "on" : ""}" data-k="${k}">${n}</button>`)
      .join("");
    $$(`${id} button`).forEach((b) => {
      b.onclick = () => {
        S[key] = b.dataset.k;
        drawKartu();
      };
    });
  };
  seg("#kGaya", KartuView.GAYA, S.kgaya, "kgaya");
  seg("#kTema", KartuView.TEMA, S.ktema, "ktema");
  $("#kartuPrev").innerHTML = KartuView.html(kartuData());
  $("#kCount").textContent = `${$("#kartu").value.length}/200`;
  drawStage();
}

/* ---------- Render: daftar barang ---------- */
function drawItems() {
  const u = used();
  const list = ITEMS.filter(
    (i) => (S.cat === "Semua" || i.kategori === S.cat) && i.nama.toLowerCase().includes(S.q),
  );

  $("#items").innerHTML =
    list
      .map((i) => {
        const on = S.pick.has(i.id);
        const locked = !on && (!S.paket || u + i.harga > S.paket);
        return `
          <button type="button" class="it ${on ? "on" : ""}" data-id="${i.id}" ${locked ? 'data-lock="1" aria-disabled="true"' : 'draggable="true"'}>
            ${pic(i)}
            ${esc(i.nama)}<br><small>${rp(i.harga)}</small>
          </button>`;
      })
      .join("") || '<p class="muted">Barang tidak ditemukan.</p>';

  $$(".it").forEach((btn) => {
    btn.onclick = () => toggleItem(+btn.dataset.id, btn);
    btn.ondragstart = (e) => e.dataTransfer.setData("text/plain", btn.dataset.id);
  });

  // Meter budget
  $("#bar").style.width = S.paket ? (u / S.paket) * 100 + "%" : "0";
  $("#bar").classList.toggle("full", isFull());
  $("#meterTxt").textContent = S.paket
    ? `Terpakai ${rp(u)} dari ${rp(S.paket)} · sisa ${rp(S.paket - u)} · ${S.pick.size} barang`
    : "Pilih paket dulu.";
}

/** Centang / batal centang barang, dengan animasi barang terbang ke wadah. */
function toggleItem(id, btn) {
  if (btn && btn.dataset.lock) {
    btn.classList.remove("shake");
    void btn.offsetWidth;
    btn.classList.add("shake");
    return toast(S.paket ? "Budget paket tidak cukup untuk barang ini." : "Pilih paket dulu ya.");
  }
  if (navigator.vibrate) navigator.vibrate(12);
  if (S.pick.has(id)) {
    S.pick.delete(id);
  } else {
    flyTo($(".pic", btn), flyTarget());
    S.pick.add(id);
  }
  draw();
}

/** Tujuan animasi: panel wadah (desktop) atau tombol bar bawah (HP). */
function flyTarget() {
  const mobile = matchMedia("(max-width: 960px)").matches;
  if (!mobile) return $("#stage");
  const peek = $("#peek");
  peek.classList.remove("bump");
  void peek.offsetWidth; // restart animasi
  peek.classList.add("bump");
  return peek;
}

/* ---------- Render: wadah live + ringkasan ---------- */
function drawStage() {
  const full = isFull();
  const text = full
    ? "Parcelmu sudah jadi! Cek hasilnya di atas 🎉"
    : S.pick.size
      ? `${S.pick.size} barang di dalam wadah · sisa ${rp(S.paket - used())}`
      : S.paket
        ? "Wadah masih kosong"
        : "Pilih paket untuk mulai";

  const justDone = stage.update({
    wadah: S.wadah,
    items: picked(),
    pita: S.pita,
    kartu: $("#kartu").value,
    full,
    text,
  });

  if (justDone) {
    confetti();
    toast("Budget penuh. Parcelmu sudah dibungkus!");
  }
  wasFull = full;

  $("#examples").hidden = !full;
  $("#picked").innerHTML = picked()
    .map((i) => `<span class="chip">${i.ikon} ${esc(i.nama)}</span>`)
    .join("");
  $("#peekN").textContent = S.pick.size;
  $("#peekIcon").textContent = full ? "🎀" : "🎁";
}

/* ---------- Render: alamat tersimpan ---------- */
function drawAddresses() {
  const manual = S.addrId === null;
  const cards = ADDR.map(
    (a) => `
      <label class="ap">
        <input type="radio" name="addr" value="${a.id}" ${S.addrId === a.id ? "checked" : ""}>
        <b>${a.label === "Rumah" ? "🏠" : a.label === "Kantor" ? "🏢" : "📌"} ${esc(a.label)}${a.utama ? '<span class="tag">Utama</span>' : ""}</b>
        <small>${esc(a.penerima)} · ${esc(a.hp)}<br>${esc(a.alamat)}</small>
      </label>`,
  ).join("");
  $("#addrPick").innerHTML = `${cards}
    <label class="ap">
      <input type="radio" name="addr" value="" ${manual ? "checked" : ""}>
      <b>✏️ ${ADDR.length ? "Alamat lain" : "Tulis alamat"}</b><small>Ketik alamat baru untuk pesanan ini.</small>
    </label>`;
  $$("#addrPick input").forEach((r) => {
    r.onchange = () => {
      S.addrId = r.value ? +r.value : null;
      applyAddress();
    };
  });
  applyAddress(false);
}

/** Terapkan pilihan alamat: tampilkan form manual / ambil titik lokasi alamat tersimpan. */
function applyAddress(refresh = true) {
  const saved = ADDR.find((a) => a.id === S.addrId);
  $("#addrManual").hidden = !!saved;
  $("#gpsBox").hidden = !!saved || val("m") === "ambil";
  if (saved) {
    S.lat = saved.lat;
    S.lng = saved.lng;
  }
  drawSum();
  if (refresh) refreshQuote();
}

/* ---------- Render: metode pembayaran ---------- */
const payMethod = () => METHODS.find((m) => m.kode === S.bayar);
const isCash = () => payMethod()?.tipe === "cash";

function drawMethods() {
  if (!METHODS.length) {
    $("#pmList").innerHTML = '<p class="muted">Belum ada metode pembayaran aktif. Hubungi admin.</p>';
    return;
  }
  $("#pmList").innerHTML = METHODS.map(
    (m) => `
      <label class="pm">
        <input type="radio" name="pm" value="${m.kode}" ${S.bayar === m.kode ? "checked" : ""}>
        <span class="ik">${BAYAR_IKON[m.tipe] || "💳"}</span>
        <b>${esc(m.nama)}</b>
        <small>${esc(m.keterangan || TIPE_BAYAR[m.tipe])}</small>
      </label>`,
  ).join("");
  $$("#pmList input").forEach((r) => {
    r.onchange = () => {
      S.bayar = r.value;
      drawBayar();
      drawSum();
    };
  });
}

/** Pilihan waktu bayar: DP 50% / lunas. Tunai selalu dibayar saat parcel diterima. */
function drawBayar() {
  const cash = isCash();
  $("#waktuBox").hidden = cash || !S.bayar;
  const old = val("b");
  const options = [
    ["dp", "Bayar DP 50%", "Sisanya dilunasi sebelum selesai."],
    ["lunas", "Bayar lunas", "Langsung beres."],
  ];
  $("#bayar").innerHTML = options
    .map(
      ([v, t, s], i) => `
        <label>
          <input type="radio" name="b" value="${v}" ${old === v || (!old && !i) ? "checked" : ""}>
          <b>${t}</b><small>${s}</small>
        </label>`,
    )
    .join("");
  $$("#bayar input").forEach((x) => (x.onchange = drawSum));
}

/** Pembayaran yang akan dikirim ke server (tunai = cod). */
const payType = () => (isCash() ? "cod" : val("b"));

/** Rincian cara bayar sesuai metode yang dipilih. */
function payInfoHTML(total) {
  const m = payMethod();
  if (!m) return "Pilih metode pembayaran di atas.";
  const nominal = payType() === "dp" ? Math.ceil(total / 2) : total;
  const copy = (txt) => `<button type="button" class="btn ghost mini" data-copy="${esc(txt)}">Salin</button>`;
  if (m.tipe === "cash") {
    return "💵 Bayar tunai saat parcel diterima atau diambil di toko. Siapkan uang pas bila bisa.";
  }
  if (m.tipe === "qris") {
    return `🔳 Setelah memesan, scan QRIS dan bayar <b>${rp(nominal)}</b>, lalu unggah bukti di Pesanan Saya.
      ${m.qris_foto ? `<img class="qr" src="/uploads/${m.qris_foto}" alt="Kode QRIS">` : '<p class="qr-missing">Kode QRIS akan ditampilkan admin di struk pesananmu.</p>'}`;
  }
  return `${BAYAR_IKON[m.tipe]} Setelah memesan, kirim <b>${rp(nominal)}</b> ke:
    <div class="pi-row"><b>${esc(m.bank || m.nama)}</b> <span class="acc">${esc(m.no_rek || "-")}</span> ${m.no_rek ? copy(m.no_rek) : ""}</div>
    <small>a.n. ${esc(m.atas_nama || "-")}. Lalu unggah bukti di Pesanan Saya.</small>`;
}

function drawSum() {
  const qty = Math.max(1, +$("#qty").value || 1);
  const pay = payType();
  const method = val("m");
  const qt = S.quote || { subtotal: S.paket * qty, diskon: 0, ongkir: 0, total: S.paket * qty, km: null };

  let rows = `<div><span>Parcel ${S.paket ? rp(S.paket) : "-"} × ${qty}</span><span>${rp(qt.subtotal)}</span></div>`;

  if (method !== "ambil") {
    rows += `<div><span>Ongkir${qt.km ? ` (${qt.km} km)` : ""}</span><span class="${qt.ongkir ? "" : "free"}">${qt.ongkir ? rp(qt.ongkir) : "Gratis"}</span></div>`;
    if (qt.km == null && qt.ongkir)
      rows += "<small>Ongkir dasar. Bagikan lokasimu agar dihitung sesuai jarak.</small>";
    if (qt.ongkir && qt.gratis_min)
      rows += `<small>Belanja ${rp(qt.gratis_min)} atau lebih gratis ongkir.</small>`;
  }
  if (qt.diskon)
    rows += `<div><span>Voucher ${esc(qt.voucher)}</span><span class="free">−${rp(qt.diskon)}</span></div>`;
  if (pay === "dp")
    rows += `<div><span>DP 50% dibayar sekarang</span><span>${rp(Math.ceil(qt.total / 2))}</span></div>`;

  $("#sum").innerHTML = rows + `<div class="t"><span>Total</span><span>${rp(qt.total)}</span></div>`;
  $("#tot").textContent = rp(qt.total);

  $("#payinfo").innerHTML = payInfoHTML(qt.total);
  $$("[data-copy]").forEach((b) => {
    b.onclick = async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.copy);
        toast("Nomor disalin ✓");
      } catch (e) {
        toast("Salin manual: " + b.dataset.copy);
      }
    };
  });

  // Indikator langkah
  const ok = [
    S.paket > 0,
    S.pick.size > 0,
    !!$("#tgl").value,
    method === "ambil" || S.addrId !== null || $("#alamat").value.trim().length >= 8,
    !!S.bayar && !!pay && S.paket > 0 && S.pick.size > 0,
  ];
  $$("#flow li").forEach((li, i) => li.classList.toggle("done", ok[i]));
}

/** Minta estimasi harga (ongkir + voucher) ke server, lalu gambar ulang ringkasan. */
let quoteTimer;
function refreshQuote() {
  clearTimeout(quoteTimer);
  quoteTimer = setTimeout(async () => {
    if (!S.paket) {
      S.quote = null;
      return drawSum();
    }
    try {
      S.quote = await api("/quote", "POST", {
        paket: S.paket,
        qty: Math.max(1, +$("#qty").value || 1),
        metode: val("m"),
        lat: S.lat,
        lng: S.lng,
        voucher: S.voucher,
      });
      if (S.voucher) {
        $("#vmsg").textContent = S.quote.voucher_msg;
        $("#vmsg").style.color = S.quote.voucher_ok ? "var(--green-d)" : "var(--ink)";
      }
    } catch (e) {
      /* pakai hitungan lokal */
    }
    drawSum();
  }, 200);
}

function draw() {
  drawPaket();
  drawItems();
  drawStage();
  drawSum();
}

/* ---------- Jadwal: kuota per tanggal ---------- */
/** Tampilkan sisa kuota untuk tanggal terpilih. Kembalikan false bila jumlah parcel melebihi sisa. */
function drawTglInfo() {
  const box = $("#tglInfo");
  const day = $("#tgl").value;
  box.className = "";
  if (!day || !AV.kapasitas) {
    box.textContent = "";
    return true;
  }
  const sisa = AV.kapasitas - (AV.terpakai[day] || 0);
  const qty = Math.max(1, +$("#qty").value || 1);
  if (sisa <= 0) {
    box.textContent = "Tanggal ini sudah penuh. Pilih tanggal lain.";
    box.className = "warn";
    return false;
  }
  if (qty > sisa) {
    box.textContent = `Sisa kuota tanggal ini ${sisa} parcel, jumlahmu ${qty}. Kurangi atau pilih tanggal lain.`;
    box.className = "warn";
    return false;
  }
  box.textContent = `Kuota tersedia: ${sisa} parcel`;
  return true;
}

/* ---------- Template isi parcel ---------- */
const TEMPLATES = {
  dapur: ["Sembako", "Minuman"],
  manis: ["Kue", "Minuman"],
  bersih: ["Kebersihan", "Sembako"],
};

/** Isi parcel dari kategori tertentu (bergiliran antarkategori), lalu lengkapi dengan barang lain sampai budget penuh. */
function fillTemplate(name) {
  if (!S.paket) return toast("Pilih paket dulu.");
  if (name === "all") return autoFill();
  S.pick.clear();
  const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
  const cats = TEMPLATES[name].filter((c) => ITEMS.some((i) => i.kategori === c));
  const queues = cats.map((c) => shuffle(ITEMS.filter((i) => i.kategori === c)));
  const rest = shuffle(ITEMS.filter((i) => !cats.includes(i.kategori)));
  for (let added = true; added;) {
    added = false;
    for (const queue of [...queues, rest]) {
      const item = queue.find((x) => !S.pick.has(x.id) && used() + x.harga <= S.paket);
      if (item) {
        S.pick.add(item.id);
        added = true;
        if (queue === rest) break; // barang "lain" hanya pelengkap, bukan prioritas
      }
    }
  }
  draw();
  toast("Isi parcel disusun dari template. Silakan ubah sesukamu.");
}

/* ---------- Aksi ---------- */
function autoFill() {
  if (!S.paket) return toast("Pilih paket dulu.");
  S.pick.clear();

  // Ambil barang acak bergiliran per kategori supaya isinya bervariasi.
  const byCat = {};
  ITEMS.forEach((i) => (byCat[i.kategori] = byCat[i.kategori] || []).push(i));
  Object.values(byCat).forEach((arr) => arr.sort(() => Math.random() - 0.5));

  for (let added = true; added;) {
    added = false;
    for (const k in byCat) {
      const item = byCat[k].find((x) => !S.pick.has(x.id) && used() + x.harga <= S.paket);
      if (item) {
        S.pick.add(item.id);
        added = true;
      }
    }
  }
  draw();
  toast("Isi parcel disusun otomatis. Silakan ubah sesukamu.");
}

function getLocation() {
  if (!navigator.geolocation) return toast("Peramban tidak mendukung lokasi.");
  $("#gpsTxt").textContent = "Mencari lokasi…";
  navigator.geolocation.getCurrentPosition(
    (p) => {
      S.lat = p.coords.latitude;
      S.lng = p.coords.longitude;
      refreshQuote();
      $("#gpsTxt").innerHTML =
        `✓ Lokasi tersimpan. <a href="https://www.google.com/maps?q=${S.lat},${S.lng}" target="_blank" rel="noopener">Lihat di peta</a>`;
    },
    () => {
      $("#gpsTxt").textContent = "Lokasi tidak bisa diambil. Tulis alamat lengkap saja.";
    },
    { enableHighAccuracy: true, timeout: 10000 },
  );
}

async function submitOrder() {
  if (ME.role !== "user") return (location = "masuk.html?next=pesan.html");
  if (!S.paket) return toast("Pilih paket dulu.");
  if (!S.pick.size) return toast("Pilih minimal satu isi parcel.");
  if (!$("#tgl").value) return toast("Isi tanggal parcel dibutuhkan.");
  if (!drawTglInfo()) return toast("Kuota tanggal itu tidak cukup. Ganti tanggal atau kurangi jumlah.");
  if (!S.bayar) return toast("Pilih metode pembayaran.");
  if (val("m") !== "ambil" && S.addrId === null && $("#alamat").value.trim().length < 8)
    return toast("Isi alamat pengantaran dengan lengkap.");
  if (S.voucher && !(S.quote && S.quote.voucher_ok)) return toast("Voucher belum valid. Periksa kodenya.");

  const pickup = val("m");
  setSending(true);
  try {
    if (pickup !== "ambil" && S.addrId === null && $("#saveAddr").checked) {
      const a = await api("/addresses", "POST", {
        label: "Rumah",
        penerima: ME.nama,
        hp: ME.hp,
        alamat: $("#alamat").value,
        lat: S.lat,
        lng: S.lng,
      }).catch(() => null);
      if (a) S.addrId = a.id;
    }
    const r = await api("/orders", "POST", {
      paket: S.paket,
      qty: +$("#qty").value,
      items: [...S.pick],
      metode: pickup,
      pay_type: payType(),
      metode_bayar: S.bayar,
      address_id: pickup !== "ambil" ? S.addrId : null,
      alamat: $("#alamat").value,
      lat: pickup !== "ambil" ? S.lat : null,
      lng: pickup !== "ambil" ? S.lng : null,
      voucher: S.voucher,
      catatan: $("#catatan").value,
      tanggal_acara: $("#tgl").value,
      kartu: $("#kartu").value,
      kartu_untuk: $("#kUntuk").value,
      kartu_dari: $("#kDari").value,
      kartu_gaya: S.kgaya,
      kartu_tema: S.ktema,
      bungkus: S.pita,
      wadah: S.wadah,
    });
    $("#okStruk").href = `struk.html?id=${r.id}`;
    $("#okTxt").textContent = `Kode pesananmu ${r.kode}. Simpan kodenya ya.`;
    $("#ok").hidden = false;
    confetti();
  } catch (e) {
    toast(e.message);
    setSending(false);
  }
}

const setSending = (on) => ($("#kirim").disabled = $("#kirim2").disabled = on);

/** Pesan ulang: isi form dari pesanan sebelumnya (?ulang=ID). */
async function prefill(id) {
  const orders = await api("/orders").catch(() => []);
  const o = orders.find((x) => x.id === id);
  if (!o) return;
  S.paket = o.paket;
  if (METHODS.some((m) => m.kode === o.metode_bayar)) S.bayar = o.metode_bayar;
  S.pita = o.bungkus || "pink";
  S.wadah = o.wadah || "nampan";
  $("#qty").value = o.qty;
  $("#kartu").value = o.kartu || "";
  $("#kUntuk").value = o.kartu_untuk || "";
  $("#kDari").value = o.kartu_dari || "";
  S.kgaya = o.kartu_gaya || "elegan";
  S.ktema = o.kartu_tema || "krem";
  o.items.forEach((it) => {
    const found = ITEMS.find((x) => x.nama === it.nama);
    if (found) S.pick.add(found.id);
  });
  toast("Isi dari pesanan sebelumnya sudah dimasukkan.");
}

/* ---------- Bottom sheet panel Parcelmu (HP) ---------- */
function toggleSide(open) {
  $("#side").classList.toggle("open", open);
  $("#scrim").hidden = !open;
}

/* ---------- Drag & drop: seret barang ke wadah ---------- */
function bindDrop() {
  const zone = $("#stage");
  zone.ondragover = (e) => {
    e.preventDefault();
    zone.classList.add("drop");
  };
  zone.ondragleave = () => zone.classList.remove("drop");
  zone.ondrop = (e) => {
    e.preventDefault();
    zone.classList.remove("drop");
    const id = +e.dataTransfer.getData("text/plain");
    const btn = $(`.it[data-id="${id}"]`);
    if (!id || S.pick.has(id)) return;
    toggleItem(id, btn);
  };
}

/* ---------- Bagikan parcel (tautan & WhatsApp) ---------- */
function shareUrl() {
  const q = new URLSearchParams({
    paket: S.paket,
    wadah: S.wadah,
    pita: S.pita,
    items: [...S.pick].join(","),
  });
  [
    ["kartu", "#kartu"],
    ["untuk", "#kUntuk"],
    ["dari", "#kDari"],
  ].forEach(([k, id]) => {
    if ($(id).value.trim()) q.set(k, $(id).value.trim());
  });
  q.set("kgaya", S.kgaya);
  q.set("ktema", S.ktema);
  return `${location.origin}${location.pathname}?${q}`;
}

function shareText() {
  const names = picked()
    .map((i) => i.nama)
    .join(", ");
  return `Lihat susunan parcel ${rp(S.paket)} yang saya buat di Parcelku 🎁\nIsi: ${names}\n${shareUrl()}`;
}

$("#shCopy").onclick = async () => {
  if (!S.pick.size) return toast("Susun parcelnya dulu ya.");
  try {
    await navigator.clipboard.writeText(shareUrl());
    toast("Tautan parcel disalin 🔗");
  } catch (e) {
    prompt("Salin tautan ini:", shareUrl());
  }
};
$("#shWa").onclick = () => {
  if (!S.pick.size) return toast("Susun parcelnya dulu ya.");
  window.open("https://wa.me/?text=" + encodeURIComponent(shareText()), "_blank", "noopener");
};

/* ---------- Ide kartu ucapan sekali klik ---------- */
$$("#kartuIdea button").forEach((b) => {
  b.onclick = () => {
    $("#kartu").value = b.textContent;
    drawKartu();
  };
});

/* ---------- Event ---------- */
$$("#metode input").forEach((radio) => {
  radio.onchange = () => {
    const m = val("m");
    $("#alamatBox").hidden = m === "ambil";
    applyAddress(false);
    refreshQuote();
  };
});
$("#alamat").oninput = drawSum;
$("#tgl").oninput = () => {
  drawSum();
  drawTglInfo();
};
["#kartu", "#kUntuk", "#kDari"].forEach((id) => ($(id).oninput = drawKartu));
$("#qty").oninput = () => {
  drawSum();
  drawTglInfo();
  refreshQuote();
};
$("#vbtn").onclick = () => {
  S.voucher = $("#voucher").value.trim().toUpperCase();
  if (!S.voucher) $("#vmsg").textContent = "";
  refreshQuote();
};
$("#cari").oninput = (e) => {
  S.q = e.target.value.toLowerCase();
  drawItems();
};
$("#auto").onclick = autoFill;
$$("#tpls [data-t]").forEach((b) => (b.onclick = () => fillTemplate(b.dataset.t)));
$("#gps").onclick = getLocation;
$("#kirim").onclick = submitOrder;
$("#kirim2").onclick = submitOrder;
$("#peek").onclick = () => toggleSide(true);
$("#sideClose").onclick = $("#scrim").onclick = () => toggleSide(false);

/* ---------- Inisialisasi ---------- */
(async () => {
  ME = await initNav();
  ITEMS = await api("/items");
  METHODS = await api("/payment-methods").catch(() => []);
  if (ME.role === "user") {
    ADDR = await api("/addresses").catch(() => []);
    const utama = ADDR.find((a) => a.utama) || ADDR[0];
    S.addrId = utama ? utama.id : null;
  }
  S.bayar = METHODS.length ? METHODS[0].kode : null;
  stage = ParcelView.mount($("#stage"), {
    onRemove: (id) => {
      S.pick.delete(id);
      draw();
    },
  });
  bindDrop();

  // Tanggal: minimal hari ini, default 3 hari lagi
  AV = await api("/availability").catch(() => AV);
  const earliest = new Date();
  earliest.setDate(earliest.getDate() + (AV.min_hari || 0));
  const soon = new Date();
  soon.setDate(soon.getDate() + Math.max(3, AV.min_hari || 0));
  $("#tgl").min = earliest.toLocaleDateString("sv-SE");
  $("#tgl").value = soon.toLocaleDateString("sv-SE");
  drawTglInfo();

  // Parameter dari tautan (?paket=25000&wadah=bulat&ulang=12)
  const qs = new URLSearchParams(location.search);
  const p = +qs.get("paket");
  if (PAKET.some((x) => x[0] === p)) S.paket = p;
  if (WADAH[qs.get("wadah")]) S.wadah = qs.get("wadah");
  if (BUNGKUS[qs.get("pita")]) S.pita = qs.get("pita");
  if (qs.get("kartu")) $("#kartu").value = qs.get("kartu").slice(0, 200);
  if (qs.get("untuk")) $("#kUntuk").value = qs.get("untuk").slice(0, 40);
  if (qs.get("dari")) $("#kDari").value = qs.get("dari").slice(0, 40);
  if (KartuView.GAYA[qs.get("kgaya")]) S.kgaya = qs.get("kgaya");
  if (KartuView.TEMA[qs.get("ktema")]) S.ktema = qs.get("ktema");
  (qs.get("items") || "")
    .split(",")
    .map(Number)
    .forEach((id) => {
      const it = ITEMS.find((x) => x.id === id);
      if (it && S.paket && used() + it.harga <= S.paket) S.pick.add(id);
    });
  if (ME.role === "user" && qs.get("ulang")) await prefill(+qs.get("ulang"));

  if (ME.role !== "user") {
    $("#loginNote").innerHTML =
      'Kamu perlu <a href="masuk.html?next=pesan.html">masuk</a> sebelum mengirim pesanan.';
  }
  if (ME.role === "admin") setSending(true);

  drawCats();
  drawWadah();
  drawPita();
  drawKartu();
  draw();
  drawAddresses();
  drawMethods();
  drawBayar();
  drawSum();
  refreshQuote();
})();
