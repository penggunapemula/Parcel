"""Rute katalog barang, galeri foto parcel, dan pengaturan toko."""
from flask import Blueprint, request, jsonify
from . import config
from .db import q, run
from .utils import err, admin_only, is_admin, save_image, delete_image

bp = Blueprint("catalog", __name__, url_prefix="/api")


# ---------- Pengaturan toko ----------
@bp.get("/settings")
def settings_get():
    return jsonify({r["key"]: r["value"] for r in q("SELECT `key`,value FROM settings")})


@bp.put("/settings")
@admin_only
def settings_put():
    for key, value in (request.json or {}).items():
        if key in config.DEFAULT_SETTINGS:
            q("INSERT OR REPLACE INTO settings(`key`,value) VALUES(?,?)", (key, str(value).strip()[:120]))
    return jsonify(ok=True)


# ---------- Barang ----------
@bp.get("/items")
def items_list():
    show_all = is_admin() and request.args.get("all")
    sql = "SELECT * FROM items ORDER BY id" if show_all else "SELECT * FROM items WHERE aktif=1 ORDER BY id"
    return jsonify([dict(r) for r in q(sql)])


@bp.post("/items")
@admin_only
def item_add():
    j = request.json or {}
    nama = (j.get("nama") or "").strip()
    try:
        harga = int(j.get("harga"))
    except (TypeError, ValueError):
        return err("Harga harus berupa angka.")
    if len(nama) < 2 or not 500 <= harga <= 35000:
        return err("Isi nama dan harga (Rp500 - Rp35.000).")
    run("INSERT INTO items(nama,ikon,kategori,harga) VALUES(?,?,?,?)",
        (nama[:50], (j.get("ikon") or "📦")[:4], (j.get("kategori") or "Lainnya").strip()[:30], harga))
    return jsonify(ok=True)


@bp.patch("/items/<int:iid>")
@admin_only
def item_edit(iid):
    j = request.json or {}
    if "harga" in j:
        try:
            harga = int(j["harga"])
        except (TypeError, ValueError):
            return err("Harga harus berupa angka.")
        if not 500 <= harga <= 35000:
            return err("Harga di luar batas (Rp500 - Rp35.000).")
        q("UPDATE items SET harga=? WHERE id=?", (harga, iid))
    if "aktif" in j:
        q("UPDATE items SET aktif=? WHERE id=?", (1 if j["aktif"] else 0, iid))
    return jsonify(ok=True)


@bp.post("/items/<int:iid>/foto")
@admin_only
def item_foto(iid):
    item = q("SELECT foto FROM items WHERE id=?", (iid,), True)
    if not item:
        return err("Barang tidak ditemukan.", 404)
    name = save_image(request.files.get("file"))
    if not name:
        return err("Foto harus JPG, PNG, atau WEBP maksimal 6 MB.")
    delete_image(item["foto"])
    q("UPDATE items SET foto=? WHERE id=?", (name, iid))
    return jsonify(ok=True, foto=name)


@bp.delete("/items/<int:iid>/foto")
@admin_only
def item_foto_hapus(iid):
    item = q("SELECT foto FROM items WHERE id=?", (iid,), True)
    if item:
        delete_image(item["foto"])
        q("UPDATE items SET foto=NULL WHERE id=?", (iid,))
    return jsonify(ok=True)


# ---------- Galeri ----------
@bp.get("/gallery")
def gallery_list():
    return jsonify([dict(r) for r in q("SELECT id,foto,caption FROM gallery ORDER BY id DESC LIMIT 24")])


@bp.post("/gallery")
@admin_only
def gallery_add():
    name = save_image(request.files.get("file"))
    if not name:
        return err("Foto harus JPG, PNG, atau WEBP maksimal 6 MB.")
    run("INSERT INTO gallery(foto,caption) VALUES(?,?)", (name, (request.form.get("caption") or "").strip()[:80]))
    return jsonify(ok=True)


@bp.delete("/gallery/<int:gid>")
@admin_only
def gallery_delete(gid):
    row = q("SELECT foto FROM gallery WHERE id=?", (gid,), True)
    if row:
        delete_image(row["foto"])
        q("DELETE FROM gallery WHERE id=?", (gid,))
    return jsonify(ok=True)
