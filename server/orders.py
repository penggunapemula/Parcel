"""Rute pesanan: buat, daftar, update, chat, bukti bayar, ulasan, dan ekspor CSV."""
import csv, io, json
from datetime import date
from flask import Blueprint, request, session, jsonify, Response
from . import config
from .db import db, q, run
from .pricing import quote
from .utils import err, rupiah, is_admin, admin_only, user_only, notify, save_image

bp = Blueprint("orders", __name__, url_prefix="/api")

ORDER_SQL = """SELECT o.*, u.nama, u.hp, u.email,
  (SELECT COUNT(*) FROM chat c WHERE c.order_id=o.id AND c.sender NOT IN (?, 'sys') AND c.dibaca=0) AS unread,
  (SELECT rating FROM reviews r WHERE r.order_id=o.id) AS rating,
  (SELECT nama FROM payment_methods pm WHERE pm.kode=o.metode_bayar) AS bayar_nama,
  (SELECT tipe FROM payment_methods pm WHERE pm.kode=o.metode_bayar) AS bayar_tipe
  FROM orders o JOIN users u ON u.id=o.user_id"""


def viewer():
    return "admin" if is_admin() else "user"


def order_dict(row):
    data = dict(row)
    data["items"] = json.loads(data["items"])
    return data


def get_order(oid):
    """Ambil pesanan bila admin atau pemiliknya; selain itu None."""
    row = q(ORDER_SQL + " WHERE o.id=?", (viewer(), oid), True)
    if row and (is_admin() or (session.get("role") == "user" and row["user_id"] == session.get("uid"))):
        return row
    return None


def validate_order(j):
    """Kembalikan (data, rows, pesan_error)."""
    paket, qty, metode, pay = j.get("paket"), j.get("qty"), j.get("metode"), j.get("pay_type")
    ids = j.get("items") or []
    if paket not in config.PAKET:
        return None, None, "Paket tidak valid."
    if not isinstance(qty, int) or not 1 <= qty <= 1000:
        return None, None, "Jumlah parcel tidak valid."
    if metode not in config.FLOW:
        return None, None, "Pilih metode pengambilan."
    bayar = q("SELECT kode,tipe FROM payment_methods WHERE kode=? AND aktif=1", (j.get("metode_bayar"),), True)
    if not bayar:
        return None, None, "Pilih metode pembayaran."
    # Tunai dibayar saat parcel diterima / diambil (cod); metode lain dibayar di muka (dp / lunas).
    if pay not in ("dp", "lunas", "cod") or (pay == "cod") != (bayar["tipe"] == "cash"):
        return None, None, "Pilihan pembayaran tidak sesuai dengan metode yang dipilih."
    try:
        tgl = date.fromisoformat(j.get("tanggal_acara") or "")
    except ValueError:
        return None, None, "Isi tanggal acara atau tanggal parcel dibutuhkan."
    if tgl < date.today():
        return None, None, "Tanggal acara tidak boleh sudah lewat."
    marks = ",".join("?" * len(ids)) or "NULL"
    rows = [dict(r) for r in q(f"SELECT * FROM items WHERE aktif=1 AND id IN ({marks})", ids)]
    if not rows or len(rows) != len(set(ids)):
        return None, None, "Pilih minimal satu isi parcel."
    if sum(r["harga"] for r in rows) > paket:
        return None, None, "Isi parcel melebihi nilai paket."
    alamat, lat, lng, address_id = (j.get("alamat") or "").strip(), j.get("lat"), j.get("lng"), None
    if j.get("address_id") and session.get("uid"):  # alamat tersimpan milik pelanggan
        saved = q("SELECT * FROM addresses WHERE id=? AND user_id=?", (j["address_id"], session["uid"]), True)
        if not saved:
            return None, None, "Alamat yang dipilih tidak ditemukan."
        address_id = saved["id"]
        alamat = f"{saved['penerima']} ({saved['hp']})\n{saved['alamat']}" + (f"\n({saved['catatan']})" if saved["catatan"] else "")
        lat, lng = saved["lat"], saved["lng"]
    if metode in ("antar", "cod") and len(alamat) < 8:
        return None, None, "Alamat pengantaran wajib diisi lengkap."
    bungkus = j.get("bungkus") if j.get("bungkus") in config.BUNGKUS else "pink"
    wadah = j.get("wadah") if j.get("wadah") in config.WADAH else "nampan"
    data = dict(paket=paket, qty=qty, metode=metode, pay=pay, tanggal=tgl.isoformat(), alamat=alamat, bungkus=bungkus, wadah=wadah,
                kartu=(j.get("kartu") or "").strip()[:200],
                kartu_untuk=(j.get("kartu_untuk") or "").strip()[:40], kartu_dari=(j.get("kartu_dari") or "").strip()[:40],
                kartu_gaya=j.get("kartu_gaya") if j.get("kartu_gaya") in config.KARTU_GAYA else "elegan",
                kartu_tema=j.get("kartu_tema") if j.get("kartu_tema") in config.KARTU_TEMA else "krem", catatan=(j.get("catatan") or "").strip()[:300],
                lat=lat, lng=lng, address_id=address_id, metode_bayar=bayar["kode"], voucher=(j.get("voucher") or "").strip().upper())
    return data, rows, None


