"""Pabrik aplikasi Flask Parcelku."""
import time
import traceback
from flask import Flask, request, send_from_directory, send_file, abort, Response
from . import config
from .db import init_db, close_db
from . import auth, catalog, orders, vouchers, addresses, payments


def create_app():
    app = Flask(__name__, static_folder=config.FRONTEND, static_url_path="")
    app.secret_key = config.SECRET_KEY
    app.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=config.PRODUCTION,
        PERMANENT_SESSION_LIFETIME=60 * 60 * 24 * 30,
    )
    app.config["MAX_CONTENT_LENGTH"] = config.MAX_UPLOAD + 1024 * 64
    app.teardown_appcontext(close_db)
    for module in (auth, catalog, orders, vouchers, addresses, payments):
        app.register_blueprint(module.bp)

    @app.get("/")
    def home():
        return app.send_static_file("beranda.html")

    @app.get("/uploads/<path:name>")
    def uploads(name):
        if config.STORE_DB:  # foto disimpan di database
            import io
            from .db import q
            row = q("SELECT mime,data FROM uploads WHERE name=?", (name,), True)
            if not row:
                abort(404)
            return send_file(io.BytesIO(row["data"]), mimetype=row["mime"], max_age=86400)
        return send_from_directory(config.UPLOADS, name, max_age=86400)

    # ---- Bila database belum tersambung, tampilkan penjelasan (bukan error 500 yang membingungkan) ----
    state = {"error": None, "tried": 0.0}

    def connect_db():
        try:
            init_db()
            state["error"] = None
        except Exception as exc:  # noqa: BLE001 - apa pun penyebabnya, jangan sampai situs mati total
            state["error"] = f"{type(exc).__name__}: {exc}"
            print("[ERROR DATABASE]", state["error"])
            traceback.print_exc()
        state["tried"] = time.time()

    @app.before_request
    def need_database():
        if state["error"] is None:
            return None
        if time.time() - state["tried"] > 10:  # coba sambung ulang tiap 10 detik
            connect_db()
            if state["error"] is None:
                return None
        if request.path.startswith("/api/"):
            return {"error": "Database belum tersambung. Hubungi admin situs."}, 503
        return Response(DB_ERROR_PAGE.replace("{ENGINE}", config.DB_ENGINE.upper()), status=503, mimetype="text/html")

    @app.after_request
    def security_headers(resp):
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
        resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        resp.headers.setdefault("Permissions-Policy", "geolocation=(self), camera=(), microphone=()")
        return resp

    @app.errorhandler(404)
    def not_found(_):
        if request.path.startswith("/api/"):
            return {"error": "Data tidak ditemukan."}, 404
        try:
            return app.send_static_file("404.html"), 404
        except Exception:  # noqa: BLE001 - jangan sampai halaman 404 sendiri menjadi error 500
            return "Halaman tidak ditemukan.", 404

    @app.errorhandler(500)
    def server_error(_):
        return {"error": "Terjadi kesalahan di server. Coba lagi sebentar."}, 500

    @app.errorhandler(413)
    def too_big(_):
        return {"error": "Ukuran file terlalu besar (maks. 6 MB)."}, 413

    connect_db()
    if config.ADMIN_PASSWORD == "admin123":
        print("\n[PERINGATAN] Kata sandi admin masih bawaan (admin123). Ubah lewat ADMIN_PASSWORD di file .env\n")
    return app


DB_ERROR_PAGE = """<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Database belum tersambung</title>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:12vh auto;padding:0 20px;color:#0f3d26">
<h1>Situs sedang disiapkan</h1>
<p>Aplikasi belum bisa tersambung ke database ({ENGINE}).</p>
<p><b>Untuk pemilik situs:</b> buka log hosting untuk melihat penyebab pastinya (baris <code>[ERROR DATABASE]</code>),
lalu periksa pengaturan <code>DB_ENGINE</code>, <code>MYSQL_HOST</code>, <code>MYSQL_USER</code>, <code>MYSQL_PASSWORD</code>,
dan <code>MYSQL_DATABASE</code>. Database di <code>127.0.0.1</code> / XAMPP tidak bisa dijangkau dari internet.</p>
<p><a href="">Muat ulang</a></p></body></html>"""
