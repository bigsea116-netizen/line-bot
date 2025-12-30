const express = require("express");
const line = require("@line/bot-sdk");

const config = {
  channelAccessToken: process.env.ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const app = express();

app.post("/webhook", line.middleware(config), (req, res) => {
  console.log(JSON.stringify(req,res,null,2));
  Promise.all(req.body.events.map(handleEvent)).then((result) =>
    res.json(result)
  );
});

const handleEvent = (event) => {
    //テキストメッセージにのみ返信する
  if (event.type !== "message" || event.message.type !== "text") {
    return Promise.resolve(null);
  }

  return client.replyMessage(event.replyToken, {
    type: "text",
    text: event.message.text,
  });
};

const client=new line.Client(config);

app.listen(3000);