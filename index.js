const express = require('express');
const app = express();
const port = 3003;
const { connectAI } = require('./connectAI');
require('dotenv').config();
const { v4 } = require('uuid');
const cron = require('node-cron');
const https = require('https');
const mysql = require('mysql');

var con = mysql.createConnection({
  host: "134.209.103.126",
  user: "anant",
  password: "uXkcYva4as",
  database: "ai_chat"
});

con.connect(function(err) {
    if (err) throw err;
    console.log("Connected!");
});

app.use(express.static('public'))

const TelegramBot = require('node-telegram-bot-api');
const token = process.env.tele_API_token;
const bot = new TelegramBot(token, {polling: true});

let messages = {};

let id = '';

bot.on('message', async (msg) => {
    let user_id = msg.from.id;
    let incoming_msg = msg.text.toString()
    let firstName = msg.from.first_name;
    let secondName = msg.from.last_name;
    let userName = msg.from.username;
    let teleData = JSON.stringify(msg);


    con.query( 'INSERT INTO users (teleID, firstName, secondName, userName, dateFirst, dateLast) VALUES (?, ?, ?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE dateLast=now()',
            [user_id, firstName, secondName, userName], function (err, result, fields) {
        if(err) console.log(err);
        console.log("1 user record inserted");
    });

    con.query("INSERT INTO messages (teleID, username, userMessage, timeStamp, robotMessage, teleData) VALUES ( ?, ?, ?, NOW(), null, ?)",
            [user_id, userName, incoming_msg, teleData], function (err, result) {
        if(err) console.log(err);
        console.log("1 user message record inserted");
        con.query("SELECT LAST_INSERT_ID() AS id", function (err, result) {
            if(err) console.log(err);
            id = result[0].id.toString();
            console.log("Last insert id recorded");
        });
    });

    var aiResponse;
    con.query('SELECT userMessage, robotMessage FROM messages WHERE teleID=? && timeStamp > now() - INTERVAL 1 day',
            [user_id], async function (err, result, fields) {
        if(err) console.log(err);
        let msgArr = [];
        result.filter((msg, index) => index !== result.length - 1).map((msg) => {
            msgArr = msgArr.concat(
            [{
                role: "user",
                content: msg.userMessage
            },
            {
                role: "assistant",
                content: msg.robotMessage   
            }]);
        })
        msgArr.push(
            {
                role: "user",
                content: result[result.length - 1].userMessage
            }
        );
        console.log(msgArr);
        const ans = await connectAI(msgArr);
        console.log(ans);

        con.query("UPDATE  messages SET timeStamp = NOW(), robotMessage =? WHERE id=?", [ans, id], function (err, result, fields) {
            if(err) console.log(err);
            console.log("1 ai message record inserted");
        });
        bot.sendMessage(msg.chat.id, ans);
        });
});

// cron.schedule('10 * * * * *', function() {
//     console.log('Running Cron Job');
//     https.get('https://chat-gilga-tele-bot.onrender.com/', (resp) => {
//         let data = '';

//         // A chunk of data has been received.
//         resp.on('data', (chunk) => {
//             data += chunk;
//         });

//         // The whole response has been received. Print out the result.
//         resp.on('end', () => {
//             console.log('Successfully pinged domain');
//         });

//     }).on("error", (err) => {
//         console.log("Error: " + err.message);
//     });
// });
    

module.exports = app
app.listen(process.env.PORT || port, () => console.log(`Express app running on port ${port}!`));

