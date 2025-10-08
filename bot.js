const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const BOT_TOKEN = '8206130580:AAG91R9Bnp2pYG0z9v1eRJmH8oZvThsN9eA';
const API_URL = 'https://telegram-community1-production.up.railway.app/api'; // URL вашего сервера
const ADMIN_ID = 8036875641;

const bot = new Telegraf(BOT_TOKEN);
const dbPath = path.join(__dirname, 'bot_database.db');

// Инициализация базы данных для бота
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Ошибка подключения к базе данных бота:', err.message);
        return;
    }
    console.log('✅ Подключено к базе данных бота');
    initBotDatabase();
});

function initBotDatabase() {
    db.serialize(() => {
        // Таблица для отслеживания бонусов приветствия
        db.run(`CREATE TABLE IF NOT EXISTS welcome_bonuses (
            user_id INTEGER PRIMARY KEY,
            bonus_received BOOLEAN DEFAULT 0,
            received_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Таблица для отслеживания реферальных бонусов
        db.run(`CREATE TABLE IF NOT EXISTS referral_bonuses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            referrer_id INTEGER NOT NULL,
            referred_id INTEGER NOT NULL,
            bonus_paid BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    });
}

// Функция для получения московского времени
function getMoscowTime() {
    return new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
}

// Главная команда /start
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name;
    const lastName = ctx.from.last_name || '';
    const username = ctx.from.username || `user_${userId}`;
    const startPayload = ctx.startPayload; // Параметр после start (реферальная ссылка)
    
    console.log(`🚀 Пользователь ${userId} запустил бота с параметром: ${startPayload}`);
    
    try {
        // Регистрируем пользователя в основной системе
        const userData = {
            id: userId,
            first_name: firstName,
            last_name: lastName,
            username: username,
            photo_url: ''
        };
        
        // 1. Регистрируем пользователя в основной системе
        const authResponse = await axios.post(`${API_URL}/user/auth`, {
            user: userData
        });
        
        if (!authResponse.data.success) {
            throw new Error('Ошибка регистрации в системе');
        }
        
        let welcomeBonusGiven = false;
        let referralBonusGiven = false;
        let referrerId = null;
        
        // 2. Проверяем и начисляем бонус приветствия (5 звёзд)
        const hasWelcomeBonus = await checkWelcomeBonus(userId);
        if (!hasWelcomeBonus) {
            await giveWelcomeBonus(userId);
            welcomeBonusGiven = true;
            console.log(`🎁 Начислен приветственный бонус пользователю ${userId}`);
        }
        
        // 3. Обрабатываем реферальную ссылку если есть
        if (startPayload && startPayload.startsWith('ref_')) {
            referrerId = startPayload.replace('ref_', '');
            
            // Проверяем, что пользователь не активировал свою же ссылку
            if (parseInt(referrerId) !== userId) {
                const referralResult = await processReferralBonus(referrerId, userId);
                referralBonusGiven = referralResult.success;
                
                if (referralBonusGiven) {
                    console.log(`💰 Реферальный бонус начислен: ${referrerId} -> ${userId}`);
                }
            }
        }
        
        // 4. Формируем приветственное сообщение
        const welcomeMessage = buildWelcomeMessage(firstName, welcomeBonusGiven, referralBonusGiven, referrerId);
        
        // 5. Отправляем сообщение с кнопками
        await ctx.reply(welcomeMessage, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.url('🚀 Начать зарабатывать', `https://t.me/LinkGoldMoney_bot/app`)],
                [Markup.button.callback('👥 Моя реферальная ссылка', 'get_referral_link')],
                [Markup.button.callback('💰 Мой баланс', 'check_balance')]
            ])
        });
        
        // 6. Отправляем дополнительную информацию
        setTimeout(async () => {
            await ctx.reply(
                `💡 <b>Как начать зарабатывать?</b>\n\n` +
                `1. <b>Откройте приложение</b> - нажмите "Начать зарабатывать"\n` +
                `2. <b>Выполняйте задания</b> - подписки, лайки, репосты\n` +
                `3. <b>Получайте выплаты</b> - от 50 рублей на карту\n\n` +
                `🎁 <b>Бонусы:</b>\n` +
                `• +5 звёзд за регистрацию\n` +
                `• +15 звёзд за каждого друга\n` +
                `• Быстрый вывод средств`,
                { parse_mode: 'HTML' }
            );
        }, 1000);
        
    } catch (error) {
        console.error('❌ Ошибка при обработке /start:', error);
        await ctx.reply(
            '😔 Произошла ошибка при регистрации. Пожалуйста, попробуйте позже или напишите в поддержку.',
            Markup.inlineKeyboard([
                Markup.button.url('📞 Поддержка', 'https://t.me/linkgold_support')
            ])
        );
    }
});

// Проверка бонуса приветствия
function checkWelcomeBonus(userId) {
    return new Promise((resolve, reject) => {
        db.get("SELECT bonus_received FROM welcome_bonuses WHERE user_id = ?", [userId], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(row ? row.bonus_received : false);
        });
    });
}

