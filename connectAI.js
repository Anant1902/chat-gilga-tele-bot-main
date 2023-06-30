const { Configuration, OpenAIApi } = require("openai");
require('dotenv').config();

const configuration = new Configuration({
  apiKey:process.env.openAI_API_key,
});
const openai = new OpenAIApi(configuration);

async function connectAI(msgs) {

    return openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: msgs
    }).then((aiResponse) => {
        const responseText = aiResponse.data.choices[0].message.content;
        return responseText;
    }).catch((error) => console.log(error));
}

module.exports = {
    connectAI
  };