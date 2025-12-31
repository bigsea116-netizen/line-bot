# Node.js 20 を使用
FROM node:20

# アプリの作業ディレクトリ
WORKDIR /app

# package.json と package-lock.json をコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm install --production

# ソースコードをコピー
COPY . .

# Fly.io が渡す PORT を使う
ENV PORT=8080

# アプリを起動
CMD ["npm", "start"]
