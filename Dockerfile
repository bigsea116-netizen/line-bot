# --- ステージ1: ビルド用 ---
FROM node:20 AS builder

WORKDIR /app

# すべての依存関係をインストール（tscコマンドなどが必要なため）
COPY package*.json ./
RUN npm install

# ソースコードをコピーしてビルド実行
COPY . .
RUN npm run build

# --- ステージ2: 実行用 ---
FROM node:20-slim

WORKDIR /app

# 本番環境用の依存関係のみをインストール
COPY package*.json ./
RUN npm install --production

# ビルド済みコード（dist）のみをコピー
COPY --from=builder /app/dist ./dist

# 環境変数の設定
ENV PORT=8080

# 起動コマンド（npm start は node dist/index.js を実行するように設定しておく）
CMD ["npm", "start"]