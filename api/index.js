const express = require('express');
const app = express();
const port = 3003;
const { connectAI } = require('../connectAI');
require('dotenv').config();
const mysql = require('mysql2/promise');
const TelegramBot = require('node-telegram-bot-api');
const bodyParser = require('body-parser');
const axios = require('axios');

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

        try {

            if (msg) {

                let user_id = msg.from.id;
                let incoming_msg = msg.text.toString()
                let firstName = (msg.from.first_name !== undefined) ? msg.from.first_name : null;
                let secondName = (msg.from.second_name !== undefined) ? msg.from.second_name : null;
                let userName = msg.from.username;
                let teleData = JSON.stringify(msg);


                try {
                    
                await con.execute("INSERT INTO users (teleID, firstName, secondName, userName, dateFirst, dateLast) VALUES ( ?, ?, ?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE dateLast=NOW()",
                        [user_id, firstName, secondName, userName]);
                } catch (error) {console.log("Insert user execution error: " + error)};

                try {
                await con.execute("INSERT INTO messages (teleID, username, userMessage, timeStamp, robotMessage, teleData) VALUES ( ?, ?, ?, NOW(), null, ?)",
                        [user_id, userName, incoming_msg, teleData]);
                } catch (error) {console.log("Insert message execution error: " + error)}

                const [result, field] =  await con.execute("SELECT LAST_INSERT_ID() AS id");
                const id = result[0].id.toString();

                const [msgResult, fields] = await con.execute('SELECT userMessage, robotMessage FROM messages WHERE teleID=? && timeStamp > now() - INTERVAL 1 day',
                        [user_id]);
                console.log(msgResult);
                let msgArr = [];
                msgResult.filter((msg, index) => index !== msgResult.length - 1 && msg.robotMessage !== null).map((msg) => {
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

                if (incoming_msg === 'What is the price of Bitcoin right now?') {
                    axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT')
                        .then( async function (response) {
                            console.log(response.body.price.toString());
                            await con.execute("UPDATE messages SET timeStamp = NOW(), robotMessage =? WHERE id=?",
                                            [response.body.price.toString(), id]).then(
                                async () => {
                                     // handle success
                                    await bot.sendMessage(msg.chat.id, response.body.price.toString());
                                })
                        })
                } else {
                    await connectAI(msgArr).then(async (ans) => {
                        await con.execute("UPDATE messages SET timeStamp = NOW(), robotMessage =? WHERE id=?", [ans, id]).then(
                            async () => {
                                await bot.sendMessage(msg.chat.id, ans);
                                await bot.sendPhoto(msg.chat.id,"https://www.somesite.com/image.jpg" );
                                await con.end();
                            })
                        });
                }
                
                
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

