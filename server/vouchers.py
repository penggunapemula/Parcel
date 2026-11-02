"""Rute voucher: kelola (admin) dan cek (publik lewat /api/quote)."""
from datetime import date
from flask import Blueprint, request, jsonify
from . import config
from .db import q, run
from .pricing import quote
from .utils import err, admin_only

bp = Blueprint("vouchers", __name__, url_prefix="/api")
TIPE = ("persen", "nominal", "ongkir")


@bp.post("/quote")
def quote_post():
    """Estimasi harga untuk form pesan (subtotal, ongkir, diskon, total)."""
    j = request.json or {}
    paket, qty = j.get("paket"), j.get("qty")
    if paket not in config.PAKET or not isinstance(qty, int) or not 1 <= qty <= 1000:
        return err("Data tidak valid.")
    return jsonify(quote(paket, qty, j.get("metode") or "ambil", j.get("lat"), j.get("lng"), j.get("voucher")))


@bp.get("/vouchers")
@admin_only
def voucher_list():
    return jsonify([dict(r) for r in q("SELECT * FROM vouchers ORDER BY id DESC")])


@bp.post("/vouchers")
@admin_only
def voucher_add():
    j = request.json or {}
    kode = "".join(c for c in (j.get("kode") or "").upper() if c.isalnum())[:20]
    tipe = j.get("tipe")
    try:
        nilai, minb, maks, kuota = (int(j.get(k) or 0) for k in ("nilai", "min_belanja", "maks_diskon", "kuota"))
    except (TypeError, ValueError):
        return err("Nilai voucher harus berupa angka.")
    sampai = j.get("sampai") or None
    if sampai:
        try:
            date.fromisoformat(sampai)
        except ValueError:
            return err("Tanggal berlaku tidak valid.")
    if len(kode) < 3 or tipe not in TIPE:
        return err("Isi kode (min. 3 huruf/angka) dan pilih jenis voucher.")
    if tipe == "persen" and not 1 <= nilai <= 100:
        return err("Persen harus 1 sampai 100.")
    if tipe == "nominal" and nilai < 500:
        return err("Potongan minimal Rp500.")
    if q("SELECT 1 FROM vouchers WHERE kode=?", (kode,), True):
        return err("Kode voucher sudah ada.")
    run("INSERT INTO vouchers(kode,tipe,nilai,min_belanja,maks_diskon,kuota,sampai) VALUES(?,?,?,?,?,?,?)",
        (kode, tipe, nilai, minb, maks, kuota, sampai))
    return jsonify(ok=True)


@bp.patch("/vouchers/<int:vid>")
@admin_only
def voucher_toggle(vid):
    q("UPDATE vouchers SET aktif=? WHERE id=?", (1 if (request.json or {}).get("aktif") else 0, vid))
    return jsonify(ok=True)


@bp.delete("/vouchers/<int:vid>")
@admin_only
def voucher_delete(vid):
    q("DELETE FROM vouchers WHERE id=?", (vid,))
    return jsonify(ok=True)
