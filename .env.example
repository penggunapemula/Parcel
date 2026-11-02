"""Titik masuk Parcelku. Jalankan: python app.py"""
import os
from server import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=False)
