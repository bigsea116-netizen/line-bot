import { createClient } from '@supabase/supabase-js'
//node_modulesにある機能を呼び出して関数、変数化
//これらのrequireは何が起こっている？→Express アプリを生成するファクトリ関数
const express = require("express");
const line = require("@line/bot-sdk");

//urlとkeyからsupabaseのインスタンスを生成
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

//IDと内容を引数にもらい、supabaseに保存する関数
//fromは何をしている？→どのテーブルかを指定している
async function saveTraningLog(userId, content) {
  const { data, error } = await supabase.from('traning_log').insert([{user_id: userId, content: content}])
  if (error) throw error
  return data;
}

//環境変数からconfigを作成　環境変数をべた書きするのはよくない
const config = {
  channelAccessToken: process.env.ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

//express()を実行して Expressアプリケーション（サーバーインスタンス）を生成
const app = express();

// /webhook に POST が来たら、LINE の署名検証ミドルウェアを通し、 
// 受け取ったイベントを handleEvent で処理して返信する
app.post("/webhook", line.middleware(config), (req, res) => {
  console.log(JSON.stringify(req, res, null, 2));
  Promise.all(req.body.events.map(handleEvent)).then((result) =>
    res.json(result)
  );
});

//テキストメッセージにのみ返信する
const handleEvent = (event) => {
  if (event.type !== "message" || event.message.type !== "text") {
    return Promise.resolve(null);
  }
  return client.replyMessage(event.replyToken, {
    type: "text",
    text: event.message.text,
  });
};

//サーバー起動時に1回だけ生成
//これは必要？→client.replyMessageで使うため必要
const client = new line.Client(config);

//3000番ポートで待機
//これを書かないとどうなる？
app.listen(3000);