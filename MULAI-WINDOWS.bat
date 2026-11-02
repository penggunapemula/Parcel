@echo off
title Parcelku
pip install -r requirements.txt
rem Hapus "rem" di bawah ini dan isi data Anda
rem set TELEGRAM_BOT_TOKEN=isi_token
rem set TELEGRAM_CHAT_ID=isi_chat_id
rem set ADMIN_PASSWORD=kata_sandi_kuat
start http://localhost:5000
python app.py
pause
