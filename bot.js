const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Токен бота - замените на ваш
const BOT_TOKEN = 'YOUR_BOT_TOKEN_HERE';
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// База данных для отслеживания бонусов
const db = new sqlite3.Database(path.join(__dirname, 'bot_database.db'));

// Инициализация базы
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS welcome_bonuses (
        user_id INTEGER PRIMARY KEY,
        bonus_received BOOLEAN DEFAULT 0,
        received_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Обработчик команды /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const firstName = msg.from.first_name;
    const startPayload = msg.text.split(' ')[1]; // Реферальный параметр

    console.log(`🚀 Пользователь ${userId} запустил бота`);

    // Начисляем бонус приветствия (5 звёзд)
    await giveWelcomeBonus(userId);

    // Обрабатываем реферальную ссылку если есть
    if (startPayload && startPayload.startsWith('ref_')) {
        await processReferral(startPayload, userId);
    }

    // Текст приветствия
    const welcomeText = `
👋 <b>Добро пожаловать в LinkGold, ${firstName}!</b>

🚀 <b>LinkGold</b> - это современная платформа для заработка на выполнении простых заданий в социальных сетях.

💎 <b>Наши преимущества:</b>
• Мгновенные выплаты
• Простые задания
• Приветственный бонус 5⭐
• Реферальная программа

💰 <b>Вам начислен приветственный бонус: 5 звёзд!</b>

🎯 <b>Чтобы начать зарабатывать:</b>
1. Перейдите в приложение по кнопке ниже
2. Выполняйте задания (подписки, лайки, репосты)
3. Выводите деньги от 50 рублей

📢 <b>Также подпишитесь на наш канал</b> - там мы публикуем новые задания и важные объявления!
    `;

    // Клавиатура с двумя кнопками
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{
                    text: "🌐 ПЕРЕЙТИ НА САЙТ",
                    web_app: { url: "https://your-domain.com" }
                }],
                [{
                    text: "📢 ПОДПИСАТЬСЯ НА КАНАЛ",
                    url: "https://t.me/LinkGoldChannel"
                }]
            ]
        }
    };

    // Отправляем сообщение
    await bot.sendMessage(chatId, welcomeText, {
        parse_mode: 'HTML',
        ...keyboard
    });
});

// Функция начисления приветственного бонуса
async function giveWelcomeBonus(userId) {
    return new Promise((resolve, reject) => {
        // Проверяем, получал ли пользователь уже бонус
        db.get("SELECT bonus_received FROM welcome_bonuses WHERE user_id = ?", [userId], (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            if (!row) {
                // Вызываем API для начисления бонуса
                const https = require('https');
                
                const data = JSON.stringify({
                    userId: userId,
                    amount: 5
                });

                const options = {
                    hostname: 'your-domain.com', // Замените на ваш домен
                    port: 443,
                    path: '/api/user/bonus/welcome',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                };

                const req = https.request(options, (res) => {
                    console.log(`✅ Бонусный запрос отправлен для пользователя ${userId}`);
                });

                req.on('error', (error) => {
                    console.error('❌ Ошибка при начислении бонуса:', error);
                });

                req.write(data);
                req.end();

                // Сохраняем в базу бота
                db.run("INSERT INTO welcome_bonuses (user_id, bonus_received) VALUES (?, 1)", [userId], (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    console.log(`✅ Приветственный бонус записан для пользователя ${userId}`);
                    resolve(true);
                });
            } else {
                resolve(false); // Бонус уже был начислен
            }
        });
    });
}

// Функция обработки реферальной ссылки
async function processReferral(referralCode, referredId) {
    return new Promise((resolve, reject) => {
        const referrerId = referralCode.replace('ref_', '');
        
        // Проверяем, что пользователь не активировал свою же ссылку
        if (parseInt(referrerId) === referredId) {
            resolve(false);
            return;
        }

        // Проверяем, не активировал ли уже этот реферал
        db.get("SELECT * FROM referral_bonuses WHERE referred_id = ?", [referredId], (err, existing) => {
            if (err) {
                reject(err);
                return;
            }

            if (!existing) {
                // Начисляем 15 звёзд пригласившему через API
                const https = require('https');
                
                const data = JSON.stringify({
                    userId: referrerId,
                    referredId: referredId,
                    amount: 15
                });

                const options = {
                    hostname: 'your-domain.com', // Замените на ваш домен
                    port: 443,
                    path: '/api/user/bonus/referral',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                };

                const req = https.request(options, (res) => {
                    console.log(`✅ Реферальный бонус отправлен для пользователя ${referrerId}`);
                });

                req.on('error', (error) => {
                    console.error('❌ Ошибка при начислении реферального бонуса:', error);
                });

                req.write(data);
                req.end();

                // Начисляем дополнительные 5 звёзд приглашенному
                giveWelcomeBonus(referredId);

                // Сохраняем в базу бота
                db.run("INSERT INTO referral_bonuses (referrer_id, referred_id, bonus_paid) VALUES (?, ?, 1)", 
                    [referrerId, referredId], (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        console.log(`✅ Реферальные бонусы начислены: ${referrerId} -> ${referredId}`);
                        resolve(true);
                    });
            } else {
                resolve(false); // Реферал уже был активирован
            }
        });
    });
}

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.error('❌ Ошибка polling:', error);
});

console.log('🤖 Бот LinkGold запущен!');