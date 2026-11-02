"""Metode pembayaran (QRIS, transfer bank, tunai, e-wallet). Pelanggan memilih, admin mengelola."""
import re
from flask import Blueprint, request, jsonify
from .db import q, run
from .utils import err, is_admin, admin_only, save_image, delete_image

bp = Blueprint("payments", __name__, url_prefix="/api")
TIPE = ("qris", "transfer", "cash", "ewallet")
FIELDS = "id,kode,nama,tipe,keterangan,bank,no_rek,atas_nama,qris_foto,aktif,urut"


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:30] or "metode"


def clean(j):
    nama = (j.get("nama") or "").strip()[:60]
    if len(nama) < 2:
        return None, "Isi nama metode pembayaran."
    if j.get("tipe") not in TIPE:
        return None, "Pilih jenis metode: QRIS, transfer, tunai, atau e-wallet."
    text = lambda k, n: (j.get(k) or "").strip()[:n]
    return dict(nama=nama, tipe=j["tipe"], keterangan=text("keterangan", 200), bank=text("bank", 60),
                no_rek=text("no_rek", 40), atas_nama=text("atas_nama", 80),
                aktif=0 if j.get("aktif") in (0, False) else 1, urut=int(j.get("urut") or 0)), None


@bp.get("/payment-methods")
def list_methods():
    # Admin melihat semua (termasuk nonaktif); pelanggan hanya yang aktif.
    where = "" if (is_admin() and request.args.get("semua")) else "WHERE aktif=1"
    rows = q(f"SELECT {FIELDS} FROM payment_methods {where} ORDER BY urut, id")
    return jsonify([dict(r) for r in rows])


@bp.post("/payment-methods")
@admin_only
def add_method():
    data, msg = clean(request.json or {})
    if msg:
        return err(msg)
    kode, n = slug(data["nama"]), 2
    while q("SELECT 1 FROM payment_methods WHERE kode=?", (kode,), True):
        kode, n = f"{slug(data['nama'])}-{n}", n + 1
    mid = run("INSERT INTO payment_methods(kode,nama,tipe,keterangan,bank,no_rek,atas_nama,aktif,urut) VALUES(?,?,?,?,?,?,?,?,?)",
              (kode, data["nama"], data["tipe"], data["keterangan"], data["bank"], data["no_rek"], data["atas_nama"], data["aktif"], data["urut"]))
    return jsonify(ok=True, id=mid, kode=kode)


@bp.patch("/payment-methods/<int:mid>")
@admin_only
def edit_method(mid):
    if not q("SELECT 1 FROM payment_methods WHERE id=?", (mid,), True):
        return err("Metode tidak ditemukan.", 404)
    data, msg = clean(request.json or {})
    if msg:
        return err(msg)
    q("UPDATE payment_methods SET nama=?,tipe=?,keterangan=?,bank=?,no_rek=?,atas_nama=?,aktif=?,urut=? WHERE id=?",
      (data["nama"], data["tipe"], data["keterangan"], data["bank"], data["no_rek"], data["atas_nama"], data["aktif"], data["urut"], mid))
    return jsonify(ok=True)


@bp.post("/payment-methods/<int:mid>/qris")
@admin_only
def upload_qris(mid):
    row = q("SELECT qris_foto FROM payment_methods WHERE id=?", (mid,), True)
    if not row:
        return err("Metode tidak ditemukan.", 404)
    name = save_image(request.files.get("file"))
    if not name:
        return err("Gambar harus JPG, PNG, atau WEBP maksimal 6 MB.")
    delete_image(row["qris_foto"])
    q("UPDATE payment_methods SET qris_foto=? WHERE id=?", (name, mid))
    return jsonify(ok=True, foto=name)


@bp.delete("/payment-methods/<int:mid>")
@admin_only
def delete_method(mid):
    row = q("SELECT kode,qris_foto FROM payment_methods WHERE id=?", (mid,), True)
    if not row:
        return err("Metode tidak ditemukan.", 404)
    if q("SELECT 1 FROM orders WHERE metode_bayar=? LIMIT 1", (row["kode"],), True):
        q("UPDATE payment_methods SET aktif=0 WHERE id=?", (mid,))  # sudah dipakai pesanan: cukup dinonaktifkan
        return jsonify(ok=True, nonaktif=True)
    delete_image(row["qris_foto"])
    q("DELETE FROM payment_methods WHERE id=?", (mid,))
    return jsonify(ok=True)
