"""Titik masuk Vercel: Vercel menjalankan variabel `app` di berkas ini sebagai fungsi serverless.

Pada sebagian konfigurasi, Vercel meneruskan permintaan ke fungsi dengan alamat tujuan rewrite
(/api/index) dan bukan alamat asli yang dibuka pengunjung (mis. /pesan.html). Middleware di bawah
memulihkan alamat asli dari parameter `__path` yang diisi oleh `vercel.json`, sehingga semua halaman
dan /api/* tetap sampai ke rute yang benar.
"""
import os
import sys
from urllib.parse import parse_qsl, urlencode

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import create_app  # noqa: E402

app = create_app()
ENTRY_PATHS = ("/api/index", "/api/index.py")


class RestoreOriginalPath:
    """Kembalikan PATH_INFO asli bila fungsi menerima alamat tujuan rewrite."""

    def __init__(self, wsgi):
        self.wsgi = wsgi

    def __call__(self, environ, start_response):
        if environ.get("PATH_INFO") in ENTRY_PATHS:
            query = parse_qsl(environ.get("QUERY_STRING", ""), keep_blank_values=True)
            original = next((v for k, v in query if k == "__path"), None)
            if original and ":path" not in original:  # ":path" berarti Vercel tidak mengisi parameternya
                environ["PATH_INFO"] = "/" + original.lstrip("/")
                environ["QUERY_STRING"] = urlencode([(k, v) for k, v in query if k != "__path"])
        return self.wsgi(environ, start_response)


app.wsgi_app = RestoreOriginalPath(app.wsgi_app)
