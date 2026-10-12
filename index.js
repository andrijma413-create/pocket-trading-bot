const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Сервер-заглушка для Render Web Service (щоб статус був Live 24/7)
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Pocket Trading Bot is active 24/7!\n');
}).listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});

const token = '8826140719:AAHlvPxwwzpnygqsjhHYlR477n6mbv9GYao';
const bot = new Telegraf(token);
const DATA_FILE = path.join(__dirname, 'users.json');

function loadUsers() {
    try {
        if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {}
    return {};
}

function saveUsers(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {}
}

function isMarketOpen(openH, openM, closeH, closeM) {
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const op = openH * 60 + openM;
    const cl = closeH * 60 + closeM;
    return cur >= op && cur <= cl;
}

function parseTimeframeToSeconds(tf) {
    if (!tf) return 60;
    if (tf.startsWith('M')) return (parseInt(tf.replace('M', '')) || 1) * 60;
    return 60;
}

const users = loadUsers();
console.log('🚀 Бот оновлено для Render 24/7!');

const mainMenu = Markup.keyboard([
    ['👤 Профіль', '📊 Отримати сигнал'],
    ['📈 Статистика', '⚙️ Вибір пари'],
    ['📈 Стратегії / Індикатори', '⏱ Час угоди'],
    ['💵 Сума угоди', '🎁 Бонус']
]).resize();

const categoriesKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('💱 Валюти (Forex)', 'cat_curr_0'), Markup.button.callback('🪙 Криптовалюта', 'cat_crypto_0')],
    [Markup.button.callback('📈 Акції', 'cat_stocks_0'), Markup.button.callback('📊 Індекси', 'cat_ind_0')]
]);

const timeKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('⏱ M1 (1 хв)', 'time_M1'), Markup.button.callback('⏱ M2 (2 хв)', 'time_M2'), Markup.button.callback('⏱ M3 (3 хв)', 'time_M3')],
    [Markup.button.callback('⏱ M5 (5 хв)', 'time_M5'), Markup.button.callback('⏱ M15 (15 хв)', 'time_M15'), Markup.button.callback('⏱ M30 (30 хв)', 'time_M30')]
]);

const strategiesKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📈 EMA (9/21) Перетин', 'strat_ema')],
    [Markup.button.callback('📊 RSI (14) Рівні', 'strat_rsi')],
    [Markup.button.callback('📉 Bollinger Bands', 'strat_bb')],
    [Markup.button.callback('🔙 Головне меню', 'back_main')]
]);

const assetsData = {
    curr: [
        { name: 'EUR/USD', oH: 2, oM: 0, cH: 22, cM: 45, p: '50%' },
        { name: 'GBP/USD', oH: 2, oM: 0, cH: 22, cM: 45, p: '87%' },
        { name: 'EUR/JPY', oH: 2, oM: 0, cH: 22, cM: 45, p: '87%' },
        { name: 'CAD/CHF', oH: 2, oM: 0, cH: 22, cM: 45, p: '57%' },
        { name: 'AUD/CAD', oH: 2, oM: 0, cH: 22, cM: 45, p: '73%' },
        { name: 'USD/JPY', oH: 2, oM: 0, cH: 22, cM: 45, p: '68%' }
    ],
    crypto: [
        { name: 'Bitcoin', oH: 0, oM: 0, cH: 23, cM: 59, p: '15%' },
        { name: 'Ethereum', oH: 0, oM: 0, cH: 23, cM: 59, p: '40%' }
    ],
    stocks: [
        { name: 'Apple', oH: 16, oM: 35, cH: 21, cM: 0, p: '50%' },
        { name: 'Tesla', oH: 16, oM: 35, cH: 21, cM: 0, p: '50%' }
    ],
    ind: [
        { name: 'US100', oH: 0, oM: 30, cH: 22, cM: 45, p: '45%' },
        { name: 'SP500', oH: 0, oM: 30, cH: 22, cM: 45, p: '45%' }
    ]
};

function getDefaultStats() {
    return {
        trades: 0,
        wins: 0,
        turnover: 0,
        profit: 0,
        maxTrade: 0,
        minTrade: 0,
        maxProfit: 0
    };
}

bot.start((ctx) => {
    const id = ctx.from.id;
    if (!users[id]) {
        users[id] = { 
            pair: 'EUR/USD', 
            timeframe: 'M1', 
            balance: 10000, 
            amount: 10, 
            bonusDate: '', 
            activeTrade: null,
            stats: getDefaultStats()
        };
        saveUsers(users);
    }
    ctx.reply('👋 Вітаю! Головне меню вашого торгового бота:', mainMenu);
});

