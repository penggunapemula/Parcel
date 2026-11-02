"""Alamat pengiriman milik pelanggan: boleh lebih dari satu, satu di antaranya menjadi alamat utama."""
from flask import Blueprint, request, session, jsonify
from .auth import norm_hp
from .db import q, run
from .utils import err, user_only

bp = Blueprint("addresses", __name__, url_prefix="/api")
MAKS_ALAMAT = 10
FIELDS = "id,label,penerima,hp,alamat,catatan,lat,lng,utama"


def clean(j):
    """Rapikan & validasi isian alamat. Kembalikan (data, pesan_error)."""
    num = lambda v: float(v) if v not in (None, "") else None
    try:
        lat, lng = num(j.get("lat")), num(j.get("lng"))
    except (TypeError, ValueError):
        return None, "Koordinat lokasi tidak valid."
    data = dict(
        label=(j.get("label") or "Rumah").strip()[:40] or "Rumah",
        penerima=(j.get("penerima") or "").strip()[:80],
        hp=norm_hp(j.get("hp")),
        alamat=(j.get("alamat") or "").strip()[:300],
        catatan=(j.get("catatan") or "").strip()[:120],
        lat=lat, lng=lng, utama=1 if j.get("utama") else 0,
    )
    if len(data["penerima"]) < 2:
        return None, "Isi nama penerima."
    if not 10 <= len(data["hp"]) <= 15:
        return None, "Nomor telepon penerima belum benar."
    if len(data["alamat"]) < 8:
        return None, "Alamat terlalu pendek. Tulis jalan, nomor, RT/RW, dan kecamatan."
    return data, None


def own(aid):
    return q("SELECT * FROM addresses WHERE id=? AND user_id=?", (aid, session["uid"]), True)


def set_utama(aid):
    q("UPDATE addresses SET utama=0 WHERE user_id=?", (session["uid"],))
    q("UPDATE addresses SET utama=1 WHERE id=?", (aid,))


@bp.get("/addresses")
@user_only
def list_addresses():
    rows = q(f"SELECT {FIELDS} FROM addresses WHERE user_id=? ORDER BY utama DESC, id", (session["uid"],))
    return jsonify([dict(r) for r in rows])


@bp.post("/addresses")
@user_only
def add_address():
    data, msg = clean(request.json or {})
    if msg:
        return err(msg)
    total = q("SELECT COUNT(*) n FROM addresses WHERE user_id=?", (session["uid"],), True)["n"]
    if total >= MAKS_ALAMAT:
        return err(f"Maksimal {MAKS_ALAMAT} alamat. Hapus yang tidak dipakai dulu.")
    aid = run("INSERT INTO addresses(user_id,label,penerima,hp,alamat,catatan,lat,lng,utama) VALUES(?,?,?,?,?,?,?,?,0)",
              (session["uid"], data["label"], data["penerima"], data["hp"], data["alamat"], data["catatan"], data["lat"], data["lng"]))
    if data["utama"] or total == 0:  # alamat pertama otomatis menjadi utama
        set_utama(aid)
    return jsonify(ok=True, id=aid)


@bp.put("/addresses/<int:aid>")
@user_only
def edit_address(aid):
    if not own(aid):
        return err("Alamat tidak ditemukan.", 404)
    data, msg = clean(request.json or {})
    if msg:
        return err(msg)
    q("UPDATE addresses SET label=?,penerima=?,hp=?,alamat=?,catatan=?,lat=?,lng=? WHERE id=?",
      (data["label"], data["penerima"], data["hp"], data["alamat"], data["catatan"], data["lat"], data["lng"], aid))
    if data["utama"]:
        set_utama(aid)
    return jsonify(ok=True)


@bp.post("/addresses/<int:aid>/utama")
@user_only
def make_default(aid):
    if not own(aid):
        return err("Alamat tidak ditemukan.", 404)
    set_utama(aid)
    return jsonify(ok=True)


@bp.delete("/addresses/<int:aid>")
@user_only
def delete_address(aid):
    row = own(aid)
    if not row:
        return err("Alamat tidak ditemukan.", 404)
    q("DELETE FROM addresses WHERE id=?", (aid,))
    if row["utama"]:  # alamat utama dihapus: jadikan alamat tertua yang tersisa sebagai utama
        nxt = q("SELECT id FROM addresses WHERE user_id=? ORDER BY id LIMIT 1", (session["uid"],), True)
        if nxt:
            set_utama(nxt["id"])
    return jsonify(ok=True)
