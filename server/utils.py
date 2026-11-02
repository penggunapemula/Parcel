"""Fungsi bantu: respons error, otorisasi, notifikasi Telegram, dan upload gambar."""
import os, threading, uuid, urllib.parse, urllib.request
from functools import wraps
from flask import jsonify, session, request
from . import config


def err(msg, code=400):
    return jsonify(error=msg), code


def rupiah(n):
    return "Rp" + f"{int(n):,}".replace(",", ".")


def is_admin():
    return session.get("role") == "admin"


def admin_only(fn):
    @wraps(fn)
    def wrapper(*a, **k):
        return fn(*a, **k) if is_admin() else err("Khusus admin.", 403)
    return wrapper


def user_only(fn):
    @wraps(fn)
    def wrapper(*a, **k):
        return fn(*a, **k) if session.get("role") == "user" else err("Silakan masuk terlebih dahulu.", 401)
    return wrapper


def notify(text):
    """Kirim notifikasi ke HP pemilik lewat Telegram Bot (thread terpisah)."""
    if not (config.TG_TOKEN and config.TG_CHAT):
        print("[NOTIF - Telegram belum diatur]\n" + text)
        return

    def send():
        try:
            data = urllib.parse.urlencode({"chat_id": config.TG_CHAT, "text": text}).encode()
            urllib.request.urlopen(f"https://api.telegram.org/bot{config.TG_TOKEN}/sendMessage", data, timeout=10)
        except Exception as exc:
            print("Gagal kirim notifikasi:", exc)
    threading.Thread(target=send, daemon=True).start()


def save_image(file):
    """Validasi (ukuran + magic bytes) lalu simpan gambar. Mengembalikan nama file atau None."""
    if not file:
        return None
    data = file.read(config.MAX_UPLOAD + 1)
    if not data or len(data) > config.MAX_UPLOAD:
        return None
    ext = next((e for magic, e in config.IMAGE_MAGIC if data.startswith(magic)), None)
    if not ext and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        ext = "webp"
    if not ext:
        return None
    os.makedirs(config.UPLOADS, exist_ok=True)
    name = f"{uuid.uuid4().hex}.{ext}"
    with open(os.path.join(config.UPLOADS, name), "wb") as fh:
        fh.write(data)
    return name


def delete_image(name):
    if name:
        try:
            os.remove(os.path.join(config.UPLOADS, os.path.basename(name)))
        except OSError:
            pass
