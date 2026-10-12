const TelegramBot = require('node-telegram-bot-api');
const token = '8872331653:AAH4HWOwVckm44DIR7_LFAPdXdk3LlPrPWg';

// Правильний виклик конструктора для цієї версії Node.js
const bot = new (TelegramBot.default || TelegramBot)(token, { polling: true });

console.log('🚀 Бот успішно запущений і чекає на команди...');

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Привіт! 👋 Я твій особистий торговий бот. Напиши /signal для отримання тестового сигналу.');
});

bot.onText(/\/signal/, (msg) => {
    const chatId = msg.chat.id;
    
    const asset = "EUR/USD (OTC)";
    const direction = "CALL (ВИЩЕ 🟢)";
    const timeframe = "M1";
    const currentTime = new Date().toLocaleTimeString();

    const signalText = `📊 **НОВИЙ ТОРГОВИЙ СИГНАЛ**\n\n` +
                       `🔹 **Актив:** \`${asset}\`\n` +
                       `🔹 **Напрямок:** ${direction}\n` +
                       `🔹 **Таймфрейм:** ${timeframe}\n` +
                       `⏱ **Час:** ${currentTime}`;

    bot.sendMessage(chatId, signalText, { parse_mode: 'Markdown' });
});
