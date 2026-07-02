#!/bin/bash
echo "========================================"
echo "  💀 KILLER VOIDS - Quick Start 💀"
echo "========================================"
if ! command -v node &> /dev/null; then
    echo "[!] Node.js not found! Installing..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi
echo "[✓] Node.js: $(node --version)"
if [ ! -d "node_modules" ]; then
    echo "[*] Installing dependencies..."
    npm install
fi
echo "[*] Starting server..."
exec node --openssl-legacy-provider server.js
