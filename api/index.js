const express = require('express');
const app = express();
const port = 3003;
const { connectAI } = require('../connectAI');
require('dotenv').config();
const mysql = require('mysql2');
const TelegramBot = require('node-telegram-bot-api');
const bodyParser = require('body-parser');
const { getSystemErrorMap } = require('util');

app.use(express.static('public'))

app.get("/", (req, res) => {
    res.json({
        data: "Home Page"
    })
});

app.get("/test", (req, res) => {
    res.json({
        data: "Test Page"
    })
});


app.post("/", bodyParser.json(), async (req, res) => {
    try {
        const bot = new TelegramBot(process.env.tele_API_token);
        const { body } = req;
        const msg = body.message;

        var pool = mysql.createPool({
            host: process.env.db_host,
            user: process.env.db_user,
            password: process.env.db_pass,
            database: process.env.db_db,
            port: process.env.PORT,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
          });
          
          pool.getConnection(async function(err, con) {
              if (err) await bot.sendMessage(msg.chat.id, 'db cannot connect');
              await bot.sendMessage(msg.chat.id, 'db connected');
          });

        try {
            await bot.sendMessage(msg.chat.id, 'can hear you');
    
            if (msg) {

                let user_id = msg.from.id;
                let incoming_msg = msg.text.toString()
                let firstName = msg.from.first_name;
                let secondName = msg.from.last_name;
                let userName = msg.from.username;
                let teleData = JSON.stringify(msg);


                pool.query( 'INSERT INTO users (teleID, firstName, secondName, userName, dateFirst, dateLast) VALUES (?, ?, ?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE dateLast=now()',
                        [user_id, firstName, secondName, userName], async function (err, result, fields) {
                    if(err) {await bot.sendMessage(msg.chat.id, err)
                    } else {bot.sendMessage(msg.chat.id, 'db working ')};
                });

                pool.query("INSERT INTO messages (teleID, username, userMessage, timeStamp, robotMessage, teleData) VALUES ( ?, ?, ?, NOW(), null, ?)",
                        [user_id, userName, incoming_msg, teleData], async function (err, result) {
                    if(err) console.log(err);
                    console.log("1 user message record inserted");
                    pool.query("SELECT LAST_INSERT_ID() AS id", function (err, result) {
                        if(err) console.log(err);
                        id = result[0].id.toString();
                    });
                });

                pool.query('SELECT userMessage, robotMessage FROM messages WHERE teleID=? && timeStamp > now() - INTERVAL 1 day',
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

                    pool.query("UPDATE messages SET timeStamp = NOW(), robotMessage =? WHERE id=?", [ans, id], function (err, result, fields) {
                        if(err) console.log(err);
                    })
                    await bot.sendMessage(msg.chat.id, ans);
                    });
                } else {
                res.json({
                    status: "no data sent"
                })
            }
        }
        catch(error) {
            // If there was an error sending our message then we 
            // can log it into the Vercel console
            console.error('Error sending message');
            console.log(error.toString());
        }
        
        // Acknowledge the message with Telegram
        // by sending a 200 HTTP status code
        // The message here doesn't matter.
        res.send('OK');

    } catch (error) {
        console.error(error);
        return res.status(200).send("DB connect error");
    }
});

module.exports = app
app.listen(process.env.PORT || port, async () => {
    console.log(`Express app running on port ${port}!`)
});

