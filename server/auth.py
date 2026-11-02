"""Rute akun: daftar & masuk pelanggan (email + kata sandi + nomor telepon), profil, dan masuk admin."""
import hmac
import re
import time
from flask import Blueprint, request, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from . import config
from .db import q, run
from .utils import err, user_only

bp = Blueprint("auth", __name__, url_prefix="/api")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
MIN_PASSWORD = 8

# Batas percobaan masuk: maks 5 kali salah per 10 menit per alamat IP (disimpan di memori).
_gagal = {}
BATAS, JEDA = 5, 600


def norm_hp(raw):
    """Ambil angkanya saja dan ubah awalan 0 / 8 menjadi 62 (format internasional Indonesia)."""
    digits = "".join(c for c in (raw or "") if c.isdigit())
    if digits.startswith("0"):
        digits = "62" + digits[1:]
    elif digits.startswith("8"):
        digits = "62" + digits
    return digits


def too_many(bucket):
    """True bila IP ini sudah terlalu sering gagal. Kembalikan juga daftar waktu gagal terbaru."""
    now = time.time()
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "?").split(",")[0].strip()
    key = f"{bucket}:{ip}"
    recent = [t for t in _gagal.get(key, []) if now - t < JEDA]
    return key, recent, len(recent) >= BATAS


def profile(row):
    return {"nama": row["nama"], "email": row["email"], "hp": row["hp"]}


def start_session(uid, nama):
    session.clear()
    session.permanent = True
    session.update(role="user", uid=uid, nama=nama)
    q("UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?", (uid,))


@bp.get("/me")
def me():
    if session.get("role") == "user":
        row = q("SELECT nama,email,hp FROM users WHERE id=?", (session.get("uid"),), True)
        if not row:  # akun sudah dihapus
            session.clear()
            return jsonify(role=None, nama=None)
        return jsonify(role="user", **profile(row))
    return jsonify(role=session.get("role"), nama=session.get("nama"))


@bp.post("/register")
def register():
    j = request.json or {}
    nama = (j.get("nama") or "").strip()[:60]
    email = (j.get("email") or "").strip().lower()[:120]
    hp = norm_hp(j.get("hp"))
    password = j.get("password") or ""

    if len(nama) < 2:
        return err("Isi nama lengkap.")
    if not EMAIL_RE.match(email):
        return err("Format email belum benar.")
    if not 10 <= len(hp) <= 15:
        return err("Nomor telepon belum benar. Contoh: 081234567890.")
    if len(password) < MIN_PASSWORD:
        return err(f"Kata sandi minimal {MIN_PASSWORD} karakter.")
    if q("SELECT 1 FROM users WHERE email=?", (email,), True):
        return err("Email ini sudah terdaftar. Silakan masuk.", 409)

    hashed = generate_password_hash(password)
    owner = q("SELECT id,email FROM users WHERE hp=?", (hp,), True)
    if owner and owner["email"]:
        return err("Nomor telepon ini sudah dipakai akun lain.", 409)
    if owner:  # akun lama (dulu masuk hanya dengan nomor): pesanan lama ikut terhubung
        uid = owner["id"]
        q("UPDATE users SET nama=?, email=?, password_hash=? WHERE id=?", (nama, email, hashed, uid))
    else:
        uid = run("INSERT INTO users(nama,email,hp,password_hash) VALUES(?,?,?,?)", (nama, email, hp, hashed))
    start_session(uid, nama)
    return jsonify(ok=True, nama=nama)


@bp.post("/login")
def login():
    key, recent, blocked = too_many("user")
    if blocked:
        return err("Terlalu banyak percobaan. Coba lagi dalam beberapa menit.", 429)
    j = request.json or {}
    email = (j.get("email") or "").strip().lower()
    user = q("SELECT id,nama,password_hash FROM users WHERE email=?", (email,), True)
    if not user or not user["password_hash"] or not check_password_hash(user["password_hash"], j.get("password") or ""):
        _gagal[key] = recent + [time.time()]
        return err("Email atau kata sandi salah.", 401)
    _gagal.pop(key, None)
    start_session(user["id"], user["nama"])
    return jsonify(ok=True, nama=user["nama"])


@bp.patch("/me")
@user_only
def update_me():
    j = request.json or {}
    uid = session["uid"]
    nama = (j.get("nama") or "").strip()[:60]
    email = (j.get("email") or "").strip().lower()[:120]
    hp = norm_hp(j.get("hp"))
    if len(nama) < 2:
        return err("Isi nama lengkap.")
    if not EMAIL_RE.match(email):
        return err("Format email belum benar.")
    if not 10 <= len(hp) <= 15:
        return err("Nomor telepon belum benar.")
    if q("SELECT 1 FROM users WHERE email=? AND id<>?", (email, uid), True):
        return err("Email ini sudah dipakai akun lain.", 409)
    if q("SELECT 1 FROM users WHERE hp=? AND id<>?", (hp, uid), True):
        return err("Nomor telepon ini sudah dipakai akun lain.", 409)
    q("UPDATE users SET nama=?, email=?, hp=? WHERE id=?", (nama, email, hp, uid))
    session["nama"] = nama
    return jsonify(ok=True, nama=nama, email=email, hp=hp)


@bp.post("/me/password")
@user_only
def change_password():
    j = request.json or {}
    user = q("SELECT password_hash FROM users WHERE id=?", (session["uid"],), True)
    if not check_password_hash(user["password_hash"] or "", j.get("lama") or ""):
        return err("Kata sandi lama salah.", 401)
    if len(j.get("baru") or "") < MIN_PASSWORD:
        return err(f"Kata sandi baru minimal {MIN_PASSWORD} karakter.")
    q("UPDATE users SET password_hash=? WHERE id=?", (generate_password_hash(j["baru"]), session["uid"]))
    return jsonify(ok=True)


@bp.post("/admin/login")
def admin_login():
    key, recent, blocked = too_many("admin")
    if blocked:
        return err("Terlalu banyak percobaan. Coba lagi dalam beberapa menit.", 429)
    if not hmac.compare_digest(str((request.json or {}).get("password") or ""), config.ADMIN_PASSWORD):
        _gagal[key] = recent + [time.time()]
        return err("Kata sandi admin salah.", 401)
    _gagal.pop(key, None)
    session.clear()
    session.update(role="admin", nama="Admin")
    return jsonify(ok=True)


@bp.post("/logout")
def logout():
    session.clear()
    return jsonify(ok=True)
