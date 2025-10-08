const TelegramBot = require('node-telegram-bot-api');

const token = '8206130580:AAG91R9Bnp2pYG0z9v1eRJmH8oZvThsN9eA';

console.log('🚀 Запуск бота LinkGold...');

const bot = new TelegramBot(token, {polling: true});

// Простое хранилище в памяти (для демо)
const userBonuses = new Set();
const referralBonuses = new Set();

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userId = msg.from.id;
    const firstName = msg.from.first_name;

    console.log('📨 Получено сообщение:', text, 'от пользователя:', userId);

    if (text === '/start') {
        // Простой старт без реферальной ссылки
        sendWelcomeMessage(chatId, firstName, userId);
    } else if (text.startsWith('/start ')) {
        // Старт с реферальной ссылкой
        const startPayload = text.split(' ')[1];
        sendWelcomeMessage(chatId, firstName, userId, startPayload);
    }
});

// Функция отправки приветственного сообщения
function sendWelcomeMessage(chatId, firstName, userId, startPayload = null) {
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
                    web_app: { url: "https://telegram-community1-production.up.railway.app/" } // ЗАМЕНИТЕ НА ВАШ САЙТ
                }],
                [{
                    text: "📢 ПОДПИСАТЬСЯ НА КАНАЛ ",
                    url: "https://t.me/LinkGoldChannel"
                }]
            ]
        }
    };

    // Отправляем сообщение
    bot.sendMessage(chatId, welcomeText, {
        parse_mode: 'HTML',
        ...keyboard
    }).then(() => {
        console.log('✅ Приветственное сообщение отправлено пользователю:', userId);
        
        // Начисляем бонусы
        handleBonuses(userId, startPayload);
        
    }).catch(error => {
        console.error('❌ Ошибка отправки сообщения:', error);
    });
}

// Функция обработки бонусов
function handleBonuses(userId, startPayload = null) {
    console.log('🎁 Обработка бонусов для пользователя:', userId);
    
    // 1. Начисляем приветственный бонус
    if (!userBonuses.has(userId)) {
        console.log('💰 Начисляем 5⭐ пользователю:', userId);
        awardBonus(userId, 5, 'welcome');
        userBonuses.add(userId);
    } else {
        console.log('ℹ️ Пользователь уже получал приветственный бонус');
    }
    
    // 2. Обрабатываем реферальную ссылку если есть
    if (startPayload && startPayload.startsWith('ref_')) {
        processReferral(startPayload, userId);
    }
}

// Функция обработки реферальной ссылки
function processReferral(referralCode, referredId) {
    const referrerId = referralCode.replace('ref_', '');
    
    console.log(`🔗 Обработка реферала: ${referrerId} -> ${referredId}`);
    
    // Проверяем, что пользователь не активировал свою же ссылку
    if (parseInt(referrerId) === referredId) {
        console.log('⚠️ Пользователь активировал свою же ссылку');
        return;
    }

    // Создаем уникальный ключ для реферала
    const referralKey = `${referrerId}_${referredId}`;
    
    if (!referralBonuses.has(referralKey)) {
        console.log(`💰 Начисляем 15⭐ рефереру ${referrerId} за приглашение ${referredId}`);
        
        // Начисляем 15 звёзд пригласившему
        awardBonus(referrerId, 15, 'referral');
        
        // Начисляем дополнительные 5 звёзд приглашенному (помимо приветственных)
        awardBonus(referredId, 5, 'referral_bonus');
        
        // Сохраняем в память
        referralBonuses.add(referralKey);
        console.log('✅ Реферал сохранен');
    } else {
        console.log('ℹ️ Реферал уже был активирован ранее');
    }
}

// Функция начисления бонуса через API
function awardBonus(userId, amount, type) {
    console.log(`🎯 Начисление ${amount}⭐ пользователю ${userId} (тип: ${type})`);
    
    // Данные для отправки
    const bonusData = {
        userId: userId,
        amount: amount,
        type: type
    };
    
    // Здесь будет вызов вашего API для начисления бонуса
    // Пока просто логируем (замените на реальный вызов API)
    console.log(`✅ [API CALL] Начислено ${amount}⭐ пользователю ${userId}`);
    
    // Пример вызова API (раскомментируйте когда будете готовы):
    /*
    const https = require('https');
    
    const data = JSON.stringify(bonusData);
    
    const options = {
        hostname: 'your-domain.com', // ЗАМЕНИТЕ НА ВАШ ДОМЕН
        port: 443,
        path: '/api/user/bonus/welcome',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    };
    
    const req = https.request(options, (res) => {
        console.log(`✅ Бонус ${amount}⭐ отправлен через API для пользователя ${userId}`);
    });
    
    req.on('error', (error) => {
        console.error('❌ Ошибка отправки бонуса через API:', error);
    });
    
    req.write(data);
    req.end();
    */
}

// Обработчик ошибок
bot.on('polling_error', (error) => {
    console.error('❌ Polling error:', error);
});

console.log('🤖 Бот LinkGold запущен!');
console.log('💎 Функции:');
console.log('   • Приветственное сообщение с кнопками');
console.log('   • Начисление 5⭐ за регистрацию');
console.log('   • Реферальная система (15⭐ за приглашение)');
console.log('   • Дополнительные 5⭐ приглашенному по реферальной ссылке');
console.log('📝 Отправьте /start в боте для тестирования');