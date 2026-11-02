"""Perhitungan harga: subtotal, ongkir berbasis jarak, dan voucher. Dipakai untuk estimasi dan pesanan final."""
import math
from datetime import date
from .db import q


def setting(key, default=""):
    row = q("SELECT value FROM settings WHERE `key`=?", (key,), True)
    return row["value"] if row and row["value"] != "" else default


def to_float(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def distance_km(lat1, lng1, lat2, lng2):
    """Jarak garis lurus (rumus haversine), dikali 1,3 sebagai pendekatan jarak jalan."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(a)) * 1.3


def shipping(metode, lat, lng, subtotal):
    """Kembalikan (ongkir, jarak_km atau None)."""
    if metode == "ambil":
        return 0, None
    fee = int(float(setting("ongkir_dasar", 0)))
    km = None
    t_lat, t_lng = to_float(setting("toko_lat", "")), to_float(setting("toko_lng", ""))
    lat, lng = to_float(lat), to_float(lng)
    if None not in (t_lat, t_lng, lat, lng):
        km = round(distance_km(t_lat, t_lng, lat, lng), 1)
        extra = max(0, math.ceil(km - float(setting("ongkir_km_gratis", 0))))
        fee += extra * int(float(setting("ongkir_per_km", 0)))
    free_min = int(float(setting("ongkir_gratis_min", 0)))
    if free_min and subtotal >= free_min:
        fee = 0
    return fee, km


def find_voucher(kode, subtotal):
    """Kembalikan (baris_voucher, pesan). Baris None bila voucher tidak bisa dipakai."""
    kode = (kode or "").strip().upper()
    if not kode:
        return None, ""
    v = q("SELECT * FROM vouchers WHERE kode=?", (kode,), True)
    if not v or not v["aktif"]:
        return None, "Kode voucher tidak ditemukan."
    if v["sampai"] and v["sampai"] < date.today().isoformat():
        return None, "Voucher sudah kedaluwarsa."
    if v["kuota"] and v["dipakai"] >= v["kuota"]:
        return None, "Kuota voucher sudah habis."
    if subtotal < v["min_belanja"]:
        return None, f"Minimal belanja Rp{v['min_belanja']:,}".replace(",", ".") + " untuk voucher ini."
    return v, "Voucher berhasil dipakai."


def quote(paket, qty, metode, lat=None, lng=None, kode=None):
    subtotal = paket * qty
    ongkir, km = shipping(metode, lat, lng, subtotal)
    diskon, voucher, msg = 0, None, ""
    v, msg = find_voucher(kode, subtotal)
    if v:
        voucher = v["kode"]
        if v["tipe"] == "persen":
            diskon = subtotal * v["nilai"] // 100
            if v["maks_diskon"]:
                diskon = min(diskon, v["maks_diskon"])
        elif v["tipe"] == "nominal":
            diskon = min(v["nilai"], subtotal)
        elif v["tipe"] == "ongkir":
            ongkir = 0
    return {"subtotal": subtotal, "diskon": diskon, "ongkir": ongkir, "km": km, "total": subtotal - diskon + ongkir,
            "voucher": voucher, "voucher_ok": bool(v), "voucher_msg": msg,
            "gratis_min": int(float(setting("ongkir_gratis_min", 0)))}
