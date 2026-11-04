"""Desainku: pelanggan menyimpan susunan parcel favoritnya (isi, wadah, pita, kartu) untuk dipakai lagi."""
import json
from flask import Blueprint, request, session, jsonify
from . import config
from .db import q, run
from .utils import err, user_only

bp = Blueprint("designs", __name__, url_prefix="/api")
MAKS_DESAIN = 20


def resolve(row):
    """Ubah baris database menjadi data siap tampil: daftar id diganti rincian barang yang masih aktif."""
    ids = json.loads(row["items"] or "[]")
    marks = ",".join("?" * len(ids)) or "NULL"
    found = {r["id"]: dict(r) for r in q(f"SELECT id,nama,ikon,foto,harga FROM items WHERE aktif=1 AND id IN ({marks})", ids)}
    data = {k: row[k] for k in ("id", "nama", "paket", "wadah", "bungkus", "kartu", "kartu_untuk", "kartu_dari", "kartu_gaya", "kartu_tema", "created")}
    data["ids"] = [i for i in ids if i in found]  # barang yang sudah dihapus admin otomatis hilang dari desain
    data["isi"] = [found[i] for i in data["ids"]]
    data["hilang"] = len(ids) - len(data["ids"])
    return data


@bp.get("/designs")
@user_only
def list_designs():
    rows = q("SELECT * FROM saved_designs WHERE user_id=? ORDER BY id DESC", (session["uid"],))
    return jsonify([resolve(r) for r in rows])


@bp.post("/designs")
@user_only
def save_design():
    j = request.json or {}
    nama = (j.get("nama") or "").strip()[:60]
    if len(nama) < 2:
        return err("Beri nama desainmu, contoh: Parcel pernikahan.")
    if j.get("paket") not in config.PAKET:
        return err("Paket tidak valid.")
    try:
        ids = [int(i) for i in (j.get("items") or [])][:40]
    except (TypeError, ValueError):
        return err("Isi parcel tidak valid.")
    if not ids:
        return err("Pilih minimal satu barang sebelum menyimpan desain.")
    if q("SELECT COUNT(*) n FROM saved_designs WHERE user_id=?", (session["uid"],), True)["n"] >= MAKS_DESAIN:
        return err(f"Maksimal {MAKS_DESAIN} desain. Hapus yang tidak dipakai dulu.")
    pick = lambda key, allowed, default: j.get(key) if j.get(key) in allowed else default
    did = run("""INSERT INTO saved_designs(user_id,nama,paket,items,wadah,bungkus,kartu,kartu_untuk,kartu_dari,kartu_gaya,kartu_tema)
                 VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
              (session["uid"], nama, j["paket"], json.dumps(ids), pick("wadah", config.WADAH, "nampan"),
               pick("bungkus", config.BUNGKUS, "pink"), (j.get("kartu") or "")[:200], (j.get("kartu_untuk") or "")[:40],
               (j.get("kartu_dari") or "")[:40], pick("kartu_gaya", config.KARTU_GAYA, "elegan"),
               pick("kartu_tema", config.KARTU_TEMA, "krem")))
    return jsonify(ok=True, id=did)


@bp.delete("/designs/<int:did>")
@user_only
def delete_design(did):
    if not q("SELECT 1 FROM saved_designs WHERE id=? AND user_id=?", (did, session["uid"]), True):
        return err("Desain tidak ditemukan.", 404)
    q("DELETE FROM saved_designs WHERE id=?", (did,))
    return jsonify(ok=True)