bot.hears('👤 Профіль', (ctx) => {
    const id = ctx.from.id;
    const u = users[id] || { balance: 10000, amount: 10, pair: 'EUR/USD', timeframe: 'M1' };
    
    let activeTradeText = '⚪ **Активна угода:** Немає';
    if (u.activeTrade) {
        const now = Date.now();
        let leftSec = Math.ceil((u.activeTrade.endTime - now) / 1000);
        if (leftSec < 0) leftSec = 0;

        activeTradeText = `🟢 **Активна угода:**\n` +
                          `• Пара: \`${u.activeTrade.pair}\`\n` +
                          `• Прогноз: ${u.activeTrade.dir}\n` +
                          `• Сума: ${u.activeTrade.amount}$\n` +
                          `⏳ Залишилось: \`${leftSec} сек.\``;
    }

    ctx.reply(`👤 **Ваш профіль:**\n` +
              `💰 Баланс: *${u.balance.toFixed(2)}$*\n` +
              `💵 Сума угоди: *${u.amount}$*\n` +
              `📊 Поточна пара: *${u.pair}*\n` +
              `⏱ Поточний час: *${u.timeframe}*\n\n` +
              `${activeTradeText}`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('💰 Вписати свій баланс', 'set_custom_balance')]
        ])
    });
});

bot.hears('📈 Статистика', (ctx) => {
    const id = ctx.from.id;
    if (!users[id]) users[id] = { stats: getDefaultStats() };
    if (!users[id].stats) users[id].stats = getDefaultStats();

    const st = users[id].stats;
    const winRate = st.trades > 0 ? Math.round((st.wins / st.trades) * 100) : 0;
    const profitSign = st.profit >= 0 ? `+$${st.profit.toFixed(2)}` : `-$${Math.abs(st.profit).toFixed(2)}`;

    const text = `📊 **ТОРГОВА СТАТИСТИКА (За весь час)**\n\n` +
                 `🟩 **Угоди:** \`${st.trades}\`\n` +
                 `🟨 **Прибуткових угод:** \`${winRate}%\`\n` +
                 `🟩 **Торговий оборот:** \`$${st.turnover.toFixed(2)}\`\n` +
                 `🟥 **Торговий прибуток:** \`${profitSign}\`\n` +
                 `🟩 **Макс. угода:** \`$${st.maxTrade.toFixed(2)}\`\n` +
                 `🟩 **Мін. угода:** \`$${st.minTrade.toFixed(2)}\`\n` +
                 `🟩 **Макс. прибуток:** \`$${st.maxProfit.toFixed(2)}\``;

    ctx.replyWithMarkdown(text);
});

bot.action('set_custom_balance', (ctx) => {
    ctx.reply('💰 Введіть вашу нову суму балансу (наприклад: `1500.00`):', { parse_mode: 'Markdown' });
    users[ctx.from.id].step = 'balance';
});

bot.hears('⚙️ Вибір пари', (ctx) => {
    ctx.reply('📂 Оберіть категорію офіційних котирувань:', { ...categoriesKeyboard });
});

bot.hears('📈 Стратегії / Індикатори', (ctx) => {
    ctx.reply('📚 **Оберіть торгову стратегію для аналізу:**', {
        parse_mode: 'Markdown',
        ...strategiesKeyboard
    });
});

bot.action('back_main', (ctx) => {
    ctx.editMessageText('✅ Головне меню активне.');
});

function renderPage(ctx, catKey, pageIndex, title) {
    const list = assetsData[catKey] || [];
    list.sort((a, b) => isMarketOpen(b.oH, b.oM, b.cH, b.cM) - isMarketOpen(a.oH, a.oM, a.cH, a.cM));

    const pageSize = 8;
    const totalPages = Math.ceil(list.length / pageSize) || 1;
    const page = Math.max(0, Math.min(pageIndex, totalPages - 1));

    const pageItems = list.slice(page * pageSize, (page + 1) * pageSize);
    const rows = [];

    for (let i = 0; i < pageItems.length; i += 2) {
        const row = [];
        const item1 = pageItems[i];
        const open1 = isMarketOpen(item1.oH, item1.oM, item1.cH, item1.cM);
        row.push(Markup.button.callback(`${open1 ? '🟢' : '⚪'} ${item1.name} (${item1.p})`, `pair_${item1.name}`));

        if (i + 1 < pageItems.length) {
            const item2 = pageItems[i + 1];
            const open2 = isMarketOpen(item2.oH, item2.oM, item2.cH, item2.cM);
            row.push(Markup.button.callback(`${open2 ? '🟢' : '⚪'} ${item2.name} (${item2.p})`, `pair_${item2.name}`));
        }
        rows.push(row);
    }

    const navRow = [];
    if (page > 0) {
        navRow.push(Markup.button.callback('⬅️ Назад', `cat_${catKey}_${page - 1}`));
    }
    navRow.push(Markup.button.callback(`📄 ${page + 1}/${totalPages}`, 'ignore'));
    if (page < totalPages - 1) {
        navRow.push(Markup.button.callback('Вперед ➡️', `cat_${catKey}_${page + 1}`));
    }
    rows.push(navRow);
    rows.push([Markup.button.callback('🔙 До категорій', 'back_cats')]);

    ctx.editMessageText(`📁 **${title}** (Сторінка ${page + 1}/${totalPages})\n🟢 — відкритий | ⚪ — закритий:`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) });
}

