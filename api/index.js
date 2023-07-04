const express = require('express');
const app = express();
const port = 3003;
const { connectAI } = require('../connectAI');
require('dotenv').config();
const mysql = require('mysql');
const TelegramBot = require('node-telegram-bot-api');
const bodyParser = require('body-parser');

app.use(express.static('public'))


app.post("/", bodyParser.json(), async (req, res) => {
    try {
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

        try {
 
            const bot = new TelegramBot(process.env.tele_API_token);
            const { body } = req;
            const msg = body.message;
            
            if (msg) {

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

                    con.query("UPDATE messages SET timeStamp = NOW(), robotMessage =? WHERE id=?", [ans, id], function (err, result, fields) {
                        if(err) console.log(err);
                        console.log("1 ai message record inserted");
                    });
                    await bot.sendMessage(msg.chat.id, ans);
                    });
                    // await bot.sendMessage(id, message, {parse_mode: 'Markdown'});
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
        return res.status(500).send("Server error");
    }
});

module.exports = app
app.listen(process.env.PORT || port, async () => {
    console.log(`Express app running on port ${port}!`)
});
