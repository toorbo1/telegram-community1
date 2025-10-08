const TelegramBot = require('node-telegram-bot-api');

const token = '8206130580:AAG91R9Bnp2pYG0z9v1eRJmH8oZvThsN9eA';

console.log('🚀 Запуск бота LinkGold...');

const bot = new TelegramBot(token, {polling: true});

// Простое хранилище в памяти
const userBonuses = new Set();
const referralBonuses = new Set();

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userId = msg.from.id;
    const firstName = msg.from.first_name;

    console.log('📨 Получено сообщение:', text, 'от пользователя:', userId);

    if (text === '/start') {
        sendWelcomeMessage(chatId, firstName, userId);
    } else if (text.startsWith('/start ')) {
        const startPayload = text.split(' ')[1];
        sendWelcomeMessage(chatId, firstName, userId, startPayload);
    }
});

function sendWelcomeMessage(chatId, firstName, userId, startPayload = null) {
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

    // Правильный URL для Web App (должен начинаться с https://)
    const webAppUrl = "https://telegram-community1-production.up.railway.app";
    const channelUrl = "https://t.me/LinkGoldChannel";

    console.log('🔗 Web App URL:', webAppUrl); // Для отладки

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{
                    text: "🌐 ПЕРЕЙТИ НА САЙТ",
                    web_app: { url: webAppUrl }
                }],
                [{
                    text: "📢 ПОДПИСАТЬСЯ НА КАНАЛ",
                    url: channelUrl
                }]
            ]
        }
    };

    bot.sendMessage(chatId, welcomeText, {
        parse_mode: 'HTML',
        ...keyboard
    }).then(() => {
        console.log('✅ Сообщение отправлено пользователю:', userId);
        handleBonuses(userId, startPayload);
    }).catch(error => {
        console.error('❌ Ошибка отправки:', error);
    });
}

function handleBonuses(userId, startPayload = null) {
    console.log('🎁 Обработка бонусов для:', userId);
    
    // Приветственный бонус
    if (!userBonuses.has(userId)) {
        console.log('💰 Начисляем 5⭐ пользователю:', userId);
        awardBonus(userId, 5, 'welcome');
        userBonuses.add(userId);
    }
    
    // Реферальная ссылка
    if (startPayload && startPayload.startsWith('ref_')) {
        processReferral(startPayload, userId);
    }
}

function processReferral(referralCode, referredId) {
    const referrerId = referralCode.replace('ref_', '');
    
    if (parseInt(referrerId) === referredId) return;
    
    const referralKey = `${referrerId}_${referredId}`;
    
    if (!referralBonuses.has(referralKey)) {
        console.log(`💰 Начисляем 15⭐ рефереру ${referrerId}`);
        awardBonus(referrerId, 15, 'referral');
        
        console.log(`💰 Начисляем дополнительные 5⭐ приглашенному ${referredId}`);
        awardBonus(referredId, 5, 'referral_bonus');
        
        referralBonuses.add(referralKey);
    }
}

function awardBonus(userId, amount, type) {
    console.log(`🎯 Начисление ${amount}⭐ пользователю ${userId}`);
    // Здесь будет вызов вашего API
}

bot.on('polling_error', (error) => {
    console.error('❌ Polling error:', error);
});

console.log('🤖 Бот LinkGold запущен! Отправьте /start в боте');