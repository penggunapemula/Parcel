#!/bin/bash
cd "$(dirname "$0")"
pip install -r requirements.txt
# export TELEGRAM_BOT_TOKEN="isi_token"
# export TELEGRAM_CHAT_ID="isi_chat_id"
# export ADMIN_PASSWORD="kata_sandi_kuat"
python3 app.py