// Начисление бонуса приветствия
async function giveWelcomeBonus(userId) {
    return new Promise(async (resolve, reject) => {
        try {
            // Начисляем 5 звёзд через API
            const bonusResponse = await axios.post(`${API_URL}/user/bonus/welcome`, {
                userId: userId,
                amount: 5
            });
            
            if (bonusResponse.data.success) {
                // Сохраняем в базу бота
                db.run("INSERT OR REPLACE INTO welcome_bonuses (user_id, bonus_received) VALUES (?, 1)", [userId], (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(true);
                });
            } else {
                reject(new Error('Ошибка начисления бонуса через API'));
            }
        } catch (error) {
            reject(error);
        }
    });
}

// Обработка реферального бонуса
async function processReferralBonus(referrerId, referredId) {
    return new Promise(async (resolve, reject) => {
        try {
            // Проверяем, не активировал ли уже этот реферал
            db.get("SELECT * FROM referral_bonuses WHERE referred_id = ?", [referredId], async (err, existing) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (existing) {
                    resolve({ success: false, message: 'Реферал уже активирован' });
                    return;
                }
                
                // Начисляем 15 звёзд пригласившему
                const referrerBonusResponse = await axios.post(`${API_URL}/user/bonus/referral`, {
                    userId: referrerId,
                    referredId: referredId,
                    amount: 15
                });
                
                // Начисляем 5 звёзд приглашенному (дополнительные к приветственным)
                const referredBonusResponse = await axios.post(`${API_URL}/user/bonus/welcome`, {
                    userId: referredId,
                    amount: 5
                });
                
                if (referrerBonusResponse.data.success && referredBonusResponse.data.success) {
                    // Сохраняем в базу бота
                    db.run("INSERT INTO referral_bonuses (referrer_id, referred_id, bonus_paid) VALUES (?, ?, 1)", 
                        [referrerId, referredId], (err) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            resolve({ success: true, message: 'Реферальные бонусы начислены' });
                        });
                } else {
                    resolve({ success: false, message: 'Ошибка начисления реферальных бонусов' });
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

// Построение приветственного сообщения
function buildWelcomeMessage(firstName, welcomeBonusGiven, referralBonusGiven, referrerId) {
    let message = `👋 <b>Добро пожаловать, ${firstName}!</b>\n\n`;
    
    if (welcomeBonusGiven) {
        message += `🎁 <b>Вам начислен приветственный бонус: 5 звёзд!</b>\n`;
    }
    
    if (referralBonusGiven) {
        message += `🤝 <b>Вы пришли по приглашению друга!</b>\n`;
        message += `💫 <b>Вам начислено дополнительно 5 звёзд!</b>\n`;
        message += `🎯 <b>Ваш друг получил 15 звёзд за ваше приглашение!</b>\n`;
    }
    
    message += `\n💰 <b>Ваш текущий баланс:</b> ${welcomeBonusGiven ? '5' : '0'} ⭐\n\n`;
    message += `🚀 <b>LinkGold</b> - платформа для заработка на выполнении простых заданий!\n\n`;
    message += `💎 <b>Что вас ждет:</b>\n`;
    message += `• Выполняйте задания и получайте оплату\n`;
    message += `• Приглашайте друзей и получайте бонусы\n`;
    message += `• Выводите деньги удобным способом\n`;
    
    return message;
}

// Обработчик кнопки "Моя реферальная ссылка"
bot.action('get_referral_link', async (ctx) => {
    const userId = ctx.from.id;
    const referralLink = `https://t.me/LinkGoldMoney_bot?start=ref_${userId}`;
    
    await ctx.answerCbQuery();
    await ctx.reply(
        `👥 <b>Ваша реферальная ссылка</b>\n\n` +
        `Приглашайте друзей и получайте <b>15 звёзд</b> за каждого!\n\n` +
        `<code>${referralLink}</code>\n\n` +
        `💫 <b>Ваш друг получит:</b>\n` +
        `• +5 звёзд за регистрацию\n` +
        `• +5 звёзд за переход по вашей ссылке\n` +
        `• Доступ к всем заданиям\n\n` +
        `📊 <b>Статистика:</b>\n` +
        `Приглашено: 0 друзей\n` +
        `Заработано: 0 звёзд`,
        {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📋 Скопировать ссылку', 'copy_referral_link')],
                [Markup.button.url('📱 Открыть приложение', `https://t.me/LinkGoldMoney_bot/app`)]
            ])
        }
    );
});

// Обработчик кнопки "Скопировать реферальную ссылку"
bot.action('copy_referral_link', async (ctx) => {
    const userId = ctx.from.id;
    const referralLink = `https://t.me/LinkGoldMoney_bot?start=ref_${userId}`;
    
    await ctx.answerCbQuery('Ссылка скопирована! ✅');
    await ctx.reply(
        `🔗 <b>Реферальная ссылка скопирована!</b>\n\n` +
        `Теперь вы можете отправить её друзьям:\n\n` +
        `<code>${referralLink}</code>`,
        { parse_mode: 'HTML' }
    );
});

// Обработчик кнопки "Мой баланс"
bot.action('check_balance', async (ctx) => {
    const userId = ctx.from.id;
    
    try {
        // Получаем баланс пользователя через API
        const userResponse = await axios.get(`${API_URL}/user/${userId}`);
        
        if (userResponse.data.success) {
            const user = userResponse.data.profile;
            const balance = user.balance || 0;
            
            await ctx.answerCbQuery();
            await ctx.reply(
                `💰 <b>Ваш баланс</b>\n\n` +
                `🏆 <b>${balance} ⭐</b>\n\n` +
                `📊 <b>Статистика:</b>\n` +
                `• Выполнено заданий: ${user.tasks_completed || 0}\n` +
                `• Активных заданий: ${user.active_tasks || 0}\n` +
                `• Уровень качества: ${user.quality_rate || 0}%\n\n` +
                `💸 <b>Минимальный вывод:</b> 50 звёзд`,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.url('🚀 Перейти к заданиям', `https://t.me/LinkGoldMoney_bot/app`)],
                        [Markup.button.callback('🔄 Обновить', 'check_balance')]
                    ])
                }
            );
        } else {
            throw new Error('Ошибка получения данных');
        }
    } catch (error) {
        console.error('Ошибка при проверке баланса:', error);
        await ctx.answerCbQuery('Ошибка получения баланса 😔');
    }
});

