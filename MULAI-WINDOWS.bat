@echo off
title Parcelku
cd /d "%~dp0"
pip install -r requirements.txt
start http://localhost:5000
python app.py
pause
