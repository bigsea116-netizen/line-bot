//node_modulesにある機能を呼び出して関数、変数化
//これらのrequireは何が起こっている？→Express アプリを生成するファクトリ関数
const { Redis } = require("@upstash/redis");
const express = require("express");
const line = require("@line/bot-sdk");
const { createClient } = require("@supabase/supabase-js");

//運動種類をオブジェクト化
const EXERCISE_MAP = {
  bench_press: ["ベンチ", "ベンチプレス", "BP", "bench"],
  dumbbell_press: ["ダンベルプレス", "DBプレス", "dumbbell press"],
  squat: ["スクワット", "SQ", "squat"],
  // running: ["ランニング", "ラン", "run", "jog"],
};

// Redis クライアントを作成
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

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
  return "unknown";
};

//重量抽出ロジック
const extractWeight = (text) => {
  const match = text.match(/(\d+)\s*(?:kg|キロ)/i);
  return match ? Number(match[1]) : null;
};

//回数抽出ロジック
const extractReps = (text) => {
  const match = text.match(
    /(\d+(?:回)?(?:(?:\s+|[,、]\s*)\d+(?:回)?)+)|(\d+(?:\s+\d+)+)/
  );
  if (!match) return [];
  const target = match[1] || match[2];
  return target
    .replace(/回/g, "")
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

//Quick Reply
const sendQuickReplyMenu = (replyToken) => {
  return client.replyMessage(replyToken, {
    type: "text",
    text: "メニューを選んでください！",
    quickReply: {
      items: [
        {
          type: "action",
          imageUrl: "https://example.com/icon_record.png",
          action: { type: "message", label: "記録", text: "記録" },
        },
        {
          type: "action",
          imageUrl: "https://example.com/icon_timer.png",
          action: { type: "message", label: "時間", text: "時間" },
        },
        {
          type: "action",
          imageUrl: "https://example.com/icon_history.png",
          action: { type: "message", label: "履歴", text: "履歴" },
        },
      ],
    },
  });
};

//イベント処理
//テキストメッセージにのみ返信する
const handleEvent = async (event) => {
  if (event.type !== "message" || event.message.type !== "text") {
    return Promise.resolve(null);
  }
  const userId = event.source.userId;
  const content = event.message.text;

  if (content === "記録") {
    await redis.set(`state:${userId}`, "recording");

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "今日のトレーニング内容を教えてください！",
    });
  }

  const userState = await redis.get(`state:${userId}`);
  if (userState === "recording") {
    try {
      await saveTrainingLog(userId, content);
      await redis.del(`state:${userId}`);

      return client.replyMessage(event.replyToken, {
        type: "text",
        text: "保存完了しました！",
        quickReply: {
          items: [
            {
              type: "action",
              action: { type: "message", label: "記録", text: "記録" },
            },
            {
              type: "action",
              action: { type: "message", label: "タイマー", text: "タイマー" },
            },
            {
              type: "action",
              action: { type: "message", label: "グラフ", text: "グラフ" },
            },
          ],
        },
      });
    } catch (error) {
      console.error(error);
      return client.replyMessage(event.replyToken, {
        type: "text",
        text: "保存に失敗しました…もう一度お試しください",
      });
    }
  }
  return sendQuickReplyMenu(event.replyToken);
};

//3000番ポートで待機
app.listen(3000);