// Команда /profile
bot.command('profile', async (ctx) => {
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name;
    
    try {
        const userResponse = await axios.get(`${API_URL}/user/${userId}`);
        
        if (userResponse.data.success) {
            const user = userResponse.data.profile;
            const referralLink = `https://t.me/LinkGoldMoney_bot?start=ref_${userId}`;
            
            await ctx.reply(
                `👤 <b>Профиль ${firstName}</b>\n\n` +
                `💰 <b>Баланс:</b> ${user.balance || 0} ⭐\n` +
                `🏆 <b>Уровень:</b> ${user.level || 0}\n` +
                `✅ <b>Выполнено заданий:</b> ${user.tasks_completed || 0}\n` +
                `📊 <b>Качество:</b> ${user.quality_rate || 0}%\n\n` +
                `👥 <b>Реферальная программа:</b>\n` +
                `Приглашено: ${user.referral_count || 0} друзей\n` +
                `Заработано: ${user.referral_earned || 0} ⭐\n\n` +
                `🔗 <b>Ваша ссылка:</b>\n` +
                `<code>${referralLink}</code>`,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.url('📱 Открыть приложение', `https://t.me/LinkGoldMoney_bot/app`)],
                        [Markup.button.callback('👥 Пригласить друзей', 'get_referral_link')],
                        [Markup.button.callback('💰 Проверить баланс', 'check_balance')]
                    ])
                }
            );
        }
    } catch (error) {
        console.error('Ошибка при получении профиля:', error);
        await ctx.reply('😔 Ошибка загрузки профиля. Попробуйте позже.');
    }
});

// Команда /help
bot.command('help', (ctx) => {
    ctx.reply(
        `🆘 <b>Помощь по LinkGold</b>\n\n` +
        `<b>Основные команды:</b>\n` +
        `/start - Начало работы\n` +
        `/profile - Ваш профиль\n` +
        `/help - Эта справка\n\n` +
        `<b>Как начать зарабатывать?</b>\n` +
        `1. Откройте приложение\n` +
        `2. Выполняйте задания\n` +
        `3. Получайте оплату\n\n` +
        `<b>Поддержка:</b>\n` +
        `По всем вопросам обращайтесь @linkgold_support`,
        { parse_mode: 'HTML' }
    );
});

// Обработка текстовых сообщений
bot.on('text', (ctx) => {
    const message = ctx.message.text;
    
    if (message.includes('привет') || message.includes('начать') || message.includes('старт')) {
        ctx.reply(
            '👋 Привет! Используйте команду /start для начала работы или откройте приложение для заработка!',
            Markup.inlineKeyboard([
                Markup.button.url('🚀 Открыть приложение', `https://t.me/LinkGoldMoney_bot/app`)
            ])
        );
    }
});

// Обработка ошибок
bot.catch((err, ctx) => {
    console.error(`❌ Ошибка для пользователя ${ctx.from?.id}:`, err);
    ctx.reply('😔 Произошла ошибка. Пожалуйста, попробуйте позже.');
});

// Запуск бота
bot.launch().then(() => {
    console.log('🤖 Бот LinkGold запущен!');
    console.log(`⏰ Московское время: ${getMoscowTime()}`);
});

// Элегантное завершение работы
process.once('SIGINT', () => {
    bot.stop('SIGINT');
    db.close();
});
process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    db.close();
});