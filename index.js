const express = require('express');
const app = express();
const port = 3003;
const { connectAI } = require('./connectAI');
require('dotenv').config();
const { v4 } = require('uuid');

app.get('/api', (req, res) => {
    const path = `/api/item/${v4()}`;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate');
    res.end(`Hello! Go to item: <a href="${path}">${path}</a>`);
  });

app.use(express.static('public'))

const TelegramBot = require('node-telegram-bot-api');
const token = process.env.tele_API_token;
const bot = new TelegramBot(token, {polling: true});

let messages = [
]

app.get('/testroute', (req, res) => {
    res.json({
        name: "Anant",
        email: "shankeranant@gmail.com"
    })
  });


bot.on('message', async (msg) => {
    let incoming_msg = msg.text.toString()

    messages.push({
        role: "user",
        content: incoming_msg
    })

    const ans = await connectAI(messages);
    messages.push({
        role: "assistant",
        content: ans
    })
    console.log(ans);
    bot.sendMessage(msg.chat.id, ans);
    });

module.exports = app
app.listen(process.env.PORT || port, () => console.log(`Express app running on port ${port}!`));

