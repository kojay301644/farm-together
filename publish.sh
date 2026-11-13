#!/bin/sh
# Cloudflare Pages 用：只把要公開的檔案放到 public/（不含 sql、src、說明檔）
set -e
cd "$(dirname "$0")"
rm -rf public && mkdir -p public
cp index.html 404.html admin.html privacy.html manifest.json sw.js supabase.js robots.txt sitemap.xml og.jpg icon-192.png icon-512.png icon-maskable-512.png apple-touch-icon.png public/
cp -r assets guide public/
cp _headers public/
# 娛樂廳伺服器程式（Supabase 部署時讀取，路徑不公開、不列出）
mkdir -p public/se2d1f464f9ecbfc2aa18fb0a && cp server/dist/*.js public/se2d1f464f9ecbfc2aa18fb0a/
