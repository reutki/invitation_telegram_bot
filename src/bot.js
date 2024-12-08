const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

// Fix deprecation warnings
process.env.NTBA_FIX_319 = "1";
process.env.NTBA_FIX_350 = "1";

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, {
    polling: {
        interval: 300,
        autoStart: true,
        params: {
            timeout: 10
        }
    }
});

// Add error handlers
bot.on("polling_error", error => {
    console.log("Polling error:", error.message || error.code);
});

bot.on("error", error => {
    console.log("Bot error:", error.message);
});

const { setRoutes } = require("./routes/registrationRoutes");
setRoutes(bot);

module.exports = bot;