@bp.post("/orders")
@user_only
def create_order():
    d, rows, msg = validate_order(request.json or {})
    if msg:
        return err(msg)
    snap = json.dumps([{"nama": r["nama"], "ikon": r["ikon"], "foto": r["foto"]} for r in rows])
    hit = quote(d["paket"], d["qty"], d["metode"], d["lat"], d["lng"], d["voucher"])
    if d["voucher"] and not hit["voucher_ok"]:
        return err(hit["voucher_msg"])
    total = hit["total"]
    oid = run("""INSERT INTO orders(user_id,paket,qty,items,total,pay_type,metode,alamat,lat,lng,catatan,tanggal_acara,kartu,bungkus,
                 subtotal,diskon,ongkir,voucher,wadah,kartu_untuk,kartu_dari,kartu_gaya,kartu_tema,address_id,metode_bayar)
                 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
              (session["uid"], d["paket"], d["qty"], snap, total, d["pay"], d["metode"], d["alamat"], d["lat"], d["lng"],
               d["catatan"], d["tanggal"], d["kartu"], d["bungkus"], hit["subtotal"], hit["diskon"], hit["ongkir"], hit["voucher"], d["wadah"],
               d["kartu_untuk"], d["kartu_dari"], d["kartu_gaya"], d["kartu_tema"], d["address_id"], d["metode_bayar"]))
    kode = f"PK{oid:04d}"
    q("UPDATE orders SET kode=? WHERE id=?", (kode, oid))
    for r in rows:  # rincian isi parcel (tabel order_items)
        run("INSERT INTO order_items(order_id,item_id,nama,ikon,foto,harga) VALUES(?,?,?,?,?,?)",
            (oid, r["id"], r["nama"], r["ikon"], r["foto"], r["harga"]))
    if hit["voucher"]:
        q("UPDATE vouchers SET dipakai=dipakai+1 WHERE kode=?", (hit["voucher"],))
    if d["metode"] == "cod":
        run("INSERT INTO chat(order_id,sender,text) VALUES(?,?,?)",
            (oid, "sys", "Pesanan COD diterima. Admin akan mengonfirmasi lokasi dan waktu antar lewat chat ini."))
    user = q("SELECT * FROM users WHERE id=?", (session["uid"],), True)
    maps = f"\n📍 https://www.google.com/maps?q={d['lat']},{d['lng']}" if d["lat"] else ""
    extra = f"\nOngkir {rupiah(hit['ongkir'])}" + (f" | Voucher {hit['voucher']} -{rupiah(hit['diskon'])}" if hit["voucher"] else "")
    kartu_info = ""
    if d["kartu"] or d["kartu_untuk"]:
        kartu_info = f"\n💌 Kartu ({d['kartu_gaya']}/{d['kartu_tema']}): untuk {d['kartu_untuk'] or '-'} | \"{d['kartu']}\" | dari {d['kartu_dari'] or '-'}"
    notify(f"🎁 PESANAN BARU {kode}\n{user['nama']} ({user['hp']}) {user['email'] or ''}\nParcel {rupiah(d['paket'])} x {d['qty']} = {rupiah(hit['subtotal'])}{extra}\n"
           f"TOTAL {rupiah(total)}\nIsi: {', '.join(r['nama'] for r in rows)}\nButuh tanggal: {d['tanggal']}  |  Pita: {d['bungkus']}  |  Wadah: {d['wadah']}{kartu_info}\n"
           f"Ambil: {d['metode'].upper()}  |  Bayar: {d['pay'].upper()} via {d['metode_bayar']}\n{d['alamat']}{maps}\n\nBuka admin: {request.host_url}admin.html")
    return jsonify(ok=True, id=oid, kode=kode)


@bp.get("/orders")
def list_orders():
    role = session.get("role")
    if not role:
        return err("Belum masuk.", 401)
    if role == "admin":
        rows = q(ORDER_SQL + " ORDER BY o.id DESC", ("admin",))
    else:
        rows = q(ORDER_SQL + " WHERE o.user_id=? ORDER BY o.id DESC", ("user", session["uid"]))
    return jsonify([order_dict(r) for r in rows])


@bp.get("/orders/<int:oid>")
def order_detail(oid):
    """Detail satu pesanan untuk struk: rincian isi, riwayat bayar, dan linimasa status."""
    row = get_order(oid)
    if not row:
        return err("Pesanan tidak ditemukan.", 404)
    data = order_dict(row)
    data["isi"] = [dict(r) for r in q("SELECT nama,ikon,foto,harga FROM order_items WHERE order_id=? ORDER BY id", (oid,))]
    data["pembayaran"] = [dict(r) for r in q("SELECT jumlah,created,oleh FROM payments WHERE order_id=? ORDER BY id", (oid,))]
    data["bayar"] = q("SELECT kode,nama,tipe,keterangan,bank,no_rek,atas_nama,qris_foto FROM payment_methods WHERE kode=?", (data.get("metode_bayar"),), True)
    data["bayar"] = dict(data["bayar"]) if data["bayar"] else None
    data["linimasa"] = [dict(r) for r in q("SELECT status,created FROM status_log WHERE order_id=? ORDER BY id", (oid,))]
    return jsonify(data)


@bp.patch("/orders/<int:oid>")
@admin_only
def update_order(oid):
    order, j = get_order(oid), request.json or {}
    if not order:
        return err("Pesanan tidak ditemukan.", 404)
    if "status" in j:
        if j["status"] not in config.FLOW[order["metode"]]:
            return err("Status tidak sesuai metode pengambilan.")
        q("UPDATE orders SET status=? WHERE id=?", (j["status"], oid))
    if "paid" in j:
        paid = int(j["paid"])
        if not 0 <= paid <= order["total"]:
            return err("Nominal pembayaran tidak valid.")
        q("UPDATE orders SET paid=? WHERE id=?", (paid, oid))
    return jsonify(ok=True)


# ---------- Chat ----------
@bp.get("/orders/<int:oid>/chat")
def chat_get(oid):
    if not get_order(oid):
        return err("Tidak ada akses.", 403)
    rows = q("SELECT id,sender,text,created FROM chat WHERE order_id=? AND id>? ORDER BY id", (oid, request.args.get("after", 0, int)))
    q("UPDATE chat SET dibaca=1 WHERE order_id=? AND sender NOT IN (?, 'sys')", (oid, viewer()))
    return jsonify([{**dict(r), "time": r["created"][11:16]} for r in rows])


@bp.post("/orders/<int:oid>/chat")
def chat_post(oid):
    order, text = get_order(oid), ((request.json or {}).get("text") or "").strip()[:500]
    if not order:
        return err("Tidak ada akses.", 403)
    if not text:
        return err("Pesan kosong.")
    sender = viewer()
    run("INSERT INTO chat(order_id,sender,text) VALUES(?,?,?)", (oid, sender, text))
    if sender == "user":
        notify(f"💬 Chat baru dari {order['nama']} ({order['kode']}):\n{text}\n\n{request.host_url}admin.html")
    return jsonify(ok=True)


# ---------- Bukti bayar & ulasan ----------
@bp.post("/orders/<int:oid>/bukti")
@user_only
def upload_bukti(oid):
    order = get_order(oid)
    if not order:
        return err("Pesanan tidak ditemukan.", 404)
    name = save_image(request.files.get("file"))
    if not name:
        return err("Bukti harus berupa foto JPG, PNG, atau WEBP maksimal 6 MB.")
    q("UPDATE orders SET bukti=? WHERE id=?", (name, oid))
    run("INSERT INTO chat(order_id,sender,text) VALUES(?,?,?)", (oid, "sys", "Bukti pembayaran diunggah. Admin akan memeriksanya."))
    notify(f"🧾 Bukti bayar {order['kode']} dari {order['nama']}\nCek: {request.host_url}admin.html")
    return jsonify(ok=True, bukti=name)


@bp.post("/orders/<int:oid>/review")
@user_only
def review(oid):
    order, j = get_order(oid), request.json or {}
    if not order or order["status"] != "selesai":
        return err("Ulasan hanya bisa diberikan setelah pesanan selesai.")
    rating = j.get("rating")
    if not isinstance(rating, int) or not 1 <= rating <= 5:
        return err("Pilih bintang 1 sampai 5.")
    q("INSERT OR REPLACE INTO reviews(order_id,rating,teks) VALUES(?,?,?)", (oid, rating, (j.get("teks") or "").strip()[:300]))
    notify(f"⭐ Ulasan {rating}/5 dari {order['nama']} ({order['kode']})")
    return jsonify(ok=True)


@bp.get("/reviews")
def reviews_public():
    stat = q("SELECT COUNT(*) n, AVG(rating) a FROM reviews", one=True)
    rows = q("""SELECT r.rating, r.teks, u.nama FROM reviews r JOIN orders o ON o.id=r.order_id
                JOIN users u ON u.id=o.user_id WHERE r.teks != '' ORDER BY r.id DESC LIMIT 6""")
    return jsonify(count=stat["n"], avg=round(stat["a"] or 0, 1),
                   items=[{"rating": r["rating"], "teks": r["teks"], "nama": r["nama"].split()[0]} for r in rows])


# ---------- Ekspor ----------
@bp.get("/orders/export.csv")
@admin_only
def export_csv():
    buf = io.StringIO()
    out = csv.writer(buf)
    out.writerow(["Kode", "Tanggal pesan", "Butuh tanggal", "Nama", "HP", "Paket", "Jumlah", "Subtotal", "Ongkir", "Diskon", "Voucher", "Total", "Dibayar", "Metode", "Status", "Alamat", "Isi"])
    for r in q(ORDER_SQL + " ORDER BY o.id DESC", ("admin",)):
        o = order_dict(r)
        out.writerow([o["kode"], o["created"], o["tanggal_acara"], o["nama"], o["hp"], o["paket"], o["qty"], o["subtotal"], o["ongkir"], o["diskon"], o["voucher"], o["total"], o["paid"],
                      o["metode"], o["status"], o["alamat"], "; ".join(i["nama"] for i in o["items"])])
    return Response("\ufeff" + buf.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment; filename=pesanan-parcelku.csv"})
