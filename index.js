//node_modulesにある機能を呼び出して関数、変数化
//これらのrequireは何が起こっている？→Express アプリを生成するファクトリ関数
const express = require("express");
const line = require("@line/bot-sdk");
const { createClient } = require("@supabase/supabase-js");
const userState = {};

//運動種類をオブジェクト化
const EXERCISE_MAP = {
  bench_press: ["ベンチ", "ベンチプレス", "BP", "bench"],
  dumbbell_press: ["ダンベルプレス", "DBプレス", "dumbbell press"],
  squat: ["スクワット", "SQ", "squat"],
  // running: ["ランニング", "ラン", "run", "jog"],
};

//Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

//種目判定ロジック
const detectExercise = (text) => {
  const lowerText = text.toLowerCase();
  for (const [key, aliases] of Object.entries(EXERCISE_MAP)) {
    if (aliases.some((alias) => lowerText.includes(alias.toLowerCase()))) {
      return key;
    }
  }
  return null;
};

//重量抽出ロジック
const extractWeight = (text) => {
  const match = text.match(/(\d+)\s*kg?/i);
  return match ? Number(match[1]) : null;
};

//回数抽出ロジック
const extractReps = (text) => {
  const match = text.match(/(\d+(?:(?:\s+|[,、]\s*)\d+)+)/);
  if (!match) return [];
  return match[1]
    .split(/[,、\s]+/)
    .map((n) => Number(n))
    .filter((n) => !isNaN(n));
};

//入力値正規関数
const parseTrainingInput = (text) => {
  const exercise = detectExercise(text);
  const weight = extractWeight(text);
  const reps = extractReps(text);
  const sets = reps ? reps.length : 0;

  return {
    exercise,
    weight,
    reps,
    sets,
  };
};

//Supabaseに保存
//fromは何をしている？→どのテーブルかを指定している
async function saveTrainingLog(userId, content) {
  const parsedData = parseTrainingInput(content);
  const { data, error } = await supabase
    .from("training_log")
    .insert([{ user_id: userId, content: content, data: parsedData }]);
  if (error) throw error;
  return data;
}

//LINE configを作成
// 環境変数をべた書きするのはよくない
const config = {
  channelAccessToken: process.env.ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

//サーバー起動時に1回だけ生成
//これは必要？→client.replyMessageで使うため必要
const client = new line.Client(config);
//express()を実行して Expressアプリケーション（サーバーインスタンス）を生成
const app = express();

// /webhook に POST が来たら、LINE の署名検証ミドルウェアを通し、
// 受け取ったイベントを handleEvent で処理して返信する
app.post("/webhook", line.middleware(config), (req, res) => {
  console.log("EVENT:", JSON.stringify(req.body, null, 2));
  Promise.all(req.body.events.map(handleEvent)).then((result) =>
    res.json(result)
  );
});

//イベント処理
//テキストメッセージにのみ返信する
const handleEvent = async (event) => {
  if (event.type !== "message" || event.message.type !== "text") {
    return Promise.resolve(null);
  }
  const userId = event.source.userId;
  const content = event.message.text;

  if (content === "記録") {
    userState[userId] = "recording";
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "今日のトレーニング内容を教えてください！",
    });
  }
  if (userState[userId] === "recording") {
    try {
      await saveTrainingLog(userId, content);
      delete userState[userId];
      return client.replyMessage(event.replyToken, {
        type: "text",
        text: "保存完了しました！",
      });
    } catch (error) {
      console.error(error);
      return client.replyMessage(event.replyToken, {
        type: "text",
        text: "保存に失敗しました…もう一度お試しください",
      });
    }
  }
  return client.replyMessage(event.replyToken, {
    type: "text",
    text: event.message.text,
  });
};

//3000番ポートで待機
app.listen(3000);
