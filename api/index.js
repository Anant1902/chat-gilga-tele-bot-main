const express = require('express');
const app = express();
const port = 3003;
const { connectAI } = require('../connectAI');
require('dotenv').config();
const mysql = require('mysql2/promise');
const TelegramBot = require('node-telegram-bot-api');
const bodyParser = require('body-parser');

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
        
        const con = await mysql.createConnection({
                host: process.env.db_host,
                user: process.env.db_user,
                password: process.env.db_pass,
                database: process.env.db_db,
                port: process.env.PORT,
                waitForConnections: true,
                queueLimit: 0,
                connectTimeout: 1000000
            });
          
        await con.connect(async function(err, con) {
            if (err) await bot.sendMessage(msg.chat.id, 'db cannot connect');
            await bot.sendMessage(msg.chat.id, 'db connected');
        });

        try {
    
            if (msg) {

                let user_id = msg.from.id;
                let incoming_msg = msg.text.toString()
                let firstName = msg.from.first_name;
                let secondName = msg.from.last_name;
                let userName = msg.from.username;
                let teleData = JSON.stringify(msg);

                await bot.sendMessage(msg.chat.id, 'can hear you say: ' + incoming_msg);

                try {
                await con.execute('INSERT INTO users (teleID, firstName, secondName, userName, dateFirst, dateLast) VALUES (?, ?, ?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE dateLast=now()',
                        [user_id, firstName, secondName, userName]);
                bot.sendMessage(msg.chat.id, '1 user id record inserted')
                } catch (error) {console.log("Execution error: " + error)};

                await con.execute("INSERT INTO messages (teleID, username, userMessage, timeStamp, robotMessage, teleData) VALUES ( ?, ?, ?, NOW(), null, ?)",
                        [user_id, userName, incoming_msg, teleData]);
                bot.sendMessage(msg.chat.id, "1 user message record inserted");

                const [result, field] =  await con.execute("SELECT LAST_INSERT_ID() AS id");
                const id = result[0].id.toString();

                const [msgResult, fields] = await con.execute('SELECT userMessage, robotMessage FROM messages WHERE teleID=? && timeStamp > now() - INTERVAL 1 day',
                        [user_id]);
                console.log(msgResult);
                let msgArr = [];
                msgResult.filter((msg, index) => index !== msgResult.length - 1).map((msg) => {
                    msgArr = msgArr.concat(
                    [{
                        role: "user",
                        content: msg.userMessage
                    },
                    {
                        role: "assistant",
                        content: msg.robotMessage   
                    }]);
                });
                msgArr.push(
                    {
                        role: "user",
                        content: msgResult[msgResult.length - 1].userMessage
                    }
                );
                console.log(msgArr);
                const ans = await connectAI(msgArr);

                await con.execute("UPDATE messages SET timeStamp = NOW(), robotMessage =? WHERE id=?", [ans, id]);
                bot.sendMessage(msg.chat.id, ans);
                await con.end();
            } else {
                res.json({
                    status: "no data sent"
                })
            }
        } catch(error) {
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