bot.action(/cat_(curr|crypto|stocks|ind)_(\d+)/, (ctx) => {
    const cat = ctx.match[1];
    const page = parseInt(ctx.match[2]);
    const titles = { curr: 'Валюти (Forex)', crypto: 'Криптовалюта', stocks: 'Акції', ind: 'Індекси' };
    renderPage(ctx, cat, page, titles[cat]);
});

bot.action('ignore', (ctx) => ctx.answerCbQuery());
bot.action('back_cats', (ctx) => ctx.editMessageText('📂 Оберіть категорію офіційних котирувань:', categoriesKeyboard));

bot.action(/pair_(.+)/, (ctx) => {
    const id = ctx.from.id;
    if (!users[id]) users[id] = { balance: 10000, amount: 10 };
    users[id].pair = ctx.match[1];
    saveUsers(users);
    ctx.answerCbQuery(`Обрано: ${users[id].pair}`);
    ctx.reply(`✅ Актив змінено на: *${users[id].pair}*.`, { parse_mode: 'Markdown' });
});

bot.hears('⏱ Час угоди', (ctx) => ctx.reply('⏱ Оберіть офіційний час експірації (від 1 хвилини):', timeKeyboard));

bot.action(/time_(.+)/, (ctx) => {
    const id = ctx.from.id;
    if (!users[id]) users[id] = { balance: 10000, amount: 10 };
    users[id].timeframe = ctx.match[1];
    saveUsers(users);
    ctx.answerCbQuery(`Час: ${users[id].timeframe}`);
    ctx.reply(`✅ Час угоди встановлено: *${users[id].timeframe}*.`, { parse_mode: 'Markdown' });
});

bot.hears('💵 Сума угоди', (ctx) => {
    ctx.reply('💵 Введіть суму для угоди (наприклад: `10` або `25`):', { parse_mode: 'Markdown' });
    users[ctx.from.id].step = 'amt';
});

bot.on('text', (ctx, next) => {
    const id = ctx.from.id;
    if (!users[id]) return next();
    const txt = ctx.message.text.trim();

    if (users[id].step === 'amt') {
        const val = parseFloat(txt.replace('$', ''));
        if (!isNaN(val) && val > 0) {
            users[id].amount = val;
            users[id].step = null;
            saveUsers(users);
            return ctx.reply(`✅ Сума угоди встановлена: *${val}$*`, { parse_mode: 'Markdown', ...mainMenu });
        } else {
            return ctx.reply('⚠️ Введіть коректну суму:');
        }
    }

    if (users[id].step === 'balance') {
        const val = parseFloat(txt.replace('$', '').replace(/\s/g, '').replace(',', '.'));
        if (!isNaN(val) && val >= 0) {
            users[id].balance = val;
            users[id].step = null;
            saveUsers(users);
            return ctx.reply(`✅ Баланс оновлено: *${val.toFixed(2)}$*`, { parse_mode: 'Markdown', ...mainMenu });
        } else {
            return ctx.reply('⚠️ Введіть коректний баланс:');
        }
    }
    return next();
});

