"""Titik masuk Vercel: Vercel menjalankan variabel `app` di berkas ini sebagai fungsi serverless."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import create_app  # noqa: E402

app = create_app()
