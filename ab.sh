#!/usr/bin/env bash
set -euo pipefail

# Konfigurasi
REPO_URL="https://github.com/tosoaja/auto-backup.git"
BRANCH="main"
SOURCE_DIR="${1:-$PWD}"
WORKDIR="/tmp/auto-backup"

: "${GITHUB_TOKEN:?Set GITHUB_TOKEN terlebih dahulu}"

rm -rf "$WORKDIR"

git clone "https://${GITHUB_TOKEN}@github.com/tosoaja/auto-backup.git" "$WORKDIR"

rsync -a --delete \
    --exclude ".git" \
    "$SOURCE_DIR/" \
    "$WORKDIR/"

cd "$WORKDIR"

git config user.name "tosoaja"
git config user.email "188399089+tosoaja@users.noreply.github.com"

git add .

if git diff --cached --quiet; then
    echo "Tidak ada perubahan."
    exit 0
fi

git commit -m "Auto Backup $(date '+%Y-%m-%d %H:%M:%S')"
git push origin "$BRANCH"

echo "Backup selesai."