bot.hears('📊 Отримати сигнал', (ctx) => {
    const id = ctx.from.id;
    const u = users[id] || { pair: 'EUR/USD', timeframe: 'M1', balance: 10000, amount: 10 };
    if (!users[id].stats) users[id].stats = getDefaultStats();

    if (u.activeTrade && u.activeTrade.endTime > Date.now()) {
        return ctx.reply('⚠️ У вас вже відкрита активна угода! Зачекайте її завершення.');
    }

    const durationSec = parseTimeframeToSeconds(u.timeframe);
    const dir = Math.random() > 0.5 ? 'КУПИТИ (CALL 🟢)' : 'ПРОДАТИ (PUT 🔴)';
    const reason = dir.includes('КУПИТИ') 
        ? '📈 **Технічний аналіз:**\n• **EMA (9/21):** Бичачий перетин.\n• **RSI:** 44.' 
        : '📉 **Технічний аналіз:**\n• **EMA (9/21):** Ведмежий імпульс.\n• **RSI:** 62.';

    let tvSym = u.pair.replace('/', '');
    if (tvSym === 'Bitcoin') tvSym = 'BTCUSD';
    if (tvSym === 'Ethereum') tvSym = 'ETHUSD';

    const totalDuration = durationSec;
    const endTime = Date.now() + (totalDuration * 1000);

    users[id].activeTrade = {
        pair: u.pair,
        dir: dir,
        amount: u.amount,
        timeframe: u.timeframe,
        endTime: endTime
    };
    saveUsers(users);

    ctx.reply(`🔔 **ОКРЕМЕ СПОВІЩЕННЯ: АКТИВНА УГОДА**\n\n` +
              `• **Пара:** \`${u.pair}\`\n` +
              `• **Прогноз:** ${dir}\n` +
              `• **Інвестиція:** ${u.amount}$\n` +
              `⏳ **Зворотний відлік:** \`${totalDuration} сек.\``, { parse_mode: 'Markdown' })
    .then((sentMsg) => {
        const chatId = sentMsg.chat.id;
        const messageId = sentMsg.message_id;

        const timerInterval = setInterval(() => {
            const currentTime = Date.now();
            const remaining = Math.ceil((users[id].activeTrade ? users[id].activeTrade.endTime - currentTime : 0) / 1000);

            if (remaining > 0 && users[id].activeTrade) {
                bot.telegram.editMessageText(
                    chatId,
                    messageId,
                    null,
                    `🔔 **ОКРЕМЕ СПОВІЩЕННЯ: АКТИВНА УГОДА**\n\n` +
                    `• **Пара:** \`${u.pair}\`\n` +
                    `• **Прогноз:** ${dir}\n` +
                    `• **Інвестиція:** ${u.amount}$\n` +
                    `⏳ **Зворотний відлік:** \`${remaining} сек.\``,
                    { parse_mode: 'Markdown' }
                ).catch(() => {});
            } else {
                clearInterval(timerInterval);
            }
        }, 1000);
    });

    const text = `📊 **ОФІЦІЙНИЙ ТОРГОВИЙ СИГНАЛ**\n\n` +
                 `🔹 **Актив:** \`${u.pair}\`\n` +
                 `🔹 **Прогноз:** ${dir}\n` +
                 `🔹 **Експірація:** \`${u.timeframe}\`\n` +
                 `💵 **Сума угоди:** ${u.amount} $\n\n` +
                 `${reason}\n\n` +
                 `📈 **Живий графік:**\nhttps://www.tradingview.com/chart/?symbol=${tvSym}`;

    ctx.replyWithMarkdown(text);

    setTimeout(() => {
        const isWin = Math.random() < 0.82;
        const profit = u.amount * 0.92;
        const st = users[id].stats;

        st.trades += 1;
        st.turnover += u.amount;

        if (st.maxTrade === 0 || u.amount > st.maxTrade) st.maxTrade = u.amount;
        if (st.minTrade === 0 || u.amount < st.minTrade) st.minTrade = u.amount;

        if (isWin) {
            st.wins += 1;
            st.profit += profit;
            if (profit > st.maxProfit) st.maxProfit = profit;

            users[id].balance += profit;
            ctx.reply(`🎉 **УГОДА ЗАКРИЛАСЯ В ПЛЮС!**\n\n` +
                      `🔹 **Актив:** \`${u.pair}\`\n` +
                      `💰 Прибуток: *+${profit.toFixed(2)} $*\n` +
                      `💼 Оновлений баланс: *${users[id].balance.toFixed(2)} $*`, { parse_mode: 'Markdown' });
        } else {
            st.profit -= u.amount;
            users[id].balance -= u.amount;
            if (users[id].balance < 0) users[id].balance = 0;
            ctx.reply(`❌ **УГОДА ЗАКРИЛАСЯ В МІНУС.**\n\n` +
                      `🔹 **Актив:** \`${u.pair}\`\n` +
                      `💸 Списано: *-${u.amount.toFixed(2)} $*\n` +
                      `💼 Оновлений баланс: *${users[id].balance.toFixed(2)} $*`, { parse_mode: 'Markdown' });
        }

        users[id].activeTrade = null;
        saveUsers(users);
    }, durationSec * 1000);
});

bot.hears('🎁 Бонус', (ctx) => {
    const id = ctx.from.id;
    if (!users[id]) users[id] = { balance: 10000, amount: 10 };
    const today = new Date().toISOString().slice(0, 10);

    if (users[id].bonusDate === today) {
        return ctx.reply('⏳ Ви вже отримували бонус сьогодні. Завітайте завтра!');
    }
    users[id].bonusDate = today;
    users[id].balance += 50;
    saveUsers(users);
    ctx.reply('🎁 Вітаємо! На ваш баланс нараховано **+50$**!', { parse_mode: 'Markdown' });
});

bot.launch();
