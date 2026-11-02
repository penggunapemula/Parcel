"""Pabrik aplikasi Flask Parcelku."""
from flask import Flask, request, send_from_directory
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
        return send_from_directory(config.UPLOADS, name, max_age=86400)

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
        return app.send_static_file("404.html"), 404

    @app.errorhandler(500)
    def server_error(_):
        return {"error": "Terjadi kesalahan di server. Coba lagi sebentar."}, 500

    @app.errorhandler(413)
    def too_big(_):
        return {"error": "Ukuran file terlalu besar (maks. 6 MB)."}, 413

    init_db()
    if config.ADMIN_PASSWORD == "admin123":
        print("\n[PERINGATAN] Kata sandi admin masih bawaan (admin123). Ubah lewat ADMIN_PASSWORD di file .env\n")
    return app
