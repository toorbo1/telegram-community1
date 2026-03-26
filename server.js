
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
let currentUser = null;
const app = express();
const PORT = process.env.PORT || 3000;
// Используйте ключ из переменных окружения
const FLYER_API_KEY = process.env.FLYER_APL_KEY || 'FL-pqKrtr-kPaJFg-KeLIQD-TLHgfC';
const FLYER_API_URL = 'https://api.flyerservice.io';
// Исправьте URL вебхука - уберите двойной слеш
// Исправьте этот код в начале файла:
// ЗАМЕНИТЕ НА ЭТОТ КОД:
const WEBHOOK_URL = 'https://telegram-community1-production-0bc1.up.railway.app/api/flyer/webhook';



const LINKGOLDMONEY_API_KEY = 'FL-pqKrtr-kPaJFg-KeLIQD-TLHgfC';
const LINKGOLDMONEY_API_URL = 'https://telegram-community1-production-0bc1.up.railway.app/';
// Конфигурация для Railway
const BOT_TOKEN = process.env.BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL; 
const ADMIN_ID = 8036875641;
const APP_URL = process.env.RAILWAY_STATIC_URL || process.env.APP_URL || `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` || 'https://your-app.com';

// Инициализация бота только если есть токен
let bot;
if (BOT_TOKEN) {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });
    console.log('🤖 Telegram Bot initialized');
} else {
    console.log('⚠️ BOT_TOKEN not set - Telegram features disabled');
}

// Используйте переменную окружения от Railway
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
// Автоматические ping-запросы каждые 5 минут
// Автоматические ping-запросы к базе каждые 5 минут
setInterval(async () => {
    try {
        await pool.query('SELECT 1');
        console.log('✅ Database ping successful');
    } catch (error) {
        console.error('❌ Database ping failed:', error);
    }
}, 5 * 60 * 1000); // 5 минут
// ==================== FLYER API INTEGRATION ====================



// Улучшенная функция для проверки подписки через Flyer API
async function checkSubscriptionWithFlyer(userId, userData) {
    try {
        console.log('🎯 Checking Flyer subscription for user:', userId);

        const requestBody = {
            key: FLYER_API_KEY,
            user_id: userId,
            language_code: userData.language_code || 'ru'
        };

        console.log('📤 Sending to Flyer API:', {
            url: `${FLYER_API_URL}/check`,
            body: requestBody
        });

        const response = await fetch(`${FLYER_API_URL}/check`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'LinkGoldBot/1.0'
            },
            body: JSON.stringify(requestBody),
            timeout: 15000
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Flyer API response:', result);

        // Обработка ответа согласно документации Flyer
        if (result.skip === true) {
            return {
                required: false,
                status: 'subscribed',
                message: 'Проверка пройдена'
            };
        } else {
            return {
                required: true,
                status: 'requires_subscription',
                message: result.error || 'Требуется подписка',
                warning: result.warning,
                info: result.info
            };
        }

    } catch (error) {
        console.error('❌ Flyer API error:', error);
        return {
            required: false,
            status: 'error',
            message: 'Ошибка проверки подписки',
            error: error.message
        };
    }
}


// Улучшенная функция для получения заданий через Flyer API
async function getFlyerTasks(userId, userData, limit = 5) {
    try {
        console.log('📋 Getting tasks from Flyer API for user:', userId);

        const requestBody = {
            key: FLYER_API_KEY,
            user_id: parseInt(userId),
            language_code: userData.language_code || 'ru',
            limit: Math.min(limit, 10) // Максимум 10 согласно документации
        };

        const response = await fetch(`${FLYER_API_URL}/get_tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'LinkGoldBot/1.0'
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Flyer tasks response:', result);

        return {
            success: true,
            tasks: result.result || [],
            error: result.error,
            rawResponse: result
        };

    } catch (error) {
        console.error('❌ Flyer tasks error:', error);
        return {
            success: false,
            error: error.message,
            tasks: []
        };
    }
}


// Функция для проверки статуса задания через Flyer API
async function checkFlyerTaskStatus(signature) {
    try {
        console.log('🔍 Checking Flyer task status:', signature);

        const requestBody = {
            key: FLYER_API_KEY,
            signature: signature
        };

        const response = await fetch(`${FLYER_API_URL}/check_task`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'LinkGoldBot/1.0'
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Flyer task status response:', result);

        return {
            success: true,
            status: result.result,
            error: result.error,
            rawResponse: result
        };

    } catch (error) {
        console.error('❌ Flyer task status error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}



// Функция для получения информации о ключе бота (тестирование подключения)
async function getFlyerBotInfo() {
    try {
        console.log('🔑 Getting Flyer bot info');

        const requestBody = {
            key: FLYER_API_KEY
        };

        const response = await fetch(`${FLYER_API_URL}/get_me`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'LinkGoldBot/1.0'
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Flyer bot info response:', result);

        return {
            success: true,
            type: result.type,
            key_number: result.key_number,
            bot_id: result.bot_id,
            webhook: result.webhook,
            status: result.status,
            error: result.error,
            rawResponse: result
        };

    } catch (error) {
        console.error('❌ Flyer bot info error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Функция для создания кнопок подписки Flyer (упрощенная версия)
function createFlyerSubscriptionButtons() {
    // В реальной реализации здесь будут кнопки из ответа Flyer API
    // Пока используем заглушку
    return [
        [
            {
                text: '📢 ПОДПИСАТЬСЯ НА КАНАЛЫ',
                url: 'https://t.me/flyerservice'
            }
        ],
        [
            {
                text: '✅ Я ПОДПИСАЛСЯ',
                callback_data: 'check_flyer_subscription'
            }
        ]
    ];
}

// Функция для показа требований подписки Flyer
async function showFlyerSubscriptionRequired(chatId, userId) {
    try {
        // Получаем задания от Flyer API чтобы показать спонсоров
        const tasksResult = await getFlyerTasks(userId, {
            first_name: 'User',
            language_code: 'ru'
        }, 5);

        let messageText = `📢 <b>ДЛЯ ДОСТУПА К LINKGOLD НЕОБХОДИМО ПОДПИСАТЬСЯ</b>\n\n`;
        messageText += `✨ <b>Подпишитесь на наши спонсорские каналы чтобы получить доступ к боту:</b>\n\n`;
        
        if (tasksResult.success && tasksResult.tasks.length > 0) {
            tasksResult.tasks.forEach((task, index) => {
                messageText += `${index + 1}. ${task.title || 'Канал'} - ${task.reward || 0}⭐\n`;
            });
        } else {
            messageText += `🔸 Подписка бесплатна\n`;
            messageText += `🔸 Отписка возможна через 3 дня\n`;
            messageText += `🔸 Доступ к боту сразу после подписки\n`;
        }

        messageText += `\n👇 <b>Нажмите кнопку ниже для проверки подписки:</b>`;

        const buttons = [
            [
                {
                    text: '📢 ПОДПИСАТЬСЯ НА КАНАЛЫ',
                    url: 'https://t.me/flyerservice'
                }
            ],
            [
                {
                    text: '✅ Я ПОДПИСАЛСЯ',
                    callback_data: 'check_flyer_subscription'
                }
            ]
        ];

        await bot.sendMessage(chatId, messageText, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: buttons
            }
        });

    } catch (error) {
        console.error('Error showing Flyer subscription:', error);
        // В случае ошибки показываем стандартное сообщение
        const messageText = `📢 <b>ДЛЯ ДОСТУПА К LINKGOLD НЕОБХОДИМО ПОДПИСАТЬСЯ</b>\n\n` +
                          `Подпишитесь на наши каналы через @FlyerServiceBot\n\n` +
                          `После подписки нажмите кнопку "✅ Я ПОДПИСАЛСЯ"`;

        await bot.sendMessage(chatId, messageText, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: '✅ Я ПОДПИСАЛСЯ',
                        callback_data: 'check_flyer_subscription'
                    }
                ]]
            }
        });
    }
}

// Обработчик проверки подписки Flyer
async function handleFlyerSubscriptionCheck(chatId, userId, callbackQuery) {
    try {
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: '🔍 Проверяем подписки...'
        });

        // Проверяем подписку снова через Flyer API
        const subscriptionCheck = await checkSubscriptionWithFlyer(userId, {
            first_name: callbackQuery.from.first_name,
            username: callbackQuery.from.username,
            language_code: callbackQuery.from.language_code || 'ru'
        });

        if (subscriptionCheck.required && !subscriptionCheck.allowAccess) {
            // Подписка все еще требуется
            await bot.sendMessage(chatId, 
                '❌ Вы еще не подписались на все необходимые каналы. Пожалуйста, завершите подписку.'
            );
        } else {
            // Подписка выполнена или ошибка (разрешаем доступ)
            try {
                await bot.deleteMessage(chatId, callbackQuery.message.message_id);
            } catch (deleteError) {
                console.log('Cannot delete message:', deleteError.message);
            }
            
            await bot.sendMessage(
                chatId, 
                '✅ Отлично! Проверка подписки пройдена. Теперь вы можете пользоваться ботом!'
            );

            // Продолжаем регистрацию
            await processUserRegistration(chatId, callbackQuery.from, null);
        }

    } catch (error) {
        console.error('❌ Flyer subscription check handler error:', error);
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ Ошибка проверки подписки'
        });
    }
}
// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('.'));

// 🔧 ИСПРАВЛЕННАЯ КОНФИГУРАЦИЯ MULTER
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExt = path.extname(file.originalname);
        // Добавляем префикс для легкой идентификации
        cb(null, 'screenshot-' + uniqueSuffix + fileExt);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        // Разрешаем только изображения
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});
// ==================== FLYER WEBHOOK HANDLER ====================
// Эндпоинт для приема вебхуков от Flyer API
// flyer_webhook.py у вас уже есть. В server.js замените текущий обработчик на этот.
app.post('/api/flyer/webhook', express.json({ limit: '10mb' }), async (req, res) => {
    console.log('📨 Received Flyer webhook:', JSON.stringify(req.body, null, 2));

    try {
        const { type, key_number, data } = req.body;

        // Проверка ключа (опционально, но для безопасности)
        if (key_number && key_number !== FLYER_API_KEY) {
            console.log('❌ Invalid Flyer webhook key:', key_number);
            // Всегда возвращаем 200, чтобы Flyer не думал, что вебхук сломан
            return res.status(200).json({ status: false, error: 'Invalid API key' });
        }

        // Обрабатываем события
        switch (type) {
            case 'test':
                console.log('✅ Test webhook received - everything works!');
                return res.json({ status: true });

            case 'sub_completed':
                console.log('✅ User completed subscription:', data);
                if (data && data.user_id) {
                    await handleFlyerSubscriptionCompleted(data.user_id);
                }
                return res.json({ status: true });

            case 'new_status':
                console.log('🔄 New task status received:', data);
                if (data && data.user_id && data.signature) {
                    await handleFlyerTaskStatusUpdate(data);
                }
                return res.json({ status: true });

            default:
                console.warn(`⚠️ Unknown webhook type: ${type}`);
                return res.json({ status: true });
        }

    } catch (error) {
        console.error('❌ Error processing Flyer webhook:', error);
        // Всегда возвращаем 200 OK, чтобы сервис Flyer не думал, что вебхук недоступен
        res.status(200).json({ status: false, error: error.message });
    }
});

// 🔧 ОБСЛУЖИВАНИЕ СТАТИЧЕСКИХ ФАЙЛОВ
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    maxAge: '1d', // Кэширование на 1 день
    setHeaders: function (res, path) {
        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    }
}));
// Убедись, что у тебя есть middleware для JSON
app.use(express.json({ limit: '10mb' }));

// Flyer webhook endpoint
app.post('/flyer/webhook', (req, res) => {
  const payload = req.body;

  console.log('📨 Получен вебхук от Flyer:', payload);

  // Обязательно ответить {"status": true}, иначе Flyer будет считать, что вебхук не работает
  res.json({ status: true });

  // Обработка событий
  if (payload.type === 'sub_completed') {
    const userId = payload.data.user_id;
    console.log(`✅ Пользователь ${userId} завершил подписку`);
    // Здесь: разблокировать пользователя, начислить звёзды и т.п.
  } else if (payload.type === 'new_status' && payload.data.status === 'abort') {
    console.log(`⚠️ Пользователь ${payload.data.user_id} отписался от задания`);
    // Здесь: отменить награду, уведомить и т.д.
  } else if (payload.type === 'test') {
    console.log('🧪 Тестовый вебхук получен — всё работает!');
  }
});
// Функция для отправки уведомления пользователю
async function sendTaskNotification(userId, taskTitle, status, adminComment = '') {
    if (!bot) {
        console.log('⚠️ Bot not initialized, cannot send notification');
        return false;
    }

    try {
        let message = '';
        
        if (status === 'approved') {
            message = `🎉 <b>Задание одобрено!</b>\n\n` +
                     `Задание: "<b>${taskTitle}</b>"\n` +
                     `✅ Статус: <b>Одобрено</b>\n` +
                     `💫 Средства зачислены на ваш баланс!`;
        } else if (status === 'rejected') {
            message = `❌ <b>Задание отклонено</b>\n\n` +
                     `Задание: "<b>${taskTitle}</b>"\n` +
                     `📝 Статус: <b>Отклонено</b>\n` +
                     `💡 Вы можете взять другое задание`;
            
            if (adminComment) {
                message += `\n\n📋 <b>Комментарий администратора:</b>\n${adminComment}`;
            }
        }

        await bot.sendMessage(userId, message, { parse_mode: 'HTML' });
        console.log(`✅ Уведомление отправлено пользователю ${userId} о статусе задания "${taskTitle}"`);
        return true;
    } catch (error) {
        console.error(`❌ Ошибка отправки уведомления пользователю ${userId}:`, error.message);
        
        // Если пользователь заблокировал бота, пропускаем ошибку
        if (error.response && error.response.statusCode === 403) {
            console.log(`🚫 Пользователь ${userId} заблокировал бота`);
            return false;
        }
        
        return false;
    }
}

async function checkAdminAccess(userId) {
    try {
        console.log('🔐 Checking admin access for user:', userId);
        
        const result = await pool.query(
            'SELECT is_admin FROM user_profiles WHERE user_id = $1',
            [userId]
        );
        
        if (result.rows.length > 0) {
            const isAdmin = result.rows[0].is_admin === true || parseInt(userId) === ADMIN_ID;
            console.log(`✅ Admin check result for ${userId}: ${isAdmin}`);
            return isAdmin;
        }
        
        console.log(`❌ User ${userId} not found in database`);
        return parseInt(userId) === ADMIN_ID;
        
    } catch (error) {
        console.error('❌ Admin access check error:', error);
        return parseInt(userId) === ADMIN_ID;
    }
}
// Логирование состояния базы данных
setInterval(async () => {
    try {
        const result = await pool.query(`
            SELECT 
                count(*) as total_tasks,
                count(CASE WHEN status = 'active' THEN 1 END) as active_tasks,
                count(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks
            FROM tasks
        `);
        
        const userStats = await pool.query(`
            SELECT 
                count(*) as total_users,
                count(CASE WHEN is_admin = true THEN 1 END) as admin_users
            FROM user_profiles
        `);
        
        console.log('📊 Database Stats:', {
            tasks: result.rows[0],
            users: userStats.rows[0],
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Database stats error:', error);
    }
}, 15 * 60 * 1000); // Каждые 15 минут

async function fixPromocodesTable() {
    try {
        console.log('🔧 Fixing promocodes table structure...');
        
        // Проверяем существование таблицы
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'promocodes'
            )
        `);
        
        if (!tableExists.rows[0].exists) {
            console.log('❌ Promocodes table does not exist, creating...');
            await createPromocodesTable();
            return;
        }
        
        console.log('✅ Promocodes table exists, checking columns...');
        
        // Добавляем отсутствующие колонки
        const alterQueries = [
            `ALTER TABLE promocodes ADD COLUMN IF NOT EXISTS reward REAL NOT NULL DEFAULT 0`,
            `ALTER TABLE promocodes ADD COLUMN IF NOT EXISTS max_uses INTEGER NOT NULL DEFAULT 1`,
            `ALTER TABLE promocodes ADD COLUMN IF NOT EXISTS used_count INTEGER DEFAULT 0`,
            `ALTER TABLE promocodes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`,
            `ALTER TABLE promocodes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
            `ALTER TABLE promocodes ADD COLUMN IF NOT EXISTS created_by BIGINT NOT NULL DEFAULT ${ADMIN_ID}`,
            `ALTER TABLE promocodes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
        ];
        
        for (const query of alterQueries) {
            try {
                await pool.query(query);
                console.log(`✅ Executed: ${query.split('ADD COLUMN IF NOT EXISTS')[1]?.split(' ')[1]}`);
            } catch (error) {
                console.log(`⚠️ Could not execute: ${query}`, error.message);
            }
        }
        
        console.log('✅ Promocodes table structure fixed');
    } catch (error) {
        console.error('❌ Error fixing promocodes table:', error);
    }
}
// ДОБАВЬТЕ ПЕРЕД ОСНОВНЫМ WEBHOOK ENDPOINT
app.get('/api/flyer/webhook/test', async (req, res) => {
    console.log('✅ Test webhook endpoint is accessible');
    res.json({ 
        status: true,
        message: 'Webhook endpoint is working!',
        timestamp: new Date().toISOString()
    });
});

async function initDatabase() {
    try {
        console.log('🔄 Initializing simplified database...');
        

        // Таблица реферальных ссылок
        await pool.query(`
            CREATE TABLE IF NOT EXISTS referral_links (
                id SERIAL PRIMARY KEY,
                code VARCHAR(20) UNIQUE NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_by BIGINT NOT NULL,
                referral_url TEXT NOT NULL,
                total_clicks INTEGER DEFAULT 0,
                unique_clicks INTEGER DEFAULT 0,
                conversions INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Таблица кликов по ссылкам
        await pool.query(`
            CREATE TABLE IF NOT EXISTS referral_link_clicks (
                id SERIAL PRIMARY KEY,
                link_id INTEGER NOT NULL,
                user_id BIGINT,
                ip_address TEXT,
                user_agent TEXT,
                clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Таблица активаций реферальных ссылок
        await pool.query(`
            CREATE TABLE IF NOT EXISTS referral_activations (
                id SERIAL PRIMARY KEY,
                link_id INTEGER NOT NULL,
                user_id BIGINT NOT NULL,
                activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reward_amount REAL DEFAULT 0
            )
        `);
        
        console.log('✅ Referral tables initialized');
        // 🔥 КОНЕЦ ДОБАВЛЕННОГО КОДА
        
        // Остальной ваш существующий код initDatabase()...
        await pool.query(`
            ALTER TABLE user_profiles 
            ADD COLUMN IF NOT EXISTS completed_tasks INTEGER DEFAULT 0
        `);

        // Добавляем колонку completed_tasks если ее нет
        await pool.query(`
            ALTER TABLE user_profiles 
            ADD COLUMN IF NOT EXISTS completed_tasks INTEGER DEFAULT 0
        `);
await pool.query(`
CREATE TABLE IF NOT EXISTS referral_links (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_by BIGINT NOT NULL,
    referral_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES user_profiles(user_id)
)
`);
        // Таблица реферальных ссылок
        await pool.query(`
            CREATE TABLE IF NOT EXISTS referral_links (
                id SERIAL PRIMARY KEY,
                code VARCHAR(20) UNIQUE NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_by BIGINT NOT NULL,
                referral_url TEXT NOT NULL,
                total_clicks INTEGER DEFAULT 0,
                unique_clicks INTEGER DEFAULT 0,
                conversions INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES user_profiles(user_id)
            )
        `);
        
        // Таблица кликов по ссылкам
        await pool.query(`
            CREATE TABLE IF NOT EXISTS referral_link_clicks (
                id SERIAL PRIMARY KEY,
                link_id INTEGER NOT NULL,
                user_id BIGINT,
                ip_address TEXT,
                user_agent TEXT,
                clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (link_id) REFERENCES referral_links(id)
            )
        `);
        
        // Таблица активаций реферальных ссылок
        await pool.query(`
            CREATE TABLE IF NOT EXISTS referral_activations (
                id SERIAL PRIMARY KEY,
                link_id INTEGER NOT NULL,
                user_id BIGINT NOT NULL,
                activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reward_amount REAL DEFAULT 0,
                FOREIGN KEY (link_id) REFERENCES referral_links(id),
                FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
            )
        `);
        
await pool.query(`CREATE TABLE IF NOT EXISTS referral_link_clicks (
    id SERIAL PRIMARY KEY,
    link_id INTEGER NOT NULL,
    user_id BIGINT,
    ip_address TEXT,
    user_agent TEXT,
    clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (link_id) REFERENCES referral_links(id))
`);
// Таблица активаций реферальных ссылок
await pool.query(`
    CREATE TABLE IF NOT EXISTS referral_activations (
        id SERIAL PRIMARY KEY,
        link_id INTEGER NOT NULL,
        user_id BIGINT NOT NULL,
        activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reward_amount REAL DEFAULT 0,
        FOREIGN KEY (link_id) REFERENCES referral_links(id),
        FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
    )
`);

// Таблица настроек админ-панели
await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        allow_admins_links BOOLEAN DEFAULT false,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);

// Добавьте колонку для прав создания ссылок
await pool.query(`
    ALTER TABLE admin_permissions 
    ADD COLUMN IF NOT EXISTS can_create_links BOOLEAN DEFAULT false
`);
        // Таблица для лога уведомлений
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_notifications (
                id SERIAL PRIMARY KEY,
                admin_id BIGINT NOT NULL,
                message TEXT NOT NULL,
                sent_count INTEGER DEFAULT 0,
                failed_count INTEGER DEFAULT 0,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Таблица пользователей
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_profiles (
                user_id BIGINT PRIMARY KEY,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                photo_url TEXT,
                balance REAL DEFAULT 0,
                level INTEGER DEFAULT 1,
                is_admin BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Добавляем реферальные поля
        await pool.query(`
            ALTER TABLE user_profiles 
            ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
            ADD COLUMN IF NOT EXISTS referred_by BIGINT,
            ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS referral_earned REAL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN DEFAULT true
        `);

        // Таблица заданий - ОБНОВЛЕННАЯ ВЕРСИЯ С image_url
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                price REAL NOT NULL,
                created_by BIGINT NOT NULL,
                category TEXT DEFAULT 'general',
                time_to_complete TEXT DEFAULT '5 минут',
                difficulty TEXT DEFAULT 'Легкая',
                people_required INTEGER DEFAULT 1,
                repost_time TEXT DEFAULT '1 день',
                task_url TEXT,
                image_url TEXT,
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_flyer_data (
                user_id BIGINT PRIMARY KEY,
                sponsors_data JSONB,
                last_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS flyer_tasks (
                id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                task_signature TEXT NOT NULL,
                task_data JSONB,
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS flyer_tasks (
                id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                task_signature TEXT NOT NULL,
                task_data JSONB,
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            )
        `);

        console.log('✅ Flyer tables initialized');
        // Гарантируем, что колонка image_url существует
        await pool.query(`
            ALTER TABLE tasks 
            ADD COLUMN IF NOT EXISTS image_url TEXT
        `);

        // Таблица запросов на вывод
        await pool.query(`
            CREATE TABLE IF NOT EXISTS withdrawal_requests (
                id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                username TEXT,
                first_name TEXT,
                amount REAL NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                completed_by BIGINT
            )
        `);

        // Таблица постов
        await pool.query(`
            CREATE TABLE IF NOT EXISTS posts (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                author TEXT NOT NULL,
                author_id BIGINT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Таблица чатов поддержки
        await pool.query(`
            CREATE TABLE IF NOT EXISTS support_chats (
                id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                user_name TEXT NOT NULL,
                user_username TEXT,
                last_message TEXT,
                last_message_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT true,
                unread_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Таблица заданий пользователей
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_tasks (
                id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                task_id INTEGER NOT NULL,
                status TEXT DEFAULT 'active',
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                screenshot_url TEXT,
                submitted_at TIMESTAMP,
                completed_at TIMESTAMP
            )
        `);
 await pool.query(`
            ALTER TABLE task_verifications 
            ADD COLUMN IF NOT EXISTS auto_verified BOOLEAN DEFAULT false
        `);
        // Вызовите эту функцию при инициализации
addAutoVerificationColumn();
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_actions (
                id SERIAL PRIMARY KEY,
                admin_id BIGINT NOT NULL,
                action_type TEXT NOT NULL,
                target_id INTEGER,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Таблица проверки заданий
        await pool.query(`
            CREATE TABLE IF NOT EXISTS task_verifications (
                id SERIAL PRIMARY KEY,
                user_task_id INTEGER NOT NULL,
                user_id BIGINT NOT NULL,
                task_id INTEGER NOT NULL,
                user_name TEXT NOT NULL,
                user_username TEXT,
                task_title TEXT NOT NULL,
                task_price REAL NOT NULL,
                screenshot_url TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reviewed_at TIMESTAMP,
                reviewed_by BIGINT
            )
        `);

        // В initDatabase() добавьте:
        await createPromocodesTable();

        // Таблица сообщений
        await pool.query(`
            CREATE TABLE IF NOT EXISTS support_messages (
                id SERIAL PRIMARY KEY,
                chat_id INTEGER NOT NULL,
                user_id BIGINT NOT NULL,
                user_name TEXT NOT NULL,
                user_username TEXT,
                message TEXT NOT NULL,
                is_admin BOOLEAN DEFAULT false,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Таблица прав доступа администраторов
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_permissions (
                admin_id BIGINT PRIMARY KEY,
                can_posts BOOLEAN DEFAULT true,
                can_tasks BOOLEAN DEFAULT true,
                can_verification BOOLEAN DEFAULT true,
                can_support BOOLEAN DEFAULT true,
                can_payments BOOLEAN DEFAULT true,
                can_admins BOOLEAN DEFAULT false,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES user_profiles(user_id)
            )
        `);

        // Добавляем недостающие колонки
        await pool.query(`
            ALTER TABLE support_chats 
            ADD COLUMN IF NOT EXISTS user_username TEXT,
            ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0
        `);
        
        await pool.query(`
            ALTER TABLE tasks 
            ADD COLUMN IF NOT EXISTS created_by BIGINT,
            ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general',
            ADD COLUMN IF NOT EXISTS time_to_complete TEXT DEFAULT '5 минут',
            ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'Легкая',
            ADD COLUMN IF NOT EXISTS people_required INTEGER DEFAULT 1,
            ADD COLUMN IF NOT EXISTS repost_time TEXT DEFAULT '1 день',
            ADD COLUMN IF NOT EXISTS task_url TEXT
        `);

        // Добавляем колонку user_username в task_verifications если ее нет
        await pool.query(`
            ALTER TABLE task_verifications 
            ADD COLUMN IF NOT EXISTS user_username TEXT
        `);

        // Добавляем колонку user_username в support_messages если ее нет
        await pool.query(`
            ALTER TABLE support_messages 
            ADD COLUMN IF NOT EXISTS user_username TEXT
        `);

        // Гарантируем существование главного админа
        await pool.query(`
            INSERT INTO user_profiles 
            (user_id, username, first_name, last_name, is_admin) 
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                is_admin = true,
                updated_at = CURRENT_TIMESTAMP
        `, [ADMIN_ID, 'linkgold_admin', 'Главный', 'Администратор', true]);

        // Создаем тестовые задания если их нет
        const tasksCount = await pool.query('SELECT COUNT(*) FROM tasks WHERE status = $1', ['active']);
        if (parseInt(tasksCount.rows[0].count) === 0) {
            console.log('📝 Создаем тестовые задания...');
            await pool.query(`
                INSERT INTO tasks (title, description, price, created_by, category) 
                VALUES 
                ('Подписаться на канал', 'Подпишитесь на наш Telegram канал и оставайтесь подписанным минимум 3 дня', 50, $1, 'subscribe'),
                ('Посмотреть видео', 'Посмотрите видео до конца и поставьте лайк', 30, $1, 'view'),
                ('Сделать репост', 'Сделайте репост записи в своем канале', 70, $1, 'repost'),
                ('Оставить комментарий', 'Напишите содержательный комментарий под постом', 40, $1, 'comment'),
                ('Вступить в группу', 'Вступите в нашу Telegram группу', 60, $1, 'social')
            `, [ADMIN_ID]);
            console.log('✅ Тестовые задания созданы');
        }
// В функции initDatabase() добавьте:
async function addMissingUserColumns() {
    try {
        console.log('🔧 Adding missing columns to user_profiles...');
        
        const columnsToAdd = [
            'is_blocked BOOLEAN DEFAULT false',
            'tasks_completed INTEGER DEFAULT 0',
            'last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
        ];
        
        for (const columnDef of columnsToAdd) {
            const columnName = columnDef.split(' ')[0];
            try {
                await pool.query(`
                    ALTER TABLE user_profiles 
                    ADD COLUMN IF NOT EXISTS ${columnDef}
                `);
                console.log(`✅ Added column: ${columnName}`);
            } catch (error) {
                console.log(`ℹ️ Column ${columnName} already exists:`, error.message);
            }
        }
        



        console.log('✅ User table structure verified');
    } catch (error) {
        console.error('❌ Error adding user columns:', error);
    }
}

// Вызовите эту функцию в initDatabase()
await addMissingUserColumns();
        // Создаем тестовый пост если нет постов
        const postsCount = await pool.query('SELECT COUNT(*) FROM posts');
        if (parseInt(postsCount.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO posts (title, content, author, author_id) 
                VALUES ('Добро пожаловать!', 'Начните зарабатывать выполняя простые задания!', 'Администратор', $1)
            `, [ADMIN_ID]);
        }

        // ВРЕМЕННОЕ РЕШЕНИЕ - проверяем таблицу промокодов
        try {
            console.log('🔧 Checking promocodes table...');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS promocodes (
                    id SERIAL PRIMARY KEY,
                    code VARCHAR(20) UNIQUE NOT NULL,
                    reward REAL NOT NULL DEFAULT 0,
                    max_uses INTEGER NOT NULL DEFAULT 1,
                    used_count INTEGER DEFAULT 0,
                    expires_at TIMESTAMP,
                    is_active BOOLEAN DEFAULT true,
                    created_by BIGINT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Promocodes table verified');
        } catch (error) {
            console.log('⚠️ Promocodes table check:', error.message);
        }
        
        console.log('✅ Database initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
}

async function createPromocodesTable() {
    try {
        console.log('🔧 Creating/verifying promocodes table...');
        
        // Создаем основную таблицу промокодов
        await pool.query(`
            CREATE TABLE IF NOT EXISTS promocodes (
                id SERIAL PRIMARY KEY,
                code VARCHAR(20) UNIQUE NOT NULL,
                max_uses INTEGER NOT NULL,
                used_count INTEGER DEFAULT 0,
                reward REAL NOT NULL DEFAULT 0,
                expires_at TIMESTAMP,
                is_active BOOLEAN DEFAULT true,
                created_by BIGINT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Создаем таблицу активаций
        await pool.query(`
            CREATE TABLE IF NOT EXISTS promocode_activations (
                id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                promocode_id INTEGER NOT NULL,
                activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (promocode_id) REFERENCES promocodes(id)
            )
        `);
        
        
        // Проверяем и добавляем отсутствующие колонки
        const columnsToCheck = [
            {name: 'reward', type: 'REAL', nullable: 'NOT NULL', defaultValue: '0'},
            {name: 'max_uses', type: 'INTEGER', nullable: 'NOT NULL'},
            {name: 'used_count', type: 'INTEGER', nullable: 'DEFAULT 0'},
            {name: 'expires_at', type: 'TIMESTAMP', nullable: 'NULL'},
            {name: 'is_active', type: 'BOOLEAN', nullable: 'DEFAULT true'},
            {name: 'created_by', type: 'BIGINT', nullable: 'NOT NULL'}
        ];
        
        for (const column of columnsToCheck) {
            const columnExists = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'promocodes' AND column_name = $1
                )
            `, [column.name]);
            
            if (!columnExists.rows[0].exists) {
                console.log(`❌ Column ${column.name} missing, adding...`);
                try {
                    await pool.query(`
                        ALTER TABLE promocodes 
                        ADD COLUMN ${column.name} ${column.type} ${column.nullable}
                        ${column.defaultValue ? `DEFAULT ${column.defaultValue}` : ''}
                    `);
                    console.log(`✅ Column ${column.name} added`);
                } catch (addError) {
                    console.log(`⚠️ Could not add column ${column.name}:`, addError.message);
                }
            }
        }
        
        console.log('✅ Promocodes tables created/verified');
    } catch (error) {
        console.error('❌ Error creating promocodes tables:', error);
        throw error;
    }
}

// Создание тестовой заявки на вывод
app.post('/api/test-withdrawal', async (req, res) => {
    try {
        // Создаем тестовую заявку
        const result = await pool.query(`
            INSERT INTO withdrawal_requests (user_id, username, first_name, amount, status) 
            VALUES ($1, $2, $3, $4, 'pending')
            RETURNING *
        `, [123456, 'test_user', 'Test User', 150]);
        
        res.json({
            success: true,
            message: 'Test withdrawal request created',
            request: result.rows[0]
        });
        
    } catch (error) {
        console.error('Test withdrawal error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// Инициализируем базу данных при запуске
initDatabase();
// Принудительное создание таблицы withdrawal_requests
async function createWithdrawalTable() {
    try {
        console.log('🔧 Creating withdrawal_requests table...');
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS withdrawal_requests (
                id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                username TEXT,
                first_name TEXT,
                amount REAL NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                completed_by BIGINT
            )
        `);
        
        console.log('✅ withdrawal_requests table created/verified');
    } catch (error) {
        console.error('❌ Error creating withdrawal_requests table:', error);
    }
}

// В server.js в функцию initDatabase добавьте:
async function checkTasksTableStructure() {
    try {
        console.log('🔍 Checking tasks table structure...');
        
        const structure = await pool.query(`
            SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'promocodes' 
ORDER BY ordinal_position;

ALTER TABLE promocodes ADD COLUMN IF NOT EXISTS reward REAL NOT NULL DEFAULT 0;
        `);
        
        console.log('📊 Tasks table structure:', structure.rows);
        
        // Проверяем наличие важных колонок
        const requiredColumns = ['id', 'title', 'description', 'price', 'created_by', 'status'];
        const missingColumns = requiredColumns.filter(col => 
            !structure.rows.find(row => row.column_name === col)
        );
        
        if (missingColumns.length > 0) {
            console.log('❌ Missing columns in tasks table:', missingColumns);
            return false;
        }
        
        console.log('✅ Tasks table structure is OK');
        return true;
        
    } catch (error) {
        console.error('Error checking tasks table structure:', error);
        return false;
    }
}
async function verifyPromocodesTable() {
    try {
        console.log('🔍 Проверка таблицы промокодов...');
        
        // Проверяем существование таблицы
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'promocodes'
            );
        `);
        
        if (!tableExists.rows[0].exists) {
            console.log('❌ Таблица promocodes не существует, создаем...');
            await createPromocodesTable();
        } else {
            console.log('✅ Таблица promocodes существует');
        }
        
        // Проверяем структуру таблицы
        const structure = await pool.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'promocodes' 
            ORDER BY ordinal_position
        `);
        
        console.log('📊 Структура таблицы promocodes:', structure.rows);
        
    } catch (error) {
        console.error('❌ Ошибка проверки таблицы промокодов:', error);
    }
}
// Функция для проверки и исправления структуры таблицы промокодов
async function verifyPromocodesTableStructure() {
    try {
        console.log('🔍 Проверка структуры таблицы promocodes...');
        
        // Проверяем существование всех необходимых колонок
        const columnsToCheck = [
            { name: 'reward', type: 'REAL', nullable: 'NOT NULL', defaultValue: '0' },
            { name: 'max_uses', type: 'INTEGER', nullable: 'NOT NULL' },
            { name: 'used_count', type: 'INTEGER', nullable: 'DEFAULT 0' },
            { name: 'expires_at', type: 'TIMESTAMP', nullable: 'NULL' },
            { name: 'is_active', type: 'BOOLEAN', nullable: 'DEFAULT true' },
            { name: 'created_by', type: 'BIGINT', nullable: 'NOT NULL' }
        ];
        
        for (const column of columnsToCheck) {
            const columnExists = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'promocodes' AND column_name = $1
                )
            `, [column.name]);
            
            if (!columnExists.rows[0].exists) {
                console.log(`❌ Колонка ${column.name} отсутствует, добавляем...`);
                
                try {
                    await pool.query(`
                        ALTER TABLE promocodes 
                        ADD COLUMN ${column.name} ${column.type} ${column.nullable}
                        ${column.defaultValue ? `DEFAULT ${column.defaultValue}` : ''}
                    `);
                    console.log(`✅ Колонка ${column.name} добавлена`);
                } catch (addError) {
                    console.log(`⚠️ Не удалось добавить колонку ${column.name}:`, addError.message);
                }
            } else {
                console.log(`✅ Колонка ${column.name} существует`);
            }
        }
        
        console.log('✅ Структура таблицы promocodes проверена');
    } catch (error) {
        console.error('❌ Ошибка проверки структуры таблицы:', error);
    }
}
// Функция для принудительного обновления структуры таблицы
async function fixWithdrawalTable() {
    try {
        console.log('🔧 Проверка и исправление структуры таблицы withdrawal_requests...');
        
        // Проверяем существование таблицы
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'withdrawal_requests'
            );
        `);
        
        if (!tableExists.rows[0].exists) {
            console.log('❌ Таблица withdrawal_requests не существует, создаем...');
            await pool.query(`
                CREATE TABLE withdrawal_requests (
                    id SERIAL PRIMARY KEY,
                    user_id BIGINT NOT NULL,
                    username TEXT,
                    first_name TEXT,
                    amount REAL NOT NULL,
                    status TEXT DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP,
                    completed_by BIGINT
                )
            `);
            console.log('✅ Таблица создана');
            return;
        }
        
        // Проверяем и добавляем отсутствующие колонки
        const columnsToCheck = [
            {name: 'username', type: 'TEXT'},
            {name: 'first_name', type: 'TEXT'},
            {name: 'completed_at', type: 'TIMESTAMP'},
            {name: 'completed_by', type: 'BIGINT'}
        ];
        
        for (const column of columnsToCheck) {
            const columnExists = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'withdrawal_requests' AND column_name = $1
                );
            `, [column.name]);
            
            if (!columnExists.rows[0].exists) {
                console.log(`❌ Колонка ${column.name} отсутствует, добавляем...`);
                
                try {
                    await pool.query(`ALTER TABLE withdrawal_requests ADD COLUMN ${column.name} ${column.type}`);
                    console.log(`✅ Колонка ${column.name} добавлена`);
                } catch (addError) {
                    console.log(`⚠️ Не удалось добавить колонку ${column.name}:`, addError.message);
                }
            } else {
                console.log(`✅ Колонка ${column.name} существует`);
            }
        }
        
        console.log('✅ Структура таблицы проверена и исправлена');
    } catch (error) {
        console.error('❌ Ошибка при исправлении таблицы:', error);
    }
}

// Вызовите эту функцию при инициализации сервера
fixWithdrawalTable();

async function checkSubscription(userId) {
    if (!bot) {
        console.log('⚠️ Bot not initialized, skipping subscription check');
        return true;
    }

    try {
        const chatId = '@LinkGoldChannel1';
        const member = await bot.getChatMember(chatId, userId);
        const isSubscribed = ['member', 'administrator', 'creator'].includes(member.status);
        
        console.log(`🔍 Subscription check for ${userId}: ${isSubscribed}`);
        return isSubscribed;
        
    } catch (error) {
        console.error('❌ Subscription check error:', error);
        
        // Временно разрешаем регистрацию при ошибке проверки
        if (error.response && error.response.statusCode === 404) {
            console.log('⚠️ Channel not found, allowing registration');
            return true;
        }
        
        return true;
    }}
// Обновленная функция обработки команды /start с Flyer
bot.onText(/\/start(.+)?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const referralCode = match[1] ? match[1].trim() : null;

    console.log('🎯 Start command with Flyer integration:', { userId, referralCode });

    try {
        await bot.sendChatAction(chatId, 'typing');

        // 🔄 ПРОВЕРКА ПОДПИСКИ ЧЕРЕЗ FLYER API
        const subscriptionCheck = await checkSubscriptionWithFlyer(userId, {
            first_name: msg.from.first_name,
            username: msg.from.username,
            language_code: msg.from.language_code || 'ru'
        });

        console.log('📊 Flyer subscription check result:', subscriptionCheck);

        // Если требуется подписка, показываем спонсоров Flyer
        if (subscriptionCheck.required && !subscriptionCheck.allowAccess) {
            console.log('📢 Subscription required, showing Flyer channels');
            await showFlyerSubscriptionRequired(chatId, userId);
            return;
        }

        // Если подписка не требуется или проверка пройдена, продолжаем обычную регистрацию
        await processUserRegistration(chatId, msg.from, referralCode);
  
        // Если требуется подписка, показываем спонсоров
        if (subscriptionCheck.required) {
            if (subscriptionCheck.status === 'requires_subscription' && subscriptionCheck.sponsors) {
                await showSubscriptionRequired(chatId, subscriptionCheck.sponsors, userId);
                return;
            } else if (subscriptionCheck.status === 'requires_registration') {
                await showRegistrationRequired(chatId, subscriptionCheck.registration_url);
                return;
            }
        }

        // Если подписка не требуется или проверка пройдена, продолжаем обычную регистрацию
        await processUserRegistration(chatId, msg.from, referralCode);

        
        // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: проверяем повторные переходы по рефке
        if (referralCode && referralCode.startsWith('ref_')) {
            const existingUser = await pool.query(
                'SELECT user_id FROM user_profiles WHERE user_id = $1',
                [userId]
            );
            
            if (existingUser.rows.length > 0) {
                console.log(`⚠️ Зарегистрированный пользователь ${userId} повторно перешел по реферальной ссылке`);
                
                await bot.sendMessage(
                    chatId,
                    `ℹ️ <b>Вы уже зарегистрированы в боте!</b>\n\n` +
                    `Реферальные бонусы начисляются только при первой регистрации по реферальной ссылке.\n\n` +
                    `Используйте команды:\n` +
                    
                    `/referral - ваша реферальная ссылка\n` +
                    `📋 - просмотр заданий`,
                    { parse_mode: 'HTML' }
                );
                
                // 🔥 ВАЖНО: завершаем обработку для повторных переходов
                return;
            }
        }
        
        // 🔥 МГНОВЕННОЕ НАЧИСЛЕНИЕ ПРИ ПЕРЕХОДЕ ПО ССЫЛКЕ
        let referralBonusApplied = false;
        let referrerId = null;
        let referrerName = '';
                // 🔧 ВЫЗЫВАЕМ ИСПРАВЛЕННУЮ ФУНКЦИЮ РЕФЕРАЛЬНОЙ РЕГИСТРАЦИИ
// 🔧 ВЫЗЫВАЕМ ИСПРАВЛЕННУЮ ФУНКЦИЮ РЕФЕРАЛЬНОЙ РЕГИСТРАЦИИ
if (referralCode && referralCode.startsWith('ref_')) {
    const referralResult = await handleReferralRegistration(userId, referralCode, {
        firstName: msg.from.first_name,
        username: msg.from.username
    });
    
    if (referralResult.referredBy) {
        console.log(`✅ Referral registration processed for ${userId}`);
    }
}
        
        if (referralCode && referralCode.startsWith('ref_')) {
            const cleanReferralCode = referralCode.replace('ref_', '');
            
            // НАХОДИМ ПРИГЛАСИВШЕГО
            const referrerResult = await pool.query(
                'SELECT user_id, first_name, username FROM user_profiles WHERE referral_code = $1',
                [cleanReferralCode]
            );
            
            if (referrerResult.rows.length > 0) {
                referrerId = referrerResult.rows[0].user_id;
                referrerName = referrerResult.rows[0].first_name;
                
                console.log(`🎯 Мгновенное начисление за переход по ссылке от: ${referrerId}`);
                
                // 🔥 МГНОВЕННО НАЧИСЛЯЕМ 1 ЗВЕЗДУ ПРИГЛАСИВШЕМУ ЗА ПЕРЕХОД
                await pool.query(`
                    UPDATE user_profiles 
                    SET balance = COALESCE(balance, 0) + 1,
                        referral_earned = COALESCE(referral_earned, 0) + 1
                    WHERE user_id = $1
                `, [referrerId]);
                
                referralBonusApplied = true;
                
                // 🔥 ОТПРАВЛЯЕМ МГНОВЕННОЕ УВЕДОМЛЕНИЕ ПРИГЛАСИВШЕМУ
                try {
                    await bot.sendMessage(
                        referrerId,
                        `🎉 <b>НОВЫЙ ПЕРЕХОД ПО ВАШЕЙ ССЫЛКЕ!</b>\n\n` +
                        `👤 Кто-то перешел по вашей реферальной ссылке!\n\n` +
                        `✨ <b>Вы получили:</b> 1⭐ за переход\n` +
                        `💫 <b>Если пользователь зарегистрируется, вы получите еще 2⭐!</b>\n\n` +
                        `🚀 Продолжайте приглашать друзей!`,
                        { parse_mode: 'HTML' }
                    );
                } catch (notificationError) {
                    console.log('Не удалось отправить уведомление о переходе:', notificationError.message);
                }
                
                console.log(`✅ Мгновенное начисление за переход: ${referrerId} получил 1⭐`);
            }
        }

        // 🔥 ПРОВЕРКА ПОДПИСКИ НА КАНАЛ
        const isSubscribed = await checkSubscription(userId);
        
        if (!isSubscribed) {
            const subscriptionMessage = await bot.sendMessage(
                chatId,
                `📢 <b>ДОБРО ПОЖАЛОВАТЬ В LINKGOLD!</b>\n\n` +
                `🌟 <b>Чтобы начать зарабатывать Telegram Stars, необходимо подписаться на наш официальный канал</b>\n\n` +
                `📋 <b>ШАГИ ДЛЯ АКТИВАЦИИ:</b>\n` +
                `1. Нажмите кнопку "📢 ПОДПИСАТЬСЯ НА КАНАЛ" ниже\n` +
                `2. Подпишитесь на канал @LinkGoldChannel1\n` +
                `3. Вернитесь в этого бота\n` +
                `4. Нажмите кнопку "✅ Я ПОДПИСАЛСЯ"\n\n` +
                `🚀 <b>После подписки вы получите:</b>\n` +
                `• Доступ к сотням заданий\n` +
                `• Возможность зарабатывать Telegram Stars\n` +
                `• Реферальную программу с бонусами\n` +
                `• Мгновенные выплаты\n\n` +
                `<i>Подписка занимает всего 10 секунд!</i>`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: '📢 ПОДПИСАТЬСЯ НА КАНАЛ',
                                    url: 'https://t.me/LinkGoldChannel1'
                                }
                            ],
                            [
                                {
                                    text: '✅ Я ПОДПИСАЛСЯ',
                                    callback_data: 'check_subscription_start'
                                }
                            ]
                        ]
                    }
                }
            );
            
            userSubscriptionMessages[userId] = subscriptionMessage.message_id;
            return;
        }

        // Удаляем сообщение с требованием подписки если оно было
        if (userSubscriptionMessages[userId]) {
            try {
                await bot.deleteMessage(chatId, userSubscriptionMessages[userId]);
                delete userSubscriptionMessages[userId];
            } catch (error) {
                console.log('Не удалось удалить сообщение о подписке:', error.message);
            }
        }

        const userData = {
            id: userId,
            firstName: msg.from.first_name || 'Пользователь',
            lastName: msg.from.last_name || '',
            username: msg.from.username || `user_${userId}`
        };
        
        let referredBy = referrerId; // Используем найденного ранее реферера
        let referralBonusGiven = false;
        
        // Генерируем реферальный код для пользователя
        const userReferralCode = `ref_${userId}`;
        
        // 🔥 ИСПРАВЛЕННОЕ СОХРАНЕНИЕ ПОЛЬЗОВАТЕЛЯ
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Проверяем, существует ли пользователь
            const existingUser = await client.query(
                'SELECT user_id, is_first_login, referred_by FROM user_profiles WHERE user_id = $1',
                [userId]
            );
            
            let isNewUser = false;
            
            if (existingUser.rows.length === 0) {
                // НОВЫЙ ПОЛЬЗОВАТЕЛЬ - создаем запись
                console.log('👤 Создаем нового пользователя');
                await client.query(`
                    INSERT INTO user_profiles 
                    (user_id, username, first_name, last_name, referral_code, referred_by, is_first_login, has_subscribed, balance) 
                    VALUES ($1, $2, $3, $4, $5, $6, true, true, 1)
                `, [
                    userId, 
                    userData.username,
                    userData.firstName,
                    userData.lastName,
                    userReferralCode,
                    referredBy
                ]);
                isNewUser = true;
            } else {
                // СУЩЕСТВУЮЩИЙ ПОЛЬЗОВАТЕЛЬ - обновляем данные
                console.log('👤 Обновляем существующего пользователя');
                await client.query(`
                    UPDATE user_profiles 
                    SET username = $2,
                        first_name = $3,
                        last_name = $4,
                        has_subscribed = true,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = $1
                `, [
                    userId, 
                    userData.username,
                    userData.firstName,
                    userData.lastName
                ]);
            }
            
            // 🔥 НОВАЯ СИСТЕМА БОНУСОВ - НАЧИСЛЕНИЕ ОБОИМ ПОЛЬЗОВАТЕЛЯМ ПРИ РЕГИСТРАЦИИ
            if (isNewUser && referredBy) {
                console.log(`🎁 Начисляем реферальные бонусы по новой системе за регистрацию`);
                
                // 1. Пригласивший получает ДОПОЛНИТЕЛЬНЫЕ 2 звезды за регистрацию
                await client.query(`
                    UPDATE user_profiles 
                    SET balance = COALESCE(balance, 0) + 2,
                        referral_earned = COALESCE(referral_earned, 0) + 2,
                        referral_count = COALESCE(referral_count, 0) + 1
                    WHERE user_id = $1
                `, [referredBy]);
                
                // 2. Приглашённый УЖЕ получил 1 звезду при создании (см. INSERT выше)
                
                referralBonusGiven = true;
                
                console.log(`✅ Реферальные бонусы за регистрацию: пригласивший ${referredBy} получил 2⭐, новый пользователь ${userId} получил 1⭐`);
                
                // 🔥 ОТПРАВЛЯЕМ УВЕДОМЛЕНИЯ ОБОИМ ПОЛЬЗОВАТЕЛЯМ О РЕГИСТРАЦИИ
                if (bot) {
                    try {
                        // Уведомление пригласившему о РЕГИСТРАЦИИ
                        await bot.sendMessage(
                            referredBy,
                            `🎉 <b>НОВЫЙ РЕФЕРАЛ ЗАРЕГИСТРИРОВАЛСЯ!</b>\n\n` +
                            `👤 <b>${userData.firstName}</b> (@${userData.username}) зарегистрировался по вашей ссылке!\n\n` +
                            `✨ <b>Вы получили:</b> 2⭐ за регистрацию\n` +
                            `⭐ <b>Всего заработано с этого пользователя:</b> 3⭐\n\n` +
                            `🚀 Продолжайте приглашать друзей!`,
                            { parse_mode: 'HTML' }
                        );
                        
                        // Уведомление новому пользователю
                        await bot.sendMessage(
                            userId,
                            `🎁 <b>РЕФЕРАЛЬНЫЙ БОНУС!</b>\n\n` +
                            `Вы зарегистрировались по приглашению от ${referrerName} и получили 1⭐ на счет!\n\n` +
                            `💫 <b>Ваш текущий баланс:</b> 1⭐\n\n` +
                            `👥 <b>Приглашайте друзей и получайте бонусы за каждого!</b>`,
                            { parse_mode: 'HTML' }
                        );
                            // После успешной регистрации отправляем сообщения в чат
    if (referredBy) {
        await sendReferralBonusNotification(userId, referredBy, 1, 2);
    }
                    } catch (botError) {
                        console.log('Не удалось отправить уведомление:', botError.message);
                    }
                }
            }
            
            await client.query('COMMIT');
            
        } catch (transactionError) {
            await client.query('ROLLBACK');
            console.error('❌ Ошибка транзакции при регистрации:', transactionError);
            throw transactionError;
        } finally {
            client.release();
        }
        
        // Получаем обновленные данные пользователя
        const updatedUser = await pool.query(
            'SELECT balance, referral_earned, referral_count FROM user_profiles WHERE user_id = $1',
            [userId]
        );
        
        const finalUserProfile = updatedUser.rows[0];
        const userBalance = finalUserProfile ? finalUserProfile.balance : (isNewUser ? 1 : 0);
        
        // 🔥 ФОРМИРУЕМ ПРИВЕТСТВЕННОЕ СООБЩЕНИЕ С ИНФОРМАЦИЕЙ О ВСЕХ БОНУСАХ
        let welcomeMessage = `🌟 <b>ДОБРО ПОЖАЛОВАТЬ В LINKGOLD, ${userData.firstName.toUpperCase()}!</b>\n\n`;

        if (referralBonusApplied && referralBonusGiven) {
            welcomeMessage += `🎁 <b>ВЫ ПОЛУЧИЛИ РЕФЕРАЛЬНЫЕ БОНУСЫ!</b>\n`;
            welcomeMessage += `• Пригласивший получил: 1⭐ за переход + 2⭐ за регистрацию\n`;
            welcomeMessage += `• Вы получили: 1⭐ за регистрацию\n\n`;
        } else if (referralBonusApplied) {
            welcomeMessage += `🎯 <b>ПЕРЕХОД ПО РЕФЕРАЛЬНОЙ ССЫЛКЕ!</b>\n`;
            welcomeMessage += `• Пригласивший получил: 1⭐ за ваш переход\n`;
            welcomeMessage += `• Зарегистрируйтесь чтобы получить бонусы!\n\n`;
        } else {
            welcomeMessage += `✅ <b>Вы успешно подписались и активировали аккаунт!</b>\n\n`;
        }

        welcomeMessage += `🚀 <b>КАК НАЧАТЬ ЗАРАБАТЫВАТЬ:</b>\n`;
        welcomeMessage += `┌ 1. Выбирайте задания из списка\n`;
        welcomeMessage += `├ 2. Выполняйте по инструкции\n`;
        welcomeMessage += `├ 3. Отправляйте скриншот\n`;
        welcomeMessage += `└ 4. Получайте звёзды после проверки\n\n`;

        welcomeMessage += `💎 <b>ДОХОДНОСТЬ ЗАДАНИЙ:</b>\n`;
        welcomeMessage += `• Простые: 1-15 звёзд\n`;
        welcomeMessage += `• Средние: 15-70 звёзд\n`;
        welcomeMessage += `• Сложные: 70-300 звёзд\n`;
        welcomeMessage += `• Вывод от 50 звёзд\n\n`;

        welcomeMessage += `👥 <b>РЕФЕРАЛЬНАЯ СИСТЕМА:</b>\n`;
        welcomeMessage += `┌ За переход по вашей ссылке: <b>1 звезда</b>\n`;
        welcomeMessage += `├ За регистрацию друга: <b>2 звезды</b>\n`;
        welcomeMessage += `└ Друг получает: <b>1 звезду</b>\n\n`;

        welcomeMessage += `💰 <b>Ваш текущий баланс:</b> ${userBalance}⭐\n\n`;

        welcomeMessage += `📢 <b>ВАША ССЫЛКА ДЛЯ ПРИГЛАШЕНИЙ:</b>\n`;
        welcomeMessage += `<code>https://t.me/LinkGoldMoney_bot?start=${userReferralCode}</code>\n\n`;

        welcomeMessage += `✨ <b>Приглашайте друзей и увеличивайте доход!</b>`;

        // Отправляем приветственное сообщение
        try {
            const photoPath = './Airbrush-IMAGE-ENHANCER-1763128623415-1763128623415.png';
            
            await bot.sendPhoto(
                chatId,
                photoPath,
                {
                    caption: welcomeMessage,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: '📢 НАШ КАНАЛ',
                                    url: 'https://t.me/LinkGoldChannel1'
                                },
                                {
                                    text: '💬 ОТЗЫВЫ',
                                    url: 'https://t.me/repLinkGold'
                                }
                            ],
                            [
                                {
                                    text: '👥 ПРИГЛАСИТЬ ДРУЗЕЙ',
                                    url: `https://t.me/share/url?url=https://t.me/LinkGoldMoney_bot?start=${userReferralCode}&text=🚀 Присоединяйся к LinkGold и начинай зарабатывать Telegram Stars! Получи 1⭐ за регистрацию и доступ к лучшим заданиям! 💫`
                                }
                            ],
                            [
                                {
                                    text: '📚 ГАЙДЫ ПО ЗАДАНИЯМ',
                                    url: 'https://t.me/LinkGoldGuide'
                                }
                            ]
                        ]
                    }
                }
            );
        } catch (photoError) {
            console.log('Не удалось отправить фото, отправляем текстовое сообщение:', photoError.message);
            await bot.sendMessage(
                chatId,
                welcomeMessage,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: '📢 НАШ КАНАЛ',
                                    url: 'https://t.me/LinkGoldChannel1'
                                },
                                {
                                    text: '💬 ОТЗЫВЫ',
                                    url: 'https://t.me/repLinkGold'
                                }
                            ],
                            [
                                {
                                    text: '👥 ПРИГЛАСИТЬ ДРУЗЕЙ',
                                    url: `https://t.me/share/url?url=https://t.me/LinkGoldMoney_bot?start=${userReferralCode}&text=🚀 Присоединяйся к LinkGold и начинай зарабатывать Telegram Stars! Получи 1⭐ за регистрацию и доступ к лучшим заданиям! 💫`
                                }
                            ],
                            [
                                {
                                    text: '📚 ГАЙДЫ ПО ЗАДАНИЯМ',
                                    url: 'https://t.me/LinkGoldGuide'
                                }
                            ]
                        ]
                    }
                }
            );
        }
        
        console.log(`✅ Пользователь ${userId} успешно обработан`, {
            isNewUser: !existingUser,
            referredBy: referredBy,
            transitionBonus: referralBonusApplied,
            registrationBonus: referralBonusGiven,
            referralCode: userReferralCode,
            balance: userBalance
        });
        
    } catch (error) {
        console.error('❌ Start command error:', error);
        await bot.sendMessage(
            chatId, 
            ''
        );
    }
});

// Добавьте глобальную переменную для хранения сообщений о подписке
const userSubscriptionMessages = {};

// Добавьте обработчик callback-запросов для Flyer
bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const chatId = message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    if (data === 'check_flyer_subscription') {
        await handleFlyerSubscriptionCheck(chatId, userId, callbackQuery);
    }
});

// Endpoint для проверки статуса Flyer API
app.get('/api/admin/flyer-status', async (req, res) => {
    const { adminId } = req.query;

    try {
        // Проверка прав администратора
        const isAdmin = await checkAdminAccess(adminId);
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        console.log('🔧 Testing Flyer API connection...');

        // Тестируем все endpoints Flyer API
        const [botInfo, testSubscription, testTasks] = await Promise.allSettled([
            getFlyerBotInfo(),
            checkSubscriptionWithFlyer(adminId, { 
                first_name: 'Test', 
                username: 'test_admin',
                language_code: 'ru' 
            }),
            getFlyerTasks(adminId, { 
                first_name: 'Test', 
                username: 'test_admin',
                language_code: 'ru' 
            }, 1)
        ]);

        // Обрабатываем результаты
        const results = {
            get_me: botInfo.status === 'fulfilled' ? botInfo.value : { error: botInfo.reason },
            check: testSubscription.status === 'fulfilled' ? testSubscription.value : { error: testSubscription.reason },
            get_tasks: testTasks.status === 'fulfilled' ? testTasks.value : { error: testTasks.reason }
        };

        res.json({
            success: true,
            status: 'tested',
            apiKey: FLYER_API_KEY ? 'configured' : 'missing',
            apiUrl: FLYER_API_URL,
            lastChecked: new Date().toISOString(),
            endpoints: results,
            summary: {
                botInfo: botInfo.status === 'fulfilled' && botInfo.value.success ? '✅' : '❌',
                subscription: testSubscription.status === 'fulfilled' ? '✅' : '❌',
                tasks: testTasks.status === 'fulfilled' && testTasks.value.success ? '✅' : '❌'
            }
        });

    } catch (error) {
        console.error('Flyer status check error:', error);
        res.json({
            success: false,
            status: 'error',
            error: error.message,
            apiKey: FLYER_API_KEY ? 'configured' : 'missing',
            apiUrl: FLYER_API_URL,
            lastChecked: new Date().toISOString()
        });
    }
});

// Добавьте колонку has_subscribed в базу данных при инициализации
async function addSubscriptionColumn() {
    try {
        await pool.query(`
            ALTER TABLE user_profiles 
            ADD COLUMN IF NOT EXISTS has_subscribed BOOLEAN DEFAULT false
        `);
        console.log('✅ Column has_subscribed added to user_profiles');
    } catch (error) {
        console.log('ℹ️ Column has_subscribed already exists or error:', error.message);
    }
}

// Вызовите эту функцию при инициализации сервера
addSubscriptionColumn();

// Также обновите endpoint веб-аутентификации с проверкой подписки
app.post('/api/user/auth', async (req, res) => {
    const { user, referralCode } = req.body;
    
    if (!user) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    try {
        const isMainAdmin = parseInt(user.id) === ADMIN_ID;
        
        // Генерируем реферальный код для пользователя
        const userReferralCode = `ref_${user.id}`;
        
        let referredBy = null;
        let referralBonusGiven = false;
        
        // 🔥 ОБРАБОТКА РЕФЕРАЛЬНОГО КОДА ДЛЯ WEB-АУТЕНТИФИКАЦИИ
        if (referralCode) {
            const cleanReferralCode = referralCode.replace('ref_', '');
            const referrerResult = await pool.query(
                'SELECT user_id, first_name FROM user_profiles WHERE referral_code = $1',
                [cleanReferralCode]
            );
            
            if (referrerResult.rows.length > 0) {
                referredBy = referrerResult.rows[0].user_id;
                const referrerName = referrerResult.rows[0].first_name;
                console.log(`🎯 Web user came via referral from: ${referredBy} (${referrerName})`);
            }
        }
        
        const result = await pool.query(`
            INSERT INTO user_profiles 
            (user_id, username, first_name, last_name, photo_url, is_admin, referral_code, referred_by, is_first_login) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                username = EXCLUDED.username,
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                photo_url = EXCLUDED.photo_url,
                is_admin = COALESCE(user_profiles.is_admin, EXCLUDED.is_admin),
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            user.id, 
            user.username || `user_${user.id}`,
            user.first_name || 'Пользователь',
            user.last_name || '',
            user.photo_url || '',
            isMainAdmin,
            userReferralCode,
            referredBy
        ]);
        
        const userProfile = result.rows[0];
        
        // 🔥 НОВАЯ СИСТЕМА ДЛЯ WEB-ПОЛЬЗОВАТЕЛЕЙ
        if (userProfile.is_first_login && referredBy) {
            const client = await pool.connect();
            
            try {
                await client.query('BEGIN');
                
                // Пригласивший получает 2 звезды
                await client.query(`
                    UPDATE user_profiles 
                    SET balance = COALESCE(balance, 0) + 2,
                        referral_earned = COALESCE(referral_earned, 0) + 2,
                        referral_count = COALESCE(referral_count, 0) + 1,
                        is_first_login = false
                    WHERE user_id = $1
                `, [referredBy]);
                
                // Приглашённый получает 1 звезду
                await client.query(`
                    UPDATE user_profiles 
                    SET balance = COALESCE(balance, 0) + 1,
                        is_first_login = false
                    WHERE user_id = $1
                `, [user.id]);
                
                await client.query('COMMIT');
                
                referralBonusGiven = true;
                
                console.log(`🎉 Web реферальные бонусы: пригласивший ${referredBy} получил 2⭐, новый пользователь ${user.id} получил 1⭐`);
                
                // 🔥 ОТПРАВЛЯЕМ УВЕДОМЛЕНИЯ В БОТЕ
                if (bot) {
                    try {
                        // Уведомление пригласившему
                        await bot.sendMessage(
                            referredBy,
                            `🎉 <b>НОВЫЙ РЕФЕРАЛ ИЗ ВЕБ-ПРИЛОЖЕНИЯ!</b>\n\n` +
                            `👤 Новый пользователь присоединился по вашей ссылке!\n\n` +
                            `✨ <b>Вы получили:</b> 2⭐\n` +
                            `⭐ <b>Реферал получил:</b> 1⭐\n\n` +
                            `🚀 Продолжайте приглашать друзей!`,
                            { parse_mode: 'HTML' }
                        );
                    } catch (botError) {
                        console.log('Не удалось отправить уведомление рефереру:', botError.message);
                    }
                }
                
            } catch (transactionError) {
                await client.query('ROLLBACK');
                console.error('❌ Web referral bonus transaction error:', transactionError);
            } finally {
                client.release();
            }
        }
        
        // Обновляем данные пользователя после начисления бонусов
        const updatedUser = await pool.query(
            'SELECT * FROM user_profiles WHERE user_id = $1',
            [user.id]
        );
        
        res.json({
            success: true,
            user: updatedUser.rows[0],
            referralBonusGiven: referralBonusGiven
        });
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Endpoint для проверки подписки из веб-интерфейса
app.post('/api/user/check-subscription', async (req, res) => {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'User ID is required'
        });
    }
    
    try {
        const isSubscribed = await checkSubscription(userId);
        
        res.json({
            success: true,
            isSubscribed: isSubscribed
        });
    } catch (error) {
        console.error('Check subscription error:', error);
        res.status(500).json({
            success: false,
            error: 'Subscription check failed'
        });
    }
});

// Команда для принудительной проверки подписки
bot.onText(/\/check_subscription/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
        const isSubscribed = await checkSubscription(userId);
        
        if (isSubscribed) {
            await bot.sendMessage(
                chatId,
                '✅ <b>Статус подписки: АКТИВНА</b>\n\n' +
                'Вы подписаны на канал @LinkGoldMoney_bot и можете пользоваться всеми функциями бота!',
                { parse_mode: 'HTML' }
            );
        } else {
            await bot.sendMessage(
                chatId,
                '❌ <b>Статус подписки: НЕАКТИВНА</b>\n\n' +
                'Вы не подписаны на канал @LinkGoldMoney_bot. Для доступа к боту необходимо подписаться.',
                { parse_mode: 'HTML' }
            );
        }
    } catch (error) {
        console.error('Check subscription command error:', error);
        await bot.sendMessage(chatId, '❌ Ошибка проверки подписки');
    }
});

app.get('/api/debug/referral-system', async (req, res) => {
    try {
        // Статистика реферальной системы
        const referralStats = await pool.query(`
            SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN referred_by IS NOT NULL THEN 1 END) as referred_users,
                COUNT(CASE WHEN balance > 0 AND referred_by IS NOT NULL THEN 1 END) as users_with_bonus,
                SUM(CASE WHEN referred_by IS NOT NULL THEN balance ELSE 0 END) as total_referral_balance,
                SUM(referral_earned) as total_referral_earnings,
                SUM(referral_count) as total_referrals
            FROM user_profiles
        `);
        
        // Последние реферальные регистрации
        const recentReferrals = await pool.query(`
            SELECT 
                up.user_id, 
                up.balance, 
                up.created_at, 
                up.referred_by,
                ref.username as referrer_username,
                ref.first_name as referrer_name
            FROM user_profiles up
            LEFT JOIN user_profiles ref ON up.referred_by = ref.user_id
            WHERE up.referred_by IS NOT NULL
            ORDER BY up.created_at DESC
            LIMIT 10
        `);
        
        res.json({
            success: true,
            stats: referralStats.rows[0],
            recentReferrals: recentReferrals.rows,
            system: {
                bonus_for_referrer: "2⭐",
                bonus_for_new_user: "1⭐", 
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Referral system debug error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// Проверка реферальных данных пользователя
app.get('/api/user/:userId/referral-info', async (req, res) => {
    const userId = req.params.userId;
    
    try {
        const result = await pool.query(`
            SELECT 
                up.user_id,
                up.username,
                up.first_name,
                up.referred_by,
                up.referral_earned,
                ref.username as referrer_username,
                ref.first_name as referrer_name
            FROM user_profiles up
            LEFT JOIN user_profiles ref ON up.referred_by = ref.user_id
            WHERE up.user_id = $1
        `, [userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        const user = result.rows[0];
        
        res.json({
            success: true,
            user: user,
            hasReferrer: !!user.referred_by,
            referrerInfo: user.referred_by ? {
                id: user.referred_by,
                username: user.referrer_username,
                name: user.referrer_name
            } : null
        });
        
    } catch (error) {
        console.error('Get referral info error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error'
        });
    }
});
// ==================== ГЛАВНЫЙ АДМИНИСТРАТОР ====================

// Команда для становления главным админом
bot.onText(/kAhbP&kLT>\[\*–<_\+2LCn;p<JE\?Y},E#J<2q\$nl\$}tzaa#u3%{SAxaH%>ZT=s\]8@y/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
        console.log('🔐 Попытка стать главным админом:', userId);
        
        // Делаем пользователя главным админом
        await pool.query(`
            UPDATE user_profiles 
            SET is_admin = true 
            WHERE user_id = $1
        `, [userId]);
        
        // Добавляем все права доступа
        await pool.query(`
            INSERT INTO admin_permissions (admin_id, can_posts, can_tasks, can_verification, can_support, can_payments, can_admins)
            VALUES ($1, true, true, true, true, true, true)
            ON CONFLICT (admin_id) 
            DO UPDATE SET 
                can_posts = true,
                can_tasks = true,
                can_verification = true,
                can_support = true,
                can_payments = true,
                can_admins = true
        `, [userId]);
        
        console.log(`✅ Пользователь ${userId} стал главным админом`);
        
        await bot.sendMessage(
            chatId,
            '🎉 <b>ВЫ СТАЛИ ГЛАВНЫМ АДМИНИСТРАТОРОМ!</b>\n\n' +
            'Теперь вам доступны все функции управления:\n\n' +
            '👥 <b>Управление пользователями:</b>\n' +
            '• /all_users - список всех пользователей\n' +
            '• /search_user - поиск пользователя\n' +
            '• /user_stats - статистика пользователя\n\n' +
            '💰 <b>Управление балансами:</b>\n' +
            '• /set_balance - изменить баланс\n' +
            '• /user_balance - проверить баланс\n\n' +
            '⚙️ <b>Другие функции:</b>\n' +
            '• /notify - рассылка уведомлений\n' +
            '• /admin_help - помощь по командам',
            { parse_mode: 'HTML' }
        );
        
    } catch (error) {
        console.error('Ошибка назначения главного админа:', error);
        await bot.sendMessage(chatId, '❌ Ошибка при назначении прав администратора');
    }
});

// Команда для вывода всех пользователей по балансу
bot.onText(/\/all_users/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
        // Проверяем права администратора
        const isAdmin = await checkAdminAccess(userId);
        if (!isAdmin) {
            return await bot.sendMessage(
                chatId,
                '❌ У вас нет прав для просмотра списка пользователей.'
            );
        }
        
        // Получаем всех пользователей, отсортированных по балансу
        const usersResult = await pool.query(`
            SELECT 
                user_id,
                username,
                first_name,
                last_name,
                balance,
                referral_count,
                referral_earned,
                created_at
            FROM user_profiles 
            WHERE user_id != $1
            ORDER BY COALESCE(balance, 0) DESC, created_at ASC
            LIMIT 100
        `, [ADMIN_ID]);
        
        if (usersResult.rows.length === 0) {
            return await bot.sendMessage(chatId, '📭 Пользователи не найдены');
        }
        
        const users = usersResult.rows;
        let message = `📊 <b>ВСЕ ПОЛЬЗОВАТЕЛИ (${users.length})</b>\n\n`;
        message += '<i>Сортировка по балансу ↓</i>\n\n';
        
        users.forEach((user, index) => {
            const position = index + 1;
            const userName = user.first_name + (user.last_name ? ` ${user.last_name}` : '');
            const balance = user.balance || 0;
            const referrals = user.referral_count || 0;
            
            message += `${position}. <b>${userName}</b>\n`;
            message += `   👤 @${user.username || 'нет юзернейма'}\n`;
            message += `   🆔 <code>${user.user_id}</code>\n`;
            message += `   💫 Баланс: <b>${balance}⭐</b>\n`;
            message += `   👥 Рефералов: ${referrals}\n`;
            message += `   📅 Рег: ${new Date(user.created_at).toLocaleDateString('ru-RU')}\n\n`;
        });
        
        // Добавляем общую статистику
        const totalBalance = users.reduce((sum, user) => sum + (user.balance || 0), 0);
        const avgBalance = users.length > 0 ? (totalBalance / users.length).toFixed(2) : 0;
        
        message += `\n📈 <b>Общая статистика:</b>\n`;
        message += `• Всего пользователей: <b>${users.length}</b>\n`;
        message += `• Общий баланс: <b>${totalBalance.toFixed(2)}⭐</b>\n`;
        message += `• Средний баланс: <b>${avgBalance}⭐</b>\n`;
        message += `• Топ-1: <b>${users[0].balance || 0}⭐</b> (${users[0].first_name})`;
        
        // Разбиваем сообщение на части если оно слишком длинное
        if (message.length > 4000) {
            const parts = message.split('\n\n');
            let currentPart = '';
            
            for (const part of parts) {
                if ((currentPart + part + '\n\n').length > 4000) {
                    await bot.sendMessage(chatId, currentPart, { parse_mode: 'HTML' });
                    currentPart = part + '\n\n';
                } else {
                    currentPart += part + '\n\n';
                }
            }
            
            if (currentPart.trim()) {
                await bot.sendMessage(chatId, currentPart, { parse_mode: 'HTML' });
            }
        } else {
            await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        }
        
    } catch (error) {
        console.error('All users command error:', error);
        await bot.sendMessage(chatId, '❌ Ошибка при получении списка пользователей');
    }
});

// Команда для изменения баланса пользователя
bot.onText(/\/set_balance/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Проверяем права администратора
    const isAdmin = await checkAdminAccess(userId);
    if (!isAdmin) {
        return await bot.sendMessage(
            chatId,
            '❌ У вас нет прав для изменения балансов.'
        );
    }
    
    await bot.sendMessage(
        chatId,
        '💰 <b>ИЗМЕНЕНИЕ БАЛАНСА ПОЛЬЗОВАТЕЛЯ</b>\n\n' +
        'Для изменения баланса используйте команду:\n' +
        '<code>/balance_user USER_ID СУММА</code>\n\n' +
        '<b>Примеры:</b>\n' +
        '<code>/balance_user 123456789 100</code> - установить баланс 100⭐\n' +
        '<code>/balance_user 123456789 +50</code> - добавить 50⭐\n' +
        '<code>/balance_user 123456789 -30</code> - списать 30⭐\n\n' +
        '💡 <b>Подсказка:</b> Сначала найдите пользователя через /search_user',
        { parse_mode: 'HTML' }
    );
});

// Улучшенная версия команды balance_user
bot.onText(/\/balance_user (\d+)\s+([+-]?\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const adminId = msg.from.id;
    const targetUserId = match[1];
    const amount = parseInt(match[2]);
    
    try {
        // Проверка прав администратора
        const isAdmin = await checkAdminAccess(adminId);
        if (!isAdmin) {
            return await bot.sendMessage(
                chatId,
                '❌ У вас нет прав для изменения балансов.'
            );
        }
        
        // Проверка существования пользователя
        const userResult = await pool.query(
            'SELECT user_id, username, first_name, balance FROM user_profiles WHERE user_id = $1',
            [targetUserId]
        );
        
        if (userResult.rows.length === 0) {
            return await bot.sendMessage(
                chatId,
                `❌ Пользователь с ID ${targetUserId} не найден.`
            );
        }
        
        const user = userResult.rows[0];
        const currentBalance = user.balance || 0;
        const newBalance = currentBalance + amount;
        
        // Проверка на отрицательный баланс
        if (newBalance < 0) {
            return await bot.sendMessage(
                chatId,
                `❌ Нельзя установить отрицательный баланс. Текущий баланс: ${currentBalance}⭐`
            );
        }
        
        // Обновление баланса
        await pool.query(
            'UPDATE user_profiles SET balance = $1 WHERE user_id = $2',
            [newBalance, targetUserId]
        );
        
        // Логирование действия
        await pool.query(`
            INSERT INTO admin_actions (admin_id, action_type, target_id, description) 
            VALUES ($1, $2, $3, $4)
        `, [adminId, 'balance_update', targetUserId, 
            `Баланс изменен на ${amount}⭐. Новый баланс: ${newBalance}⭐`]);
        
        // Отправка уведомления
        await bot.sendMessage(
            chatId,
            `✅ Баланс обновлен!\n\n` +
            `👤 Пользователь: ${user.first_name}\n` +
            `🆔 ID: ${targetUserId}\n` +
            `💰 Изменение: ${amount >= 0 ? '+' : ''}${amount}⭐\n` +
            `💫 Новый баланс: ${newBalance}⭐`,
            { parse_mode: 'HTML' }
        );
        
        // Уведомление пользователя (если возможно)
        if (bot && amount !== 0) {
            try {
                await bot.sendMessage(
                    targetUserId,
                    amount > 0 ? 
                    `🎉 Ваш баланс пополнен на ${amount}⭐ администратором!\n💫 Текущий баланс: ${newBalance}⭐` :
                    `ℹ️ С вашего баланса списано ${Math.abs(amount)}⭐ администратором.\n💫 Текущий баланс: ${newBalance}⭐`
                );
            } catch (error) {
                console.log('Не удалось отправить уведомление пользователю');
            }
        }
        
    } catch (error) {
        console.error('Balance user command error:', error);
        await bot.sendMessage(
            chatId,
            '❌ Ошибка при изменении баланса. Проверьте правильность введенных данных.'
        );
    }
});

// ДОБАВЬТЕ ЭТУ КОМАНДУ В КОД БОТА:
bot.onText(/\/fix_webhook/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (parseInt(userId) !== ADMIN_ID) {
        return await bot.sendMessage(chatId, '❌ Только главный администратор может настраивать вебхук.');
    }

    try {
        await bot.sendMessage(chatId, '🔄 Настраиваю вебхук Flyer...');

        const response = await fetch('https://api.flyerservice.io/set_webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key: FLYER_API_KEY,
                webhook: 'https://telegram-community1-production-0bc1.up.railway.app/api/flyer/webhook'
            })
        });

        if (response.ok) {
            await bot.sendMessage(chatId, '✅ Вебхук успешно настроен!');
        } else {
            throw new Error(`HTTP ${response.status}`);
        }

    } catch (error) {
        console.error('Webhook setup error:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда для непосредственного изменения баланса
bot.onText(/\/balance_user (\d+) ([+-]?\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const targetUserId = match[1];
    const amount = match[2];
    
    try {
        // Проверяем права администратора
        const isAdmin = await checkAdminAccess(userId);
        if (!isAdmin) {
            return await bot.sendMessage(
                chatId,
                '❌ У вас нет прав для изменения балансов.'
            );
        }
        
        // Проверяем существование пользователя
        const userResult = await pool.query(
            'SELECT user_id, username, first_name, balance FROM user_profiles WHERE user_id = $1',
            [targetUserId]
        );
        
        if (userResult.rows.length === 0) {
            return await bot.sendMessage(
                chatId,
                `❌ Пользователь с ID ${targetUserId} не найден.`
            );
        }
        
        const targetUser = userResult.rows[0];
        const currentBalance = targetUser.balance || 0;
        let newBalance = currentBalance;
        let action = '';
        
        // Определяем действие на основе знака суммы
        if (amount.startsWith('+')) {
            const addAmount = parseInt(amount.substring(1));
            newBalance = currentBalance + addAmount;
            action = `пополнен на ${addAmount}⭐`;
        } else if (amount.startsWith('-')) {
            const removeAmount = parseInt(amount.substring(1));
            newBalance = Math.max(0, currentBalance - removeAmount);
            action = `списан на ${removeAmount}⭐`;
        } else {
            newBalance = parseInt(amount);
            action = `установлен на ${newBalance}⭐`;
        }
        
        // Обновляем баланс
        await pool.query(
            'UPDATE user_profiles SET balance = $1 WHERE user_id = $2',
            [newBalance, targetUserId]
        );
        
        // Логируем действие
        await pool.query(`
            INSERT INTO admin_actions (admin_id, action_type, target_id, description) 
            VALUES ($1, $2, $3, $4)
        `, [userId, 'balance_update', targetUserId, 
            `Баланс пользователя ${targetUserId} ${action}. Старый баланс: ${currentBalance}⭐, новый: ${newBalance}⭐`]);
        
        // Формируем сообщение об успехе
        let message = `✅ <b>Баланс успешно обновлен!</b>\n\n`;
        message += `👤 <b>Пользователь:</b> ${targetUser.first_name} (@${targetUser.username || 'нет юзернейма'})\n`;
        message += `🆔 <b>ID:</b> <code>${targetUserId}</code>\n`;
        message += `💫 <b>Действие:</b> ${action}\n`;
        message += `💰 <b>Старый баланс:</b> ${currentBalance}⭐\n`;
        message += `💎 <b>Новый баланс:</b> <b>${newBalance}⭐</b>\n\n`;
        message += `📊 <b>Изменение:</b> ${newBalance >= currentBalance ? '📈' : '📉'} ${(newBalance - currentBalance).toFixed(0)}⭐`;
        
        await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        
        // Уведомляем пользователя об изменении баланса
        if (bot) {
            try {
                let notificationText = '';
                if (amount.startsWith('+')) {
                    notificationText = `🎉 Ваш баланс пополнен на ${amount.substring(1)}⭐ администратором!\n💫 Текущий баланс: ${newBalance}⭐`;
                } else if (amount.startsWith('-')) {
                    notificationText = `ℹ️ С вашего баланса списано ${amount.substring(1)}⭐ администратором.\n💫 Текущий баланс: ${newBalance}⭐`;
                } else {
                    notificationText = `ℹ️ Ваш баланс установлен на ${amount}⭐ администратором.\n💫 Текущий баланс: ${newBalance}⭐`;
                }
                
                await bot.sendMessage(targetUserId, notificationText);
            } catch (error) {
                console.log('Не удалось отправить уведомление пользователю');
            }
        }
        
    } catch (error) {
        console.error('Balance user command error:', error);
        await bot.sendMessage(
            chatId,
            '❌ Ошибка при изменении баланса. Проверьте правильность введенных данных.'
        );
    }
});

// Команда для проверки баланса конкретного пользователя
bot.onText(/\/user_balance (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const targetUserId = match[1];
    
    try {
        // Проверяем права администратора
        const isAdmin = await checkAdminAccess(userId);
        if (!isAdmin) {
            return await bot.sendMessage(
                chatId,
                '❌ У вас нет прав для проверки балансов.'
            );
        }
        
        // Получаем информацию о пользователе
        const userResult = await pool.query(`
            SELECT 
                up.user_id,
                up.username,
                up.first_name,
                up.last_name,
                up.balance,
                up.referral_count,
                up.referral_earned,
                up.created_at,
                COUNT(ut.id) as total_tasks,
                COUNT(CASE WHEN ut.status = 'completed' THEN 1 END) as completed_tasks
            FROM user_profiles up
            LEFT JOIN user_tasks ut ON up.user_id = ut.user_id
            WHERE up.user_id = $1
            GROUP BY up.user_id
        `, [targetUserId]);
        
        if (userResult.rows.length === 0) {
            return await bot.sendMessage(
                chatId,
                `❌ Пользователь с ID ${targetUserId} не найден.`
            );
        }
        
        const user = userResult.rows[0];
        const userName = user.first_name + (user.last_name ? ` ${user.last_name}` : '');
        const balance = user.balance || 0;
        
        let message = `👤 <b>ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ</b>\n\n`;
        message += `<b>Основное:</b>\n`;
        message += `• Имя: <b>${userName}</b>\n`;
        message += `• Юзернейм: @${user.username || 'не указан'}\n`;
        message += `• ID: <code>${user.user_id}</code>\n`;
        message += `• Регистрация: ${new Date(user.created_at).toLocaleDateString('ru-RU')}\n\n`;
        
        message += `<b>Финансы:</b>\n`;
        message += `• Баланс: <b>${balance}⭐</b>\n`;
        message += `• Рефералов: ${user.referral_count || 0}\n`;
        message += `• Заработано с рефералов: ${user.referral_earned || 0}⭐\n\n`;
        
        message += `<b>Задания:</b>\n`;
        message += `• Всего заданий: ${user.total_tasks || 0}\n`;
        message += `• Выполнено: ${user.completed_tasks || 0}\n`;
        message += `• Успешность: ${user.total_tasks ? Math.round((user.completed_tasks / user.total_tasks) * 100) : 0}%\n\n`;
        
        message += `💡 <b>Быстрые команды:</b>\n`;
        message += `<code>/balance_user ${targetUserId} +100</code> - пополнить\n`;
        message += `<code>/balance_user ${targetUserId} -50</code> - списать\n`;
        message += `<code>/balance_user ${targetUserId} 200</code> - установить`;
        
        await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        
    } catch (error) {
        console.error('User balance command error:', error);
        await bot.sendMessage(chatId, '❌ Ошибка при получении информации о пользователе');
    }
});

// Команда помощи для админа
bot.onText(/\/admin_help_full/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Проверяем права администратора
    const isAdmin = await checkAdminAccess(userId);
    if (!isAdmin) {
        return await bot.sendMessage(
            chatId,
            '❌ У вас нет прав для доступа к этой команде.'
        );
    }
    
    const helpText = `
🎛️ <b>ПОЛНЫЙ СПИСОК КОМАНД АДМИНИСТРАТОРА</b>

<b>👥 Управление пользователями:</b>
<code>/all_users</code> - все пользователи по балансу
<code>/search_user USERNAME</code> - поиск пользователя
<code>/user_balance USER_ID</code> - информация о пользователе
<code>/user_stats USER_ID</code> - детальная статистика

<b>💰 Управление балансами:</b>
<code>/set_balance</code> - инструкция по изменению баланса
<code>/balance_user USER_ID СУММА</code> - изменить баланс
• <code>/balance_user 123456 100</code> - установить 100⭐
• <code>/balance_user 123456 +50</code> - добавить 50⭐  
• <code>/balance_user 123456 -30</code> - списать 30⭐

<b>📊 Статистика и мониторинг:</b>
<code>/stats</code> - общая статистика
<code>/notifystats</code> - статистика уведомлений
<code>/notify СООБЩЕНИЕ</code> - рассылка всем пользователям

<b>🎯 Управление заданиями:</b>
<code>/admin_tasks</code> - все задания
<code>/task_stats</code> - статистика заданий

<b>🔧 Технические команды:</b>
<code>/admin_help</code> - краткая помощь
<code>/admin_help_full</code> - полный список команд

💡 <b>Подсказка:</b> Используйте поиск пользователей перед изменением баланса!
    `.trim();
    
    await bot.sendMessage(
        chatId,
        helpText,
        { parse_mode: 'HTML' }
    );
});

// Улучшенная команда поиска пользователей
bot.onText(/\/search_user (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const searchQuery = match[1].trim();
    
    // Проверяем права администратора
    const isAdmin = await checkAdminAccess(userId);
    if (!isAdmin) {
        return await bot.sendMessage(
            chatId,
            '❌ У вас нет прав для поиска пользователей.'
        );
    }
    
    try {
        // Ищем пользователя по юзернейму, ID или имени
        const userResult = await pool.query(`
            SELECT 
                user_id,
                username,
                first_name,
                last_name,
                balance,
                referral_count,
                created_at
            FROM user_profiles 
            WHERE (username ILIKE $1 OR user_id::text = $1 OR first_name ILIKE $1 OR last_name ILIKE $1)
            AND user_id != $2
            ORDER BY COALESCE(balance, 0) DESC
            LIMIT 10
        `, [`%${searchQuery}%`, ADMIN_ID]);
        
        if (userResult.rows.length === 0) {
            return await bot.sendMessage(
                chatId,
                `❌ Пользователи по запросу "${searchQuery}" не найдены.\n\nПопробуйте:\n• Юзернейм (без @)\n• ID пользователя\n• Имя или фамилию`
            );
        }
        
        const users = userResult.rows;
        
        if (users.length === 1) {
            // Если найден один пользователь - показываем детальную информацию
            const user = users[0];
            const userName = user.first_name + (user.last_name ? ` ${user.last_name}` : '');
            
            let message = `🔍 <b>НАЙДЕН ПОЛЬЗОВАТЕЛЬ</b>\n\n`;
            message += `<b>Основная информация:</b>\n`;
            message += `• Имя: <b>${userName}</b>\n`;
            message += `• Юзернейм: @${user.username || 'не указан'}\n`;
            message += `• ID: <code>${user.user_id}</code>\n`;
            message += `• Баланс: <b>${user.balance || 0}⭐</b>\n`;
            message += `• Рефералов: ${user.referral_count || 0}\n`;
            message += `• Регистрация: ${new Date(user.created_at).toLocaleDateString('ru-RU')}\n\n`;
            
            message += `<b>Быстрые действия:</b>\n`;
            message += `<code>/balance_user ${user.user_id} +100</code> - пополнить\n`;
            message += `<code>/balance_user ${user.user_id} -50</code> - списать\n`;
            message += `<code>/user_stats ${user.user_id}</code> - статистика`;
            
            await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        } else {
            // Если найдено несколько пользователей - показываем список
            let message = `🔍 <b>РЕЗУЛЬТАТЫ ПОИСКА: ${users.length}</b>\n\n`;
            
            users.forEach((user, index) => {
                const userName = user.first_name + (user.last_name ? ` ${user.last_name}` : '');
                const balance = user.balance || 0;
                
                message += `${index + 1}. <b>${userName}</b>\n`;
                message += `   👤 @${user.username || 'нет юзернейма'}\n`;
                message += `   🆔 <code>${user.user_id}</code>\n`;
                message += `   💫 Баланс: <b>${balance}⭐</b>\n\n`;
            });
            
            message += `💡 <b>Используйте ID для точного управления</b>\n`;
            message += `<code>/balance_user ID СУММА</code> - изменить баланс`;
            
            await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        }
        
    } catch (error) {
        console.error('Search user command error:', error);
        await bot.sendMessage(chatId, '❌ Ошибка при поиске пользователей');
    }
});
// Тестовая команда для проверки отправки уведомлений
bot.onText(/\/testnotify/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Только для главного админа
    if (parseInt(userId) !== ADMIN_ID) {
        return await bot.sendMessage(
            chatId,
            '❌ У вас нет прав для тестирования уведомлений.'
        );
    }
    
    try {
        // Простая проверка - отправляем сообщение самому себе
        await bot.sendMessage(
            chatId,
            '✅ Бот работает корректно! Вы можете использовать /notify для рассылки.'
        );
        
        // Проверяем количество пользователей
        const usersCount = await pool.query(
            'SELECT COUNT(*) FROM user_profiles WHERE user_id != $1',
            [ADMIN_ID]
        );
        
        await bot.sendMessage(
            chatId,
            `📊 Всего пользователей для рассылки: ${parseInt(usersCount.rows[0].count)}`
        );
        
    } catch (error) {
        console.error('Test notify error:', error);
        await bot.sendMessage(
            chatId,
            `❌ Ошибка тестирования: ${error.message}`
        );
    }
});

// Обработчик команды /notify для главного админа
// Обработчик команды /notify для главного админа
bot.onText(/\/notify(.+)?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageText = match[1] ? match[1].trim() : null;
    
    console.log('📢 Notify command received:', { userId, messageText });
    
    // Проверяем что это именно главный админ
    if (parseInt(userId) !== ADMIN_ID) {
        return await bot.sendMessage(
            chatId,
            '❌ У вас нет прав для отправки уведомлений. Эта команда доступна только главному администратору.'
        );
    }
    
    if (!messageText) {
        return await bot.sendMessage(
            chatId,
            '❌ Использование: /notify [сообщение]\n\nПример: /notify Всем привет! Новое обновление уже доступно!'
        );
    }
    
    try {
        // Показываем пользователю, что началась отправка
        const processingMsg = await bot.sendMessage(
            chatId,
            '🔄 Начинаю отправку уведомлений всем пользователям...'
        );
        
        // 🔥 ИСПРАВЛЕНИЕ: Получаем всех пользователей и отправляем напрямую через бота
        const usersResult = await pool.query(
            'SELECT user_id FROM user_profiles WHERE user_id != $1',
            [ADMIN_ID]
        );
        
        const users = usersResult.rows;
        console.log(`📨 Найдено ${users.length} пользователей для отправки уведомлений`);
        
        if (users.length === 0) {
            return await bot.editMessageText(
                '❌ Нет пользователей для отправки уведомлений',
                {
                    chat_id: chatId,
                    message_id: processingMsg.message_id
                }
            );
        }
        
        let successCount = 0;
        let failCount = 0;
        const failedUsers = [];
        
        // Сохраняем запись об уведомлении
        const notificationRecord = await pool.query(`
            INSERT INTO admin_notifications (admin_id, message, sent_count, failed_count) 
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [userId, messageText, 0, 0]);
        
        // Отправляем уведомление каждому пользователю
        for (const user of users) {
            try {
                await bot.sendMessage(
                    user.user_id,
                    `📢 <b>Уведомление от LinkGold:</b>\n\n${messageText}`,
                    { parse_mode: 'HTML' }
                );
                successCount++;
                
                // Обновляем прогресс каждые 10 отправок
                if (successCount % 10 === 0) {
                    await bot.editMessageText(
                        `🔄 Отправка уведомлений...\n\nПрогресс: ${successCount}/${users.length}`,
                        {
                            chat_id: chatId,
                            message_id: processingMsg.message_id
                        }
                    );
                }
                
                // Задержка чтобы не превысить лимиты Telegram (30 сообщений в секунду)
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`❌ Ошибка отправки пользователю ${user.user_id}:`, error.message);
                failCount++;
                failedUsers.push({
                    user_id: user.user_id,
                    error: error.message
                });
                
                // Если ошибка связана с блокировкой бота, пропускаем пользователя
                if (error.response && error.response.statusCode === 403) {
                    console.log(`🚫 Бот заблокирован пользователем ${user.user_id}`);
                }
            }
        }
        
        // Обновляем статистику отправки
        await pool.query(`
            UPDATE admin_notifications 
            SET sent_count = $1, failed_count = $2 
            WHERE id = $3
        `, [successCount, failCount, notificationRecord.rows[0].id]);
        
        console.log(`✅ Уведомления отправлены: ${successCount} успешно, ${failCount} с ошибкой`);
        
        // Формируем финальное сообщение со статистикой
        let finalMessage = `✅ <b>Уведомление отправлено!</b>\n\n`;
        finalMessage += `📊 <b>Статистика:</b>\n`;
        finalMessage += `• Всего пользователей: ${users.length}\n`;
        finalMessage += `• Успешно отправлено: ${successCount}\n`;
        finalMessage += `• С ошибкой: ${failCount}\n\n`;
        finalMessage += `💬 <b>Ваше сообщение:</b>\n${messageText}`;
        
        // Показываем ошибки если есть
        if (failedUsers.length > 0) {
            finalMessage += `\n\n❌ <b>Ошибки отправки (первые 5):</b>\n`;
            failedUsers.slice(0, 5).forEach((failed, index) => {
                finalMessage += `${index + 1}. ID ${failed.user_id}: ${failed.error}\n`;
            });
            
            if (failedUsers.length > 5) {
                finalMessage += `... и еще ${failedUsers.length - 5} ошибок`;
            }
        }
        
        await bot.editMessageText(
            finalMessage,
            {
                chat_id: chatId,
                message_id: processingMsg.message_id,
                parse_mode: 'HTML'
            }
        );
        
    } catch (error) {
        console.error('Notify command error:', error);
        
        // Пытаемся отправить сообщение об ошибке
        try {
            await bot.sendMessage(
                chatId,
                `❌ Произошла ошибка при отправке уведомлений: ${error.message}`
            );
        } catch (e) {
            console.error('Even error message failed:', e);
        }
    }
});

// Обработчик ошибок бота
if (bot) {
    bot.on('polling_error', (error) => {
        console.error('❌ Bot polling error:', error);
    });
    
    bot.on('webhook_error', (error) => {
        console.error('❌ Bot webhook error:', error);
    });
}
// Получение детальной статистики по ссылке
app.get('/api/admin/links/:linkId/stats', async (req, res) => {
    const { linkId } = req.params;
    const { adminId } = req.query;
    
    try {
        // Проверка прав администратора
        const isAdmin = await checkAdminAccess(adminId);
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }
        
        // Основная статистика ссылки
        const linkStats = await pool.query(`
            SELECT * FROM referral_links WHERE id = $1
        `, [linkId]);
        
        if (linkStats.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Ссылка не найдена'
            });
        }
        
        // Статистика по дням
        const dailyStats = await pool.query(`
            SELECT 
                DATE(clicked_at) as date,
                COUNT(*) as total_clicks,
                COUNT(DISTINCT ip_address) as unique_clicks
            FROM referral_link_clicks 
            WHERE link_id = $1 
            GROUP BY DATE(clicked_at)
            ORDER BY date DESC
            LIMIT 30
        `, [linkId]);
        
        // Последние клики
        const recentClicks = await pool.query(`
            SELECT 
                rlc.*,
                up.username,
                up.first_name
            FROM referral_link_clicks rlc
            LEFT JOIN user_profiles up ON rlc.user_id = up.user_id
            WHERE rlc.link_id = $1
            ORDER BY rlc.clicked_at DESC
            LIMIT 20
        `, [linkId]);
        
        res.json({
            success: true,
            link: linkStats.rows[0],
            dailyStats: dailyStats.rows,
            recentClicks: recentClicks.rows
        });
        
    } catch (error) {
        console.error('Get link stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});



// Endpoint для проверки статуса интеграции Flyer
app.get('/api/admin/flyer-status', async (req, res) => {
    const { adminId } = req.query;

    try {
        // Проверка прав администратора
        const isAdmin = await checkAdminAccess(adminId);
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        // Тестовый запрос к Flyer API
        const testPayload = {
            key: FLYER_API_KEY,
            user_id: adminId,
            language_code: 'ru'
        };

        const response = await fetch(`${FLYER_API_URL}/check`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testPayload)
        });

        const status = response.ok ? 'connected' : 'error';

        res.json({
            success: true,
            status: status,
            apiKey: FLYER_API_KEY ? 'configured' : 'missing',
            apiUrl: FLYER_API_URL,
            lastChecked: new Date().toISOString(),
            responseStatus: response.status
        });

    } catch (error) {
        console.error('Flyer status check error:', error);
        res.json({
            success: false,
            status: 'error',
            error: error.message,
            apiKey: FLYER_API_KEY ? 'configured' : 'missing',
            apiUrl: FLYER_API_URL,
            lastChecked: new Date().toISOString()
        });
    }
});

// Создаем таблицу для данных Flyer при инициализации
async function createFlyerTables() {
    try {
        console.log('🔧 Creating Flyer tables...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_flyer_data (
                user_id BIGINT PRIMARY KEY,
                sponsors_data JSONB,
                last_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS flyer_tasks (
                id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                task_signature TEXT NOT NULL,
                task_data JSONB,
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            )
        `);

        console.log('✅ Flyer tables created');
    } catch (error) {
        console.error('❌ Error creating Flyer tables:', error);
    }
}

// Добавьте вызов в функцию инициализации
async function initializeServer() {
    await initDatabase();
    await createFlyerTables(); // Добавьте эту строку
    await createSampleTasks();
    
    console.log('✅ Server initialization complete with Flyer integration');
}


async function handleSubscriptionCompleted(userId) {
    try {
        // Помечаем пользователя как прошедшего проверку подписки
        await pool.query(`
            UPDATE user_profiles 
            SET has_subscribed = true 
            WHERE user_id = $1
        `, [userId]);

        console.log(`✅ User ${userId} subscription marked as completed`);

        // Отправляем сообщение пользователю
        if (bot) {
            await bot.sendMessage(
                userId,
                '✅ **Подписка подтверждена!**\n\nТеперь вы можете пользоваться всеми функциями бота!',
                { parse_mode: 'HTML' }
            );
        }

    } catch (error) {
        console.error('❌ Handle subscription completed error:', error);
    }
}
// Обработчик обновления статуса задания
async function handleTaskStatusUpdate(data) {
    try {
        const { status, user_id, signature, link } = data;

        // Обновляем статус задания в базе данных
        await pool.query(`
            UPDATE flyer_tasks 
            SET status = $1, completed_at = CASE WHEN $1 = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END
            WHERE user_id = $2 AND task_signature = $3
        `, [status, user_id, signature]);

        console.log(`✅ Flyer task status updated: ${user_id} - ${signature} - ${status}`);

        // Если задание завершено, начисляем награду
        if (status === 'completed') {
            await awardUserForFlyerTask(user_id, signature);
        }

    } catch (error) {
        console.error('❌ Handle task status update error:', error);
    }
}

// Улучшенная функция начисления награды
async function awardUserForFlyerTask(userId, signature) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Получаем информацию о задании
        const taskResult = await client.query(`
            SELECT task_data FROM flyer_tasks 
            WHERE user_id = $1 AND task_signature = $2
        `, [userId, signature]);

        if (taskResult.rows.length === 0) {
            console.log('❌ Flyer task not found for awarding');
            return;
        }

        const taskData = taskResult.rows[0].task_data;
        const reward = taskData.reward || 10; // Дефолтная награда

        // Начисляем награду пользователю
        await client.query(`
            UPDATE user_profiles 
            SET balance = COALESCE(balance, 0) + $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
        `, [reward, userId]);

        console.log(`✅ Awarded ${reward} stars to user ${userId} for Flyer task`);

        // Отправляем уведомление пользователю
        if (bot) {
            try {
                await bot.sendMessage(
                    userId,
                    `🎉 <b>Задание выполнено!</b>\n\n` +
                    `Вы получили ${reward}⭐ за выполнение задания через Flyer!\n\n` +
                    `💫 Ваш баланс пополнен.`,
                    { parse_mode: 'HTML' }
                );
            } catch (botError) {
                console.log('⚠️ Could not send notification:', botError.message);
            }
        }

        await client.query('COMMIT');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Award Flyer task error:', error);
    } finally {
        client.release();
    }
}

// Получение истории отправленных уведомлений
app.get('/api/admin/notification-history', async (req, res) => {
    const { adminId } = req.query;
    
    // Только для главного админа
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Доступ запрещен'
        });
    }
    
    try {
        const result = await pool.query(`
            SELECT * FROM admin_notifications 
            ORDER BY sent_at DESC 
            LIMIT 50
        `);
        
        res.json({
            success: true,
            notifications: result.rows
        });
    } catch (error) {
        console.error('Get notification history error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Команда для проверки статистики пользователей перед отправкой
bot.onText(/\/notifystats/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Только для главного админа
    if (parseInt(userId) !== ADMIN_ID) {
        return await bot.sendMessage(
            chatId,
            '❌ У вас нет прав для просмотра статистики уведомлений.'
        );
    }
    
    try {
        const usersCount = await pool.query(
            'SELECT COUNT(*) FROM user_profiles WHERE user_id != $1',
            [ADMIN_ID]
        );
        
        const notificationsCount = await pool.query(
            'SELECT COUNT(*) FROM admin_notifications'
        );
        
        const lastNotification = await pool.query(
            'SELECT * FROM admin_notifications ORDER BY sent_at DESC LIMIT 1'
        );
        
        let message = `📊 <b>Статистика для рассылки уведомлений</b>\n\n`;
        message += `👥 <b>Всего пользователей:</b> ${parseInt(usersCount.rows[0].count)}\n`;
        message += `📨 <b>Всего отправлено уведомлений:</b> ${parseInt(notificationsCount.rows[0].count)}\n`;
        
        if (lastNotification.rows.length > 0) {
            const last = lastNotification.rows[0];
            message += `\n🕒 <b>Последнее уведомление:</b>\n`;
            message += `• Дата: ${new Date(last.sent_at).toLocaleString('ru-RU')}\n`;
            message += `• Отправлено: ${last.sent_count} пользователям\n`;
            message += `• Ошибок: ${last.failed_count}\n`;
        }
        
        message += `\n💡 <b>Используйте команду:</b>\n<code>/notify [ваше сообщение]</code>`;
        
        await bot.sendMessage(
            chatId,
            message,
            { parse_mode: 'HTML' }
        );
        
    } catch (error) {
        console.error('Notification stats error:', error);
        await bot.sendMessage(
            chatId,
            '❌ Ошибка при получении статистики.'
        );
    }
});

bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Проверяем права администратора
    const isAdmin = await checkAdminAccess(userId);
    if (!isAdmin) {
        return await bot.sendMessage(
            chatId,
            '❌ У вас нет прав для просмотра статистики.'
        );
    }
    
    try {
        const response = await fetch(`${APP_URL}/api/admin/users-detailed-stats?adminId=${userId}&limit=5`);
        const result = await response.json();
        
        if (result.success) {
            const stats = result.stats.main;
            const activity = result.stats.activity;
            
            let message = `📊 <b>Детальная статистика LinkGold</b>\n\n`;
            message += `<b>👥 Пользователи:</b>\n`;
            message += `• Всего: <b>${stats.total_users}</b>\n`;
            message += `• Админов: <b>${stats.admin_users}</b>\n`;
            message += `• С балансом: <b>${stats.users_with_balance}</b>\n`;
            message += `• Могут выводить: <b>${stats.users_can_withdraw}</b>\n\n`;
            
            message += `<b>💰 Финансы:</b>\n`;
            message += `• Общий баланс: <b>${parseFloat(stats.total_balance).toFixed(2)}⭐</b>\n`;
            message += `• Средний баланс: <b>${parseFloat(stats.avg_balance).toFixed(2)}⭐</b>\n`;
            message += `• Макс. баланс: <b>${parseFloat(stats.max_balance).toFixed(2)}⭐</b>\n\n`;
            
            message += `<b>🎯 Активность:</b>\n`;
            message += `• Выполнено заданий: <b>${activity.completed_tasks || 0}</b>\n`;
            message += `• На проверке: <b>${activity.pending_tasks || 0}</b>\n`;
            message += `• Заработано: <b>${parseFloat(activity.total_earned_from_tasks || 0).toFixed(2)}⭐</b>\n\n`;
            
            message += `<b>👥 Рефералы:</b>\n`;
            message += `• Всего приглашено: <b>${stats.total_referrals}</b>\n`;
            message += `• Заработано: <b>${parseFloat(stats.total_referral_earnings).toFixed(2)}⭐</b>`;
            
            await bot.sendMessage(
                chatId,
                message,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: '📊 Полная статистика',
                                    url: `${APP_URL}/admin.html?tab=users`
                                }
                            ],
                            [
                                {
                                    text: '📢 Отправить уведомление',
                                    callback_data: 'send_notification'
                                }
                            ]
                        ]
                    }
                }
            );
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('Stats command error:', error);
        await bot.sendMessage(
            chatId,
            '❌ Ошибка при получении статистики.'
        );
    }
});

// Команда для поиска пользователей по юзернейму
bot.onText(/\/search_user (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const searchUsername = match[1].trim();
    
    console.log('🔍 Search user command:', { userId, searchUsername });
    
    // Проверяем права администратора
    const isAdmin = await checkAdminAccess(userId);
    if (!isAdmin) {
        return await bot.sendMessage(
            chatId,
            '❌ У вас нет прав для поиска пользователей.'
        );
    }
    
    try {
        // Ищем пользователя по юзернейму
        const userResult = await pool.query(`
            SELECT 
                up.user_id,
                up.username,
                up.first_name,
                up.last_name,
                up.balance,
                up.is_admin,
                up.created_at,
                up.referral_count,
                up.referral_earned,
                COUNT(ut.id) as total_tasks,
                COUNT(CASE WHEN ut.status = 'completed' THEN 1 END) as completed_tasks,
                COUNT(CASE WHEN ut.status = 'rejected' THEN 1 END) as rejected_tasks,
                COUNT(CASE WHEN ut.status = 'pending_review' THEN 1 END) as pending_tasks
            FROM user_profiles up
            LEFT JOIN user_tasks ut ON up.user_id = ut.user_id
            WHERE up.username ILIKE $1 OR up.user_id::text = $1
            GROUP BY up.user_id
            LIMIT 1
        `, [`%${searchUsername}%`]);
        
        if (userResult.rows.length === 0) {
            return await bot.sendMessage(
                chatId,
                `❌ Пользователь с юзернеймом "${searchUsername}" не найден.`
            );
        }
        
        const user = userResult.rows[0];
        await sendUserInfo(chatId, user);
        
    } catch (error) {
        console.error('Search user error:', error);
        await bot.sendMessage(
            chatId,
            '❌ Произошла ошибка при поиске пользователя.'
        );
    }
});
// 🎯 ПРОСТАЯ КОМАНДА ДЛЯ НАСТРОЙКИ WEBHOOK
bot.onText(/\/setup_flyer_simple/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (parseInt(userId) !== ADMIN_ID) {
        return await bot.sendMessage(chatId, '❌ Только главный администратор может настраивать Flyer.');
    }

    try {
        await bot.sendMessage(chatId, '🔄 Настраиваю вебхук Flyer...');

        const response = await fetch('https://api.flyerservice.io/set_webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key: FLYER_API_KEY,
                webhook: 'https://telegram-community1-production-0bc1.up.railway.app/api/flyer/webhook'
            })
        });

        const result = await response.json();
        
        if (response.ok) {
            await bot.sendMessage(
                chatId,
                `✅ Вебхук успешно настроен!\n\n` +
                `🌐 URL: https://telegram-community1-production-0bc1.up.railway.app/api/flyer/webhook\n` +
                `📨 Ответ: ${JSON.stringify(result)}`,
                { parse_mode: 'HTML' }
            );
        } else {
            throw new Error(JSON.stringify(result));
        }

    } catch (error) {
        console.error('Simple webhook setup error:', error);
        await bot.sendMessage(
            chatId,
            `❌ Ошибка: ${error.message}\n\n` +
            `Проверьте:\n` +
            `1. Правильность API ключа\n` +
            `2. Доступность вашего сервера извне\n` +
            `3. Что endpoint возвращает {status: true}`
        );
    }
});
// Команда для поиска по ID пользователя
bot.onText(/\/user (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const searchId = match[1].trim();
    
    // Проверяем права администратора
    const isAdmin = await checkAdminAccess(userId);
    if (!isAdmin) {
        return await bot.sendMessage(
            chatId,
            '❌ У вас нет прав для поиска пользователей.'
        );
    }
    
    try {
        const userResult = await pool.query(`
            SELECT 
                up.user_id,
                up.username,
                up.first_name,
                up.last_name,
                up.balance,
                up.is_admin,
                up.created_at,
                up.referral_count,
                up.referral_earned,
                COUNT(ut.id) as total_tasks,
                COUNT(CASE WHEN ut.status = 'completed' THEN 1 END) as completed_tasks,
                COUNT(CASE WHEN ut.status = 'rejected' THEN 1 END) as rejected_tasks,
                COUNT(CASE WHEN ut.status = 'pending_review' THEN 1 END) as pending_tasks
            FROM user_profiles up
            LEFT JOIN user_tasks ut ON up.user_id = ut.user_id
            WHERE up.user_id = $1
            GROUP BY up.user_id
        `, [searchId]);
        
        if (userResult.rows.length === 0) {
            return await bot.sendMessage(
                chatId,
                `❌ Пользователь с ID "${searchId}" не найден.`
            );
        }
        
        const user = userResult.rows[0];
        await sendUserInfo(chatId, user);
        
    } catch (error) {
        console.error('User search error:', error);
        await bot.sendMessage(
            chatId,
            '❌ Произошла ошибка при поиске пользователя.'
        );
    }
});
// 🔍 ПОИСК ПОЛЬЗОВАТЕЛЕЙ ПО ЮЗЕРНЕЙМУ - УЛУЧШЕННАЯ ВЕРСИЯ
bot.onText(/\/search (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const searchQuery = match[1].trim();
    
    console.log('🔍 Search command received:', { userId, searchQuery });
    
    // Проверяем права администратора
    const isAdmin = await checkAdminAccess(userId);
    if (!isAdmin) {
        return await bot.sendMessage(
            chatId,
            '❌ У вас нет прав для поиска пользователей.'
        );
    }
    
    try {
        // Ищем пользователя по юзернейму или ID
        const userResult = await pool.query(`
            SELECT 
                up.user_id,
                up.username,
                up.first_name,
                up.last_name,
                up.balance,
                up.is_admin,
                up.created_at,
                up.referral_count,
                up.referral_earned,
                -- Статистика заданий
                COUNT(ut.id) as total_tasks,
                COUNT(CASE WHEN ut.status = 'completed' THEN 1 END) as completed_tasks,
                COUNT(CASE WHEN ut.status = 'rejected' THEN 1 END) as rejected_tasks,
                COUNT(CASE WHEN ut.status = 'pending_review' THEN 1 END) as pending_tasks,
                -- Статистика выплат
                COUNT(wr.id) as withdrawal_requests,
                COUNT(CASE WHEN wr.status = 'completed' THEN 1 END) as completed_withdrawals,
                COALESCE(SUM(CASE WHEN wr.status = 'completed' THEN wr.amount ELSE 0 END), 0) as total_withdrawn,
                -- Информация о реферере
                ref.username as referrer_username,
                ref.first_name as referrer_name
            FROM user_profiles up
            LEFT JOIN user_tasks ut ON up.user_id = ut.user_id
            LEFT JOIN withdrawal_requests wr ON up.user_id = wr.user_id
            LEFT JOIN user_profiles ref ON up.referred_by = ref.user_id
            WHERE up.username ILIKE $1 OR up.user_id::text = $1 OR up.first_name ILIKE $1
            GROUP BY up.user_id, ref.username, ref.first_name
            ORDER BY 
                CASE 
                    WHEN up.username = $1 THEN 1
                    WHEN up.user_id::text = $1 THEN 2
                    ELSE 3
                END,
                up.created_at DESC
            LIMIT 10
        `, [`%${searchQuery}%`]);
        
        if (userResult.rows.length === 0) {
            return await bot.sendMessage(
                chatId,
                `❌ Пользователи по запросу "${searchQuery}" не найдены.\n\nПопробуйте:\n• Юзернейм (без @)\n• ID пользователя\n• Имя`
            );
        }
        
        if (userResult.rows.length === 1) {
            // Если найден один пользователь - показываем детальную информацию
            const user = userResult.rows[0];
            await sendUserManagementPanel(chatId, user);
        } else {
            // Если найдено несколько пользователей - показываем список
            await sendUsersList(chatId, userResult.rows, searchQuery);
        }
        
    } catch (error) {
        console.error('❌ Search users error:', error);
        await bot.sendMessage(
            chatId,
            '❌ Произошла ошибка при поиске пользователей.'
        );
    }
});

// 📋 ОТПРАВКА СПИСКА ПОЛЬЗОВАТЕЛЕЙ
async function sendUsersList(chatId, users, searchQuery) {
    let messageText = `🔍 <b>Найдено пользователей: ${users.length}</b>\n\n`;
    
    users.forEach((user, index) => {
        const userName = user.first_name + (user.last_name ? ` ${user.last_name}` : '');
        const userStatus = user.is_admin ? '👑' : '👤';
        const balance = user.balance || 0;
        
        messageText += `${index + 1}. ${userStatus} <b>${userName}</b>\n`;
        messageText += `   👤 @${user.username || 'нет юзернейма'}\n`;
        messageText += `   🆔 <code>${user.user_id}</code>\n`;
        messageText += `   💫 Баланс: <b>${balance}⭐</b>\n`;
        messageText += `   📅 Регистрация: ${new Date(user.created_at).toLocaleDateString('ru-RU')}\n\n`;
    });
    
    messageText += `💡 <b>Выберите пользователя для управления:</b>`;
    
    const keyboard = {
        inline_keyboard: users.map(user => [
            {
                text: `${user.first_name} (@${user.username || user.user_id})`,
                callback_data: `manage_user_${user.user_id}`
            }
        ])
    };
    
    // Добавляем кнопку "Новый поиск"
    keyboard.inline_keyboard.push([
        {
            text: '🔍 Новый поиск',
            callback_data: 'new_search'
        }
    ]);
    
    await bot.sendMessage(
        chatId,
        messageText,
        {
            parse_mode: 'HTML',
            reply_markup: keyboard
        }
    );
}
// Улучшенная функция обработки завершения подписки
async function handleFlyerSubscriptionCompleted(userId) {
    try {
        console.log(`🎉 Processing subscription completion for user: ${userId}`);

        // Помечаем пользователя как прошедшего проверку подписки в базе данных
        // Замените pool.query на вашу логику работы с БД
        await pool.query(`UPDATE user_profiles SET has_subscribed = true, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`, [userId]);
        console.log(`✅ User ${userId} subscription marked as completed`);

        // Отправляем сообщение пользователю через Telegram Bot API
        if (bot) {
            try {
                await bot.sendMessage(userId, '✅ **Подписка подтверждена!**\nБлагодарим за подписку!\nТеперь вы можете пользоваться всеми функциями бота! 🎉', { parse_mode: 'HTML' });
                console.log(`✅ Notification sent to user ${userId}`);
            } catch (botError) {
                console.error('❌ Failed to send notification:', botError.message);
            }
        }

    } catch (error) {
        console.error('❌ Handle subscription completed error:', error);
    }
}

// Функция обработки обновления статуса задания
async function handleFlyerTaskStatusUpdate(data) {
    try {
        const { status, user_id, signature, link } = data;
        console.log(`🔄 Processing task status update:`, { user_id, signature, status, link });

        // Обновляем статус задания в базе данных
        await pool.query(`UPDATE flyer_tasks SET status = $1, completed_at = CASE WHEN $1 = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE user_id = $2 AND task_signature = $3`, [status, user_id, signature]);

        // Можно отправить уведомление пользователю, если статус изменился на 'abort'
        if (status === 'abort' && bot) {
            await bot.sendMessage(user_id, `⚠️ Вы отписались от канала: ${link}\nЭто может повлиять на ваш доступ к боту.`, { parse_mode: 'HTML' });
        }

    } catch (error) {
        console.error('❌ Handle task status update error:', error);
    }
}
// Функция для автоматической настройки вебхука при запуске
async function setupFlyerWebhook() {
    try {
        console.log('🚀 Setting up Flyer webhook...');

        const response = await fetch('https://api.flyerservice.io/set_webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key: FLYER_API_KEY,
                webhook: 'https://telegram-community1-production-0bc1.up.railway.app/api/flyer/webhook'
            })
        });

        const result = await response.json();
        console.log('✅ Flyer setup response:', result);

        if (response.ok) {
            console.log('✅ Flyer webhook configured successfully!');
            return { success: true, result };
        } else {
            throw new Error(`Flyer API: ${response.status} - ${JSON.stringify(result)}`);
        }

    } catch (error) {
        console.error('❌ Flyer webhook setup failed:', error);
        return { success: false, error: error.message };
    }
}

// Вызов функции при запуске сервера
initializeServer(); // Предположим, что у вас есть такая функция
setupFlyerWebhook(); // Вызываем настройку вебхука
// 🎛️ ПАНЕЛЬ УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЕМ
async function sendUserManagementPanel(chatId, user) {
    const userName = user.first_name + (user.last_name ? ` ${user.last_name}` : '');
    const userStatus = user.is_admin ? '👑 Администратор' : '👤 Пользователь';
    const registrationDate = new Date(user.created_at).toLocaleDateString('ru-RU');
    const totalEarned = (user.balance || 0) + (user.total_withdrawn || 0);
    
    const messageText = `
👤 <b>ПАНЕЛЬ УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЕМ</b>

<b>Основная информация:</b>
🆔 ID: <code>${user.user_id}</code>
👤 Имя: <b>${userName}</b>
📧 Юзернейм: @${user.username || 'не указан'}
🎭 Статус: ${userStatus}
📅 Регистрация: ${registrationDate}

💰 <b>Финансы:</b>
💫 Текущий баланс: <b>${user.balance || 0}⭐</b>
🏦 Всего выведено: <b>${user.total_withdrawn || 0}⭐</b>
💸 Всего заработано: <b>${totalEarned}⭐</b>

📊 <b>Статистика заданий:</b>
✅ Выполнено: <b>${user.completed_tasks || 0}</b>
❌ Отклонено: <b>${user.rejected_tasks || 0}</b>
⏳ На проверке: <b>${user.pending_tasks || 0}</b>
📋 Всего заданий: <b>${user.total_tasks || 0}</b>

👥 <b>Реферальная система:</b>
👤 Приглашено: <b>${user.referral_count || 0} чел.</b>
💫 Заработано: <b>${user.referral_earned || 0}⭐</b>
🎯 Пригласил: ${user.referrer_username ? `@${user.referrer_username}` : 'нет'}
    `.trim();

    const keyboard = {
        inline_keyboard: [
            // Первый ряд: Управление балансом
            [
                {
                    text: '💰 Управление балансом',
                    callback_data: `balance_menu_${user.user_id}`
                },
                {
                    text: '🎭 Права доступа',
                    callback_data: `admin_toggle_${user.user_id}`
                }
            ],
            // Второй ряд: Статистика и действия
            [
                {
                    text: '📊 Детальная статистика',
                    callback_data: `user_stats_${user.user_id}`
                },
                {
                    text: '🔄 Обновить',
                    callback_data: `refresh_user_${user.user_id}`
                }
            ],
            // Третий ряд: Блокировка и выплаты
            [
                {
                    text: user.balance > 0 ? '💸 Выплаты' : '💸 История выплат',
                    callback_data: `withdrawal_info_${user.user_id}`
                },
                {
                    text: '🚫 Заблокировать',
                    callback_data: `block_user_${user.user_id}`
                }
            ],
            // Четвертый ряд: Навигация
            [
                {
                    text: '🔍 Новый поиск',
                    callback_data: 'new_search'
                },
                {
                    text: '📋 Список пользователей',
                    callback_data: 'users_list'
                }
            ]
        ]
    };

    await bot.sendMessage(
        chatId,
        messageText,
        {
            parse_mode: 'HTML',
            reply_markup: keyboard
        }
    );
}

// 💰 МЕНЮ УПРАВЛЕНИЯ БАЛАНСОМ
async function showBalanceManagement(chatId, adminId, targetUserId, messageId) {
    try {
        const userResult = await pool.query(
            'SELECT username, first_name, balance FROM user_profiles WHERE user_id = $1',
            [targetUserId]
        );
        
        if (userResult.rows.length === 0) {
            return await bot.editMessageText(
                '❌ Пользователь не найден',
                { chat_id: chatId, message_id: messageId }
            );
        }
        
        const user = userResult.rows[0];
        const currentBalance = user.balance || 0;
        
        const messageText = `
💰 <b>УПРАВЛЕНИЕ БАЛАНСОМ</b>

👤 Пользователь: ${user.first_name} (@${user.username})
💫 Текущий баланс: <b>${currentBalance}⭐</b>

<b>Быстрые действия:</b>
        `.trim();
        
        const keyboard = {
            inline_keyboard: [
                // Пополнение счета
                [
                    { text: '➕ 50⭐', callback_data: `balance_add_${targetUserId}_50` },
                    { text: '➕ 100⭐', callback_data: `balance_add_${targetUserId}_100` },
                    { text: '➕ 500⭐', callback_data: `balance_add_${targetUserId}_500` }
                ],
                // Списание средств
                [
                    { text: '➖ 50⭐', callback_data: `balance_remove_${targetUserId}_50` },
                    { text: '➖ 100⭐', callback_data: `balance_remove_${targetUserId}_100` },
                    { text: '➖ 500⭐', callback_data: `balance_remove_${targetUserId}_500` }
                ],
                // Специальные действия
                [
                    { text: '🎯 Указать сумму', callback_data: `balance_custom_${targetUserId}` },
                    { text: '🔄 Сбросить баланс', callback_data: `balance_reset_${targetUserId}` },
                    { text: '💸 Обнулить', callback_data: `balance_zero_${targetUserId}` }
                ],
                // Навигация
                [
                    { text: '🔙 Назад', callback_data: `manage_user_${targetUserId}` },
                    { text: '📊 Статистика', callback_data: `user_stats_${targetUserId}` }
                ]
            ]
        };
        
        if (messageId) {
            await bot.editMessageText(
                messageText,
                {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'HTML',
                    reply_markup: keyboard
                }
            );
        } else {
            await bot.sendMessage(
                chatId,
                messageText,
                {
                    parse_mode: 'HTML',
                    reply_markup: keyboard
                }
            );
        }
        
    } catch (error) {
        console.error('Show balance management error:', error);
        await bot.sendMessage(
            chatId,
            '❌ Ошибка при загрузке управления балансом'
        );
    }
}

// 🔄 ОБРАБОТКА ДЕЙСТВИЙ С БАЛАНСОМ
async function handleBalanceAction(chatId, adminId, targetUserId, action, amount, messageId) {
    try {
        const userResult = await pool.query(
            'SELECT username, first_name, balance FROM user_profiles WHERE user_id = $1',
            [targetUserId]
        );
        
        if (userResult.rows.length === 0) {
            return await bot.editMessageText(
                '❌ Пользователь не найден',
                { chat_id: chatId, message_id: messageId }
            );
        }
        
        const user = userResult.rows[0];
        let newBalance = user.balance || 0;
        let actionText = '';
        let notificationText = '';
        
        switch (action) {
            case 'add':
                newBalance += amount;
                actionText = `пополнен на ${amount}⭐`;
                notificationText = `🎉 Ваш баланс пополнен на ${amount}⭐ администратором!\n💫 Текущий баланс: ${newBalance}⭐`;
                break;
                
            case 'remove':
                if (newBalance >= amount) {
                    newBalance -= amount;
                    actionText = `списано ${amount}⭐`;
                    notificationText = `ℹ️ С вашего баланса списано ${amount}⭐ администратором.\n💫 Текущий баланс: ${newBalance}⭐`;
                } else {
                    newBalance = 0;
                    actionText = `баланс сброшен (было недостаточно средств)`;
                    notificationText = `ℹ️ Ваш баланс был сброшен администратором.\n💫 Текущий баланс: ${newBalance}⭐`;
                }
                break;
                
            case 'reset':
                actionText = `сброшен до 0⭐`;
                newBalance = 0;
                notificationText = `ℹ️ Ваш баланс был сброшен администратором.\n💫 Текущий баланс: ${newBalance}⭐`;
                break;
                
            case 'zero':
                actionText = `обнулен`;
                newBalance = 0;
                notificationText = `ℹ️ Ваш баланс был обнулен администратором.`;
                break;
                
            case 'custom':
                // Обработка произвольной суммы через текстовый ввод
                userBalanceState[adminId] = { targetUserId, action: 'custom' };
                await bot.sendMessage(
                    chatId,
                    `💵 <b>Введите сумму для изменения баланса</b>\n\n` +
                    `Пользователь: ${user.first_name} (@${user.username})\n` +
                    `Текущий баланс: ${user.balance || 0}⭐\n\n` +
                    `<b>Форматы ввода:</b>\n` +
                    `<code>+100</code> - пополнить на 100⭐\n` +
                    `<code>-50</code> - списать 50⭐\n` +
                    `<code>=200</code> - установить баланс 200⭐\n` +
                    `<code>0</code> - обнулить баланс`,
                    { parse_mode: 'HTML' }
                );
                return;
        }
        
        if (action !== 'custom') {
            // Обновляем баланс в базе данных
            await pool.query(
                'UPDATE user_profiles SET balance = $1 WHERE user_id = $2',
                [newBalance, targetUserId]
            );
            
            // Логируем действие
            await pool.query(`
                INSERT INTO admin_actions (admin_id, action_type, target_id, description) 
                VALUES ($1, $2, $3, $4)
            `, [adminId, 'balance_update', targetUserId, 
                `Баланс пользователя ${targetUserId} ${actionText}. Новый баланс: ${newBalance}⭐`]);
            
            // Обновляем сообщение
            await bot.editMessageText(
                `✅ <b>Баланс обновлен!</b>\n\n` +
                `👤 Пользователь: ${user.first_name}\n` +
                `💫 Действие: ${actionText}\n` +
                `💰 Новый баланс: <b>${newBalance}⭐</b>`,
                {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '🔙 Назад к управлению', callback_data: `manage_user_${targetUserId}` },
                                { text: '💰 Еще действия', callback_data: `balance_menu_${targetUserId}` }
                            ]
                        ]
                    }
                }
            );
            
            // Уведомляем пользователя
            if (bot && notificationText) {
                try {
                    await bot.sendMessage(targetUserId, notificationText);
                } catch (error) {
                    console.log('Не удалось отправить уведомление пользователю');
                }
            }
        }
        
    } catch (error) {
        console.error('Handle balance action error:', error);
        await bot.editMessageText(
            '❌ Ошибка при изменении баланса',
            { chat_id: chatId, message_id: messageId }
        );
    }
}

// 📊 ДЕТАЛЬНАЯ СТАТИСТИКА ПОЛЬЗОВАТЕЛЯ
async function showUserDetailedStats(chatId, targetUserId, messageId) {
    try {
        const statsResult = await pool.query(`
            SELECT 
                up.user_id,
                up.username,
                up.first_name,
                up.balance,
                up.created_at,
                up.referral_count,
                up.referral_earned,
                up.referred_by,
                -- Статистика по заданиям
                COUNT(ut.id) as total_tasks,
                COUNT(CASE WHEN ut.status = 'completed' THEN 1 END) as completed_tasks,
                COUNT(CASE WHEN ut.status = 'rejected' THEN 1 END) as rejected_tasks,
                COUNT(CASE WHEN ut.status = 'pending_review' THEN 1 END) as pending_tasks,
                COUNT(CASE WHEN ut.status = 'active' THEN 1 END) as active_tasks,
                -- Статистика по выплатам
                COUNT(wr.id) as withdrawal_requests,
                COUNT(CASE WHEN wr.status = 'completed' THEN 1 END) as completed_withdrawals,
                COUNT(CASE WHEN wr.status = 'pending' THEN 1 END) as pending_withdrawals,
                COUNT(CASE WHEN wr.status = 'cancelled' THEN 1 END) as cancelled_withdrawals,
                COALESCE(SUM(CASE WHEN wr.status = 'completed' THEN wr.amount ELSE 0 END), 0) as total_withdrawn,
                -- Реферальная статистика
                ref.username as referrer_username,
                ref.first_name as referrer_name,
                -- Последняя активность
                MAX(ut.started_at) as last_task_activity,
                MAX(wr.created_at) as last_withdrawal_date
            FROM user_profiles up
            LEFT JOIN user_tasks ut ON up.user_id = ut.user_id
            LEFT JOIN withdrawal_requests wr ON up.user_id = wr.user_id
            LEFT JOIN user_profiles ref ON up.referred_by = ref.user_id
            WHERE up.user_id = $1
            GROUP BY up.user_id, ref.username, ref.first_name
        `, [targetUserId]);
        
        if (statsResult.rows.length === 0) {
            return await bot.editMessageText(
                '❌ Пользователь не найден',
                { chat_id: chatId, message_id: messageId }
            );
        }
        
        const stats = statsResult.rows[0];
        const lastActivity = stats.last_task_activity ? 
            new Date(stats.last_task_activity).toLocaleDateString('ru-RU') : 'нет активности';
        const lastWithdrawal = stats.last_withdrawal_date ? 
            new Date(stats.last_withdrawal_date).toLocaleDateString('ru-RU') : 'нет выплат';
        
        const messageText = `
📊 <b>ДЕТАЛЬНАЯ СТАТИСТИКА ПОЛЬЗОВАТЕЛЯ</b>

👤 <b>${stats.first_name}</b> (@${stats.username})
💫 <b>Баланс:</b> ${stats.balance || 0}⭐
📅 <b>Регистрация:</b> ${new Date(stats.created_at).toLocaleDateString('ru-RU')}
🕒 <b>Последняя активность:</b> ${lastActivity}

🎯 <b>ЗАДАНИЯ:</b>
• Всего: ${stats.total_tasks || 0}
• ✅ Выполнено: ${stats.completed_tasks || 0}
• ❌ Отклонено: ${stats.rejected_tasks || 0}
• ⏳ На проверке: ${stats.pending_tasks || 0}
• 🔄 Активные: ${stats.active_tasks || 0}

💳 <b>ВЫПЛАТЫ:</b>
• 📨 Запросов: ${stats.withdrawal_requests || 0}
• ✅ Выведено: ${stats.completed_withdrawals || 0}
• ⏳ Ожидают: ${stats.pending_withdrawals || 0}
• ❌ Отменено: ${stats.cancelled_withdrawals || 0}
• 💰 Сумма: ${stats.total_withdrawn || 0}⭐
• 📅 Последняя: ${lastWithdrawal}

👥 <b>РЕФЕРАЛЫ:</b>
• 👤 Приглашено: ${stats.referral_count || 0}
• 💫 Заработано: ${stats.referral_earned || 0}⭐
• 🎯 Пригласил: ${stats.referrer_username ? `@${stats.referrer_username}` : 'нет'}

💰 <b>ОБЩАЯ СТАТИСТИКА:</b>
• 💸 Всего заработано: ${(stats.balance || 0) + (stats.total_withdrawn || 0)}⭐
• 📈 Эффективность: ${stats.total_tasks ? Math.round((stats.completed_tasks / stats.total_tasks) * 100) : 0}%
        `.trim();
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🔙 Назад', callback_data: `manage_user_${targetUserId}` },
                    { text: '🔄 Обновить', callback_data: `refresh_stats_${targetUserId}` }
                ],
                [
                    { text: '💰 Управление балансом', callback_data: `balance_menu_${targetUserId}` },
                    { text: '📋 История операций', callback_data: `user_operations_${targetUserId}` }
                ]
            ]
        };
        
        await bot.editMessageText(
            messageText,
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: keyboard
            }
        );
        
    } catch (error) {
        console.error('Show user stats error:', error);
        await bot.editMessageText(
            '❌ Ошибка при загрузке статистики',
            { chat_id: chatId, message_id: messageId }
        );
    }
}

// Получение топа пользователей с реальными данными о выполненных заданиях
app.get('/api/leaderboard/top', async (req, res) => {
    try {
        console.log('🏆 Loading improved leaderboard with real task counts...');
        
        // Получаем топ пользователей по реальным выполненным заданиям
        const topUsers = await pool.query(`
            SELECT 
                up.user_id,
                up.username,
                up.first_name,
                -- РЕАЛЬНЫЕ выполненные задания из user_tasks
                COUNT(CASE WHEN ut.status = 'completed' THEN 1 END) as completed_tasks,
                COALESCE(up.balance, 0) as balance,
                COALESCE(up.referral_count, 0) as referral_count,
                up.created_at
            FROM user_profiles up
            LEFT JOIN user_tasks ut ON up.user_id = ut.user_id AND ut.status = 'completed'
            GROUP BY up.user_id, up.username, up.first_name, up.balance, up.referral_count, up.created_at
            HAVING COUNT(CASE WHEN ut.status = 'completed' THEN 1 END) > 0  -- Только пользователи с выполненными заданиями
               OR COALESCE(up.balance, 0) > 0          -- Или с балансом
            ORDER BY 
                completed_tasks DESC,  -- Сначала по выполненным заданиям
                COALESCE(up.balance, 0) DESC,           -- Затем по балансу
                up.created_at ASC                       -- Затем по дате регистрации
            LIMIT 10
        `);
        
        // Форматируем данные для отображения
        const formattedUsers = topUsers.rows.map(user => ({
            user_id: user.user_id,
            username: user.username || `user_${user.user_id}`,
            first_name: user.first_name,
            completed_tasks: parseInt(user.completed_tasks) || 0, // Реальные выполненные задания
            balance: user.balance || 0,
            referral_count: user.referral_count || 0,
            created_at: user.created_at
        }));
        
        // Получаем место текущего пользователя
        const userId = req.query.userId;
        let currentUserRank = null;
        let currentUserStats = null;
        
        if (userId) {
            const userRank = await pool.query(`
                WITH user_ranking AS (
                    SELECT 
                        up.user_id,
                        up.first_name,
                        up.username,
                        COUNT(CASE WHEN ut.status = 'completed' THEN 1 END) as completed_tasks,
                        COALESCE(up.balance, 0) as balance,
                        ROW_NUMBER() OVER (
                            ORDER BY 
                                COUNT(CASE WHEN ut.status = 'completed' THEN 1 END) DESC,
                                COALESCE(up.balance, 0) DESC,
                                up.created_at ASC
                        ) as position
                    FROM user_profiles up
                    LEFT JOIN user_tasks ut ON up.user_id = ut.user_id AND ut.status = 'completed'
                    GROUP BY up.user_id, up.username, up.first_name, up.balance, up.created_at
                    HAVING COUNT(CASE WHEN ut.status = 'completed' THEN 1 END) > 0
                       OR COALESCE(up.balance, 0) > 0
                )
                SELECT * FROM user_ranking WHERE user_id = $1
            `, [userId]);
            
            if (userRank.rows.length > 0) {
                currentUserRank = userRank.rows[0].position;
                currentUserStats = {
                    ...userRank.rows[0],
                    username: userRank.rows[0].username || `user_${userId}`,
                    completed_tasks: parseInt(userRank.rows[0].completed_tasks) || 0
                };
            }
        }
        
        console.log(`✅ Improved leaderboard loaded: ${formattedUsers.length} users with real task counts`);
        
        res.json({
            success: true,
            topUsers: formattedUsers,
            currentUserRank: currentUserRank,
            currentUserStats: currentUserStats,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Improved leaderboard error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка загрузки топа пользователей: ' + error.message
        });
    }
});
// В server.js обновите endpoint удаления пользователя:
// В server.js обновите endpoint удаления пользователя:
app.post('/api/admin/leaderboard/remove-user', async (req, res) => {
    const { adminId, targetUserId } = req.body;
    
    console.log('🗑️ Remove user from leaderboard request:', { adminId, targetUserId });
    
    try {
        // Преобразуем ID в числа для сравнения
        const adminIdNum = parseInt(adminId);
        const targetUserIdNum = parseInt(targetUserId);
        
        // Проверяем права - только главный админ
        if (adminIdNum !== ADMIN_ID) {
            return res.status(403).json({
                success: false,
                error: 'Только главный администратор может удалять пользователей из топа!'
            });
        }
        
        if (!targetUserId) {
            return res.status(400).json({
                success: false,
                error: 'ID пользователя обязателен'
            });
        }
        
        // Проверяем существование пользователя
        const userCheck = await pool.query(
            'SELECT user_id, username, first_name FROM user_profiles WHERE user_id = $1',
            [targetUserIdNum] // Используем числовое значение
        );
        
        if (userCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }
        
        const user = userCheck.rows[0];
        
        // Сбрасываем статистику пользователя
        await pool.query(`
            UPDATE user_profiles 
            SET completed_tasks = 0, 
                balance = 0,
                referral_count = 0,
                referral_earned = 0
            WHERE user_id = $1
        `, [targetUserIdNum]); // Используем числовое значение
        
        // Также удаляем все задания пользователя
        await pool.query(`
            DELETE FROM user_tasks 
            WHERE user_id = $1
        `, [targetUserIdNum]);
        
        // Удаляем проверки заданий пользователя
        await pool.query(`
            DELETE FROM task_verifications 
            WHERE user_id = $1
        `, [targetUserIdNum]);
        
        console.log(`✅ User ${user.username} (ID: ${targetUserId}) removed from leaderboard`);
        
        res.json({
            success: true,
            message: `Пользователь @${user.username} удален из топа!`,
            removedUser: {
                id: targetUserId,
                username: user.username,
                firstName: user.first_name
            }
        });
        
    } catch (error) {
        console.error('❌ Remove user from leaderboard error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных: ' + error.message
        });
    }
});
// Получение детальной информации о пользователе для админа
app.get('/api/admin/leaderboard/user-info/:userId', async (req, res) => {
    const { userId } = req.params;
    const { adminId } = req.query;
    
    try {
        // Проверяем права администратора
        const isAdmin = await checkAdminAccess(adminId);
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }
        
        // Получаем детальную информацию о пользователе
        const userInfo = await pool.query(`
            SELECT 
                up.user_id,
                up.username,
                up.first_name,
                up.last_name,
                up.balance,
                up.completed_tasks,
                up.referral_count,
                up.referral_earned,
                up.created_at,
                up.is_admin,
                -- Статистика заданий
                COUNT(ut.id) as total_tasks,
                COUNT(CASE WHEN ut.status = 'completed' THEN 1 END) as completed_user_tasks,
                COUNT(CASE WHEN ut.status = 'rejected' THEN 1 END) as rejected_tasks,
                COUNT(CASE WHEN ut.status = 'pending_review' THEN 1 END) as pending_tasks,
                -- Статистика выплат
                COUNT(wr.id) as withdrawal_requests,
                COUNT(CASE WHEN wr.status = 'completed' THEN 1 END) as completed_withdrawals,
                COALESCE(SUM(CASE WHEN wr.status = 'completed' THEN wr.amount ELSE 0 END), 0) as total_withdrawn
            FROM user_profiles up
            LEFT JOIN user_tasks ut ON up.user_id = ut.user_id
            LEFT JOIN withdrawal_requests wr ON up.user_id = wr.user_id
            WHERE up.user_id = $1
            GROUP BY up.user_id
        `, [userId]);
        
        if (userInfo.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }
        
        const user = userInfo.rows[0];
        
        res.json({
            success: true,
            user: user,
            statistics: {
                total_earned: (user.balance || 0) + (user.total_withdrawn || 0),
                task_success_rate: user.total_tasks > 0 ? 
                    Math.round((user.completed_user_tasks / user.total_tasks) * 100) : 0,
                registration_date: new Date(user.created_at).toLocaleDateString('ru-RU')
            }
        });
        
    } catch (error) {
        console.error('Get user info error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// Простой endpoint для тестирования топа
app.get('/api/leaderboard/simple', async (req, res) => {
    try {
        const topUsers = await pool.query(`
            SELECT 
                user_id,
                first_name,
                username,
                COALESCE(completed_tasks, 0) as completed_tasks,
                COALESCE(balance, 0) as balance
            FROM user_profiles 
            ORDER BY COALESCE(completed_tasks, 0) DESC 
            LIMIT 5
        `);
        
        res.json({
            success: true,
            topUsers: topUsers.rows,
            debug: {
                total_users: topUsers.rows.length,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Simple leaderboard error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Диагностический endpoint для топа
app.get('/api/debug/leaderboard', async (req, res) => {
    try {
        // Проверяем общее количество пользователей
        const totalUsers = await pool.query('SELECT COUNT(*) FROM user_profiles');
        
        // Проверяем пользователей с выполненными заданиями
        const usersWithTasks = await pool.query(`
            SELECT COUNT(*) 
            FROM user_profiles 
            WHERE COALESCE(completed_tasks, 0) > 0
        `);
        
        // Проверяем структуру данных
        const sampleUsers = await pool.query(`
            SELECT 
                user_id,
                username,
                completed_tasks,
                balance,
                referral_count
            FROM user_profiles 
            ORDER BY COALESCE(completed_tasks, 0) DESC 
            LIMIT 5
        `);
        
        res.json({
            success: true,
            diagnostics: {
                total_users: parseInt(totalUsers.rows[0].count),
                users_with_completed_tasks: parseInt(usersWithTasks.rows[0].count),
                sample_data: sampleUsers.rows,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Leaderboard diagnostics error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 🔧 ФУНКЦИЯ ЗАГРУЗКИ ТОПА
// 🔧 ФУНКЦИЯ ЗАГРУЗКИ ЛИДЕРБОРДА
async function loadLeaderboard() {
    try {
        const leaderboardElement = document.getElementById('leaderboard-content');
        if (!leaderboardElement) return;
        
        // Показываем загрузку
        leaderboardElement.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div class="loading-spinner">⏳</div>
                <div style="margin-top: 16px;">Загружаем топ пользователей...</div>
            </div>
        `;
        
        const response = await fetch(`/api/leaderboard/top?userId=${currentUser?.id || ''}`);
        const result = await response.json();
        
        if (result.success) {
            displayLeaderboardWithAdminControls(
                result.topUsers, 
                result.currentUserRank, 
                result.currentUserStats
            );
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Load leaderboard error:', error);
        const leaderboardElement = document.getElementById('leaderboard-content');
        if (leaderboardElement) {
            leaderboardElement.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--error);">
                    <div>❌ Ошибка загрузки топа</div>
                    <div style="font-size: 12px; margin-top: 8px;">${error.message}</div>
                    <button class="btn btn-primary" onclick="loadLeaderboard()" style="margin-top: 16px;">
                        🔄 Попробовать снова
                    </button>
                </div>
            `;
        }
    }
}

// 🔧 ФУНКЦИЯ ЗАГРУЗКИ ТОПА ДЛЯ ГЛАВНОЙ СТРАНИЦЫ
async function loadTopUsers() {
    try {
        const response = await fetch('/api/leaderboard/top');
        const result = await response.json();
        
        if (result.success) {
            displayTopUsers(result.topUsers);
        } else {
            console.error('Failed to load top users:', result.error);
        }
    } catch (error) {
        console.error('Failed to load top users:', error);
    }
}

async function loadSimpleLeaderboard() {
    try {
        const response = await fetch('/api/leaderboard/simple');
        const result = await response.json();
        
        if (result.success) {
            displayLeaderboard(result.topUsers);
        }
    } catch (error) {
        console.error('Failed to load simple leaderboard:', error);
        showError('Топ временно недоступен');
    }
}

async function toggleUserBlock(chatId, adminId, targetUserId, messageId) {
    try {
        const userResult = await pool.query(
            'SELECT username, first_name, COALESCE(is_blocked, false) as is_blocked FROM user_profiles WHERE user_id = $1',
            [targetUserId]
        );
        
        if (userResult.rows.length === 0) {
            return await bot.editMessageText(
                '❌ Пользователь не найден',
                { chat_id: chatId, message_id: messageId }
            );
        }
        
        const user = userResult.rows[0];
        const newBlockStatus = !user.is_blocked;
        const actionText = newBlockStatus ? 'заблокирован' : 'разблокирован';
        const emoji = newBlockStatus ? '🚫' : '✅';
        
        // Обновляем статус блокировки
        await pool.query(
            'UPDATE user_profiles SET is_blocked = $1 WHERE user_id = $2',
            [newBlockStatus, targetUserId]
        );
        
        // Логируем действие
        await pool.query(`
            INSERT INTO admin_actions (admin_id, action_type, target_id, description) 
            VALUES ($1, $2, $3, $4)
        `, [adminId, 'user_block', targetUserId, 
            `Пользователь ${targetUserId} ${actionText}`]);
        
        await bot.editMessageText(
            `${emoji} <b>Пользователь ${actionText}!</b>\n\n` +
            `👤 ${user.first_name} (@${user.username})\n` +
            `🆔 ID: <code>${targetUserId}</code>\n` +
            `📊 Статус: ${newBlockStatus ? '🚫 Заблокирован' : '✅ Активен'}`,
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🔙 Назад', callback_data: `manage_user_${targetUserId}` },
                            { text: '🔄 Обновить', callback_data: `refresh_user_${targetUserId}` }
                        ]
                    ]
                }
            }
        );
        
        // Уведомляем пользователя
        if (bot) {
            try {
                await bot.sendMessage(
                    targetUserId,
                    newBlockStatus ? 
                    `🚫 <b>Ваш аккаунт заблокирован!</b>\n\n` +
                    `Ваш аккаунт был заблокирован администратором. ` +
                    `Для разблокировки обратитесь в поддержку.` :
                    `✅ <b>Ваш аккаунт разблокирован!</b>\n\n` +
                    `Ваш аккаунт был разблокирован администратором. ` +
                    `Теперь вы снова можете пользоваться ботом.`,
                    { parse_mode: 'HTML' }
                );
            } catch (error) {
                console.log('Не удалось отправить уведомление пользователю');
            }
        }
        
    } catch (error) {
        console.error('Toggle user block error:', error);
        await bot.editMessageText(
            '❌ Ошибка при изменении статуса блокировки',
            { chat_id: chatId, message_id: messageId }
        );
    }
}
// В server.js добавьте:
// В server.js добавьте:
app.get('/api/debug/user-id-columns', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                table_name,
                column_name,
                data_type,
                is_nullable
            FROM information_schema.columns 
            WHERE table_name IN ('user_profiles', 'user_tasks', 'task_verifications', 'withdrawal_requests', 'support_chats', 'support_messages')
            AND column_name LIKE '%user%id%'
            ORDER BY table_name, column_name
        `);
        
        res.json({
            success: true,
            columns: result.rows
        });
    } catch (error) {
        console.error('User ID columns debug error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// В server.js добавьте эту функцию:
// В server.js добавьте эту функцию:
async function fixUserIdColumns() {
    try {
        console.log('🔧 Fixing user_id columns to BIGINT...');
        
        const tablesToFix = [
            'user_profiles',
            'user_tasks', 
            'task_verifications',
            'withdrawal_requests',
            'support_chats',
            'support_messages',
            'admin_permissions',
            'referral_links',
            'referral_link_clicks',
            'referral_activations',
            'admin_notifications',
            'admin_actions'
        ];
        
        for (const table of tablesToFix) {
            try {
                // Проверяем существование таблицы
                const tableExists = await pool.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = $1
                    )
                `, [table]);
                
                if (!tableExists.rows[0].exists) {
                    console.log(`ℹ️ Table ${table} doesn't exist, skipping`);
                    continue;
                }
                
                // Проверяем колонки с user_id
                const columns = await pool.query(`
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = $1 
                    AND (column_name = 'user_id' OR column_name LIKE '%user%id%')
                `, [table]);
                
                for (const column of columns.rows) {
                    if (column.data_type === 'integer') {
                        console.log(`🔄 Changing ${table}.${column.column_name} from integer to bigint...`);
                        
                        try {
                            await pool.query(`
                                ALTER TABLE ${table} 
                                ALTER COLUMN ${column.column_name} TYPE BIGINT
                            `);
                            console.log(`✅ ${table}.${column.column_name} changed to BIGINT`);
                        } catch (alterError) {
                            console.log(`⚠️ Could not alter ${table}.${column.column_name}:`, alterError.message);
                        }
                    }
                }
                
            } catch (error) {
                console.log(`⚠️ Error processing table ${table}:`, error.message);
            }
        }
        
        console.log('✅ User ID columns fixed');
    } catch (error) {
        console.error('❌ Error fixing user_id columns:', error);
    }
}

// 🔧 ОБНОВЛЕННЫЙ ОБРАБОТЧИК CALLBACK-ЗАПРОСОВ
bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const chatId = message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;
    
    try {
        // Управление пользователями
        if (data.startsWith('manage_user_')) {
            const targetUserId = data.replace('manage_user_', '');
            const userResult = await pool.query(`
                SELECT * FROM user_profiles WHERE user_id = $1
            `, [targetUserId]);
            
            if (userResult.rows.length > 0) {
                await sendUserManagementPanel(chatId, userResult.rows[0]);
            }
        }
        
        else if (data.startsWith('balance_menu_')) {
            const targetUserId = data.replace('balance_menu_', '');
            await showBalanceManagement(chatId, userId, targetUserId, message.message_id);
        }
        
        else if (data.startsWith('balance_')) {
            const parts = data.replace('balance_', '').split('_');
            const action = parts[0];
            const targetUserId = parts[1];
            const amount = parts[2] ? parseInt(parts[2]) : 0;
            
            await handleBalanceAction(chatId, userId, targetUserId, action, amount, message.message_id);
        }
        
        else if (data.startsWith('user_stats_')) {
            const targetUserId = data.replace('user_stats_', '');
            await showUserDetailedStats(chatId, targetUserId, message.message_id);
        }
        
        else if (data.startsWith('block_user_')) {
            const targetUserId = data.replace('block_user_', '');
            await toggleUserBlock(chatId, userId, targetUserId, message.message_id);
        }
        
        else if (data.startsWith('refresh_user_')) {
            const targetUserId = data.replace('refresh_user_', '');
            const userResult = await pool.query(`
                SELECT * FROM user_profiles WHERE user_id = $1
            `, [targetUserId]);
            
            if (userResult.rows.length > 0) {
                await sendUserManagementPanel(chatId, userResult.rows[0]);
                await bot.deleteMessage(chatId, message.message_id);
            }
        }
        
        else if (data === 'new_search') {
            await bot.sendMessage(
                chatId,
                '🔍 <b>Поиск пользователей</b>\n\n' +
                'Введите команду:\n' +
                '<code>/search юзернейм</code> - поиск по юзернейму\n' +
                '<code>/search ID</code> - поиск по ID пользователя\n' +
                '<code>/search имя</code> - поиск по имени\n\n' +
                'Примеры:\n' +
                '<code>/search john_doe</code>\n' +
                '<code>/search 123456789</code>\n' +
                '<code>/search Иван</code>',
                { parse_mode: 'HTML' }
            );
            await bot.deleteMessage(chatId, message.message_id);
        }
        
        else if (data === 'users_list') {
            // Показать последних пользователей
            const usersResult = await pool.query(`
                SELECT * FROM user_profiles 
                ORDER BY created_at DESC 
                LIMIT 10
            `);
            
            if (usersResult.rows.length > 0) {
                await sendUsersList(chatId, usersResult.rows, 'последние пользователи');
                await bot.deleteMessage(chatId, message.message_id);
            }
        }
        
        // Подтверждаем обработку callback
        await bot.answerCallbackQuery(callbackQuery.id);
        
    } catch (error) {
        console.error('Callback query error:', error);
        await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Произошла ошибка' });
    }
});
// 🔍 ПРОВЕРКА ДОСТУПНОСТИ WEBHOOK
bot.onText(/\/check_webhook/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (parseInt(userId) !== ADMIN_ID) {
        return await bot.sendMessage(chatId, '❌ Только главный администратор может проверять вебхук.');
    }

    try {
        await bot.sendMessage(chatId, '🔍 Проверяю доступность вебхука...');

        const response = await fetch('https://telegram-community1-production-0bc1.up.railway.app/api/flyer/webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            'User-Agent': 'Flyer-Webhook-Test/1.0'
            },
            body: JSON.stringify({
                type: 'test',
                key_number: FLYER_API_KEY,
                data: { test: true }
            })
        });

        const result = await response.json();

        await bot.sendMessage(
            chatId,
            `📊 <b>Результат проверки вебхука:</b>\n\n` +
            `🌐 <b>URL:</b> https://telegram-community1-production-0bc1.up.railway.app/api/flyer/webhook\n` +
            `📡 <b>Статус:</b> ${response.status}\n` +
            `✅ <b>Ответ:</b> ${JSON.stringify(result)}\n` +
            `⏰ <b>Время:</b> ${new Date().toLocaleString()}`,
            { parse_mode: 'HTML' }
        );

    } catch (error) {
        await bot.sendMessage(
            chatId,
            `❌ <b>Ошибка проверки:</b> ${error.message}\n\n` +
            `Возможно, сервер недоступен извне.`,
            { parse_mode: 'HTML' }
        );
    }
});
// 📝 КОМАНДА ПОМОЩИ ПО УПРАВЛЕНИЮ ПОЛЬЗОВАТЕЛЯМИ
bot.onText(/\/user_help/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Проверяем права администратора
    const isAdmin = await checkAdminAccess(userId);
    if (!isAdmin) {
        return await bot.sendMessage(
            chatId,
            '❌ У вас нет прав для доступа к этой команде.'
        );
    }
    
    const helpText = `
🛠️ <b>СИСТЕМА УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ</b>

<b>Основные команды:</b>
<code>/search username</code> - поиск по юзернейму
<code>/search 123456</code> - поиск по ID
<code>/search Имя</code> - поиск по имени

<b>Функционал управления:</b>
• 💰 <b>Управление балансом</b> - пополнение, списание, сброс
• 🎭 <b>Права доступа</b> - назначение/снятие админа
• 📊 <b>Детальная статистика</b> - задания, выплаты, рефералы
• 🚫 <b>Блокировка</b> - блокировка/разблокировка пользователей
• 💸 <b>Управление выплатами</b> - история и статусы выплат

<b>Быстрые действия:</b>
• Пополнение баланса: +50, +100, +500 ⭐
• Списание средств: -50, -100, -500 ⭐  
• Сброс баланса: установка 0⭐
• Произвольная сумма: ввод любой суммы

<b>Уведомления:</b>
Пользователи автоматически получают уведомления о всех изменениях их баланса и статуса.
    `.trim();
    
    await bot.sendMessage(
        chatId,
        helpText,
        { 
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🔍 Начать поиск', callback_data: 'new_search' },
                        { text: '📋 Список пользователей', callback_data: 'users_list' }
                    ]
                ]
            }
        }
    );
});

// 🔧 ДОБАВЛЯЕМ КОЛОНКУ is_blocked В БАЗУ ДАННЫХ
async function addBlockedColumn() {
    try {
        await pool.query(`
            ALTER TABLE user_profiles 
            ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false
        `);
        console.log('✅ Column is_blocked added to user_profiles');
    } catch (error) {
        console.log('ℹ️ Column is_blocked already exists or error:', error.message);
    }
}

// Вызываем при инициализации
addBlockedColumn();
// Команда для отключения встроенной проверки подписки
bot.onText(/\/disable_builtin_op/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (parseInt(userId) !== ADMIN_ID) {
        return await bot.sendMessage(chatId, '❌ Только главный администратор может выполнять эту команду.');
    }
    
    try {
        await bot.sendMessage(
            chatId,
            '🔄 Отключаю встроенную проверку подписки...\n\n' +
            'Для полного отключения встроенного ОП:\n' +
            '1. Напишите @BotFather\n' +
            '2. Выберите вашего бота\n' +
            '3. Нажмите "Bot Settings"\n' +
            '4. Выберите "Domain List"\n' +
            '5. Удалите все домены из списка\n\n' +
            '✅ После этого проверка подписки будет работать только через Flyer API'
        );
    } catch (error) {
        console.error('Disable builtin OP error:', error);
    }
});
// 🛠️ КОМАНДА ДЛЯ ПРИНУДИТЕЛЬНОЙ НАСТРОЙКИ FLYER WEBHOOK
bot.onText(/\/force_setup_flyer/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (parseInt(userId) !== ADMIN_ID) {
        return await bot.sendMessage(chatId, '❌ Только главный администратор может настраивать Flyer.');
    }

    try {
        await bot.sendMessage(chatId, '🔄 Запускаю принудительную настройку Flyer webhook...');

        // Тестируем наш endpoint сначала
        const testResponse = await fetch(WEBHOOK_URL, {
            method: 'GET'
        });

        const testResult = await testResponse.json();
        
        if (!testResult.status) {
            throw new Error('Our webhook endpoint returns false status');
        }

        await bot.sendMessage(chatId, '✅ Наш вебхук отвечает корректно, настраиваю Flyer...');

        // Настраиваем вебхук через Flyer API
        const setupResponse = await fetch('https://api.flyerservice.io/set_webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key: FLYER_API_KEY,
                webhook: WEBHOOK_URL
            })
        });

        if (!setupResponse.ok) {
            const errorText = await setupResponse.text();
            throw new Error(`Flyer API: ${setupResponse.status} - ${errorText}`);
        }

        const setupResult = await setupResponse.json();
        
        await bot.sendMessage(
            chatId,
            `🎉 <b>Flyer webhook успешно настроен!</b>\n\n` +
            `🌐 <b>URL:</b> ${WEBHOOK_URL}\n` +
            `✅ <b>Статус:</b> Активен\n` +
            `📨 <b>Ответ Flyer:</b> ${JSON.stringify(setupResult)}\n\n` +
            `Теперь Flyer будет отправлять уведомления на ваш сервер.`,
            { parse_mode: 'HTML' }
        );

    } catch (error) {
        console.error('Force setup flyer error:', error);
        
        let errorMessage = `❌ <b>Ошибка настройки Flyer:</b> ${error.message}\n\n`;
        
        if (error.message.includes('404')) {
            errorMessage += `<b>Проблема:</b> Endpoint не найден\n`;
            errorMessage += `<b>Решение:</b> Убедитесь что URL вебхука корректен\n\n`;
        }
        
        errorMessage += `<b>Ручная настройка через curl:</b>\n\n` +
            `<code>curl -X POST "https://api.flyerservice.io/set_webhook" \\\n` +
            `-H "Content-Type: application/json" \\\n` +
            `-d '{"key": "${FLYER_API_KEY}", "webhook": "${WEBHOOK_URL}"}'</code>`;

        await bot.sendMessage(chatId, errorMessage, { parse_mode: 'HTML' });
    }
});
// 🧪 КОМАНДА ДЛЯ ТЕСТИРОВАНИЯ FLYER API
bot.onText(/\/test_flyer_api/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (parseInt(userId) !== ADMIN_ID) {
        return await bot.sendMessage(chatId, '❌ Только главный администратор может тестировать API.');
    }

    try {
        await bot.sendMessage(chatId, '🧪 Тестирую подключение к Flyer API...');

        const endpoints = [
            '/set_webhook',
            '/webhook',
            '/setWebhook', 
            '/get_me',
            '/check'
        ];

        let results = [];
        
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(`https://api.flyerservice.io${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        key: FLYER_API_KEY
                    })
                });

                results.push({
                    endpoint: endpoint,
                    status: response.status,
                    ok: response.ok
                });

            } catch (error) {
                results.push({
                    endpoint: endpoint,
                    error: error.message
                });
            }
        }

        let message = `🔍 <b>Результаты тестирования Flyer API:</b>\n\n`;
        
        results.forEach(result => {
            if (result.error) {
                message += `❌ ${result.endpoint}: ${result.error}\n`;
            } else {
                message += result.ok ? 
                    `✅ ${result.endpoint}: HTTP ${result.status}\n` :
                    `❌ ${result.endpoint}: HTTP ${result.status}\n`;
            }
        });

        message += `\n🔑 <b>API Key:</b> ${FLYER_API_KEY ? 'Настроен' : 'Отсутствует'}`;

        await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });

    } catch (error) {
        await bot.sendMessage(chatId, `❌ Ошибка тестирования: ${error.message}`);
    }
});
// 🔄 АЛЬТЕРНАТИВНЫЙ МЕТОД НАСТРОЙКИ WEBHOOK
bot.onText(/\/setup_flyer_alternative/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (parseInt(userId) !== ADMIN_ID) {
        return await bot.sendMessage(chatId, '❌ Только главный администратор может настраивать Flyer.');
    }

    try {
        await bot.sendMessage(chatId, '🔄 Пробую альтернативные методы настройки webhook...');

        // Метод 1: Попробуем через разные endpoints
        const endpoints = [
            '/set_webhook',
            '/webhook', 
            '/setWebhook',
            '/bot/set_webhook'
        ];

        let success = false;
        let lastError = '';

        for (const endpoint of endpoints) {
            try {
                await bot.sendMessage(chatId, `🔄 Пробую endpoint: ${endpoint}`);
                
                const response = await fetch(`https://api.flyerservice.io${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        key: FLYER_API_KEY,
                        webhook: WEBHOOK_URL
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    success = true;
                    
                    await bot.sendMessage(
                        chatId,
                        `🎉 <b>Успешно через ${endpoint}!</b>\n\n` +
                        `Ответ: ${JSON.stringify(result)}`,
                        { parse_mode: 'HTML' }
                    );
                    break;
                } else {
                    lastError = `${endpoint}: HTTP ${response.status}`;
                }
            } catch (error) {
                lastError = `${endpoint}: ${error.message}`;
            }
        }

        if (!success) {
            // Метод 2: Попробуем получить информацию о боте
            await bot.sendMessage(chatId, '🔄 Пробую получить информацию о боте...');
            
            try {
                const botInfoResponse = await fetch('https://api.flyerservice.io/get_me', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        key: FLYER_API_KEY
                    })
                });

                if (botInfoResponse.ok) {
                    const botInfo = await botInfoResponse.json();
                    
                    await bot.sendMessage(
                        chatId,
                        `🤖 <b>Информация о боте:</b>\n\n` +
                        `Статус: ${JSON.stringify(botInfo)}\n\n` +
                        `💡 <b>Рекомендация:</b> Обратитесь в поддержку Flyer для настройки webhook.`,
                        { parse_mode: 'HTML' }
                    );
                } else {
                    throw new Error(`get_me: HTTP ${botInfoResponse.status}`);
                }
            } catch (botError) {
                throw new Error(`Все методы failed. Последняя ошибка: ${lastError}, Bot info: ${botError.message}`);
            }
        }

    } catch (error) {
        await bot.sendMessage(
            chatId,
            `❌ <b>Все методы настройки не сработали:</b>\n\n` +
            `${error.message}\n\n` +
            `<b>Возможные причины:</b>\n` +
            `• Неправильный API ключ\n` +
            `• API временно недоступно\n` +
            `• Изменились endpoints API\n` +
            `• Требуется верификация аккаунта\n\n` +
            `<b>Решение:</b>\n` +
            `1. Проверьте ключ в @FlyerServiceBot\n` +
            `2. Обратитесь в поддержку Flyer\n` +
            `3. Используйте временно встроенную проверку подписки`,
            { parse_mode: 'HTML' }
        );
    }
});
// 🎯 ВРЕМЕННОЕ РЕШЕНИЕ - ВСТРОЕННАЯ ПРОВЕРКА ПОДПИСКИ
bot.onText(/\/use_builtin_check/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (parseInt(userId) !== ADMIN_ID) {
        return await bot.sendMessage(chatId, '❌ Только главный администратор может менять настройки.');
    }

    try {
        // Отключаем Flyer проверку временно
        process.env.USE_FLYER_CHECK = 'false';
        
        await bot.sendMessage(
            chatId,
            `🔧 <b>Переключено на встроенную проверку подписки!</b>\n\n` +
            `Теперь бот будет использовать встроенную проверку подписки на канал.\n\n` +
            `<b>Преимущества:</b>\n` +
            `• Мгновенная работа\n` +
            `• Не зависит от внешних API\n` +
            `• Простая настройка\n\n` +
            `<b>Чтобы вернуть Flyer:</b>\n` +
            `<code>/enable_flyer_check</code>`,
            { parse_mode: 'HTML' }
        );

    } catch (error) {
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});
// 🔧 КОМАНДА ДЛЯ ПРИНУДИТЕЛЬНОЙ НАСТРОЙКИ FLYER
bot.onText(/\/fix_flyer_webhook/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (parseInt(userId) !== ADMIN_ID) {
        return await bot.sendMessage(chatId, '❌ Только главный администратор может настраивать Flyer.');
    }

    try {
        await bot.sendMessage(chatId, '🔄 Запускаю улучшенную настройку Flyer webhook...');
        
        // 1. Проверяем текущий статус
        const status = await checkFlyerStatus();
        
        let message = `🔧 <b>Статус Flyer перед настройкой</b>\n\n`;
        message += `🌐 <b>API URL:</b> ${FLYER_API_URL}\n`;
        message += `🔑 <b>API Key:</b> ${FLYER_API_KEY ? '✅ настроен' : '❌ отсутствует'}\n`;
        message += `🔄 <b>Webhook URL:</b> ${WEBHOOK_URL}\n`;
        message += `📡 <b>Текущий статус:</b> ${status.status}\n\n`;
        
        await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        
        // 2. Настраиваем вебхук
        const setupResult = await setupFlyerWebhookEnhanced();
        
        if (setupResult.success) {
            await bot.sendMessage(
                chatId,
                `✅ <b>Flyer webhook успешно настроен!</b>\n\n` +
                `🌐 <b>URL:</b> ${WEBHOOK_URL}\n` +
                `🔄 <b>Статус:</b> Активен\n` +
                `⏰ <b>Время:</b> ${new Date().toLocaleString()}\n\n` +
                `<b>Тестируем вебхук...</b>`,
                { parse_mode: 'HTML' }
            );
            
            // 3. Тестируем вебхук
            const testResult = await testFlyerWebhook();
            
            if (testResult.success) {
                await bot.sendMessage(
                    chatId,
                    `🎉 <b>Вебхук полностью работоспособен!</b>\n\n` +
                    `✅ Настройка завершена успешно\n` +
                    `📨 Вебхук отвечает корректно\n` +
                    `🚀 Flyer интегрирован с ботом`,
                    { parse_mode: 'HTML' }
                );
            } else {
                await bot.sendMessage(
                    chatId,
                    `⚠️ <b>Вебхук настроен, но тест не пройден</b>\n\n` +
                    `Сообщение: ${testResult.error}\n\n` +
                    `Рекомендуется проверить логи сервера.`,
                    { parse_mode: 'HTML' }
                );
            }
            
        } else {
            throw new Error(setupResult.error);
        }
        
    } catch (error) {
        console.error('Fix flyer webhook error:', error);
        
        let errorMessage = `❌ <b>Ошибка настройки Flyer:</b> ${error.message}\n\n`;
        
        if (error.message.includes('404')) {
            errorMessage += `<b>Возможные причины:</b>\n`;
            errorMessage += `• Неправильный URL вебхука\n`;
            errorMessage += `• Сервер недоступен извне\n`;
            errorMessage += `• Ошибка в маршрутизации\n\n`;
        }
        
        errorMessage += `<b>Ручная настройка через curl:</b>\n\n` +
            `<code>curl -X POST "https://api.flyerservice.io/set_webhook" \\\n` +
            `  -H "Content-Type: application/json" \\\n` +
            `  -d '{"key": "${FLYER_API_KEY}", "webhook": "${WEBHOOK_URL}"}'</code>`;
            
        await bot.sendMessage(chatId, errorMessage, { parse_mode: 'HTML' });
    }
});
// Команда помощи по управлению пользователями
bot.onText(/\/admin_help/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Проверяем права администратора
    const isAdmin = await checkAdminAccess(userId);
    if (!isAdmin) {
        return await bot.sendMessage(
            chatId,
            '❌ У вас нет прав для доступа к этой команде.'
        );
    }
    
    const helpText = `
🛠️ <b>Команды для управления пользователями</b>

<b>Поиск пользователей:</b>
<code>/search_user username</code> - поиск по юзернейму
<code>/user 123456</code> - поиск по ID пользователя

<b>Управление балансом:</b>
• Пополнение счета
• Списание средств  
• Установка произвольной суммы
• Сброс баланса

<b>Управление правами:</b>
• Назначение администраторов
• Разжалование администраторов

<b>Просмотр статистики:</b>
• Детальная статистика заданий
• История выплат
• Реферальная статистика 

Для начала работы используйте команду поиска.
    `.trim();
    
    await bot.sendMessage(
        chatId,
        helpText,
        { parse_mode: 'HTML' }
    );
});

// Команда для настройки вебхука Flyer (только для админа)
// В server.js ОСТАВЬТЕ эту команду, но обновите URL
bot.onText(/\/setup_flyer/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (parseInt(userId) !== ADMIN_ID) {
        return await bot.sendMessage(chatId, '❌ Только главный администратор может настраивать Flyer.');
    }

    try {
        await bot.sendMessage(chatId, '🔄 Настраиваю вебхук Flyer...');

        const response = await fetch(`${FLYER_API_URL}/set_webhook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key: FLYER_API_KEY,
                webhook: 'https://telegram-community1-production-0bc1.up.railway.app/flyer_webhook'  // ← ИЗМЕНИТЕ НА PYTHON URL
            })
        });

        if (response.ok) {
            await bot.sendMessage(
                chatId,
                `✅ Вебхук Flyer успешно настроен!\n\nURL: https://ваш-домен/flyer_webhook`
            );
        } else {
            throw new Error(`HTTP ${response.status}`);
        }

    } catch (error) {
        console.error('Setup flyer error:', error);
        await bot.sendMessage(
            chatId,
            `❌ Ошибка настройки Flyer: ${error.message}`
        );
    }
});

// Команда для проверки статуса Flyer
bot.onText(/\/flyer_status/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (parseInt(userId) !== ADMIN_ID) {
        return await bot.sendMessage(chatId, '❌ Только главный администратор может проверять статус Flyer.');
    }

    try {
        const botInfo = await getFlyerBotInfo();
        const testCheck = await checkSubscriptionWithFlyer(userId, {
            first_name: 'Test',
            language_code: 'ru'
        });

        await bot.sendMessage(
            chatId,
            `🔧 **Flyer API Status**\n\n` +
            `✅ API Key: ${FLYER_API_KEY ? 'Configured' : 'Missing'}\n` +
            `🌐 API URL: ${FLYER_API_URL}\n` +
            `🔄 Webhook: ${WEBHOOK_URL}\n` +
            `🤖 Bot Info: ${botInfo.success ? 'Connected' : 'Error'}\n` +
            `🔍 Test Check: ${testCheck.status}\n` +
            `📝 Message: ${testCheck.message}`,
            { parse_mode: 'HTML' }
        );

    } catch (error) {
        await bot.sendMessage(
            chatId,
            `❌ Ошибка проверки Flyer: ${error.message}`
        );
    }
});

// 🔥 ОБНОВЛЕННАЯ КОМАНДА /referral
bot.onText(/\/referral/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
        const userResult = await pool.query(
            'SELECT referral_code, referral_count, referral_earned, first_name FROM user_profiles WHERE user_id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return await bot.sendMessage(chatId, '❌ Сначала зарегистрируйтесь с помощью /start');
        }
        
        const user = userResult.rows[0];
        const referralLink = `https://t.me/LinkGoldMoney_bot?start=${user.referral_code}`;
        const shareText = `Присоединяйся к LinkGold и начни зарабатывать Telegram Stars! 🚀 Получи 1⭐ за регистрацию по моей ссылке, а я получу 2⭐!`;
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`;
        
        await bot.sendMessage(
            chatId,
            `📢 <b>Реферальная программа LinkGold</b>\n\n` +
            `🎁 <b>Новая система:</b>\n` +
            `• Вы получаете: <strong>2⭐</strong> за каждого приглашенного\n` +
            `• Друг получает: <strong>1⭐</strong> за регистрацию\n` +
            `• Бонусы начисляются сразу\n\n` +
            `📊 <b>Ваша статистика:</b>\n` +
            `• Приглашено: <b>${user.referral_count || 0} чел.</b>\n` +
            `• Заработано: <b>${user.referral_earned || 0}⭐</b>\n\n` +
            `🔗 <b>Ваша ссылка:</b>\n<code>${referralLink}</code>`,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: '👥 Поделиться с друзьями',
                                url: shareUrl
                            }
                        ]
                    ]
                }
            }
        );
        
    } catch (error) {
        console.error('Referral command error:', error);
        await bot.sendMessage(chatId, '❌ Ошибка при получении реферальной ссылки.');
    }
});
// Команда для проверки баланса
bot.onText(/\/balance/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
        const userResult = await pool.query(
            'SELECT balance, referral_code, first_name FROM user_profiles WHERE user_id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return await bot.sendMessage(chatId, '❌ Сначала зарегистрируйтесь с помощью /start');
        }
        
        const user = userResult.rows[0];
        const balance = user.balance || 0;
        
        await bot.sendMessage(
            chatId,
            `💰 <b>Ваш баланс: ${balance}⭐</b>\n\n` +
            `<b>💫 LinkGold - биржа заработка Telegram Stars</b>\n` +
            `Выполняйте задания, приглашайте друзей и участвуйте в розыгрышах!\n\n` +
            `🚀 <b>Начните зарабатывать прямо сейчас!</b>`,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
              
                        [
                                {
                                    text: '📢 НАШ КАНАЛ',
                                    url: 'https://t.me/LinkGoldChannel1'
                                },
                                {
                                    text: '💬 ОТЗЫВЫ',
                                    url: 'https://t.me/repLinkGold'
                                }
                            ],
                            [
                                // В команде /balance обновите текст приглашения друзей:
{
    text: '👥 ПРИГЛАСИТЬ ДРУЗЕЙ',
    url: `https://t.me/share/url?url=https://t.me/LinkGoldMoney_bot?start=${userReferralCode}&text=🚀 Присоединяйся к LinkGold и начинай зарабатывать Telegram Stars! Получи 1⭐ за регистрацию и доступ к лучшим заданиям! 💫`
}
                            ],
                            [
                                {
                                    text: '📚 ГАЙДЫ ПО ЗАДАНИЯМ',
                                    url: 'https://t.me/LinkGoldGuide'
                                },
                               
                            ]
                    ]
                }
            }
        );
        
    } catch (error) {
        console.error('Balance command error:', error);
        await bot.sendMessage(chatId, '❌ Ошибка при проверке баланса.');
    }
});


// Обработчик callback кнопок
bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const chatId = message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;
    
    try {
        if (data === 'referral') {
            const userResult = await pool.query(
                'SELECT referral_code FROM user_profiles WHERE user_id = $1',
                [userId]
            );
            
            if (userResult.rows.length > 0) {
                const user = userResult.rows[0];
                const referralLink = `https://t.me/LinkGoldMoney_bot?start=${user.referral_code}`;
                const shareText = `Присоединяйся к LinkGold - бирже заработка Telegram Stars! 🚀 Выполняй задания, участвуй в розыгрышах и зарабатывай вместе со мной!`;
                const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`;
                
                await bot.sendMessage(
                    chatId,
                    `🔗 <b>Ваша реферальная ссылка:</b>\n<code>${referralLink}</code>\n\n` +
                    `🎁 <b>За каждого приглашенного друга:</b>\n` +
                    `• Вы получаете: 10⭐\n` +
                    `• Друг получает: 5⭐`,
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: '👥 Поделиться с друзьями',
                                        url: shareUrl
                                    }
                                    
                                ]
                            ]
                        }
                    }
                );
            }
        }
        

        if (data === 'send_notification') {
            // Проверяем права администратора
            const isAdmin = await checkAdminAccess(userId);
            if (!isAdmin) {
                await bot.answerCallbackQuery(callbackQuery.id, {
                    text: '❌ У вас нет прав для отправки уведомлений'
                });
                return;
            }
            
            await bot.sendMessage(
                chatId,
                '📢 <b>Отправка уведомления всем пользователям</b>\n\n' +
                'Введите команду:\n' +
                '<code>/notify [ваше сообщение]</code>\n\n' +
                'Пример:\n' +
                '<code>/notify Всем привет! Новые задания уже доступны!</code>',
                {
                    parse_mode: 'HTML'
                }
            );
        }
        
 if (data.startsWith('toggle_admin_')) {
            const targetUserId = data.replace('toggle_admin_', '');
            await toggleAdminStatus(chatId, userId, targetUserId, message.message_id);
        }
        
        else if (data.startsWith('manage_balance_')) {
            const targetUserId = data.replace('manage_balance_', '');
            await showBalanceManagement(chatId, userId, targetUserId, message.message_id);
        }
        
        else if (data.startsWith('refresh_user_')) {
            const targetUserId = data.replace('refresh_user_', '');
            await refreshUserInfo(chatId, targetUserId, message.message_id);
        }
        
        else if (data.startsWith('user_stats_')) {
            const targetUserId = data.replace('user_stats_', '');
            await showUserStats(chatId, targetUserId, message.message_id);
        }
        
        else if (data.startsWith('balance_action_')) {
            const [action, targetUserId, amount] = data.replace('balance_action_', '').split('_');
            await handleBalanceAction(chatId, userId, targetUserId, action, parseInt(amount), message.message_id);
        }
        
        // Подтверждаем обработку callback
        await bot.answerCallbackQuery(callbackQuery.id);
        
    } catch (error) {
        console.error('Callback query error:', error);
        await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Произошла ошибка' });
    }
});
// ... остальные endpoints остаются без изменений ...


// Переключение статуса администратора
async function toggleAdminStatus(chatId, adminId, targetUserId, messageId) {
    // Проверяем права - только главный админ может управлять админами
    if (parseInt(adminId) !== ADMIN_ID) {
        return await bot.sendMessage(
            chatId,
            '❌ Только главный администратор может управлять правами доступа.'
        );
    }
    
    try {
        const userResult = await pool.query(
            'SELECT is_admin, username, first_name FROM user_profiles WHERE user_id = $1',
            [targetUserId]
        );
        
        if (userResult.rows.length === 0) {
            return await bot.editMessageText(
                '❌ Пользователь не найден',
                { chat_id: chatId, message_id: messageId }
            );
        }
        
        const user = userResult.rows[0];
        const newAdminStatus = !user.is_admin;
        
        // Обновляем статус администратора
        await pool.query(
            'UPDATE user_profiles SET is_admin = $1 WHERE user_id = $2',
            [newAdminStatus, targetUserId]
        );
        
        // Добавляем права доступа если делаем админом
        if (newAdminStatus) {
            try {
                await pool.query(`
                    INSERT INTO admin_permissions (admin_id, can_posts, can_tasks, can_verification, can_support, can_payments)
                    VALUES ($1, true, true, true, true, true)
                    ON CONFLICT (admin_id) DO UPDATE SET 
                        can_posts = true,
                        can_tasks = true,
                        can_verification = true,
                        can_support = true,
                        can_payments = true
                `, [targetUserId]);
            } catch (error) {
                console.log('⚠️ Could not set admin permissions:', error.message);
            }
        }
        
        const actionText = newAdminStatus ? 'назначен администратором' : 'разжалован из администраторов';
        
        await bot.editMessageText(
            `✅ Пользователь ${user.first_name} (@${user.username}) ${actionText}!`,
            { chat_id: chatId, message_id: messageId }
        );
        
        // Отправляем уведомление пользователю
        if (bot) {
            try {
                await bot.sendMessage(
                    targetUserId,
                    newAdminStatus ? 
                    `🎉 <b>Поздравляем!</b>\n\nВы были назначены администратором в LinkGold!` :
                    `ℹ️ <b>Уведомление</b>\n\nВы больше не являетесь администратором LinkGold.`,
                    { parse_mode: 'HTML' }
                );
            } catch (error) {
                console.log('Не удалось отправить уведомление пользователю');
            }
        }
        
    } catch (error) {
        console.error('Toggle admin error:', error);
        await bot.editMessageText(
            '❌ Ошибка при изменении статуса администратора',
            { chat_id: chatId, message_id: messageId }
        );
    }
}

// Управление балансом пользователя
async function showBalanceManagement(chatId, adminId, targetUserId, messageId) {
    try {
        const userResult = await pool.query(
            'SELECT username, first_name, balance FROM user_profiles WHERE user_id = $1',
            [targetUserId]
        );
        
        if (userResult.rows.length === 0) {
            return await bot.editMessageText(
                '❌ Пользователь не найден',
                { chat_id: chatId, message_id: messageId }
            );
        }
        
        const user = userResult.rows[0];
        
        const messageText = `
💰 <b>Управление балансом</b>

👤 Пользователь: ${user.first_name} (@${user.username})
💫 Текущий баланс: <b>${user.balance || 0}⭐</b>

Выберите действие:
        `.trim();
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '➕ Пополнить 50⭐', callback_data: `balance_action_add_${targetUserId}_50` },
                    { text: '➕ Пополнить 100⭐', callback_data: `balance_action_add_${targetUserId}_100` }
                ],
                [
                    { text: '➖ Списать 50⭐', callback_data: `balance_action_remove_${targetUserId}_50` },
                    { text: '➖ Списать 100⭐', callback_data: `balance_action_remove_${targetUserId}_100` }
                ],
                [
                    { text: '🎯 Указать сумму', callback_data: `balance_action_custom_${targetUserId}` },
                    { text: '🔄 Сбросить баланс', callback_data: `balance_action_reset_${targetUserId}` }
                ],
                [
                    { text: '🔙 Назад', callback_data: `refresh_user_${targetUserId}` }
                ]
            ]
        };
        
        await bot.editMessageText(
            messageText,
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: keyboard
            }
        );
        
    } catch (error) {
        console.error('Show balance management error:', error);
        await bot.editMessageText(
            '❌ Ошибка при загрузке управления балансом',
            { chat_id: chatId, message_id: messageId }
        );
    }
}

// Обработка действий с балансом
async function handleBalanceAction(chatId, adminId, targetUserId, action, amount, messageId) {
    try {
        const userResult = await pool.query(
            'SELECT username, first_name, balance FROM user_profiles WHERE user_id = $1',
            [targetUserId]
        );
        
        if (userResult.rows.length === 0) {
            return await bot.editMessageText(
                '❌ Пользователь не найден',
                { chat_id: chatId, message_id: messageId }
            );
        }
        
        const user = userResult.rows[0];
        let newBalance = user.balance || 0;
        let actionText = '';
        
        switch (action) {
            case 'add':
                newBalance += amount;
                actionText = `пополнен на ${amount}⭐`;
                break;
                
            case 'remove':
                if (newBalance >= amount) {
                    newBalance -= amount;
                    actionText = `списано ${amount}⭐`;
                } else {
                    newBalance = 0;
                    actionText = `баланс сброшен (было недостаточно средств)`;
                }
                break;
                
            case 'reset':
                actionText = `сброшен до 0⭐`;
                newBalance = 0;
                break;
                
            case 'custom':
                // Здесь можно реализовать запрос произвольной суммы
                await bot.sendMessage(
                    chatId,
                    `Введите сумму для изменения баланса пользователя ${user.first_name}:\n\n` +
                    `Примеры:\n` +
                    `+100 - пополнить на 100⭐\n` +
                    `-50 - списать 50⭐\n` +
                    `=200 - установить баланс 200⭐`
                );
                // Сохраняем состояние для обработки следующего сообщения
                userBalanceState[adminId] = { targetUserId, action: 'custom' };
                return;
        }
        
        // Обновляем баланс в базе данных
        await pool.query(
            'UPDATE user_profiles SET balance = $1 WHERE user_id = $2',
            [newBalance, targetUserId]
        );
        
        // Логируем действие
        await pool.query(`
            INSERT INTO admin_actions (admin_id, action_type, target_id, description) 
            VALUES ($1, $2, $3, $4)
        `, [adminId, 'balance_update', targetUserId, `Баланс пользователя ${targetUserId} ${actionText}. Новый баланс: ${newBalance}⭐`]);
        
        await bot.editMessageText(
            `✅ Баланс пользователя ${user.first_name} ${actionText}\n\n` +
            `💫 Новый баланс: <b>${newBalance}⭐</b>`,
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML'
            }
        );
        
        // Уведомляем пользователя об изменении баланса
        if (bot && action !== 'custom') {
            try {
                let notificationText = '';
                if (action === 'add') {
                    notificationText = `🎉 Ваш баланс пополнен на ${amount}⭐ администратором!\n💫 Текущий баланс: ${newBalance}⭐`;
                } else if (action === 'remove') {
                    notificationText = `ℹ️ С вашего баланса списано ${amount}⭐ администратором.\n💫 Текущий баланс: ${newBalance}⭐`;
                } else if (action === 'reset') {
                    notificationText = `ℹ️ Ваш баланс был сброшен администратором.\n💫 Текущий баланс: ${newBalance}⭐`;
                }
                
                if (notificationText) {
                    await bot.sendMessage(targetUserId, notificationText);
                }
            } catch (error) {
                console.log('Не удалось отправить уведомление пользователю');
            }
        }
        
    } catch (error) {
        console.error('Handle balance action error:', error);
        await bot.editMessageText(
            '❌ Ошибка при изменении баланса',
            { chat_id: chatId, message_id: messageId }
        );
    }
}

// Обновление информации о пользователе
async function refreshUserInfo(chatId, targetUserId, messageId) {
    try {
        const userResult = await pool.query(`
            SELECT 
                up.user_id,
                up.username,
                up.first_name,
                up.last_name,
                up.balance,
                up.is_admin,
                up.created_at,
                up.referral_count,
                up.referral_earned,
                COUNT(ut.id) as total_tasks,
                COUNT(CASE WHEN ut.status = 'completed' THEN 1 END) as completed_tasks,
                COUNT(CASE WHEN ut.status = 'rejected' THEN 1 END) as rejected_tasks,
                COUNT(CASE WHEN ut.status = 'pending_review' THEN 1 END) as pending_tasks
            FROM user_profiles up
            LEFT JOIN user_tasks ut ON up.user_id = ut.user_id
            WHERE up.user_id = $1
            GROUP BY up.user_id
        `, [targetUserId]);
        
        if (userResult.rows.length === 0) {
            return await bot.editMessageText(
                '❌ Пользователь не найден',
                { chat_id: chatId, message_id: messageId }
            );
        }
        
        const user = userResult.rows[0];
        await sendUserInfo(chatId, user);
        
        // Удаляем старое сообщение
        await bot.deleteMessage(chatId, messageId);
        
    } catch (error) {
        console.error('Refresh user info error:', error);
        await bot.editMessageText(
            '❌ Ошибка при обновлении информации',
            { chat_id: chatId, message_id: messageId }
        );
    }
}

// Показать детальную статистику пользователя
async function showUserStats(chatId, targetUserId, messageId) {
    try {
        const statsResult = await pool.query(`
            SELECT 
                up.user_id,
                up.username,
                up.first_name,
                up.balance,
                up.created_at,
                -- Статистика по заданиям
                COUNT(ut.id) as total_tasks,
                COUNT(CASE WHEN ut.status = 'completed' THEN 1 END) as completed_tasks,
                COUNT(CASE WHEN ut.status = 'rejected' THEN 1 END) as rejected_tasks,
                COUNT(CASE WHEN ut.status = 'pending_review' THEN 1 END) as pending_tasks,
                COUNT(CASE WHEN ut.status = 'active' THEN 1 END) as active_tasks,
                -- Статистика по выплатам
                COUNT(wr.id) as withdrawal_requests,
                COUNT(CASE WHEN wr.status = 'completed' THEN 1 END) as completed_withdrawals,
                COALESCE(SUM(CASE WHEN wr.status = 'completed' THEN wr.amount ELSE 0 END), 0) as total_withdrawn,
                -- Реферальная статистика
                up.referral_count,
                up.referral_earned,
                -- Последняя активность
                MAX(ut.started_at) as last_task_activity
            FROM user_profiles up
            LEFT JOIN user_tasks ut ON up.user_id = ut.user_id
            LEFT JOIN withdrawal_requests wr ON up.user_id = wr.user_id
            WHERE up.user_id = $1
            GROUP BY up.user_id
        `, [targetUserId]);
        
        if (statsResult.rows.length === 0) {
            return await bot.editMessageText(
                '❌ Пользователь не найден',
                { chat_id: chatId, message_id: messageId }
            );
        }
        
        const stats = statsResult.rows[0];
        const lastActivity = stats.last_task_activity ? 
            new Date(stats.last_task_activity).toLocaleDateString('ru-RU') : 'нет активности';
        
        const messageText = `
📊 <b>Детальная статистика пользователя</b>

👤 <b>${stats.first_name}</b> (@${stats.username})
💫 <b>Баланс:</b> ${stats.balance || 0}⭐
📅 <b>Регистрация:</b> ${new Date(stats.created_at).toLocaleDateString('ru-RU')}
🕒 <b>Последняя активность:</b> ${lastActivity}

🎯 <b>Задания:</b>
• Всего: ${stats.total_tasks || 0}
• Выполнено: ${stats.completed_tasks || 0}
• Отклонено: ${stats.rejected_tasks || 0}
• На проверке: ${stats.pending_tasks || 0}
• Активные: ${stats.active_tasks || 0}

💳 <b>Выплаты:</b>
• Запросов: ${stats.withdrawal_requests || 0}
• Выведено: ${stats.completed_withdrawals || 0}
• Сумма: ${stats.total_withdrawn || 0}⭐

👥 <b>Рефералы:</b>
• Приглашено: ${stats.referral_count || 0}
• Заработано: ${stats.referral_earned || 0}⭐
        `.trim();
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🔙 Назад', callback_data: `refresh_user_${targetUserId}` }
                ]
            ]
        };
        
        await bot.editMessageText(
            messageText,
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: keyboard
            }
        );
        
    } catch (error) {
        console.error('Show user stats error:', error);
        await bot.editMessageText(
            '❌ Ошибка при загрузке статистики',
            { chat_id: chatId, message_id: messageId }
        );
    }
}

// Глобальная переменная для хранения состояния
const userBalanceState = {};

// Обработчик текстовых сообщений для ввода произвольной суммы
bot.on('message', async (msg) => {
    if (msg.text && !msg.text.startsWith('/')) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text.trim();
        
        // Проверяем, ожидаем ли мы ввод суммы для управления балансом
        if (userBalanceState[userId] && userBalanceState[userId].action === 'custom') {
            const { targetUserId } = userBalanceState[userId];
            delete userBalanceState[userId]; // Очищаем состояние
            
            try {
                let amount = 0;
                let action = '';
                let newBalance = 0;
                
                const userResult = await pool.query(
                    'SELECT username, first_name, balance FROM user_profiles WHERE user_id = $1',
                    [targetUserId]
                );
                
                if (userResult.rows.length === 0) {
                    return await bot.sendMessage(chatId, '❌ Пользователь не найден');
                }
                
                const user = userResult.rows[0];
                const currentBalance = user.balance || 0;
                
                // Парсим ввод пользователя
                if (text.startsWith('+')) {
                    amount = parseInt(text.substring(1));
                    action = 'add';
                    if (isNaN(amount) || amount <= 0) {
                        return await bot.sendMessage(chatId, '❌ Неверная сумма для пополнения');
                    }
                    newBalance = currentBalance + amount;
                    
                } else if (text.startsWith('-')) {
                    amount = parseInt(text.substring(1));
                    action = 'remove';
                    if (isNaN(amount) || amount <= 0) {
                        return await bot.sendMessage(chatId, '❌ Неверная сумма для списания');
                    }
                    newBalance = Math.max(0, currentBalance - amount);
                    
                } else if (text.startsWith('=')) {
                    amount = parseInt(text.substring(1));
                    action = 'set';
                    if (isNaN(amount) || amount < 0) {
                        return await bot.sendMessage(chatId, '❌ Неверная сумма для установки');
                    }
                    newBalance = amount;
                    
                } else {
                    return await bot.sendMessage(
                        chatId,
                        '❌ Неверный формат. Используйте:\n' +
                        '+100 - пополнить\n' +
                        '-50 - списать\n' +
                        '=200 - установить'
                    );
                }
                
                // Обновляем баланс
                await pool.query(
                    'UPDATE user_profiles SET balance = $1 WHERE user_id = $2',
                    [newBalance, targetUserId]
                );
                
                // Логируем действие
                await pool.query(`
                    INSERT INTO admin_actions (admin_id, action_type, target_id, description) 
                    VALUES ($1, $2, $3, $4)
                `, [userId, 'balance_update', targetUserId, `Баланс пользователя ${targetUserId} изменен: ${text}. Новый баланс: ${newBalance}⭐`]);
                
                await bot.sendMessage(
                    chatId,
                    `✅ Баланс пользователя ${user.first_name} обновлен!\n\n` +
                    `💫 Новый баланс: <b>${newBalance}⭐</b>`,
                    { parse_mode: 'HTML' }
                );
                
                // Уведомляем пользователя
                if (bot) {
                    try {
                        let notificationText = '';
                        if (action === 'add') {
                            notificationText = `🎉 Ваш баланс пополнен на ${amount}⭐ администратором!\n💫 Текущий баланс: ${newBalance}⭐`;
                        } else if (action === 'remove') {
                            notificationText = `ℹ️ С вашего баланса списано ${amount}⭐ администратором.\n💫 Текущий баланс: ${newBalance}⭐`;
                        } else if (action === 'set') {
                            notificationText = `ℹ️ Ваш баланс установлен на ${amount}⭐ администратором.\n💫 Текущий баланс: ${newBalance}⭐`;
                        }
                        
                        await bot.sendMessage(targetUserId, notificationText);
                    } catch (error) {
                        console.log('Не удалось отправить уведомление пользователю');
                    }
                }
                
            } catch (error) {
                console.error('Custom balance action error:', error);
                await bot.sendMessage(chatId, '❌ Ошибка при изменении баланса');
            }
        }
    }
});



// Улучшенный health check
app.get('/api/health', async (req, res) => {
  try {
    // Проверяем подключение к БД
    await pool.query('SELECT 1');
    
    // Проверяем основные таблицы
    const tables = ['user_profiles', 'tasks', 'user_tasks'];
    for (const table of tables) {
      await pool.query(`SELECT 1 FROM ${table} LIMIT 1`);
    }
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      services: ['api', 'database']
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Диагностика таблицы промокодов
app.get('/api/admin/promocodes/debug-structure', async (req, res) => {
    try {
        const structure = await pool.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'promocodes' 
            ORDER BY ordinal_position
        `);
        
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'promocodes'
            )
        `);
        
        res.json({
            success: true,
            table_exists: tableExists.rows[0].exists,
            columns: structure.rows,
            current_timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Promocodes structure debug error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// ==================== WITHDRAWAL REQUESTS FOR ADMINS ====================
// Endpoint для принудительного исправления таблицы промокодов
app.post('/api/admin/promocodes/fix-table', async (req, res) => {
    try {
        await fixPromocodesTable();
        
        // Проверяем структуру после исправления
        const structure = await pool.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'promocodes' 
            ORDER BY ordinal_position
        `);
        
        res.json({
            success: true,
            message: 'Таблица промокодов исправлена',
            structure: structure.rows
        });
    } catch (error) {
        console.error('Fix promocodes table error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// Предпросмотр изображения задания
function previewTaskImage(input) {
    const preview = document.getElementById('task-image-preview');
    const img = document.getElementById('task-preview-img');
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            img.src = e.target.result;
            preview.style.display = 'block';
        }
        
        reader.readAsDataURL(input.files[0]);
    } else {
        preview.style.display = 'none';
    }
}

// Очистка изображения
function clearTaskImage() {
    const input = document.getElementById('admin-task-image');
    const preview = document.getElementById('task-image-preview');
    
    input.value = '';
    preview.style.display = 'none';
}
async function fixTasksTable() {
    try {
        console.log('🔧 Checking and fixing tasks table structure...');
        
        // Проверяем существование колонки image_url
        const columnCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'tasks' AND column_name = 'image_url'
        `);
        
        if (columnCheck.rows.length === 0) {
            console.log('❌ Column image_url not found, adding...');
            await pool.query(`ALTER TABLE tasks ADD COLUMN image_url TEXT`);
            console.log('✅ Column image_url added successfully');
        } else {
            console.log('✅ Column image_url already exists');
        }
        
        // Проверяем другие важные колонки
        const columnsToCheck = [
            'created_by', 'category', 'time_to_complete', 
            'difficulty', 'people_required', 'repost_time', 'task_url'
        ];
        
        for (const column of columnsToCheck) {
            const exists = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'tasks' AND column_name = $1
            `, [column]);
            
            if (exists.rows.length === 0) {
                console.log(`❌ Column ${column} not found, adding...`);
                let columnType = 'TEXT';
                if (column === 'created_by') columnType = 'BIGINT';
                if (column === 'people_required') columnType = 'INTEGER';
                
                await pool.query(`ALTER TABLE tasks ADD COLUMN ${column} ${columnType}`);
                console.log(`✅ Column ${column} added`);
            }
        }
        
        console.log('✅ Tasks table structure verified and fixed');
    } catch (error) {
        console.error('❌ Error fixing tasks table:', error);
    }
}
async function addTask() {
    console.log('🎯 Starting add task function...');
    
    try {
        // Получаем значения из формы
        const taskData = {
            title: document.getElementById('admin-task-title').value.trim(),
            description: document.getElementById('admin-task-description').value.trim(),
            price: document.getElementById('admin-task-price').value,
            category: document.getElementById('admin-task-category').value,
            time_to_complete: document.getElementById('admin-task-time').value || '5-10 минут',
            difficulty: document.getElementById('admin-task-difficulty').value,
            people_required: document.getElementById('admin-task-people').value || 1,
            task_url: document.getElementById('admin-task-url').value || '',
            created_by: currentUser.id
        };

        console.log('📋 Form data collected:', taskData);

        // Валидация
        if (!taskData.title.trim()) {
            showNotification('Введите название задания!', 'error');
            return;
        }
        if (!taskData.description.trim()) {
            showNotification('Введите описание задания!', 'error');
            return;
        }
        if (!taskData.price) {
            showNotification('Введите цену задания!', 'error');
            return;
        }

        const price = parseFloat(taskData.price);
        if (isNaN(price) || price <= 0) {
            showNotification('Цена должна быть положительным числом!', 'error');
            return;
        }

        // Подготавливаем данные для отправки
        const requestData = {
            title: taskData.title.trim(),
            description: taskData.description.trim(),
            price: price,
            category: taskData.category || 'general',
            time_to_complete: taskData.time_to_complete || '5-10 минут',
            difficulty: taskData.difficulty || 'Легкая',
            people_required: parseInt(taskData.people_required) || 1,
            task_url: taskData.task_url || '',
            created_by: currentUser.id
        };

        console.log('📤 Sending request to server:', requestData);

        const result = await makeRequest('/api/tasks', {
            method: 'POST',
            body: JSON.stringify(requestData)
        });

        console.log('📨 Server response:', result);

        if (result.success) {
            showNotification('✅ Задание успешно создано!', 'success');
            
            // Очищаем форму
            clearTaskForm();
            
            // Обновляем списки заданий
            setTimeout(() => {
                loadAdminTasks();
                loadTasks();
            }, 1000);
            
        } else {
            throw new Error(result.error || 'Unknown server error');
        }

    } catch (error) {
        console.error('💥 Error in addTask:', error);
        showNotification(`❌ Ошибка создания задания: ${error.message}`, 'error');
    }
}
// Принудительное исправление таблицы промокодов
app.post('/api/admin/promocodes/fix-table', async (req, res) => {
    try {
        await fixPromocodesTable();
        
        // Проверяем структуру после исправления
        const structure = await pool.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'promocodes' 
            ORDER BY ordinal_position
        `);
        
        res.json({
            success: true,
            message: 'Таблица промокодов исправлена',
            structure: structure.rows
        });
    } catch (error) {
        console.error('Fix promocodes table error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/tasks', async (req, res) => {
    const { 
        title, 
        description, 
        price, 
        created_by,
        category,
        time_to_complete,
        difficulty,
        people_required,
        task_url
    } = req.body;
    
    console.log('🔍 Parsed data:', {
        title, description, price, created_by, category,
        time_to_complete, difficulty, people_required, task_url
    });
    
    // 🔧 ПРОВЕРКА ПРАВ АДМИНА
    if (!created_by) {
        return res.status(400).json({
            success: false,
            error: 'Отсутствует ID создателя'
        });
    }
    
    const isAdmin = await checkAdminAccess(created_by);
    if (!isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Только администратор может создавать задания!'
        });
    }
    
    
    // Базовая валидация
    if (!title || !description || !price) {
        console.log('❌ Validation failed: missing required fields');
        return res.status(400).json({
            success: false,
            error: 'Заполните все обязательные поля'
        });
    }
    
    try {
        const taskPrice = parseFloat(price);
        if (isNaN(taskPrice) || taskPrice <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Цена должна быть положительным числом!'
            });
        }

        console.log('💾 Saving task to database...');
        
          
        const result = await pool.query(`
            INSERT INTO tasks (
                title, description, price, created_by, category,
                time_to_complete, difficulty, people_required, task_url
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [
            title.trim(), 
            description.trim(), 
            taskPrice, 
            created_by,
            category || 'general',
            time_to_complete || '5-10 минут',
            difficulty || 'Легкая',
            parseInt(people_required) || 1,
            task_url || ''
        ]);
        
        console.log('✅ Task saved successfully:', result.rows[0]);
        
        res.json({
            success: true,
            message: 'Задание успешно создано!',
            task: result.rows[0]
        });
        
    } catch (error) {
        console.error('❌ Create task error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных: ' + error.message
        });
    }
});
// 🔧 ФУНКЦИЯ ДЛЯ ОТПРАВКИ СООБЩЕНИЙ О РЕФЕРАЛЬНЫХ НАЧИСЛЕНИЯХ В ЧАТ БОТА
// 🔧 ФУНКЦИЯ ДЛЯ ОТПРАВКИ СООБЩЕНИЙ О РЕФЕРАЛЬНЫХ НАЧИСЛЕНИЯХ В ЧАТ БОТА
async function sendReferralBonusNotification(userId, referrerId, newUserBonus, referrerBonus) {
    if (!bot) {
        console.log('⚠️ Bot not initialized, cannot send referral notification');
        return false;
    }

    try {
        // Получаем информацию о пользователях
        const [userResult, referrerResult] = await Promise.all([
            pool.query('SELECT first_name, username FROM user_profiles WHERE user_id = $1', [userId]),
            pool.query('SELECT first_name, username FROM user_profiles WHERE user_id = $1', [referrerId])
        ]);

        const user = userResult.rows[0];
        const referrer = referrerResult.rows[0];

        if (!user || !referrer) {
            console.log('❌ User or referrer not found for notification');
            return false;
        }

        // Сообщение для пригласившего
        const referrerMessage = `🎉 <b>НОВЫЙ РЕФЕРАЛ!</b>\n\n` +
                               `👤 <b>${user.first_name}</b> (@${user.username}) присоединился по вашей ссылке!\n\n` +
                               `✨ <b>Вы получили:</b> ${referrerBonus}⭐\n` +
                               `⭐ <b>Реферал получил:</b> ${newUserBonus}⭐\n\n` +
                               `🚀 Продолжайте приглашать друзей!`;

        // Сообщение для нового пользователя
        const newUserMessage = `🎁 <b>РЕФЕРАЛЬНЫЙ БОНУС!</b>\n\n` +
                              `Вы зарегистрировались по приглашению от ${referrer.first_name} и получили ${newUserBonus}⭐ на счет!\n\n` +
                              `💫 <b>Ваш текущий баланс:</b> ${newUserBonus}⭐\n\n` +
                              `👥 <b>Приглашайте друзей и получайте ${referrerBonus}⭐ за каждого!</b>`;

        // Отправляем уведомления в чат бота
        await Promise.all([
            bot.sendMessage(referrerId, referrerMessage, { parse_mode: 'HTML' }),
            bot.sendMessage(userId, newUserMessage, { parse_mode: 'HTML' })
        ]);

        console.log(`✅ Referral bonus notifications sent: ${referrerId} (${referrerBonus}⭐) and ${userId} (${newUserBonus}⭐)`);
        return true;

    } catch (error) {
        console.error(`❌ Error sending referral notifications:`, error);
        
        // Если пользователь заблокировал бот, пропускаем ошибку
        if (error.response && error.response.statusCode === 403) {
            console.log(`🚫 User blocked the bot`);
            return false;
        }
        
        return false;
    }
}

// 🔧 ИСПРАВЛЕННАЯ ФУНКЦИЯ РЕФЕРАЛЬНОЙ РЕГИСТРАЦИИ
async function handleReferralRegistration(userId, referralCode, userData) {
    try {
        console.log(`🔍 Processing referral registration for user ${userId} with code: ${referralCode}`);
        
        let referredBy = null;
        let referrerName = '';
        
        if (referralCode) {
            // 🔥 ИСПРАВЛЕНИЕ: используем код как есть, без удаления 'ref_'
            const cleanReferralCode = referralCode; // УБИРАЕМ .replace('ref_', '')
            
            // ПРОВЕРЯЕМ: был ли пользователь уже зарегистрирован в боте
            const existingUser = await pool.query(
                'SELECT user_id FROM user_profiles WHERE user_id = $1',
                [userId]
            );
            
            // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: если пользователь УЖЕ зарегистрирован - не начисляем бонусы
            if (existingUser.rows.length > 0) {
                console.log(`❌ Пользователь ${userId} уже зарегистрирован в боте - реферальные бонусы не начисляются`);
                
                // Находим информацию о пригласившем для сообщения
                const referrerResult = await pool.query(
                    'SELECT user_id, first_name FROM user_profiles WHERE referral_code = $1',
                    [cleanReferralCode]
                );
                
                if (referrerResult.rows.length > 0) {
                    const referrer = referrerResult.rows[0];
                    console.log(`ℹ️ Пользователь ${userId} повторно перешел по ссылке от ${referrer.user_id} - бонусы не начислены`);
                    
                    // Можно отправить сообщение пользователю
                    if (bot) {
                        try {
                            await bot.sendMessage(
                                userId,
                                `ℹ️ <b>Вы уже зарегистрированы в боте!</b>\n\n` +
                                `Реферальные бонусы начисляются только при первой регистрации.`,
                                { parse_mode: 'HTML' }
                            );
                        } catch (botError) {
                            console.log('Не удалось отправить уведомление:', botError.message);
                        }
                    }
                }
                
                return { referredBy: null, referrerName: '', alreadyRegistered: true };
            }
            
            // Ищем пользователя по реферальному коду (только для НОВЫХ пользователей)
            const referrerResult = await pool.query(
                'SELECT user_id, first_name, username, referral_earned FROM user_profiles WHERE referral_code = $1',
                [cleanReferralCode] // ✅ Теперь ищем с 'ref_' префиксом
            );
            
            if (referrerResult.rows.length > 0) {
                const referrer = referrerResult.rows[0];
                referredBy = referrer.user_id;
                referrerName = referrer.first_name;
                
                console.log(`🎯 Новый пользователь пришел по реферальной ссылке от: ${referredBy} (${referrerName})`);
                
                // 🔥 НЕМЕДЛЕННО НАЧИСЛЯЕМ БОНУСЫ ПРИ ПЕРВОЙ РЕГИСТРАЦИИ
                const client = await pool.connect();
                
                try {
                    await client.query('BEGIN');
                    
                    // 1. Пригласивший получает 2 звезды за регистрацию
                    await client.query(`
                        UPDATE user_profiles 
                        SET balance = COALESCE(balance, 0) + 2,
                            referral_earned = COALESCE(referral_earned, 0) + 2,
                            referral_count = COALESCE(referral_count, 0) + 1
                        WHERE user_id = $1
                    `, [referredBy]);
                    
                    // 2. Новый пользователь получает 1 звезду
                    await client.query(`
                        UPDATE user_profiles 
                        SET balance = COALESCE(balance, 0) + 1
                        WHERE user_id = $1
                    `, [userId]);
                    
                    await client.query('COMMIT');
                    
                    console.log(`✅ Реферальные бонусы применены: ${referredBy} получил 2⭐, ${userId} получил 1⭐`);
                    
                    // 🔥 ОТПРАВЛЯЕМ СООБЩЕНИЯ В ЧАТ БОТА
                    await sendReferralBonusNotification(userId, referredBy, 1, 2);
                    
                } catch (transactionError) {
                    await client.query('ROLLBACK');
                    console.error('❌ Ошибка транзакции реферальных бонусов:', transactionError);
                    throw transactionError;
                } finally {
                    client.release();
                }
                
            } else {
                console.log(`❌ Приглашающий не найден по коду: ${cleanReferralCode}`);
            }
        }
        
        return { referredBy, referrerName, alreadyRegistered: false };
        
    } catch (error) {
        console.error('❌ Ошибка обработки реферальной регистрации:', error);
        return { referredBy: null, referrerName: '', alreadyRegistered: false };
    }
}

// 🔧 УЛУЧШЕННАЯ ФУНКЦИЯ НАСТРОЙКИ ВЕБХУКА FLYER
async function setupFlyerWebhookEnhanced() {
    try {
        console.log('🚀 Starting enhanced Flyer webhook setup...');
        
        // Проверяем доступность нашего вебхука
        const webhookTest = await fetch(WEBHOOK_URL, {
            method: 'GET',
            timeout: 10000
        });
        
        if (!webhookTest.ok) {
            throw new Error(`Our webhook returns ${webhookTest.status} status`);
        }
        
        console.log('✅ Our webhook is accessible');
        
        // Пробуем разные endpoints для настройки вебхука
        const endpoints = [
            '/set_webhook',
            '/webhook', 
            '/setWebhook',
            '/setwebhook'
        ];
        
        let setupSuccess = false;
        let lastError = '';
        
        for (const endpoint of endpoints) {
            try {
                console.log(`🔄 Trying endpoint: ${endpoint}`);
                
                const response = await fetch(`${FLYER_API_URL}${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        key: FLYER_API_KEY,
                        webhook: WEBHOOK_URL
                    }),
                    timeout: 15000
                });
                
                if (response.ok) {
                    const result = await response.json();
                    console.log(`✅ Success with ${endpoint}:`, result);
                    setupSuccess = true;
                    break;
                } else {
                    lastError = `Endpoint ${endpoint}: HTTP ${response.status}`;
                    console.log(`❌ Failed with ${endpoint}: ${response.status}`);
                }
            } catch (error) {
                lastError = `Endpoint ${endpoint}: ${error.message}`;
                console.log(`❌ Error with ${endpoint}:`, error.message);
            }
        }
        
        if (setupSuccess) {
            return {
                success: true,
                message: 'Flyer webhook successfully configured!',
                webhookUrl: WEBHOOK_URL
            };
        } else {
            throw new Error(`All endpoints failed. Last error: ${lastError}`);
        }
        
    } catch (error) {
        console.error('❌ Enhanced webhook setup failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 🛠️ ФУНКЦИЯ ДЛЯ РУЧНОЙ НАСТРОЙКИ WEBHOOK
async function setupFlyerWebhookManually() {
    try {
        console.log('🔧 Setting up Flyer webhook manually...');

        const webhookUrl = 'https://telegram-community1-production-0bc1.up.railway.app/api/flyer/webhook';
        
        const response = await fetch('https://api.flyerservice.io/set_webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key: FLYER_API_KEY,
                webhook: webhookUrl
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Webhook setup successful:', result);
            return {
                success: true,
                result: result
            };
        } else {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

    } catch (error) {
        console.error('❌ Manual webhook setup error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
// Улучшенная команда для настройки вебхука
bot.onText(/\/setup_flyer_fixed/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (parseInt(userId) !== ADMIN_ID) {
        return await bot.sendMessage(chatId, '❌ Только главный администратор может настраивать Flyer.');
    }

    try {
        await bot.sendMessage(chatId, '🔄 Начинаю улучшенную настройку Flyer webhook...');

        // Тестируем наш вебхук сначала
        const testResponse = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'test',
                key_number: FLYER_API_KEY,
                data: {}
            })
        });

        if (!testResponse.ok) {
            throw new Error(`Our webhook returned ${testResponse.status}`);
        }

        const testResult = await testResponse.json();
        console.log('✅ Our webhook test result:', testResult);

        // Настраиваем вебхук через Flyer API
        const setupResponse = await fetch(`${FLYER_API_URL}/set_webhook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key: FLYER_API_KEY,
                webhook: WEBHOOK_URL
            })
        });

        const setupResult = await setupResponse.json();
        console.log('✅ Flyer setup response:', setupResult);

        if (setupResponse.ok) {
            await bot.sendMessage(
                chatId,
                `✅ <b>Flyer webhook успешно настроен!</b>\n\n` +
                `🌐 <b>URL:</b> ${WEBHOOK_URL}\n` +
                `🔄 <b>Статус:</b> Активен\n` +
                `📨 <b>Тест:</b> Пройден\n` +
                `⏰ <b>Время:</b> ${new Date().toLocaleString()}`,
                { parse_mode: 'HTML' }
            );
        } else {
            throw new Error(`Flyer API: ${setupResponse.status} - ${JSON.stringify(setupResult)}`);
        }

    } catch (error) {
        console.error('Setup flyer command error:', error);
        
        let errorMessage = `❌ <b>Ошибка настройки Flyer:</b> ${error.message}\n\n`;
        
        if (error.message.includes('404')) {
            errorMessage += `🔧 <b>Проблема:</b> Вебхук возвращает 404 ошибку\n`;
            errorMessage += `💡 <b>Решение:</b> Проверьте что endpoint правильно настроен\n\n`;
        }
        
        errorMessage += `<b>Ручная настройка через curl:</b>\n\n` +
            `<code>curl -X POST "https://api.flyerservice.io/set_webhook" \\\n` +
            `  -H "Content-Type: application/json" \\\n` +
            `  -d '{"key": "${FLYER_API_KEY}", "webhook": "${WEBHOOK_URL}"}'</code>`;

        await bot.sendMessage(chatId, errorMessage, { parse_mode: 'HTML' });
    }
});
// Команда для ручной настройки
bot.onText(/\/setup_flyer_manual/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (parseInt(userId) !== ADMIN_ID) {
        return await bot.sendMessage(chatId, '❌ Только главный администратор может настраивать Flyer.');
    }

    try {
        await bot.sendMessage(chatId, '🔄 Начинаю ручную настройку Flyer webhook...');

        const result = await setupFlyerWebhookManually();

        if (result.success) {
            await bot.sendMessage(
                chatId,
                `✅ <b>Flyer webhook успешно настроен!</b>\n\n` +
                `🌐 URL: https://telegram-community1-production-0bc1.up.railway.app/api/flyer/webhook\n` +
                `🔄 Статус: подключено`,
                { parse_mode: 'HTML' }
            );
        } else {
            throw new Error(result.error);
        }

    } catch (error) {
        console.error('Manual setup command error:', error);
        await bot.sendMessage(
            chatId,
            `❌ <b>Ошибка настройки Flyer:</b> ${error.message}\n\n` +
            `<b>Попробуйте выполнить вручную:</b>\n\n` +
            `<code>curl -X POST https://api.flyerservice.io/set_webhook \\\n  -H "Content-Type: application/json" \\\n  -d '{"key": "${FLYER_API_KEY}", "webhook": "https://telegram-community1-production-0bc1.up.railway.app/api/flyer/webhook"}'</code>`,
            { parse_mode: 'HTML' }
        );
    }
});
// Команда для проверки статуса вебхука
bot.onText(/\/webhook_status/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (parseInt(userId) !== ADMIN_ID) {
        return await bot.sendMessage(chatId, '❌ Только главный администратор может проверять статус вебхука.');
    }

    try {
        // Проверяем доступность нашего вебхука
        const testResponse = await fetch('https://telegram-community1-production-0bc1.up.railway.app/api/flyer/webhook', {
            method: 'GET'
        });

        let webhookStatus = '❌ Не отвечает';
        if (testResponse.ok) {
            webhookStatus = '✅ Работает';
        }

        await bot.sendMessage(
            chatId,
            `🔧 <b>Статус вебхука</b>\n\n` +
            `🌐 <b>URL:</b> https://telegram-community1-production-0bc1.up.railway.app/api/flyer/webhook\n` +
            `📡 <b>Статус:</b> ${webhookStatus}\n` +
            `🔑 <b>API Key:</b> ${FLYER_API_KEY ? 'Настроен' : 'Отсутствует'}\n\n` +
            `<b>Для настройки используйте:</b>\n` +
            `<code>/setup_flyer_manual</code>`,
            { parse_mode: 'HTML' }
        );

    } catch (error) {
        await bot.sendMessage(
            chatId,
            `❌ Ошибка проверки статуса: ${error.message}`
        );
    }
});
// 🧪 ФУНКЦИЯ ТЕСТИРОВАНИЯ ВЕБХУКА
async function testFlyerWebhook() {
    try {
        console.log('🧪 Testing Flyer webhook...');
        
        const testPayload = {
            type: 'test',
            key_number: FLYER_API_KEY,
            data: {
                test: true,
                user_id: ADMIN_ID,
                timestamp: new Date().toISOString()
            }
        };
        
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testPayload),
            timeout: 10000
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.status !== true) {
            throw new Error('Webhook returned false status');
        }
        
        console.log('✅ Webhook test successful:', result);
        
        return {
            success: true,
            response: result
        };
        
    } catch (error) {
        console.error('❌ Webhook test failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
// Отправка уведомлений всем пользователям (только для главного админа)
app.post('/api/admin/send-notification', async (req, res) => {
    const { adminId, message } = req.body;
    
    console.log('📢 Notification request from admin:', { adminId, message });
    
    try {
        // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: Проверяем что это именно главный админ
        if (parseInt(adminId) !== ADMIN_ID) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен. Только главный администратор может отправлять уведомления.'
            });
        }
        
        if (!message || message.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Сообщение не может быть пустым'
            });
        }
        
        // Сохраняем запись об уведомлении
        const notificationRecord = await pool.query(`
            INSERT INTO admin_notifications (admin_id, message, sent_count, failed_count) 
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [adminId, message, 0, 0]);
        
        // Получаем всех пользователей из базы данных
        const usersResult = await pool.query(
            'SELECT user_id FROM user_profiles WHERE user_id != $1',
            [adminId]
        );
        
        const users = usersResult.rows;
        console.log(`📨 Найдено ${users.length} пользователей для отправки уведомлений`);
        
        let successCount = 0;
        let failCount = 0;
        const failedUsers = [];
        
        // Отправляем уведомление каждому пользователю с обработкой ошибок
        for (const user of users) {
            try {
                if (bot) {
                    await bot.sendMessage(
                        user.user_id,
                        `📢 <b>Уведомление от администратора LinkGold:</b>\n\n${message}`,
                        { parse_mode: 'HTML' }
                    );
                    successCount++;
                    
                    // Задержка чтобы не превысить лимиты Telegram (20 сообщений в секунду)
                    await new Promise(resolve => setTimeout(resolve, 50));
                } else {
                    console.log('⚠️ Bot not initialized, skipping message send');
                    failCount++;
                    failedUsers.push({
                        user_id: user.user_id,
                        error: 'Bot not initialized'
                    });
                }
            } catch (error) {
                console.error(`❌ Ошибка отправки пользователю ${user.user_id}:`, error.message);
                failCount++;
                failedUsers.push({
                    user_id: user.user_id,
                    error: error.message
                });
                
                // Если ошибка связана с блокировкой бота, пропускаем пользователя
                if (error.response && error.response.statusCode === 403) {
                    console.log(`🚫 Бот заблокирован пользователем ${user.user_id}`);
                }
            }
        }
        
        // Обновляем статистику отправки
        await pool.query(`
            UPDATE admin_notifications 
            SET sent_count = $1, failed_count = $2 
            WHERE id = $3
        `, [successCount, failCount, notificationRecord.rows[0].id]);
        
        console.log(`✅ Уведомления отправлены: ${successCount} успешно, ${failCount} с ошибкой`);
        
        res.json({
            success: true,
            message: `Уведомление отправлено ${successCount} пользователям`,
            stats: {
                total: users.length,
                success: successCount,
                failed: failCount
            },
            failedUsers: failedUsers.length > 0 ? failedUsers.slice(0, 10) : undefined,
            notificationId: notificationRecord.rows[0].id
        });
        
    } catch (error) {
        console.error('❌ Send notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при отправке уведомлений: ' + error.message
        });
    }
});

// Полная статистика пользователей с детализацией
app.get('/api/admin/users-detailed-stats', async (req, res) => {
    const { adminId, limit = 50, offset = 0, search = '' } = req.query;
    
    console.log('📊 Detailed users stats request from admin:', adminId);
    
    try {
        // Проверяем права администратора
        const isAdmin = await checkAdminAccess(adminId);
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен. Только администраторы могут просматривать статистику.'
            });
        }
        
        // Основная статистика
        const mainStats = await pool.query(`
            SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN is_admin = true THEN 1 END) as admin_users,
                COUNT(CASE WHEN balance > 0 THEN 1 END) as users_with_balance,
                COUNT(CASE WHEN referred_by IS NOT NULL THEN 1 END) as referred_users,
                COUNT(CASE WHEN balance >= 200 THEN 1 END) as users_can_withdraw,
                SUM(COALESCE(balance, 0)) as total_balance,
                AVG(COALESCE(balance, 0)) as avg_balance,
                MAX(COALESCE(balance, 0)) as max_balance,
                SUM(COALESCE(referral_count, 0)) as total_referrals,
                SUM(COALESCE(referral_earned, 0)) as total_referral_earnings
            FROM user_profiles
            WHERE user_id != $1
        `, [ADMIN_ID]);
        
        // Статистика по активностям
        const activityStats = await pool.query(`
            SELECT 
                COUNT(DISTINCT user_id) as users_with_tasks,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
                COUNT(CASE WHEN status = 'pending_review' THEN 1 END) as pending_tasks,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_tasks,
                SUM(CASE WHEN status = 'completed' THEN t.price ELSE 0 END) as total_earned_from_tasks
            FROM user_tasks ut
            JOIN tasks t ON ut.task_id = t.id
        `);
        
        // Статистика по датам
        const dateStats = await pool.query(`
            SELECT 
                COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as new_today,
                COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_week,
                COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_month,
                TO_CHAR(created_at, 'YYYY-MM-DD') as date,
                COUNT(*) as daily_registrations
            FROM user_profiles 
            WHERE user_id != $1 AND created_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
            ORDER BY date DESC
            LIMIT 30
        `, [ADMIN_ID]);
        
        // Детальный список пользователей с поиском и пагинацией
        let usersQuery = `
            SELECT 
                up.user_id,
                up.username,
                up.first_name,
                up.last_name,
                up.balance,
                up.referral_count,
                up.referral_earned,
                up.referred_by,
                up.is_admin,
                up.created_at,
                ref.username as referrer_username,
                ref.first_name as referrer_name,
                COUNT(ut.id) as total_tasks,
                COUNT(CASE WHEN ut.status = 'completed' THEN 1 END) as completed_tasks,
                COUNT(CASE WHEN ut.status = 'pending_review' THEN 1 END) as pending_tasks,
                COALESCE(SUM(CASE WHEN ut.status = 'completed' THEN t.price ELSE 0 END), 0) as total_earned
            FROM user_profiles up
            LEFT JOIN user_profiles ref ON up.referred_by = ref.user_id
            LEFT JOIN user_tasks ut ON up.user_id = ut.user_id
            LEFT JOIN tasks t ON ut.task_id = t.id
        `;
        
        let queryParams = [ADMIN_ID];
        let whereConditions = ['up.user_id != $1'];
        let paramCount = 1;
        
        if (search) {
            paramCount++;
            whereConditions.push(`
                (up.username ILIKE $${paramCount} 
                 OR up.first_name ILIKE $${paramCount} 
                 OR up.last_name ILIKE $${paramCount}
                 OR up.user_id::text = $${paramCount})
            `);
            queryParams.push(`%${search}%`);
        }
        
        if (whereConditions.length > 0) {
            usersQuery += ' WHERE ' + whereConditions.join(' AND ');
        }
        
        usersQuery += `
            GROUP BY up.user_id, ref.username, ref.first_name
            ORDER BY up.created_at DESC
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `;
        
        queryParams.push(parseInt(limit), parseInt(offset));
        
        const usersResult = await pool.query(usersQuery, queryParams);
        
        // Топ рефералов
        const topReferrers = await pool.query(`
            SELECT 
                user_id,
                username,
                first_name,
                referral_count,
                referral_earned
            FROM user_profiles 
            WHERE referral_count > 0 
            ORDER BY referral_count DESC, referral_earned DESC 
            LIMIT 10
        `);
        
        // Топ пользователей по балансу
        const topBalances = await pool.query(`
            SELECT 
                user_id,
                username,
                first_name,
                balance
            FROM user_profiles 
            WHERE balance > 0 
            ORDER BY balance DESC 
            LIMIT 10
        `);
        
        res.json({
            success: true,
            stats: {
                main: mainStats.rows[0],
                activity: activityStats.rows[0],
                dates: dateStats.rows,
                top_referrers: topReferrers.rows,
                top_balances: topBalances.rows
            },
            users: usersResult.rows,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: parseInt(mainStats.rows[0].total_users)
            }
        });
        
    } catch (error) {
        console.error('❌ Get detailed users stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// Endpoint для начала задания с автоматическим скрытием
app.post('/api/user/tasks/start-with-hide', async (req, res) => {
    const { userId, taskId } = req.body;
    
    console.log('🚀 Start task with hide request:', { userId, taskId });
    
    if (!userId || !taskId) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // 1. Проверяем, выполнял ли пользователь это задание
        const existingTask = await client.query(`
            SELECT id FROM user_tasks 
            WHERE user_id = $1 AND task_id = $2 
            AND status IN ('active', 'pending_review', 'completed', 'rejected')
        `, [userId, taskId]);
        
        if (existingTask.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Вы уже выполняли это задание'
            });
        }
        
        // 2. Проверяем лимит выполнений задания
        const taskInfo = await client.query(`
            SELECT t.*, 
                   COUNT(ut.id) as completed_count
            FROM tasks t
            LEFT JOIN user_tasks ut ON t.id = ut.task_id AND ut.status = 'completed'
            WHERE t.id = $1 AND t.status = 'active'
            GROUP BY t.id
        `, [taskId]);
        
        if (taskInfo.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Задание не найдено или недоступно'
            });
        }
        
        const task = taskInfo.rows[0];
        const peopleRequired = task.people_required || 1;
        const completedCount = task.completed_count || 0;
        const remainingSlots = peopleRequired - completedCount;
        
        console.log(`📊 Task slots: ${completedCount}/${peopleRequired}, remaining: ${remainingSlots}`);
        
        // 3. Если это последний слот - помечаем задание как выполненное
        let taskHidden = false;
        if (remainingSlots === 1) {
            console.log(`🎯 Last slot taken! Hiding task ${taskId} for all users`);
            
            await client.query(`
                UPDATE tasks 
                SET status = 'completed' 
                WHERE id = $1
            `, [taskId]);
            
            taskHidden = true;
        }
        
        // 4. Start the task for user
        const result = await client.query(`
            INSERT INTO user_tasks (user_id, task_id, status) 
            VALUES ($1, $2, 'active')
            RETURNING *
        `, [userId, taskId]);
        
        await client.query('COMMIT');
        
        console.log('✅ Task started successfully:', {
            userTaskId: result.rows[0].id,
            taskHidden: taskHidden,
            remainingSlotsBefore: remainingSlots
        });
        
        res.json({
            success: true,
            message: taskHidden ? 
                'Задание начато! Это был последний доступный слот - задание скрыто для других пользователей.' : 
                'Задание начато!',
            userTaskId: result.rows[0].id,
            taskHidden: taskHidden,
            remainingSlots: remainingSlots - 1
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Start task with hide error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    } finally {
        client.release();
    }
});

// Добавьте проверку перед изменением баланса
app.post('/api/admin/balance/update', async (req, res) => {
    const { adminId, targetUserId, amount } = req.body;
    
    try {
        // Проверка прав администратора
        const isAdmin = await checkAdminAccess(adminId);
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        // Проверка существования пользователя
        const userCheck = await pool.query(
            'SELECT user_id FROM user_profiles WHERE user_id = $1',
            [targetUserId]
        );
        
        if (userCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }

        // Обновление баланса
        await pool.query(
            'UPDATE user_profiles SET balance = COALESCE(balance, 0) + $1 WHERE user_id = $2',
            [amount, targetUserId]
        );

        res.json({
            success: true,
            message: `Баланс пользователя ${targetUserId} обновлен на ${amount}⭐`
        });
        
    } catch (error) {
        console.error('Balance update error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных: ' + error.message
        });
    }
});

// Функция для проверки прав главного администратора
async function checkMainAdminAccess(userId) {
    try {
        // Главный админ имеет ID 8036875641
        if (parseInt(userId) === ADMIN_ID) {
            return true;
        }
        
        // Проверяем дополнительные права в базе данных
        const result = await pool.query(`
            SELECT up.is_admin, ap.can_admins 
            FROM user_profiles up
            LEFT JOIN admin_permissions ap ON up.user_id = ap.admin_id
            WHERE up.user_id = $1
        `, [userId]);
        
        if (result.rows.length > 0) {
            const user = result.rows[0];
            return user.is_admin === true && user.can_admins === true;
        }
        
        return false;
    } catch (error) {
        console.error('Main admin access check error:', error);
        return false;
    }
}
// Функция для автоматической проверки задания через LinkGoldMoney
async function checkTaskWithLinkGold(userId, taskData, screenshotUrl = null) {
    try {
        console.log('🔍 Starting automatic task verification with LinkGoldMoney...', {
            userId,
            taskId: taskData.id,
            screenshotUrl
        });

        const payload = {
            api_key: LINKGOLDMONEY_API_KEY,
            user_id: userId.toString(),
            task_id: taskData.id.toString(),
            task_title: taskData.title,
            task_description: taskData.description,
            task_price: taskData.price,
            timestamp: new Date().toISOString()
        };

        // Если есть скриншот, добавляем его в запрос
        if (screenshotUrl) {
            payload.screenshot_url = screenshotUrl;
        }

        console.log('📤 Sending request to LinkGoldMoney API...');

        const response = await fetch(`${LINKGOLDMONEY_API_URL}/check`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        console.log('✅ LinkGoldMoney API response:', result);

        return {
            success: true,
            approved: result.approved || false,
            message: result.message || 'Проверка завершена',
            details: result
        };

    } catch (error) {
        console.error('❌ LinkGoldMoney API error:', error);
        
        // Возвращаем результат для ручной проверки в случае ошибки API
        return {
            success: false,
            approved: false,
            message: 'Автоматическая проверка временно недоступна. Задание будет проверено вручную.',
            error: error.message
        };
    }
}
// ❌ УДАЛИТЕ этот endpoint (он дублируется)
// app.post('/api/user/tasks/:userTaskId/submit-auto', upload.single('screenshot'), async (req, res) => {

// ✅ ОСТАВЬТЕ только этот endpoint
app.post('/api/user/tasks/:userTaskId/submit-auto', upload.single('screenshot'), async (req, res) => {
    console.log('📸 Received screenshot submission request');
    
    try {
        const { userTaskId } = req.params;
        const { userId } = req.body;
        
        console.log('📋 Submission data:', {
            userTaskId,
            userId,
            hasFile: !!req.file,
            fileInfo: req.file ? {
                originalname: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype,
                filename: req.file.filename
            } : 'No file'
        });

        // 🔥 КРИТИЧЕСКАЯ ПРОВЕРКА: Убедитесь что файл получен
        if (!req.file) {
            console.error('❌ No file received in multer');
            return res.status(400).json({
                success: false,
                error: 'Файл не был получен сервером. Пожалуйста, попробуйте еще раз.'
            });
        }

        if (!userId) {
            // Удаляем загруженный файл при ошибке
            if (req.file) {
                try {
                    fs.unlinkSync(req.file.path);
                } catch (deleteError) {
                    console.error('Error deleting uploaded file:', deleteError);
                }
            }
            return res.status(400).json({
                success: false,
                error: 'User ID обязателен'
            });
        }
        
        // 🔥 ИСПРАВЛЕНИЕ: Используем правильный путь к файлу
        const screenshotUrl = `/uploads/${req.file.filename}`;
        console.log('📁 Screenshot URL:', screenshotUrl);
        console.log('📁 File path:', req.file.path);
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // 1. Проверяем существование задания и права пользователя
            const taskInfo = await client.query(`
                SELECT ut.user_id, ut.task_id, ut.status, 
                       u.first_name, u.last_name, u.username, 
                       t.title, t.price, t.description, t.people_required
                FROM user_tasks ut 
                JOIN user_profiles u ON ut.user_id = u.user_id 
                JOIN tasks t ON ut.task_id = t.id 
                WHERE ut.id = $1 AND ut.user_id = $2
            `, [userTaskId, userId]);
            
            if (taskInfo.rows.length === 0) {
                await client.query('ROLLBACK');
                // Удаляем загруженный файл
                try {
                    fs.unlinkSync(req.file.path);
                } catch (deleteError) {
                    console.error('Error deleting uploaded file:', deleteError);
                }
                return res.status(404).json({
                    success: false,
                    error: 'Задание не найдено или нет доступа'
                });
            }
            
            const taskData = taskInfo.rows[0];
            
            // Проверяем, что задание в активном статусе
            if (taskData.status !== 'active') {
                await client.query('ROLLBACK');
                // Удаляем загруженный файл
                try {
                    fs.unlinkSync(req.file.path);
                } catch (deleteError) {
                    console.error('Error deleting uploaded file:', deleteError);
                }
                return res.status(400).json({
                    success: false,
                    error: 'Задание не в активном статусе'
                });
            }
            
            const userName = `${taskData.first_name} ${taskData.last_name}`;

            // 2. Обновляем user_task
            await client.query(`
                UPDATE user_tasks 
                SET status = 'pending_review', 
                    screenshot_url = $1, 
                    submitted_at = CURRENT_TIMESTAMP 
                WHERE id = $2 AND user_id = $3
            `, [screenshotUrl, userTaskId, userId]);
            
            // 3. Создаем запись верификации
            const verificationResult = await client.query(`
                INSERT INTO task_verifications 
                (user_task_id, user_id, task_id, user_name, user_username, task_title, task_price, screenshot_url, status) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
                RETURNING *
            `, [
                userTaskId, 
                userId, 
                taskData.task_id, 
                userName, 
                taskData.username, 
                taskData.title, 
                taskData.price, 
                screenshotUrl
            ]);

            await client.query('COMMIT');

            console.log('✅ Task submitted successfully:', {
                verificationId: verificationResult.rows[0].id,
                userTaskId: userTaskId,
                userId: userId,
                screenshotUrl: screenshotUrl
            });
            
            res.json({
                success: true,
                message: 'Задание отправлено на проверку! Ожидайте решения администратора.',
                verificationId: verificationResult.rows[0].id,
                userTaskId: userTaskId,
                screenshotUrl: screenshotUrl
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Submit task error:', error);
            
            // Удаляем загруженный файл при ошибке
            if (req.file) {
                try {
                    fs.unlinkSync(req.file.path);
                    console.log('✅ Deleted uploaded file after error');
                } catch (deleteError) {
                    console.error('Error deleting uploaded file:', deleteError);
                }
            }
            
            res.status(500).json({
                success: false,
                error: 'Database error: ' + error.message
            });
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('❌ Submit task outer error:', error);
        
        // Удаляем загруженный файл при ошибке
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (deleteError) {
                console.error('Error deleting uploaded file:', deleteError);
            }
        }
        
        res.status(500).json({
            success: false,
            error: 'Server error: ' + error.message
        });
    }
});

// Диагностика multer
app.post('/api/debug/upload-test', upload.single('screenshot'), (req, res) => {
    console.log('🔍 Upload debug:', {
        body: req.body,
        file: req.file,
        headers: req.headers
    });
    
    if (!req.file) {
        return res.json({
            success: false,
            error: 'No file received',
            received: req.body
        });
    }
    
    res.json({
        success: true,
        file: {
            originalname: req.file.originalname,
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype,
            path: req.file.path
        }
    });
});
// ==================== FLYER API SETUP FUNCTIONS ====================

// Улучшенная функция настройки вебхука Flyer
async function setupFlyerWebhook() {
    try {
        console.log('🔧 Setting up Flyer webhook...');

        // Проверяем корректность URL вебхука
        const webhookUrl = WEBHOOK_URL.replace('//api', '/api'); // Исправляем двойной слеш
        console.log('🌐 Webhook URL:', webhookUrl);

        // Метод 1: Попробуем через /set_webhook
        try {
            console.log('🔄 Trying /set_webhook endpoint...');
            const response1 = await fetch(`${FLYER_API_URL}/set_webhook`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    key: FLYER_API_KEY,
                    webhook: webhookUrl
                }),
                timeout: 10000
            });

            if (response1.ok) {
                const result = await response1.json();
                console.log('✅ Webhook setup via /set_webhook:', result);
                return {
                    success: true,
                    method: 'set_webhook',
                    result: result
                };
            }
        } catch (error) {
            console.log('⚠️ /set_webhook failed:', error.message);
        }

        // Метод 2: Попробуем через /webhook
        try {
            console.log('🔄 Trying /webhook endpoint...');
            const response2 = await fetch(`${FLYER_API_URL}/webhook`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    key: FLYER_API_KEY,
                    url: webhookUrl
                }),
                timeout: 10000
            });

            if (response2.ok) {
                const result = await response2.json();
                console.log('✅ Webhook setup via /webhook:', result);
                return {
                    success: true,
                    method: 'webhook',
                    result: result
                };
            }
        } catch (error) {
            console.log('⚠️ /webhook failed:', error.message);
        }

        // Метод 3: Попробуем через /setWebhook (camelCase)
        try {
            console.log('🔄 Trying /setWebhook endpoint...');
            const response3 = await fetch(`${FLYER_API_URL}/setWebhook`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    key: FLYER_API_KEY,
                    webhook: webhookUrl
                }),
                timeout: 10000
            });

            if (response3.ok) {
                const result = await response3.json();
                console.log('✅ Webhook setup via /setWebhook:', result);
                return {
                    success: true,
                    method: 'setWebhook',
                    result: result
                };
            }
        } catch (error) {
            console.log('⚠️ /setWebhook failed:', error.message);
        }

        throw new Error('All webhook setup methods failed');

    } catch (error) {
        console.error('❌ Flyer webhook setup error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Функция для проверки статуса вебхука
async function checkFlyerWebhookStatus() {
    try {
        console.log('🔍 Checking Flyer webhook status...');

        const response = await fetch(`${FLYER_API_URL}/get_me`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key: FLYER_API_KEY
            }),
            timeout: 10000
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Flyer webhook status:', result);

        return {
            success: true,
            webhook: result.webhook,
            status: result.status,
            rawResponse: result
        };

    } catch (error) {
        console.error('❌ Flyer webhook status check error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Команда для принудительной настройки Flyer
bot.onText(/\/setup_flyer_force/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (parseInt(userId) !== ADMIN_ID) {
        return await bot.sendMessage(chatId, '❌ Только главный администратор может настраивать Flyer.');
    }

    try {
        await bot.sendMessage(chatId, '🔄 Начинаю настройку Flyer webhook...');

        // Проверяем текущий статус
        const status = await checkFlyerWebhookStatus();
        
        let message = `🔧 <b>Настройка Flyer Webhook</b>\n\n`;
        message += `🌐 <b>API URL:</b> ${FLYER_API_URL}\n`;
        message += `🔑 <b>API Key:</b> ${FLYER_API_KEY ? '✅ настроен' : '❌ отсутствует'}\n`;
        message += `🔄 <b>Webhook URL:</b> ${WEBHOOK_URL}\n\n`;

        if (status.success) {
            message += `📊 <b>Текущий статус:</b>\n`;
            message += `• Webhook: ${status.webhook || 'не настроен'}\n`;
            message += `• Статус: ${status.status || 'неизвестен'}\n\n`;
        }

        await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });

        // Пытаемся настроить вебхук
        const setupResult = await setupFlyerWebhook();

        if (setupResult.success) {
            await bot.sendMessage(
                chatId,
                `✅ <b>Flyer webhook успешно настроен!</b>\n\n` +
                `📝 Метод: ${setupResult.method}\n` +
                `🌐 URL: ${WEBHOOK_URL}\n` +
                `🔄 Статус: подключено`,
                { parse_mode: 'HTML' }
            );
        } else {
            throw new Error(setupResult.error);
        }

    } catch (error) {
        console.error('Setup flyer command error:', error);
        await bot.sendMessage(
            chatId,
            `❌ <b>Ошибка настройки Flyer:</b> ${error.message}\n\n` +
            `<b>Проверьте:</b>\n` +
            `• Корректность API ключа\n` +
            `• Доступность Flyer API\n` +
            `• URL вебхука: ${WEBHOOK_URL}\n\n` +
            `<b>Ручная настройка:</b>\n` +
            `Отправьте POST запрос на ${FLYER_API_URL}/set_webhook\n` +
            `с телом: {"key": "${FLYER_API_KEY}", "webhook": "${WEBHOOK_URL}"}`,
            { parse_mode: 'HTML' }
        );
    }
});


// Функция для проверки статуса Flyer
async function checkFlyerStatus() {
    try {
        console.log('🔍 Checking Flyer status...');

        const response = await fetch(`${FLYER_API_URL}/get_me`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key: FLYER_API_KEY
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        
        return {
            success: true,
            status: 'connected',
            botInfo: result,
            apiKey: FLYER_API_KEY ? 'configured' : 'missing',
            apiUrl: FLYER_API_URL,
            webhookUrl: WEBHOOK_URL,
            lastChecked: new Date().toISOString()
        };

    } catch (error) {
        console.error('Flyer status check error:', error);
        return {
            success: false,
            status: 'error',
            error: error.message,
            apiKey: FLYER_API_KEY ? 'configured' : 'missing',
            apiUrl: FLYER_API_URL,
            webhookUrl: WEBHOOK_URL,
            lastChecked: new Date().toISOString()
        };
    }
}

// Команда для проверки статуса Flyer
bot.onText(/\/flyer_status/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (parseInt(userId) !== ADMIN_ID) {
        return await bot.sendMessage(chatId, '❌ Только главный администратор может проверять статус Flyer.');
    }

    try {
        const status = await checkFlyerStatus();

        if (status.success) {
            await bot.sendMessage(
                chatId,
                `🔧 **Flyer API Status**\n\n` +
                `✅ Status: ${status.status}\n` +
                `🔑 API Key: ${status.apiKey}\n` +
                `🌐 API URL: ${status.apiUrl}\n` +
                `🔄 Webhook: ${status.webhookUrl}\n` +
                `🤖 Bot Info: ${status.botInfo ? 'Available' : 'N/A'}\n` +
                `📅 Last Check: ${new Date(status.lastChecked).toLocaleString()}`,
                { parse_mode: 'HTML' }
            );
        } else {
            await bot.sendMessage(
                chatId,
                `❌ **Flyer API Status**\n\n` +
                `🚫 Status: ${status.status}\n` +
                `🔑 API Key: ${status.apiKey}\n` +
                `🌐 API URL: ${status.apiUrl}\n` +
                `🔄 Webhook: ${status.webhookUrl}\n` +
                `💥 Error: ${status.error}\n` +
                `📅 Last Check: ${new Date(status.lastChecked).toLocaleString()}`,
                { parse_mode: 'HTML' }
            );
        }

    } catch (error) {
        await bot.sendMessage(
            chatId,
            `❌ Ошибка проверки Flyer: ${error.message}`
        );
    }
});

// Endpoint для проверки статуса Flyer через API
app.get('/api/admin/flyer-status', async (req, res) => {
    const { adminId } = req.query;

    try {
        // Проверка прав администратора
        const isAdmin = await checkAdminAccess(adminId);
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        const status = await checkFlyerStatus();
        res.json(status);

    } catch (error) {
        console.error('Flyer status API error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Автоматическая настройка вебхука при запуске сервера
async function initializeFlyer() {
    try {
        console.log('🚀 Initializing Flyer integration...');
        
        const status = await checkFlyerStatus();
        if (status.success) {
            console.log('✅ Flyer integration ready');
            
            // Автоматически настраиваем вебхук при запуске
            const setupResult = await setupFlyerWebhook();
            if (setupResult.success) {
                console.log('✅ Flyer webhook configured automatically');
            } else {
                console.log('⚠️ Flyer webhook auto-configuration failed:', setupResult.error);
            }
        } else {
            console.log('❌ Flyer integration failed:', status.error);
        }
    } catch (error) {
        console.error('❌ Flyer initialization error:', error);
    }
}

// Вызов инициализации Flyer при запуске сервера
initializeFlyer();
// Endpoint для ручного вызова проверки через LinkGoldMoney
app.post('/api/admin/task-verifications/:verificationId/check-with-linkgold', async (req, res) => {
    const verificationId = req.params.verificationId;
    const { adminId } = req.body;

    console.log('🔍 Manual LinkGoldMoney check request:', { verificationId, adminId });

    // Проверка прав администратора
    const isAdmin = await checkAdminAccess(adminId);
    if (!isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Доступ запрещен'
        });
    }

    try {
        // Получаем информацию о проверке
        const verificationResult = await pool.query(`
            SELECT tv.*, t.title, t.description, t.price, u.user_id
            FROM task_verifications tv
            JOIN tasks t ON tv.task_id = t.id
            JOIN user_profiles u ON tv.user_id = u.user_id
            WHERE tv.id = $1
        `, [verificationId]);

        if (verificationResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Проверка не найдена'
            });
        }

        const verification = verificationResult.rows[0];

        // Вызываем проверку через LinkGoldMoney
        const linkGoldResult = await checkTaskWithLinkGold(
            verification.user_id, 
            {
                id: verification.task_id,
                title: verification.task_title,
                description: verification.task_description,
                price: verification.task_price
            },
            verification.screenshot_url
        );

        // Обновляем статус проверки на основе результата
        if (linkGoldResult.success && linkGoldResult.approved) {
            // Если автоматически одобрено, выполняем стандартную процедуру одобрения
            await pool.query(`
                UPDATE task_verifications 
                SET status = 'approved', reviewed_at = NOW(), reviewed_by = $1, auto_verified = true
                WHERE id = $2
            `, [adminId, verificationId]);

            // Здесь можно добавить логику начисления средств и т.д.
        }

        res.json({
            success: true,
            verificationResult: linkGoldResult,
            message: linkGoldResult.success ? 
                `Проверка завершена: ${linkGoldResult.message}` : 
                'Ошибка автоматической проверки'
        });

    } catch (error) {
        console.error('LinkGoldMoney manual check error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка проверки: ' + error.message
        });
    }
});

// Endpoint для получения статуса интеграции LinkGoldMoney
// Endpoint для получения статуса интеграции LinkGoldMoney
app.get('/api/admin/linkgold-status', async (req, res) => {
    const { adminId } = req.query;

    // Проверка прав администратора
    const isAdmin = await checkAdminAccess(adminId);
    if (!isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Доступ запрещен'
        });
    }

    try {
        // Тестовый запрос к API LinkGoldMoney
        const testPayload = {
            api_key: LINKGOLDMONEY_API_KEY,
            test: true,
            timestamp: new Date().toISOString()
        };

        const response = await fetch(`${LINKGOLDMONEY_API_URL}/check`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testPayload)
        });

        const status = response.ok ? 'connected' : 'error';

        res.json({
            success: true,
            status: status,
            apiKey: LINKGOLDMONEY_API_KEY ? 'configured' : 'missing',
            apiUrl: LINKGOLDMONEY_API_URL,
            lastChecked: new Date().toISOString(),
            responseStatus: response.status
        });

    } catch (error) {
        console.error('LinkGoldMoney status check error:', error);
        res.json({
            success: false,
            status: 'error',
            error: error.message,
            apiKey: LINKGOLDMONEY_API_KEY ? 'configured' : 'missing',
            apiUrl: LINKGOLDMONEY_API_URL,
            lastChecked: new Date().toISOString()
        });
    }
});

// Обновите endpoint получения заданий
app.get('/api/tasks-with-auto-hide', async (req, res) => {
    const { search, category, userId } = req.query;
    
    console.log('📥 Получен запрос на задания с авто-скрытием: ', { search, category, userId });
    
    try {
        let query = `
            SELECT t.*, 
                   COUNT(ut.id) as completed_count,
                   EXISTS(
                       SELECT 1 FROM user_tasks ut2 
                       WHERE ut2.task_id = t.id 
                       AND ut2.user_id = $1 
                       AND ut2.status IN ('active', 'pending_review', 'completed')
                   ) as user_has_task,
                   EXISTS(
                       SELECT 1 FROM user_tasks ut3 
                       WHERE ut3.task_id = t.id 
                       AND ut3.user_id = $1 
                       AND ut3.status = 'rejected'
                   ) as user_has_rejected_task
            FROM tasks t 
            LEFT JOIN user_tasks ut ON t.id = ut.task_id AND ut.status = 'completed'
            WHERE t.status = 'active'
        `;
        let params = [userId];
        let paramCount = 1;
        
        if (search) {
            paramCount++;
            query += ` AND (t.title ILIKE $${paramCount} OR t.description ILIKE $${paramCount + 1})`;
            params.push(`%${search}%`, `%${search}%`);
            paramCount += 2;
        }
        
        if (category && category !== 'all') {
            paramCount++;
            query += ` AND t.category = $${paramCount}`;
            params.push(category);
        }
        
        query += ` GROUP BY t.id ORDER BY t.created_at DESC`;
        
        console.log('📊 Выполняем запрос с авто-скрытием');
        
        const result = await pool.query(query, params);
        
        // 🔥 АВТОМАТИЧЕСКИ СКРЫВАЕМ ЗАПОЛНЕННЫЕ ЗАДАНИЯ
        const tasksToHide = [];
        const availableTasks = result.rows.filter(task => {
            const completedCount = task.completed_count || 0;
            const peopleRequired = task.people_required || 1;
            const isAvailableByLimit = completedCount < peopleRequired;
            
            // Если задание заполнено - помечаем для скрытия
            if (!isAvailableByLimit) {
                tasksToHide.push(task.id);
            }
            
            return isAvailableByLimit;
        });
        
        // 🔥 СКРЫВАЕМ ЗАПОЛНЕННЫЕ ЗАДАНИЯ В БАЗЕ
        if (tasksToHide.length > 0) {
            console.log(`🎯 Авто-скрытие заполненных заданий: ${tasksToHide.join(', ')}`);
            
            await pool.query(`
                UPDATE tasks 
                SET status = 'completed' 
                WHERE id = ANY($1) AND status = 'active'
            `, [tasksToHide]);
        }
        
        // 🔥 ФИЛЬТРУЕМ задания которые пользователь уже начал ИЛИ ОТКЛОНЕНЫ
        const filteredTasks = availableTasks.filter(task => {
            const hasActiveTask = task.user_has_task;
            const hasRejectedTask = task.user_has_rejected_task;
            
            return !hasActiveTask && !hasRejectedTask;
        });
        
        console.log(`✅ Найдено заданий: ${result.rows.length}, доступно: ${availableTasks.length}, для пользователя: ${filteredTasks.length}, скрыто: ${tasksToHide.length}`);
        
        res.json({
            success: true,
            tasks: filteredTasks,
            stats: {
                totalCount: result.rows.length,
                availableByLimit: availableTasks.length,
                availableCount: filteredTasks.length,
                hiddenCount: tasksToHide.length
            }
        });
    } catch (error) {
        console.error('❌ Get tasks with auto-hide error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Добавьте также endpoint для принудительной проверки и скрытия заданий
app.post('/api/admin/hide-completed-tasks', async (req, res) => {
    const { adminId } = req.body;
    
    console.log('🔧 Принудительное скрытие заполненных заданий админом:', adminId);
    
    try {
        // Находим задания которые достигли лимита
        const completedTasks = await pool.query(`
            SELECT t.id, t.title, t.people_required, COUNT(ut.id) as completed_count
            FROM tasks t
            LEFT JOIN user_tasks ut ON t.id = ut.task_id AND ut.status = 'completed'
            WHERE t.status = 'active'
            GROUP BY t.id, t.title, t.people_required
            HAVING COUNT(ut.id) >= t.people_required
        `);
        
        if (completedTasks.rows.length === 0) {
            return res.json({
                success: true,
                message: 'Нет заданий для скрытия',
                hiddenCount: 0
            });
        }
        
        const taskIds = completedTasks.rows.map(task => task.id);
        
        // Скрываем задания
        await pool.query(`
            UPDATE tasks 
            SET status = 'completed' 
            WHERE id = ANY($1)
        `, [taskIds]);
        
        console.log(`✅ Скрыто заданий: ${taskIds.join(', ')}`);
        
        res.json({
            success: true,
            message: `Скрыто ${taskIds.length} заполненных заданий`,
            hiddenTasks: completedTasks.rows,
            hiddenCount: taskIds.length
        });
        
    } catch (error) {
        console.error('❌ Hide completed tasks error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// Endpoint для получения ранга пользователя
app.get('/api/user/:userId/rank', async (req, res) => {
    const userId = req.params.userId;
    
    try {
        console.log('🎯 Getting user rank for:', userId);
        
        // Получаем позицию пользователя в рейтинге
        const rankResult = await pool.query(`
            WITH user_ranking AS (
                SELECT 
                    up.user_id,
                    COUNT(CASE WHEN ut.status = 'completed' THEN 1 END) as completed_tasks,
                    COALESCE(up.balance, 0) as balance,
                    up.referral_count,
                    ROW_NUMBER() OVER (
                        ORDER BY 
                            COUNT(CASE WHEN ut.status = 'completed' THEN 1 END) DESC,
                            COALESCE(up.balance, 0) DESC,
                            up.created_at ASC
                    ) as position
                FROM user_profiles up
                LEFT JOIN user_tasks ut ON up.user_id = ut.user_id AND ut.status = 'completed'
                GROUP BY up.user_id, up.balance, up.referral_count, up.created_at
                HAVING COUNT(CASE WHEN ut.status = 'completed' THEN 1 END) > 0
                   OR COALESCE(up.balance, 0) > 0
            )
            SELECT * FROM user_ranking WHERE user_id = $1
        `, [userId]);
        
        if (rankResult.rows.length === 0) {
            return res.json({
                success: true,
                rank: null,
                completed_tasks: 0,
                balance: 0,
                referral_count: 0,
                message: 'Вы еще не в рейтинге. Выполните первое задание!'
            });
        }
        
        const userRank = rankResult.rows[0];
        
        // Получаем информацию о следующем месте
        const nextRankResult = await pool.query(`
            WITH user_ranking AS (
                SELECT 
                    up.user_id,
                    COUNT(CASE WHEN ut.status = 'completed' THEN 1 END) as completed_tasks,
                    COALESCE(up.balance, 0) as balance,
                    ROW_NUMBER() OVER (
                        ORDER BY 
                            COUNT(CASE WHEN ut.status = 'completed' THEN 1 END) DESC,
                            COALESCE(up.balance, 0) DESC,
                            up.created_at ASC
                    ) as position
                FROM user_profiles up
                LEFT JOIN user_tasks ut ON up.user_id = ut.user_id AND ut.status = 'completed'
                GROUP BY up.user_id, up.balance, up.created_at
                HAVING COUNT(CASE WHEN ut.status = 'completed' THEN 1 END) > 0
                   OR COALESCE(up.balance, 0) > 0
            )
            SELECT * FROM user_ranking WHERE position = $1
        `, [userRank.position - 1]);
        
        let nextRankInfo = 'Вы на первой позиции! 🎉';
        
        if (nextRankResult.rows.length > 0) {
            const nextUser = nextRankResult.rows[0];
            const tasksNeeded = nextUser.completed_tasks - userRank.completed_tasks;
            
            if (tasksNeeded > 0) {
                nextRankInfo = `Выполните еще ${tasksNeeded} заданий чтобы подняться на ${userRank.position - 1} место`;
            } else {
                nextRankInfo = 'Вы на максимальной позиции!';
            }
        }
        
        res.json({
            success: true,
            rank: userRank.position,
            completed_tasks: userRank.completed_tasks,
            balance: userRank.balance,
            referral_count: userRank.referral_count,
            next_rank_info: nextRankInfo
        });
        
    } catch (error) {
        console.error('❌ Get user rank error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения ранга: ' + error.message
        });
    }
});
// Создание реферальной ссылки с базовой статистикой
app.post('/api/admin/links/create', async (req, res) => {
    const { adminId, name, description, createdBy } = req.body;
    
    console.log('🔗 Create referral link request:', { adminId, name, description, createdBy });
    
    try {
        // Проверка прав администратора
        const isAdmin = await checkAdminAccess(adminId);
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен. Только администраторы могут создавать ссылки.'
            });
        }
        
        // Генерируем уникальный код
        const code = generateReferralCode();
        
        // Создаем ссылку на бота
        const referralUrl = `https://t.me/LinkGoldMoney_bot?start=${code}`;
        
        // Создаем запись в базе данных с начальной статистикой
        const result = await pool.query(`
            INSERT INTO referral_links (code, name, description, created_by, referral_url, total_clicks, unique_clicks, conversions) 
            VALUES ($1, $2, $3, $4, $5, 0, 0, 0)
            RETURNING *
        `, [code, name.trim(), description?.trim() || '', createdBy, referralUrl]);
        
        console.log('✅ Referral link created with tracking:', result.rows[0]);
        
        res.json({
            success: true,
            message: `Ссылка "${name}" успешно создана!`,
            link: result.rows[0],
            referralUrl: referralUrl
        });
        
    } catch (error) {
        console.error('❌ Create referral link error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных: ' + error.message
        });
    }
});


// Функция для проверки и восстановления таблицы referral_links
async function fixReferralLinksTable() {
    try {
        console.log('🔧 Checking referral_links table structure...');
        
        // Проверяем существование таблицы
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'referral_links'
            )
        `);
        
        if (!tableExists.rows[0].exists) {
            console.log('❌ referral_links table does not exist, creating...');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS referral_links (
                    id SERIAL PRIMARY KEY,
                    code VARCHAR(20) UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    created_by BIGINT NOT NULL,
                    referral_url TEXT NOT NULL,
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (created_by) REFERENCES user_profiles(user_id)
                )
            `);
            console.log('✅ referral_links table created');
        }
        
        
        // Проверяем и добавляем отсутствующие колонки
        const columnsToCheck = [
            {name: 'description', type: 'TEXT'},
            {name: 'is_active', type: 'BOOLEAN', defaultValue: 'true'},
            {name: 'created_at', type: 'TIMESTAMP', defaultValue: 'CURRENT_TIMESTAMP'}
        ];
        
        for (const column of columnsToCheck) {
            const columnExists = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'referral_links' AND column_name = $1
                )
            `, [column.name]);
            
            if (!columnExists.rows[0].exists) {
                console.log(`❌ Column ${column.name} missing, adding...`);
                await pool.query(`
                    ALTER TABLE referral_links 
                    ADD COLUMN ${column.name} ${column.type} 
                    ${column.defaultValue ? `DEFAULT ${column.defaultValue}` : ''}
                `);
                console.log(`✅ Column ${column.name} added`);
            }
        }
        
        console.log('✅ referral_links table structure verified');
    } catch (error) {
        console.error('❌ Error fixing referral_links table:', error);
    }
}

// Вызовите эту функцию при инициализации сервера
async function initializeServer() {
    await initDatabase();
    await fixReferralLinksTable(); // Добавьте эту строку
    await createSampleTasks();
}
// Получение списка ссылок
// Улучшенный endpoint для получения списка ссылок
app.get('/api/admin/links/list', async (req, res) => {
    const { adminId } = req.query;
    
    try {
        // Проверка прав администратора
        const isAdmin = await checkAdminAccess(adminId);
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }
        
        // Сначала проверяем и исправляем таблицу
        await fixReferralLinksTable();
        
        const result = await pool.query(`
            SELECT rl.*, 
                   up.username as creator_username,
                   up.first_name as creator_name,
                   COUNT(ra.id) as activation_count,
                   COALESCE(SUM(ra.reward_amount), 0) as total_earned
            FROM referral_links rl
            LEFT JOIN user_profiles up ON rl.created_by = up.user_id
            LEFT JOIN referral_activations ra ON rl.id = ra.link_id
            WHERE rl.is_active = true
            GROUP BY rl.id, up.username, up.first_name
            ORDER BY rl.created_at DESC
        `);
        
        console.log(`✅ Found ${result.rows.length} active referral links`);
        
        res.json({
            success: true,
            links: result.rows
        });
        
    } catch (error) {
        console.error('Get referral links error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Функция для восстановления потерянных ссылок
app.post('/api/admin/links/recover', async (req, res) => {
    const { adminId } = req.body;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Доступ запрещен'
        });
    }
    
    try {
        console.log('🔧 Attempting to recover referral links...');
        
        // 1. Проверяем структуру таблицы
        await fixReferralLinksTable();
        
        // 2. Проверяем, есть ли ссылки в базе
        const linksCount = await pool.query('SELECT COUNT(*) FROM referral_links WHERE is_active = true');
        
        // 3. Если ссылок нет, создаем пример
        if (parseInt(linksCount.rows[0].count) === 0) {
            console.log('📝 No links found, creating sample link...');
            
            const sampleCode = generateReferralCode();
            const sampleUrl = `https://t.me/LinkGoldMoney_bot?start=${sampleCode}`;
            
            await pool.query(`
                INSERT INTO referral_links (code, name, description, created_by, referral_url) 
                VALUES ($1, $2, $3, $4, $5)
            `, [sampleCode, 'Пример ссылки', 'Тестовая реферальная ссылка', ADMIN_ID, sampleUrl]);
            
            console.log('✅ Sample link created');
        }
        
        // 4. Получаем обновленный список
        const result = await pool.query(`
            SELECT * FROM referral_links 
            WHERE is_active = true 
            ORDER BY created_at DESC
        `);
        
        res.json({
            success: true,
            message: `Восстановлено ${result.rows.length} ссылок`,
            links: result.rows
        });
        
    } catch (error) {
        console.error('Recover links error:', error);
        res.status(500).json({
            success: false,
            error: 'Recovery error: ' + error.message
        });
    }
});

// Удаление ссылки
app.post('/api/admin/links/delete', async (req, res) => {
    const { adminId, code } = req.body;
    
    try {
        // Проверка прав администратора
        const isAdmin = await checkAdminAccess(adminId);
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }
        
        // Проверяем, может ли админ удалить эту ссылку
        const linkCheck = await pool.query(
            'SELECT created_by FROM referral_links WHERE code = $1',
            [code]
        );
        
        if (linkCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Ссылка не найдена'
            });
        }
        
        const linkCreator = linkCheck.rows[0].created_by;
        const isMainAdmin = parseInt(adminId) === ADMIN_ID;
        
        if (!isMainAdmin && parseInt(linkCreator) !== parseInt(adminId)) {
            return res.status(403).json({
                success: false,
                error: 'Вы можете удалять только свои ссылки!'
            });
        }
        
        // Деактивируем ссылку
        await pool.query(
            'UPDATE referral_links SET is_active = false WHERE code = $1',
            [code]
        );
        
        res.json({
            success: true,
            message: 'Ссылка успешно удалена!'
        });
        
    } catch (error) {
        console.error('Delete referral link error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// ==================== REFERRAL LINK TRACKING SYSTEM ====================
// 🧪 ТЕСТОВЫЙ ENDPOINT ДЛЯ ПРОВЕРКИ
app.get('/api/flyer/test-webhook', async (req, res) => {
    console.log('🧪 Test webhook endpoint called');
    
    // Имитируем запрос от Flyer
    const testPayload = {
        type: 'test',
        key_number: FLYER_API_KEY,
        data: {}
    };

    try {
        // Отправляем тестовый запрос на наш же вебхук
        const response = await fetch('https://telegram-community1-production-0bc1.up.railway.app/api/flyer/webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testPayload)
        });

        const result = await response.json();

        res.json({
            success: true,
            webhook_status: response.status,
            webhook_response: result,
            test_payload: testPayload,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Test webhook error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// Функция для создания реферальной ссылки
app.post('/api/referral-links/create', async (req, res) => {
    const { adminId, name, description } = req.body;
    
    console.log('🔗 Create referral link request:', { adminId, name, description });
    
    try {
        // Проверка прав администратора
        const isAdmin = await checkAdminAccess(adminId);
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен. Только администраторы могут создавать ссылки.'
            });
        }
        
        // Генерируем уникальный код
        const code = generateReferralCode();
        
        // Создаем ссылку на бота
        const referralUrl = `https://t.me/LinkGoldMoney_bot?start=ref_${code}`;
        
        // Создаем запись в базе данных
        const result = await pool.query(`
            INSERT INTO referral_links (code, name, description, created_by, referral_url) 
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [code, name.trim(), description?.trim() || '', adminId, referralUrl]);
        
        console.log('✅ Referral link created:', result.rows[0]);
        
        res.json({
            success: true,
            message: `Ссылка "${name}" успешно создана!`,
            link: result.rows[0],
            referralUrl: referralUrl
        });
        
    } catch (error) {
        console.error('❌ Create referral link error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных: ' + error.message
        });
    }
});
// 🔥 ENDPOINT ДЛЯ ОТСЛЕЖИВАНИЯ ПЕРЕХОДОВ ПО РЕФЕРАЛЬНЫМ ССЫЛКАМ
app.post('/api/referral-links/track-click', async (req, res) => {
    const { code, userId, ipAddress, userAgent } = req.body;
    
    try {
        console.log('🖱️ Tracking referral click:', { code, userId, ipAddress });
        
        // Находим ссылку по коду пользователя
        const linkResult = await pool.query(
            'SELECT user_id, referral_code FROM user_profiles WHERE referral_code = $1',
            [code]
        );
        
        if (linkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Referral link not found'
            });
        }
        
        const linkOwnerId = linkResult.rows[0].user_id;
        
        // Проверяем уникальность клика (по IP и user agent)
        const uniqueCheck = await pool.query(`
            SELECT id FROM referral_link_clicks 
            WHERE user_id = $1 AND ip_address = $2 AND user_agent = $3
            LIMIT 1
        `, [userId, ipAddress, userAgent]);
        
        const isUniqueClick = uniqueCheck.rows.length === 0;
        
        // Сохраняем информацию о клике
        await pool.query(`
            INSERT INTO referral_link_clicks (link_id, user_id, ip_address, user_agent)
            VALUES ($1, $2, $3, $4)
        `, [linkOwnerId, userId, ipAddress, userAgent]);
        
        // 🔥 МГНОВЕННО НАЧИСЛЯЕМ БОНУС ЗА ПЕРЕХОД
        if (isUniqueClick) {
            await pool.query(`
                UPDATE user_profiles 
                SET balance = COALESCE(balance, 0) + 1,
                    referral_earned = COALESCE(referral_earned, 0) + 1
                WHERE user_id = $1
            `, [linkOwnerId]);
            
            console.log(`✅ Transition bonus applied: ${linkOwnerId} got 1⭐ for click`);
        }
        
        console.log(`✅ Click tracked: user ${userId} -> owner ${linkOwnerId}, unique: ${isUniqueClick}`);
        
        res.json({
            success: true,
            isUnique: isUniqueClick,
            bonusApplied: isUniqueClick,
            message: 'Клик зарегистрирован'
        });
        
    } catch (error) {
        console.error('❌ Track click error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка отслеживания клика'
        });
    }
});
// Функция для отслеживания кликов по реферальным ссылкам
// Функция для отслеживания кликов по реферальным ссылкам
app.post('/api/referral-links/track-click', async (req, res) => {
    const { code, userId, ipAddress, userAgent } = req.body;
    
    try {
        console.log('🖱️ Tracking referral click:', { code, userId, ipAddress });
        
        // Находим ссылку по коду
        const linkResult = await pool.query(
            'SELECT id FROM referral_links WHERE code = $1 AND is_active = true',
            [code]
        );
        
        if (linkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Ссылка не найдена'
            });
        }
        
        const linkId = linkResult.rows[0].id;
        
        // Проверяем уникальность клика (по IP и user agent)
        const uniqueCheck = await pool.query(`
            SELECT id FROM referral_link_clicks 
            WHERE link_id = $1 AND ip_address = $2 AND user_agent = $3
            LIMIT 1
        `, [linkId, ipAddress, userAgent]);
        
        const isUniqueClick = uniqueCheck.rows.length === 0;
        
        // Сохраняем информацию о клике
        await pool.query(`
            INSERT INTO referral_link_clicks (link_id, user_id, ip_address, user_agent)
            VALUES ($1, $2, $3, $4)
        `, [linkId, userId, ipAddress, userAgent]);
        
        // Обновляем статистику в referral_links
        await pool.query(`
            UPDATE referral_links 
            SET total_clicks = total_clicks + 1,
                unique_clicks = unique_clicks + $1
            WHERE id = $2
        `, [isUniqueClick ? 1 : 0, linkId]);
        
        console.log(`✅ Click tracked: link ${linkId}, unique: ${isUniqueClick}`);
        
        // 🔥 НЕМЕДЛЕННО НАЧИСЛЯЕМ БОНУС ЗА ПЕРЕХОД
        if (isUniqueClick && userId) {
            try {
                // Находим создателя ссылки
                const creatorResult = await pool.query(
                    'SELECT created_by FROM referral_links WHERE id = $1',
                    [linkId]
                );
                
                if (creatorResult.rows.length > 0) {
                    const creatorId = creatorResult.rows[0].created_by;
                    
                    // Начисляем бонус за переход
                    await pool.query(`
                        UPDATE user_profiles 
                        SET balance = COALESCE(balance, 0) + 1,
                            referral_earned = COALESCE(referral_earned, 0) + 1
                        WHERE user_id = $1
                    `, [creatorId]);
                    
                    console.log(`✅ Transition bonus applied: ${creatorId} got 1⭐ for click`);
                }
            } catch (bonusError) {
                console.error('❌ Error applying transition bonus:', bonusError);
            }
        }
        
        res.json({
            success: true,
            isUnique: isUniqueClick,
            message: 'Клик зарегистрирован'
        });
        
    } catch (error) {
        console.error('❌ Track click error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка отслеживания клика'
        });
    }
});
// ==================== SUBGRAM API INTEGRATION ====================

const SUBGRAM_API_KEY = '849e4d1d215c57172c535e7a6fbedab62294721a38a36d3e3da158b3aedf34b';
const SUBGRAM_API_URL = 'https://api.subgram.org';

// Основная функция для получения спонсоров
async function getSubGramSponsors(userData) {
    try {
        console.log('🎯 Requesting SubGram sponsors for user:', userData.user_id);

        const requestBody = {
            chat_id: userData.chat_id || userData.user_id,
            user_id: userData.user_id,
            first_name: userData.first_name,
            username: userData.username,
            language_code: userData.language_code || 'ru',
            is_premium: userData.is_premium || false,
            action: 'subscribe',
            max_sponsors: 3
        };

        // Добавляем опциональные параметры если они есть
        if (userData.gender) requestBody.gender = userData.gender;
        if (userData.age) requestBody.age = userData.age;
        if (userData.exclude_resource_ids) requestBody.exclude_resource_ids = userData.exclude_resource_ids;
        if (userData.exclude_ads_ids) requestBody.exclude_ads_ids = userData.exclude_ads_ids;

        const response = await fetch(`${SUBGRAM_API_URL}/get-sponsors`, {
            method: 'POST',
            headers: {
                'Auth': SUBGRAM_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ SubGram API response:', result);

        return result;

    } catch (error) {
        console.error('❌ SubGram API error:', error);
        return {
            status: 'error',
            message: 'Failed to get sponsors',
            error: error.message
        };
    }
}

// Функция для проверки подписок пользователя
async function checkUserSubscriptions(userId, links = []) {
    try {
        console.log('🔍 Checking user subscriptions:', userId);

        const requestBody = {
            user_id: userId
        };

        if (links.length > 0) {
            requestBody.links = links;
        }

        const response = await fetch(`${SUBGRAM_API_URL}/get-user-subscriptions`, {
            method: 'POST',
            headers: {
                'Auth': SUBGRAM_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result;

    } catch (error) {
        console.error('❌ Check subscriptions error:', error);
        return {
            status: 'error',
            message: 'Failed to check subscriptions'
        };
    }
}
// ДОБАВЬТЕ ЭТОТ ENDPOINT
app.get('/api/flyer/debug-setup', async (req, res) => {
  try {
    console.log('🔧 Debug Flyer setup...');
    
    // 1. Проверяем переменные
    const envCheck = {
      FLYER_APL_KEY: process.env.FLYER_APL_KEY ? '✅' : '❌',
      FLYER_API_KEY: process.env.FLYER_API_KEY ? '✅' : '❌',
      APP_URL: process.env.APP_URL || '❌'
    };
    
    // 2. Проверяем доступность нашего вебхука
    const webhookTest = await fetch(WEBHOOK_URL);
    const webhookStatus = webhookTest.ok ? '✅ Доступен' : `❌ Ошибка ${webhookTest.status}`;
    
    // 3. Пробуем настроить вебхук
    let setupResult = 'Не выполнено';
    try {
      const response = await fetch('https://api.flyerservice.io/set_webhook', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          key: FLYER_API_KEY,
          webhook: WEBHOOK_URL
        })
      });
      setupResult = response.ok ? '✅ Успешно' : `❌ Ошибка ${response.status}`;
    } catch (error) {
      setupResult = `❌ ${error.message}`;
    }
    
    res.json({
      success: true,
      environment: envCheck,
      webhook: {
        url: WEBHOOK_URL,
        status: webhookStatus
      },
      setup: setupResult,
      used_api_key: FLYER_API_KEY ? '✅ Используется' : '❌ Отсутствует'
    });
    
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});
// Функция для управления ботами в SubGram
async function manageSubGramBot(action, botData = {}) {
    try {
        console.log('🤖  Managing SubGram bot:', action);

        const requestBody = {
            action: action,
            ...botData
        };

        const response = await fetch(`${SUBGRAM_API_URL}/bots`, {
            method: 'POST',
            headers: {
                'Auth': SUBGRAM_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result;

    } catch (error) {
        console.error('❌ Manage bot error:', error);
        return {
            status: 'error',
            message: 'Failed to manage bot'
        };
    }
}

// Middleware для проверки подписки через SubGram
async function checkSubscriptionWithSubGram(userId, userData) {
    try {
        console.log('🔐 Checking subscription with SubGram for user:', userId);

        // Получаем спонсоров для пользователя
        const sponsorsResult = await getSubGramSponsors({
            user_id: userId,
            chat_id: userId,
            first_name: userData.first_name,
            username: userData.username,
            language_code: 'ru',
            is_premium: false
        });

        // Обрабатываем разные статусы ответа
        switch (sponsorsResult.status) {
            case 'ok':
                // Пользователь подписан на все или нет подходящих спонсоров
                console.log('✅ User passed subscription check');
                return {
                    required: false,
                    status: 'subscribed'
                };

            case 'warning':
                // Требуется подписка
                console.log('📢 User needs to subscribe to sponsors');
                return {
                    required: true,
                    status: 'requires_subscription',
                    sponsors: sponsorsResult.sponsors || [],
                    message: 'Требуется подписка на спонсоров'
                };

            case 'register':
                // Требуется регистрация через WebApp
                console.log('📝 User needs registration');
                return {
                    required: true,
                    status: 'requires_registration',
                    registration_url: sponsorsResult.additional?.registration_url,
                    message: 'Требуется дополнительная информация'
                };

            case 'gender':
            case 'age':
                // Требуется указать пол/возраст
                console.log('👤 User needs to provide demographic info');
                return {
                    required: true,
                    status: `requires_${sponsorsResult.status}`,
                    message: `Требуется указать ${sponsorsResult.status === 'gender' ? 'пол' : 'возраст'}`
                };

            default:
                // В случае ошибки разрешаем доступ
                console.log('⚠️ SubGram check failed, allowing access');
                return {
                    required: false,
                    status: 'error',
                    message: 'Ошибка проверки подписки'
                };
        }

    } catch (error) {
        console.error('❌ Subscription check error:', error);
        // В случае ошибки разрешаем доступ
        return {
            required: false,
            status: 'error',
            message: error.message
        };
    }
}

// Функция для создания кнопок подписки
function createSubscriptionButtons(sponsors) {
    const buttons = [];
    
    // Добавляем кнопки для каждого спонсора
    sponsors.forEach(sponsor => {
        if (sponsor.available_now && sponsor.status === 'unsubscribed') {
            buttons.push([
                {
                    text: sponsor.button_text || 'Подписаться',
                    url: sponsor.link
                }
            ]);
        }
    });

    // Добавляем кнопку проверки подписки
    buttons.push([
        {
            text: '✅ Я подписался',
            callback_data: 'check_subgram_subscription'
        }
    ]);

    return buttons;
}

// ДОБАВЬТЕ В server.js
app.get('/api/flyer/debug', async (req, res) => {
  try {
    const testPayload = {
      key: FLYER_API_KEY,
      user_id: ADMIN_ID,
      language_code: 'ru'
    };

    // Тест подключения к Flyer API
    const response = await fetch(`${FLYER_API_URL}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });

    res.json({
      success: true,
      flyer_api: {
        status: response.status,
        ok: response.ok,
        key: FLYER_API_KEY ? 'configured' : 'missing',
        url: FLYER_API_URL
      },
      webhook: {
        url: WEBHOOK_URL,
        accessible: true
      },
      environment: {
        FLYER_APL_KEY: process.env.FLYER_APL_KEY ? 'set' : 'missing',
        APP_URL: process.env.APP_URL
      }
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      flyer_api: {
        key: FLYER_API_KEY ? 'configured' : 'missing',
        url: FLYER_API_URL
      }
    });
  }
});

// Функция для показа требований подписки
async function showSubscriptionRequired(chatId, sponsors, userId) {
    const messageText = `
📢 <b>ДЛЯ ДОСТУПА К LINKGOLD НЕОБХОДИМО ПОДПИСАТЬСЯ</b>

✨ <b>Подпишитесь на наши спонсорские каналы чтобы получить доступ к боту:</b>

🔸 Подписка бесплатна
🔸 Отписка возможна через 3 дня
🔸 Доступ к боту сразу после подписки

👇 <b>Выберите каналы для подписки:</b>
    `.trim();

    const buttons = createSubscriptionButtons(sponsors);

    await bot.sendMessage(chatId, messageText, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: buttons
        }
    });

    // Сохраняем информацию о спонсорах для пользователя
    await saveUserSponsors(userId, sponsors);
}

// Функция для показа требований регистрации
async function showRegistrationRequired(chatId, registrationUrl) {
    const messageText = `
📝 <b>ТРЕБУЕТСЯ ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ</b>

Для персонализации контента и предложений, пожалуйста, укажите дополнительную информацию о себе.

Это займет всего 1 минуту!
    `.trim();

    await bot.sendMessage(chatId, messageText, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: '✅ Заполнить анкету',
                        web_app: { url: registrationUrl }
                    }
                ],
                [
                    {
                        text: '🔄 Проверить снова',
                        callback_data: 'check_subgram_subscription'
                    }
                ]
            ]
        }
    });
}

// Сохранение спонсоров пользователя
async function saveUserSponsors(userId, sponsors) {
    try {
        // Здесь можно сохранить информацию о спонсорах в базу данных
        // для последующей проверки подписки
        console.log('💾 Saving user sponsors:', { userId, sponsorsCount: sponsors.length });
        
        // Временное решение - можно добавить в user_profiles или отдельную таблицу
        await pool.query(`
            INSERT INTO user_subgram_data (user_id, sponsors_data, last_check) 
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) 
            DO UPDATE SET sponsors_data = $2, last_check = CURRENT_TIMESTAMP
        `, [userId, JSON.stringify(sponsors)]);

    } catch (error) {
        console.error('❌ Save sponsors error:', error);
    }
}

// Обработчик проверки подписки
bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const chatId = message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    if (data === 'check_subgram_subscription') {
        await handleSubscriptionCheck(chatId, userId, callbackQuery);
    }
});

// Обработчик проверки подписки
async function handleSubscriptionCheck(chatId, userId, callbackQuery) {
    try {
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: '🔍 Проверяем подписки...'
        });

        // Проверяем подписку снова
        const subscriptionCheck = await checkSubscriptionWithSubGram(userId, {
            first_name: callbackQuery.from.first_name,
            username: callbackQuery.from.username
        });

        if (subscriptionCheck.required) {
            // Подписка все еще требуется
            await bot.sendMessage(chatId, '❌ Вы еще не подписались на все необходимые каналы. Пожалуйста, завершите подписку.');
        } else {
            // Подписка выполнена
            await bot.deleteMessage(chatId, message.message_id);
            await bot.sendMessage(chatId, '✅ Отлично! Проверка подписки пройдена. Теперь вы можете пользоваться ботом!');

            // Продолжаем регистрацию
            await processUserRegistration(chatId, callbackQuery.from, null);
        }

    } catch (error) {
        console.error('❌ Subscription check handler error:', error);
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ Ошибка проверки подписки'
        });
    }
}

async function processUserRegistration(chatId, user, referralCode) {
    try {
        console.log('👤 Processing user registration:', user.id);
        
        // Ваш существующий код регистрации пользователя
        // Перенесите сюда основную логику из обработчика /start
        
        const userData = {
            id: user.id,
            firstName: user.first_name || 'Пользователь',
            lastName: user.last_name || '',
            username: user.username || `user_${user.id}`
        };
        
        // ... остальная логика регистрации
        
    } catch (error) {
        console.error('❌ User registration error:', error);
        throw error;
    }
}

// Endpoint для админ-панели SubGram
app.get('/api/admin/subgram-status', async (req, res) => {
    const { adminId } = req.query;

    try {
        // Проверка прав администратора
        const isAdmin = await checkAdminAccess(adminId);
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        // Получаем информацию о боте в SubGram
        const botInfo = await manageSubGramBot('info', {
            bot_id: await getBotSubGramId() // Нужно получить ID бота в SubGram
        });

        // Получаем статистику
        const testResult = await getSubGramSponsors({
            user_id: adminId,
            chat_id: adminId,
            first_name: 'Test',
            username: 'test_admin'
        });

        res.json({
            success: true,
            subgram: {
                api_key_configured: !!SUBGRAM_API_KEY,
                bot_status: botInfo.status,
                test_request: testResult.status,
                last_checked: new Date().toISOString()
            },
            botInfo: botInfo,
            testResult: testResult
        });

    } catch (error) {
        console.error('SubGram status error:', error);
        res.status(500).json({
            success: false,
            error: 'SubGram check failed: ' + error.message
        });
    }
});

// Функция для получения ID бота в SubGram
async function getBotSubGramId() {
    // Здесь можно сохранить ID бота при регистрации
    // Пока используем дефолтное значение или получаем из базы
    return await pool.query('SELECT subgram_bot_id FROM bot_settings LIMIT 1')
        .then(result => result.rows[0]?.subgram_bot_id || 'default_bot_id');
}

// Создаем таблицу для данных SubGram при инициализации
async function createSubGramTables() {
    try {
        console.log('🔧 Creating SubGram tables...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_subgram_data (
                user_id BIGINT PRIMARY KEY,
                sponsors_data JSONB,
                last_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS bot_settings (
                id SERIAL PRIMARY KEY,
                subgram_bot_id TEXT,
                subgram_api_key TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ SubGram tables created');
    } catch (error) {
        console.error('❌ Error creating SubGram tables:', error);
    }
}

// Добавьте вызов в функцию инициализации
async function initializeServer() {
    await initDatabase();
    await createSubGramTables(); // Добавьте эту строку
    await createSampleTasks();
    
    console.log('✅ Server initialization complete with SubGram integration');
}
// 🔥 ENDPOINT ДЛЯ МГНОВЕННОЙ ПРОВЕРКИ РЕФЕРАЛЬНЫХ НАЧИСЛЕНИЙ
app.get('/api/user/:userId/instant-referral-stats', async (req, res) => {
    const userId = req.params.userId;
    
    console.log('📊 Instant referral stats request for user:', userId);
    
    try {
        // Получаем основную статистику пользователя
        const userResult = await pool.query(`
            SELECT 
                up.user_id,
                up.username,
                up.first_name,
                up.balance,
                up.referral_count,
                up.referral_earned,
                up.referred_by,
                up.created_at,
                -- Статистика переходов по ссылкам
                COUNT(rlc.id) as total_clicks,
                COUNT(DISTINCT rlc.id) as unique_clicks,
                -- Статистика реферальных активаций
                COUNT(ra.id) as referral_activations,
                COALESCE(SUM(ra.reward_amount), 0) as total_referral_rewards
            FROM user_profiles up
            LEFT JOIN referral_links rl ON up.user_id = rl.created_by
            LEFT JOIN referral_link_clicks rlc ON rl.id = rlc.link_id
            LEFT JOIN referral_activations ra ON rl.id = ra.link_id
            WHERE up.user_id = $1
            GROUP BY up.user_id
        `, [userId]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }
        
        const user = userResult.rows[0];
        
        // Получаем информацию о реферере (если есть)
        let referrerInfo = null;
        if (user.referred_by) {
            const referrerResult = await pool.query(`
                SELECT user_id, username, first_name 
                FROM user_profiles 
                WHERE user_id = $1
            `, [user.referred_by]);
            
            if (referrerResult.rows.length > 0) {
                referrerInfo = referrerResult.rows[0];
            }
        }
        
        // Получаем последние реферальные начисления
        const recentReferrals = await pool.query(`
            SELECT 
                ra.activated_at,
                ra.reward_amount,
                up.first_name,
                up.username
            FROM referral_activations ra
            JOIN user_profiles up ON ra.user_id = up.user_id
            JOIN referral_links rl ON ra.link_id = rl.id
            WHERE rl.created_by = $1
            ORDER BY ra.activated_at DESC
            LIMIT 5
        `, [userId]);
        
        // Получаем статистику по дням
        const dailyStats = await pool.query(`
            SELECT 
                DATE(ra.activated_at) as date,
                COUNT(*) as referrals_count,
                SUM(ra.reward_amount) as daily_earnings
            FROM referral_activations ra
            JOIN referral_links rl ON ra.link_id = rl.id
            WHERE rl.created_by = $1 AND ra.activated_at >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY DATE(ra.activated_at)
            ORDER BY date DESC
        `, [userId]);
        
        const responseData = {
            success: true,
            stats: {
                // Основная статистика
                user_id: user.user_id,
                username: user.username,
                first_name: user.first_name,
                
                // Финансы
                balance: parseFloat(user.balance) || 0,
                referral_earned: parseFloat(user.referral_earned) || 0,
                
                // Реферальная статистика
                referral_count: user.referral_count || 0,
                referred_by: user.referred_by,
                total_clicks: parseInt(user.total_clicks) || 0,
                unique_clicks: parseInt(user.unique_clicks) || 0,
                referral_activations: parseInt(user.referral_activations) || 0,
                total_referral_rewards: parseFloat(user.total_referral_rewards) || 0,
                
                // Расчетные показатели
                conversion_rate: user.total_clicks > 0 ? 
                    ((user.referral_activations / user.total_clicks) * 100).toFixed(1) : 0,
                avg_referral_earning: user.referral_activations > 0 ? 
                    (user.total_referral_rewards / user.referral_activations).toFixed(2) : 0
            },
            
            // Дополнительная информация
            referrer: referrerInfo,
            recent_referrals: recentReferrals.rows,
            daily_stats: dailyStats.rows,
            
            // Информация о бонусах
            bonus_info: {
                for_click: 1,        // Бонус за переход
                for_registration: 2, // Бонус за регистрацию
                for_new_user: 1      // Бонус новому пользователю
            },
            
            // Мета-информация
            timestamp: new Date().toISOString(),
            cache_ttl: 5 // В секундах до следующего обновления
        };
        
        console.log(`✅ Instant referral stats loaded for ${user.username}:`, {
            balance: responseData.stats.balance,
            referral_earned: responseData.stats.referral_earned,
            referral_count: responseData.stats.referral_count
        });
        
        res.json(responseData);
        
    } catch (error) {
        console.error('❌ Instant referral stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных: ' + error.message,
            timestamp: new Date().toISOString()
        });
    }
});



// 🚀 АВТОМАТИЧЕСКАЯ ИНИЦИАЛИЗАЦИЯ FLYER ПРИ ЗАПУСКЕ
async function initializeFlyerIntegration() {
    try {
        console.log('🚀 Initializing Flyer integration...');
        
        if (!FLYER_API_KEY) {
            console.log('❌ Flyer API key not configured');
            return;
        }
        
        // Проверяем текущий статус
        const status = await checkFlyerStatus();
        console.log('📊 Current Flyer status:', status.status);
        
        // Автоматически настраиваем вебхук
        console.log('🔄 Auto-configuring Flyer webhook...');
        const setupResult = await setupFlyerWebhookEnhanced();
        
        if (setupResult.success) {
            console.log('✅ Flyer webhook configured automatically');
            
            // Тестируем вебхук
            const testResult = await testFlyerWebhook();
            if (testResult.success) {
                console.log('🎉 Flyer integration fully operational!');
            } else {
                console.log('⚠️ Flyer webhook configured but test failed:', testResult.error);
            }
        } else {
            console.log('❌ Flyer webhook auto-configuration failed:', setupResult.error);
            console.log('💡 Use /fix_flyer_webhook command to set up manually');
        }
        
    } catch (error) {
        console.error('❌ Flyer initialization error:', error);
    }
}
// Endpoint для проверки статуса Flyer
app.get('/api/admin/flyer-status-detailed', async (req, res) => {
    const { adminId } = req.query;

    try {
        // Проверка прав администратора
        const isAdmin = await checkAdminAccess(adminId);
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        console.log('🔧 Testing Flyer API connection...');

        // Тестируем все endpoints
        const [botInfo, webhookStatus, testSubscription] = await Promise.allSettled([
            getFlyerBotInfo(),
            checkFlyerWebhookStatus(),
            checkSubscriptionWithFlyer(adminId, { 
                first_name: 'Test', 
                username: 'test_admin',
                language_code: 'ru' 
            })
        ]);

        const results = {
            get_me: botInfo.status === 'fulfilled' ? botInfo.value : { error: botInfo.reason },
            webhook_status: webhookStatus.status === 'fulfilled' ? webhookStatus.value : { error: webhookStatus.reason },
            check: testSubscription.status === 'fulfilled' ? testSubscription.value : { error: testSubscription.reason }
        };

        res.json({
            success: true,
            status: 'tested',
            apiKey: FLYER_API_KEY ? 'configured' : 'missing',
            apiUrl: FLYER_API_URL,
            webhookUrl: WEBHOOK_URL,
            lastChecked: new Date().toISOString(),
            endpoints: results,
            summary: {
                api: botInfo.status === 'fulfilled' && botInfo.value.success ? '✅' : '❌',
                webhook: webhookStatus.status === 'fulfilled' && webhookStatus.value.success ? '✅' : '❌',
                subscription: testSubscription.status === 'fulfilled' ? '✅' : '❌'
            },
            manualSetup: {
                url: `${FLYER_API_URL}/set_webhook`,
                method: 'POST',
                body: {
                    key: FLYER_API_KEY,
                    webhook: WEBHOOK_URL
                }
            }
        });

    } catch (error) {
        console.error('Flyer status check error:', error);
        res.json({
            success: false,
            status: 'error',
            error: error.message,
            apiKey: FLYER_API_KEY ? 'configured' : 'missing',
            apiUrl: FLYER_API_URL,
            webhookUrl: WEBHOOK_URL,
            lastChecked: new Date().toISOString()
        });
    }
});



// Улучшенная функция обработки завершения подписки
async function handleFlyerSubscriptionCompleted(userId) {
    try {
        console.log(`🎉 Processing subscription completion for user: ${userId}`);

        // Помечаем пользователя как прошедшего проверку подписки
        await pool.query(`
            UPDATE user_profiles 
            SET has_subscribed = true,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
        `, [userId]);

        console.log(`✅ User ${userId} subscription marked as completed`);

        // Отправляем сообщение пользователю
        if (bot) {
            try {
                await bot.sendMessage(
                    userId,
                    '✅ **Подписка подтверждена!**\n\n' +
                    'Благодарим за подписку! Теперь вы можете пользоваться всеми функциями бота! 🎉',
                    { parse_mode: 'HTML' }
                );
                console.log(`✅ Notification sent to user ${userId}`);
            } catch (botError) {
                console.error('❌ Failed to send notification:', botError.message);
            }
        }

    } catch (error) {
        console.error('❌ Handle subscription completed error:', error);
    }
}
// Улучшенная функция обработки статуса задания
async function handleFlyerTaskStatusUpdate(data) {
    try {
        const { status, user_id, signature, link } = data;
        
        console.log(`🔄 Processing task status update:`, {
            user_id,
            signature,
            status,
            link
        });

        // Обновляем статус задания в базе данных
        const result = await pool.query(`
            UPDATE flyer_tasks 
            SET status = $1, 
                completed_at = CASE WHEN $1 = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2 AND task_signature = $3
            RETURNING *
        `, [status, user_id, signature]);

        if (result.rows.length > 0) {
            console.log(`✅ Flyer task status updated: ${user_id} - ${signature} - ${status}`);
        } else {
            console.log(`⚠️ Flyer task not found: ${user_id} - ${signature}`);
        }

        // Если задание завершено, начисляем награду
        if (status === 'completed') {
            await awardUserForFlyerTask(user_id, signature);
        }

    } catch (error) {
        console.error('❌ Handle task status update error:', error);
    }
}

// 🔧 БЫСТРЫЙ ENDPOINT ДЛЯ ПРОВЕРКИ ТОЛЬКО БАЛАНСА
app.get('/api/user/:userId/quick-balance', async (req, res) => {
    const userId = req.params.userId;
    
    try {
        const result = await pool.query(`
            SELECT balance, referral_earned, referral_count 
            FROM user_profiles 
            WHERE user_id = $1
        `, [userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        const user = result.rows[0];
        
        res.json({
            success: true,
            balance: parseFloat(user.balance) || 0,
            referral_earned: parseFloat(user.referral_earned) || 0,
            referral_count: user.referral_count || 0,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Quick balance error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error'
        });
    }
});
// Функция для отслеживания конверсий (регистраций по ссылке)
app.post('/api/referral-links/track-conversion', async (req, res) => {
    const { code, userId } = req.body;
    
    try {
        console.log('🎯 Tracking referral conversion:', { code, userId });
        
        // Находим ссылку по коду
        const linkResult = await pool.query(
            'SELECT id FROM referral_links WHERE code = $1 AND is_active = true',
            [code]
        );
        
        if (linkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Ссылка не найдена'
            });
        }
        
        const linkId = linkResult.rows[0].id;
        
        // Создаем запись об активации
        await pool.query(`
            INSERT INTO referral_activations (link_id, user_id, reward_amount)
            VALUES ($1, $2, $3)
        `, [linkId, userId, 2]); // 2 звезды за активацию
        
        // Обновляем счетчик конверсий
        await pool.query(`
            UPDATE referral_links 
            SET conversions = conversions + 1
            WHERE id = $1
        `, [linkId]);
        
        console.log(`✅ Conversion tracked: user ${userId} via link ${linkId}`);
        
        res.json({
            success: true,
            message: 'Конверсия зарегистрирована'
        });
        
    } catch (error) {
        console.error('❌ Track conversion error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка отслеживания конверсии'
        });
    }
});

// Получение статистики по реферальным ссылкам
app.get('/api/admin/referral-links/stats', async (req, res) => {
    const { adminId } = req.query;
    
    try {
        // Проверка прав администратора
        const isAdmin = await checkAdminAccess(adminId);
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }
        
        const result = await pool.query(`
            SELECT 
                rl.*,
                up.username as creator_username,
                up.first_name as creator_name,
                COUNT(DISTINCT rlc.id) as total_clicks,
                COUNT(DISTINCT CASE WHEN rlc.user_id IS NOT NULL THEN rlc.id END) as registered_clicks,
                COUNT(DISTINCT ra.id) as activations,
                COALESCE(SUM(ra.reward_amount), 0) as total_rewards
            FROM referral_links rl
            LEFT JOIN user_profiles up ON rl.created_by = up.user_id
            LEFT JOIN referral_link_clicks rlc ON rl.id = rlc.link_id
            LEFT JOIN referral_activations ra ON rl.id = ra.link_id
            WHERE rl.is_active = true
            GROUP BY rl.id, up.username, up.first_name
            ORDER BY rl.created_at DESC
        `);
        
        res.json({
            success: true,
            links: result.rows
        });
        
    } catch (error) {
        console.error('❌ Get referral stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Вспомогательная функция для генерации кода ссылки
function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Функция для получения детальной статистики по ссылке
app.get('/api/admin/referral-links/:linkId/detailed-stats', async (req, res) => {
    const { linkId } = req.params;
    const { adminId } = req.query;
    
    try {
        // Проверка прав администратора
        const isAdmin = await checkAdminAccess(adminId);
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }
        
        // Основная статистика ссылки
        const linkStats = await pool.query(`
            SELECT * FROM referral_links WHERE id = $1
        `, [linkId]);
        
        if (linkStats.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Ссылка не найдена'
            });
        }
        
        // Статистика по дням
        const dailyStats = await pool.query(`
            SELECT 
                DATE(clicked_at) as date,
                COUNT(*) as total_clicks,
                COUNT(DISTINCT ip_address) as unique_clicks,
                COUNT(DISTINCT user_id) as registered_clicks
            FROM referral_link_clicks 
            WHERE link_id = $1 
            GROUP BY DATE(clicked_at)
            ORDER BY date DESC
            LIMIT 30
        `, [linkId]);
        
        // Последние активации
        const recentActivations = await pool.query(`
            SELECT 
                ra.*,
                up.username,
                up.first_name
            FROM referral_activations ra
            LEFT JOIN user_profiles up ON ra.user_id = up.user_id
            WHERE ra.link_id = $1
            ORDER BY ra.activated_at DESC
            LIMIT 20
        `, [linkId]);
        
        // География кликов (по IP)
        const geographyStats = await pool.query(`
            SELECT 
                ip_address,
                COUNT(*) as click_count,
                MIN(clicked_at) as first_click,
                MAX(clicked_at) as last_click
            FROM referral_link_clicks 
            WHERE link_id = $1
            GROUP BY ip_address
            ORDER BY click_count DESC
            LIMIT 50
        `, [linkId]);
        
        res.json({
            success: true,
            link: linkStats.rows[0],
            dailyStats: dailyStats.rows,
            recentActivations: recentActivations.rows,
            geographyStats: geographyStats.rows,
            summary: {
                total_days: dailyStats.rows.length,
                total_activations: recentActivations.rows.length,
                conversion_rate: linkStats.rows[0].total_clicks > 0 ? 
                    (linkStats.rows[0].conversions / linkStats.rows[0].total_clicks * 100).toFixed(2) : 0
            }
        });
        
    } catch (error) {
        console.error('❌ Get detailed link stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// Настройки доступа к ссылкам
app.get('/api/admin/links/settings', async (req, res) => {
    const { adminId } = req.query;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Доступ запрещен'
        });
    }
    
    try {
        const result = await pool.query(`
            SELECT allow_admins_links FROM admin_settings WHERE id = 1
        `);
        
        res.json({
            success: true,
            allowAdminsLinks: result.rows.length > 0 ? result.rows[0].allow_admins_links : false
        });
        
    } catch (error) {
        console.error('Get link settings error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

app.post('/api/admin/links/settings', async (req, res) => {
    const { adminId, allowAdminsLinks } = req.body;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Доступ запрещен'
        });
    }
    
    try {
        await pool.query(`
            INSERT INTO admin_settings (id, allow_admins_links) 
            VALUES (1, $1)
            ON CONFLICT (id) 
            DO UPDATE SET allow_admins_links = $1
        `, [allowAdminsLinks]);
        
        res.json({
            success: true,
            message: 'Настройки сохранены!'
        });
        
    } catch (error) {
        console.error('Save link settings error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});


// Endpoint для ручного тестирования вебхука
app.post('/api/flyer/webhook/test', async (req, res) => {
    try {
        const testPayload = {
            type: 'test',
            key_number: FLYER_API_KEY,
            data: {
                test: true,
                timestamp: new Date().toISOString()
            }
        };

        // Имитируем запрос от Flyer
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testPayload)
        });

        const result = await response.json();

        res.json({
            success: response.ok,
            status: response.status,
            response: result,
            test_payload: testPayload
        });

    } catch (error) {
        console.error('Test webhook error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Экспорт данных пользователей
app.get('/api/admin/users-export', async (req, res) => {
    const { adminId, format = 'json' } = req.query;
    
    try {
        // Проверяем права администратора
        const isAdmin = await checkAdminAccess(adminId);
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен.'
            });
        }
        
        const usersResult = await pool.query(`
            SELECT 
                up.user_id,
                up.username,
                up.first_name,
                up.last_name,
                up.balance,
                up.referral_count,
                up.referral_earned,
                up.referred_by,
                up.is_admin,
                up.created_at,
                ref.username as referrer_username,
                COUNT(ut.id) as total_tasks,
                COUNT(CASE WHEN ut.status = 'completed' THEN 1 END) as completed_tasks,
                COALESCE(SUM(CASE WHEN ut.status = 'completed' THEN t.price ELSE 0 END), 0) as total_earned
            FROM user_profiles up
            LEFT JOIN user_profiles ref ON up.referred_by = ref.user_id
            LEFT JOIN user_tasks ut ON up.user_id = ut.user_id
            LEFT JOIN tasks t ON ut.task_id = t.id
            WHERE up.user_id != $1
            GROUP BY up.user_id, ref.username
            ORDER BY up.created_at DESC
        `, [ADMIN_ID]);
        
        if (format === 'csv') {
            // Генерируем CSV
            const headers = ['ID', 'Username', 'First Name', 'Balance', 'Referrals', 'Referral Earned', 'Tasks Completed', 'Total Earned', 'Registration Date'];
            let csv = headers.join(',') + '\n';
            
            usersResult.rows.forEach(user => {
                const row = [
                    user.user_id,
                    user.username || '',
                    user.first_name || '',
                    user.balance || 0,
                    user.referral_count || 0,
                    user.referral_earned || 0,
                    user.completed_tasks || 0,
                    user.total_earned || 0,
                    user.created_at
                ].map(field => `"${field}"`).join(',');
                
                csv += row + '\n';
            });
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=users_export.csv');
            return res.send(csv);
        } else {
            // JSON формат
            res.json({
                success: true,
                users: usersResult.rows,
                exported_at: new Date().toISOString(),
                total_users: usersResult.rows.length
            });
        }
        
    } catch (error) {
        console.error('❌ Users export error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Получение статистики пользователей для админ-панели
app.get('/api/admin/users-stats', async (req, res) => {
    const { adminId } = req.query;
    
    // Проверяем права администратора
    const isAdmin = await checkAdminAccess(adminId);
    if (!isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Доступ запрещен'
        });
    }
    
    try {
        // Получаем общую статистику пользователей
        const statsResult = await pool.query(`
            SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN is_admin = true THEN 1 END) as admin_users,
                COUNT(CASE WHEN balance > 0 THEN 1 END) as users_with_balance,
                COUNT(CASE WHEN referred_by IS NOT NULL THEN 1 END) as referred_users,
                SUM(COALESCE(balance, 0)) as total_balance,
                AVG(COALESCE(balance, 0)) as avg_balance
            FROM user_profiles
            WHERE user_id != $1
        `, [ADMIN_ID]);
        
        // Получаем последних зарегистрированных пользователей
        const recentUsers = await pool.query(`
            SELECT user_id, username, first_name, balance, created_at 
            FROM user_profiles 
            WHERE user_id != $1
            ORDER BY created_at DESC 
            LIMIT 10
        `, [ADMIN_ID]);
        
        res.json({
            success: true,
            stats: statsResult.rows[0],
            recentUsers: recentUsers.rows
        });
        
    } catch (error) {
        console.error('Get users stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Получение заявок на вывод для всех админов
app.get('/api/admin/withdrawal-requests', async (req, res) => {
    const { adminId } = req.query;
    
    console.log('🔄 Запрос на получение заявок на вывод от админа:', adminId);
    
    // Проверка прав администратора - РАЗРЕШАЕМ ВСЕМ АДМИНАМ
    const isAdmin = await checkAdminAccess(adminId);
    if (!isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Доступ запрещен. Только администраторы могут просматривать заявки на вывод.'
        });
    }
    
    try {
        const result = await pool.query(`
            SELECT wr.*, u.username, u.first_name 
            FROM withdrawal_requests wr
            LEFT JOIN user_profiles u ON wr.user_id = u.user_id
            WHERE wr.status = 'pending'
            ORDER BY wr.created_at DESC
        `);
        
        console.log(`✅ Найдено ${result.rows.length} заявок на вывод для админа ${adminId}`);
        
        res.json({
            success: true,
            requests: result.rows
        });
    } catch (error) {
        console.error('❌ Get withdrawal requests error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// Добавьте эту функцию и вызовите ее в initDatabase()
async function fixWithdrawalTableStructure() {
    try {
        console.log('🔧 Fixing withdrawal_requests table structure...');
        
        // Проверяем и добавляем недостающие колонки
        const columnsToAdd = [
            'completed_at TIMESTAMP',
            'completed_by BIGINT',
            'username TEXT', 
            'first_name TEXT'
        ];
        
        for (const columnDef of columnsToAdd) {
            const columnName = columnDef.split(' ')[0];
            try {
                await pool.query(`
                    ALTER TABLE withdrawal_requests 
                    ADD COLUMN IF NOT EXISTS ${columnDef}
                `);
                console.log(`✅ Added column: ${columnName}`);
            } catch (error) {
                console.log(`ℹ️ Column ${columnName} already exists or error:`, error.message);
            }
        }
        
        console.log('✅ Withdrawal table structure fixed');
    } catch (error) {
        console.error('❌ Error fixing withdrawal table:', error);
    }
}



// Подтверждение выплаты для всех админов
app.post('/api/admin/withdrawal-requests/:requestId/complete', async (req, res) => {
    const requestId = req.params.requestId;
    const { adminId } = req.body;
    
    console.log('✅ Подтверждение выплаты админом:', { requestId, adminId });
    
    // Проверка прав администратора - РАЗРЕШАЕМ ВСЕМ АДМИНАМ
    const isAdmin = await checkAdminAccess(adminId);
    if (!isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Доступ запрещен. Только администраторы могут подтверждать выплаты.'
        });
    }
    
    try {
        // Проверяем существование запроса
        const requestCheck = await pool.query(
            'SELECT * FROM withdrawal_requests WHERE id = $1 AND status = $2',
            [requestId, 'pending']
        );
        
        if (requestCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Запрос не найден или уже обработан'
            });
        }
        
        const withdrawalRequest = requestCheck.rows[0];
        
        // Обновляем статус запроса
        await pool.query(`
            UPDATE withdrawal_requests 
            SET status = 'completed', 
                completed_at = CURRENT_TIMESTAMP,
                completed_by = $1
            WHERE id = $2
        `, [adminId, requestId]);
        
        console.log(`✅ Выплата подтверждена админом ${adminId} для запроса ${requestId}`);
        
        // Отправляем уведомление пользователю через бота (если бот активен)
        if (bot) {
            try {
                await bot.sendMessage(
                    withdrawalRequest.user_id,
                    `🎉 Ваша заявка на вывод ${withdrawalRequest.amount}⭐ была обработана и средства перечислены!`
                );
            } catch (botError) {
                console.log('Не удалось отправить уведомление пользователю:', botError.message);
            }
        }
        
        res.json({
            success: true,
            message: 'Выплата успешно подтверждена!'
        });
        
    } catch (error) {
        console.error('❌ Complete withdrawal error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});


// 🔧 ДИАГНОСТИКА ПРОБЛЕМ С ЗАГРУЗКОЙ ФАЙЛОВ
app.get('/api/debug/uploads', async (req, res) => {
    try {
        const uploadsDir = path.join(__dirname, 'uploads');
        const files = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
        
        // Проверяем записи в базе данных
        const dbScreenshots = await pool.query(`
            SELECT screenshot_url, COUNT(*) as count 
            FROM task_verifications 
            WHERE screenshot_url IS NOT NULL 
            GROUP BY screenshot_url
            LIMIT 10
        `);
        
        res.json({
            success: true,
            uploads: {
                directory: uploadsDir,
                exists: fs.existsSync(uploadsDir),
                fileCount: files.length,
                files: files.slice(0, 10)
            },
            database: {
                totalVerifications: (await pool.query('SELECT COUNT(*) FROM task_verifications')).rows[0].count,
                withScreenshots: (await pool.query('SELECT COUNT(*) FROM task_verifications WHERE screenshot_url IS NOT NULL')).rows[0].count,
                sampleScreenshots: dbScreenshots.rows
            }
        });
    } catch (error) {
        console.error('Uploads debug error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get user profile
app.get('/api/user/:userId', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM user_profiles WHERE user_id = $1', 
            [req.params.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        res.json({
            success: true,
            profile: result.rows[0]
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// ==================== POSTS ENDPOINTS ====================

// Get all posts
app.get('/api/posts', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM posts 
            ORDER BY created_at DESC
        `);
        
        res.json({
            success: true,
            posts: result.rows
        });
    } catch (error) {
        console.error('Get posts error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Create post (for all admins) - УПРОЩЕННАЯ ВЕРСИЯ БЕЗ ПРОВЕРОК
app.post('/api/posts', async (req, res) => {
    const { title, content, author, authorId } = req.body;
    
    if (!title || !content || !author) {
        return res.status(400).json({
            success: false,
            error: 'Заполните все поля'
        });
    }
    
    try {
        const result = await pool.query(`
            INSERT INTO posts (title, content, author, author_id) 
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [title, content, author, authorId]);
        
        res.json({
            success: true,
            message: 'Пост успешно опубликован!',
            post: result.rows[0]
        });
    } catch (error) {
        console.error('Create post error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});

// Delete post (for all admins) - УПРОЩЕННАЯ ВЕРСИЯ БЕЗ ПРОВЕРОК
app.delete('/api/posts/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM posts WHERE id = $1", [req.params.id]);
        res.json({
            success: true,
            message: 'Пост успешно удален!'
        });
    } catch (error) {
        console.error('Delete post error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// ==================== TASKS ENDPOINTS ====================

// Получение заданий с правильной фильтрацией отклоненных заданий
// Обновленный endpoint получения заданий с авто-скрытием заполненных
app.get('/api/tasks', async (req, res) => {
    const { search, category, userId } = req.query;
    
    console.log('📥 Получен запрос на задания:', { search, category, userId });
    
    try {
        let query = `
            SELECT t.*, 
                   COUNT(ut.id) as completed_count,
                   EXISTS(
                       SELECT 1 FROM user_tasks ut2 
                       WHERE ut2.task_id = t.id 
                       AND ut2.user_id = $1 
                       AND ut2.status IN ('active', 'pending_review', 'completed')
                   ) as user_has_task
            FROM tasks t 
            LEFT JOIN user_tasks ut ON t.id = ut.task_id AND ut.status = 'completed'
            WHERE t.status = 'active'
        `;
        let params = [userId];
        let paramCount = 1;
        
        if (search) {
            paramCount++;
            query += ` AND (t.title ILIKE $${paramCount} OR t.description ILIKE $${paramCount + 1})`;
            params.push(`%${search}%`, `%${search}%`);
            paramCount += 2;
        }
        
        if (category && category !== 'all') {
            paramCount++;
            query += ` AND t.category = $${paramCount}`;
            params.push(category);
        }
        
        query += ` GROUP BY t.id ORDER BY t.created_at DESC`;
        
        console.log('📊 Выполняем запрос с авто-скрытием');
        
        const result = await pool.query(query, params);
        
        // 🔥 АВТОМАТИЧЕСКИ СКРЫВАЕМ ЗАПОЛНЕННЫЕ ЗАДАНИЯ
        const tasksToHide = [];
        const availableTasks = result.rows.filter(task => {
            const completedCount = task.completed_count || 0;
            const peopleRequired = task.people_required || 1;
            const isAvailableByLimit = completedCount < peopleRequired;
            
            // Если задание заполнено - помечаем для скрытия
            if (!isAvailableByLimit) {
                tasksToHide.push(task.id);
            }
            
            return isAvailableByLimit;
        });
        
        // 🔥 СКРЫВАЕМ ЗАПОЛНЕННЫЕ ЗАДАНИЯ В БАЗЕ
        if (tasksToHide.length > 0) {
            console.log(`🎯 Авто-скрытие заполненных заданий: ${tasksToHide.join(', ')}`);
            
            await pool.query(`
                UPDATE tasks 
                SET status = 'completed' 
                WHERE id = ANY($1) AND status = 'active'
            `, [tasksToHide]);
        }
        
        // 🔥 ФИЛЬТРУЕМ задания которые пользователь уже начал
        const filteredTasks = availableTasks.filter(task => !task.user_has_task);
        
        console.log(`✅ Найдено заданий: ${result.rows.length}, доступно: ${availableTasks.length}, для пользователя: ${filteredTasks.length}, скрыто: ${tasksToHide.length}`);
        
        res.json({
            success: true,
            tasks: filteredTasks,
            stats: {
                totalCount: result.rows.length,
                availableByLimit: availableTasks.length,
                availableCount: filteredTasks.length,
                hiddenCount: tasksToHide.length
            }
        });
    } catch (error) {
        console.error('❌ Get tasks error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// Endpoint для принудительной проверки и скрытия заполненных заданий
app.post('/api/admin/hide-completed-tasks', async (req, res) => {
    const { adminId } = req.body;
    
    console.log('🔧 Принудительное скрытие заполненных заданий админом:', adminId);
    
    try {
        // Находим задания которые достигли лимита
        const completedTasks = await pool.query(`
            SELECT t.id, t.title, t.people_required, COUNT(ut.id) as completed_count
            FROM tasks t
            LEFT JOIN user_tasks ut ON t.id = ut.task_id AND ut.status = 'completed'
            WHERE t.status = 'active'
            GROUP BY t.id, t.title, t.people_required
            HAVING COUNT(ut.id) >= t.people_required
        `);
        
        if (completedTasks.rows.length === 0) {
            return res.json({
                success: true,
                message: 'Нет заданий для скрытия',
                hiddenCount: 0
            });
        }
        
        const taskIds = completedTasks.rows.map(task => task.id);
        
        // Скрываем задания
        await pool.query(`
            UPDATE tasks 
            SET status = 'completed' 
            WHERE id = ANY($1)
        `, [taskIds]);
        
        console.log(`✅ Скрыто заданий: ${taskIds.join(', ')}`);
        
        res.json({
            success: true,
            message: `Скрыто ${taskIds.length} заполненных заданий`,
            hiddenTasks: completedTasks.rows,
            hiddenCount: taskIds.length
        });
        
    } catch (error) {
        console.error('❌ Hide completed tasks error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// Debug endpoint for tasks
app.get('/api/debug/tasks', async (req, res) => {
    try {
        const tasksCount = await pool.query('SELECT COUNT(*) FROM tasks WHERE status = $1', ['active']);
        const tasks = await pool.query('SELECT * FROM tasks WHERE status = $1 ORDER BY created_at DESC LIMIT 10', ['active']);
        
        res.json({
            success: true,
            total_active_tasks: parseInt(tasksCount.rows[0].count),
            sample_tasks: tasks.rows,
            database_status: 'OK'
        });
    } catch (error) {
        console.error('Debug tasks error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// В server.js добавьте:
app.get('/api/debug/tasks-test', async (req, res) => {
    try {
        const { userId } = req.query;
        console.log('🧪 Debug tasks request for user:', userId);
        
        const tasks = await pool.query(`
            SELECT * FROM tasks 
            WHERE status = 'active'
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        console.log('📊 Found tasks:', tasks.rows.length);
        
        res.json({
            success: true,
            tasks: tasks.rows,
            debug: {
                userId: userId,
                timestamp: new Date().toISOString(),
                taskCount: tasks.rows.length
            }
        });
    } catch (error) {
        console.error('Debug tasks error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// Создание задания с изображением
app.post('/api/tasks-with-image', upload.single('image'), async (req, res) => {
    console.log('📥 Received task creation request with image');
    
    const { 
        title, 
        description, 
        price, 
        created_by,
        category,
        time_to_complete,
        difficulty,
        people_required,
        task_url
    } = req.body;
    
    // Базовая валидация
    if (!title || !description || !price || !created_by) {
        return res.status(400).json({
            success: false,
            error: 'Заполните все обязательные поля'
        });
    }
    
    try {
        const taskPrice = parseFloat(price);
        if (isNaN(taskPrice) || taskPrice <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Цена должна быть положительным числом!'
            });
        }

        // 🔧 ИСПРАВЛЕНИЕ: Правильная обработка изображения
        let imageUrl = '';
        if (req.file) {
            // Используем абсолютный URL для изображения
            imageUrl = `${APP_URL}/uploads/${req.file.filename}`;
            console.log('🖼️ Image uploaded with absolute URL:', imageUrl);
        }

        console.log('💾 Saving task to database with image...');
        
        const result = await pool.query(`
            INSERT INTO tasks (
                title, description, price, created_by, category,
                time_to_complete, difficulty, people_required, task_url, image_url
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [
            title.trim(), 
            description.trim(), 
            taskPrice, 
            created_by,
            category || 'general',
            time_to_complete || '5-10 минут',
            difficulty || 'Легкая',
            parseInt(people_required) || 1,
            task_url || '',
            imageUrl
        ]);
        
        console.log('✅ Task with image saved successfully:', result.rows[0]);
        
        res.json({
            success: true,
            message: imageUrl ? 'Задание с фото успешно создано!' : 'Задание успешно создано!',
            task: result.rows[0]
        });
        
    } catch (error) {
        console.error('❌ Create task with image error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных: ' + error.message
        });
    }
});
app.get('/api/debug/tasks-structure', async (req, res) => {
    try {
        const structure = await pool.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'tasks' 
            ORDER BY ordinal_position
        `);
        
        res.json({
            success: true,
            columns: structure.rows
        });
    } catch (error) {
        console.error('Tasks structure debug error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// В server.js добавьте этот endpoint

// Поиск заданий в админке
app.get('/api/admin/tasks/search', async (req, res) => {
    const { adminId, search } = req.query;
    
    if (!adminId) {
        return res.status(400).json({
            success: false,
            error: 'ID администратора обязателен'
        });
    }

    try {
        // Проверяем права администратора
        const adminCheck = await pool.query(
            'SELECT is_admin FROM user_profiles WHERE user_id = $1',
            [adminId]
        );

        if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_admin) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен. Только для администраторов.'
            });
        }

        let query = `
            SELECT 
                t.*,
                COUNT(ut.id) as completed_count,
                COUNT(CASE WHEN ut.status = 'rejected' THEN 1 END) as rejected_count,
                COUNT(CASE WHEN ut.status = 'pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN ut.status = 'active' THEN 1 END) as active_count,
                MAX(ut.completed_at) as last_completed
            FROM tasks t
            LEFT JOIN user_tasks ut ON t.id = ut.task_id
        `;

        const queryParams = [];
        let whereConditions = [];

        // Добавляем условия поиска если есть поисковый запрос
        if (search && search.trim() !== '') {
            whereConditions.push(`
                (t.title ILIKE $${queryParams.length + 1} 
                 OR t.description ILIKE $${queryParams.length + 1}
                 OR t.category ILIKE $${queryParams.length + 1})
            `);
            queryParams.push(`%${search}%`);
        }

        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }

        query += `
            GROUP BY t.id
            ORDER BY t.created_at DESC
        `;

        const result = await pool.query(query, queryParams);

        // Получаем статистику
        const statsQuery = `
            SELECT 
                COUNT(*) as total_tasks,
                COUNT(CASE WHEN t.status = 'active' THEN 1 END) as active_tasks,
                COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
                COUNT(CASE WHEN t.created_by = $1 THEN 1 END) as my_tasks
            FROM tasks t
            ${search ? `WHERE (t.title ILIKE $2 OR t.description ILIKE $2 OR t.category ILIKE $2)` : ''}
        `;

        const statsParams = [adminId];
        if (search) {
            statsParams.push(`%${search}%`);
        }

        const statsResult = await pool.query(statsQuery, statsParams);

        res.json({
            success: true,
            tasks: result.rows,
            statistics: statsResult.rows[0],
            searchTerm: search || ''
        });

    } catch (error) {
        console.error('Search tasks error:', error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера: ' + error.message
        });
    }
});

// Функция для добавления недостающих колонок в таблицу tasks
async function fixTasksTable() {
    try {
        console.log('🔧 Checking and fixing tasks table structure...');
        
        // Проверяем существование колонки image_url
        const columnCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'tasks' AND column_name = 'image_url'
        `);
        
        if (columnCheck.rows.length === 0) {
            console.log('❌ Column image_url not found, adding...');
            await pool.query(`ALTER TABLE tasks ADD COLUMN image_url TEXT`);
            console.log('✅ Column image_url added successfully');
        } else {
            console.log('✅ Column image_url already exists');
        }
        
        // Проверяем другие важные колонки
        const columnsToCheck = [
            'created_by', 'category', 'time_to_complete', 
            'difficulty', 'people_required', 'repost_time', 'task_url'
        ];
        
        for (const column of columnsToCheck) {
            const exists = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'tasks' AND column_name = $1
            `, [column]);
            
            if (exists.rows.length === 0) {
                console.log(`❌ Column ${column} not found, adding...`);
                let columnType = 'TEXT';
                if (column === 'created_by') columnType = 'BIGINT';
                if (column === 'people_required') columnType = 'INTEGER';
                
                await pool.query(`ALTER TABLE tasks ADD COLUMN ${column} ${columnType}`);
                console.log(`✅ Column ${column} added`);
            }
        }
        
        console.log('✅ Tasks table structure verified and fixed');
    } catch (error) {
        console.error('❌ Error fixing tasks table:', error);
    }
}
// Функция для создания тестовых заданий
async function createSampleTasks() {
    try {
        console.log('📝 Creating sample tasks...');
        
        // Проверяем, есть ли уже задания
        const tasksCount = await pool.query('SELECT COUNT(*) FROM tasks WHERE status = $1', ['active']);
        
        if (parseInt(tasksCount.rows[0].count) === 0) {
            console.log('🔄 No active tasks found, creating sample tasks...');
            
            const sampleTasks = [
                {
                    title: 'Подписаться на Telegram канал',
                    description: 'Подпишитесь на наш Telegram канал и оставайтесь подписанным минимум 3 дня. Сделайте скриншот подписки.',
                    price: 50,
                    category: 'subscribe',
                    time_to_complete: '5 минут',
                    difficulty: 'Легкая',
                    people_required: 100
                },
                {
                    title: 'Посмотреть видео на YouTube',
                    description: 'Посмотрите видео до конца и поставьте лайк. Пришлите скриншот с видео и лайком.',
                    price: 30,
                    category: 'view',
                    time_to_complete: '10 минут', 
                    difficulty: 'Легкая',
                    people_required: 50
                },
                {
                    title: 'Сделать репост записи',
                    description: 'Сделайте репост записи в своем Telegram канале или чате. Скриншот репоста обязателен.',
                    price: 70,
                    category: 'repost',
                    time_to_complete: '5 минут',
                    difficulty: 'Средняя',
                    people_required: 30
                },
                {
                    title: 'Оставить комментарий под постом',
                    description: 'Напишите содержательный комментарий под указанным постом. Комментарий должен быть уникальным.',
                    price: 40,
                    category: 'comment',
                    time_to_complete: '7 минут',
                    difficulty: 'Легкая', 
                    people_required: 80
                },
                {
                    title: 'Вступить в Telegram группу',
                    description: 'Вступите в нашу Telegram группу и оставайтесь в ней минимум 7 дней.',
                    price: 60,
                    category: 'social',
                    time_to_complete: '3 минуты',
                    difficulty: 'Легкая',
                    people_required: 40
                }
            ];

            for (const task of sampleTasks) {
                await pool.query(`
                    INSERT INTO tasks (title, description, price, created_by, category, time_to_complete, difficulty, people_required) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    task.title,
                    task.description, 
                    task.price,
                    ADMIN_ID,
                    task.category,
                    task.time_to_complete,
                    task.difficulty,
                    task.people_required
                ]);
            }
            
            console.log('✅ Sample tasks created successfully!');
        } else {
            console.log(`✅ Tasks already exist: ${tasksCount.rows[0].count} active tasks`);
        }
    } catch (error) {
        console.error('❌ Error creating sample tasks:', error);
    }
}

// Вызовите эту функцию после инициализации базы данных
async function initializeWithTasks() {
    await initDatabase();
    await createSampleTasks();
}
// Диагностический endpoint для проверки заданий
app.get('/api/debug/tasks-status', async (req, res) => {
    try {
        // Статистика по заданиям
        const tasksStats = await pool.query(`
            SELECT 
                status,
                COUNT(*) as count,
                COUNT(CASE WHEN created_by = $1 THEN 1 END) as my_tasks
            FROM tasks 
            GROUP BY status
        `, [ADMIN_ID]);
        
        // Все задания
        const allTasks = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
        
        // Активные задания
        const activeTasks = await pool.query('SELECT * FROM tasks WHERE status = $1 ORDER BY created_at DESC', ['active']);

        res.json({
            success: true,
            stats: tasksStats.rows,
            all_tasks_count: allTasks.rows.length,
            active_tasks_count: activeTasks.rows.length,
            active_tasks: activeTasks.rows,
            all_tasks: allTasks.rows
        });
    } catch (error) {
        console.error('Tasks status debug error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Endpoint для принудительного создания тестовых заданий
app.post('/api/admin/create-sample-tasks', async (req, res) => {
    const { adminId } = req.body;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }
    
    try {
        await createSampleTasks();
        
        const tasksCount = await pool.query('SELECT COUNT(*) FROM tasks WHERE status = $1', ['active']);
        
        res.json({
            success: true,
            message: 'Sample tasks created successfully',
            active_tasks_count: parseInt(tasksCount.rows[0].count)
        });
    } catch (error) {
        console.error('Create sample tasks error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// Test endpoint for task creation
app.post('/api/test-task', async (req, res) => {
    console.log('🧪 Test task endpoint called:', req.body);
    
    try {
        // Простая проверка - возвращаем успех без сохранения в БД
        res.json({
            success: true,
            message: 'Test endpoint works!',
            received_data: req.body
        });
    } catch (error) {
        console.error('Test endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// Check database structure
app.get('/api/debug/database', async (req, res) => {
    try {
        // Проверяем структуру таблицы tasks
        const tableInfo = await pool.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'tasks' 
            ORDER BY ordinal_position
        `);
        
        // Проверяем количество записей
        const countResult = await pool.query('SELECT COUNT(*) FROM tasks');
        
        res.json({
            success: true,
            table_structure: tableInfo.rows,
            task_count: parseInt(countResult.rows[0].count),
            database_status: 'OK'
        });
    } catch (error) {
        console.error('Database debug error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// Delete task (for all admins) - УПРОЩЕННАЯ ВЕРСИЯ БЕЗ ПРОВЕРОК
app.delete('/api/tasks/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM tasks WHERE id = $1", [req.params.id]);
        res.json({
            success: true,
            message: 'Задание успешно удалено!'
        });
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Get tasks for admin (show ALL tasks including completed)
app.get('/api/admin/tasks', async (req, res) => {
    const { adminId, showCompleted = 'true' } = req.query;
    
    console.log('🔄 Admin tasks request:', { adminId, showCompleted });
    
    // Проверка прав администратора
    const isAdmin = await checkAdminAccess(adminId);
    if (!isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Доступ запрещен'
        });
    }
    
    try {
        let query = `
            SELECT t.*, 
                   COUNT(ut.id) as completed_count,
                   COUNT(CASE WHEN ut.status = 'completed' THEN 1 END) as actual_completed,
                   COUNT(CASE WHEN ut.status = 'rejected' THEN 1 END) as rejected_count,
                   COUNT(CASE WHEN ut.status = 'pending_review' THEN 1 END) as pending_count
            FROM tasks t 
            LEFT JOIN user_tasks ut ON t.id = ut.task_id
        `;
        
        // Если нужно показать только активные задания
        if (showCompleted === 'false') {
            query += ` WHERE t.status = 'active'`;
        }
        
        query += ` GROUP BY t.id ORDER BY t.created_at DESC`;
        
        console.log('📊 Executing admin tasks query:', query);
        
        const result = await pool.query(query);
        
        console.log(`✅ Found ${result.rows.length} tasks for admin`);
        
        res.json({
            success: true,
            tasks: result.rows,
            stats: {
                total: result.rows.length,
                active: result.rows.filter(t => t.status === 'active').length,
                completed: result.rows.filter(t => t.status === 'completed').length
            }
        });
    } catch (error) {
        console.error('❌ Get admin tasks error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// В server.js - исправленная функция загрузки админ-заданий
app.get('/api/admin/all-tasks', async (req, res) => {
    const { adminId } = req.query;
    
    console.log('🔄 Admin ALL tasks request from:', adminId);
    
    try {
        // УПРОЩЕННАЯ ПРОВЕРКА - разрешаем всем админам
        const isAdmin = await checkAdminAccess(adminId);
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }
        
        // ПРОСТОЙ запрос без сложной статистики
        const result = await pool.query(`
            SELECT 
                t.*,
                COUNT(ut.id) as completed_count
            FROM tasks t 
            LEFT JOIN user_tasks ut ON t.id = ut.task_id AND ut.status = 'completed'
            GROUP BY t.id
            ORDER BY t.created_at DESC
        `);
        
        console.log(`✅ Found ${result.rows.length} tasks for admin ${adminId}`);
        
        res.json({
            success: true,
            tasks: result.rows || [],
            statistics: {
                total_tasks: result.rows.length,
                active_tasks: result.rows.filter(t => t.status === 'active').length,
                completed_tasks: result.rows.filter(t => t.status === 'completed').length,
                my_tasks: result.rows.filter(t => t.created_by == adminId).length
            }
        });
        
    } catch (error) {
        console.error('❌ Get all admin tasks error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// Простой endpoint для админ-заданий
app.get('/api/admin/simple-tasks', async (req, res) => {
    const { adminId } = req.query;
    
    console.log('🎯 Simple admin tasks request from:', adminId);
    
    try {
        // Базовая проверка админа
        const userResult = await pool.query(
            'SELECT is_admin FROM user_profiles WHERE user_id = $1',
            [adminId]
        );
        
        if (userResult.rows.length === 0 || (!userResult.rows[0].is_admin && parseInt(adminId) !== ADMIN_ID)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        
        // Самый простой запрос
        const result = await pool.query(`
            SELECT * FROM tasks 
            ORDER BY created_at DESC
            LIMIT 50
        `);
        
        console.log(`✅ Simple query: ${result.rows.length} tasks`);
        
        res.json({
            success: true,
            tasks: result.rows,
            debug: {
                adminId: adminId,
                isAdmin: true,
                taskCount: result.rows.length
            }
        });
        
    } catch (error) {
        console.error('Simple admin tasks error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// ==================== USER TASKS ENDPOINTS ====================
// В server.js добавьте:
app.get('/api/debug/admin-tasks', async (req, res) => {
    const { adminId } = req.query;
    
    try {
        // Все задания
        const allTasks = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
        
        // Статистика по статусам
        const statusStats = await pool.query(`
            SELECT status, COUNT(*) as count 
            FROM tasks 
            GROUP BY status
        `);
        
        // Задания созданные админом
        const adminTasks = await pool.query(`
            SELECT * FROM tasks 
            WHERE created_by = $1 
            ORDER BY created_at DESC
        `, [adminId]);
        
        res.json({
            success: true,
            all_tasks_count: allTasks.rows.length,
            status_stats: statusStats.rows,
            admin_tasks: adminTasks.rows,
            admin_id: adminId
        });
    } catch (error) {
        console.error('Debug admin tasks error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// В server.js - обновите endpoint начала задания
// Обновленный endpoint для начала задания с автоматическим скрытием
app.post('/api/user/tasks/start', async (req, res) => {
    const { userId, taskId } = req.body;
    
    console.log('🚀 Start task request:', { userId, taskId });
    
    if (!userId || !taskId) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // 1. Проверяем, выполнял ли пользователь это задание
        const existingTask = await client.query(`
            SELECT id FROM user_tasks 
            WHERE user_id = $1 AND task_id = $2 
            AND status IN ('active', 'pending_review', 'completed')
        `, [userId, taskId]);
        
        if (existingTask.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Вы уже выполняли это задание'
            });
        }
        
        // 2. Проверяем лимит выполнений задания
        const taskInfo = await client.query(`
            SELECT t.*, 
                   COUNT(ut.id) as completed_count
            FROM tasks t
            LEFT JOIN user_tasks ut ON t.id = ut.task_id AND ut.status = 'completed'
            WHERE t.id = $1 AND t.status = 'active'
            GROUP BY t.id
        `, [taskId]);
        
        if (taskInfo.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Задание не найдено или недоступно'
            });
        }
        
        const task = taskInfo.rows[0];
        const peopleRequired = task.people_required || 1;
        const completedCount = task.completed_count || 0;
        const remainingSlots = peopleRequired - completedCount;
        
        console.log(`📊 Task slots: ${completedCount}/${peopleRequired}, remaining: ${remainingSlots}`);
        
        // 3. Если это последний слот - помечаем задание как выполненное
        let taskHidden = false;
        if (remainingSlots === 1) {
            console.log(`🎯 Last slot taken! Hiding task ${taskId} for all users`);
            
            await client.query(`
                UPDATE tasks 
                SET status = 'completed' 
                WHERE id = $1
            `, [taskId]);
            
            taskHidden = true;
        }
        
        // 4. Start the task for user
        const result = await client.query(`
            INSERT INTO user_tasks (user_id, task_id, status) 
            VALUES ($1, $2, 'active')
            RETURNING *
        `, [userId, taskId]);
        
        await client.query('COMMIT');
        
        console.log('✅ Task started successfully:', {
            userTaskId: result.rows[0].id,
            taskHidden: taskHidden,
            remainingSlotsBefore: remainingSlots
        });
        
        res.json({
            success: true,
            message: taskHidden ? 
                'Задание начато! Это был последний доступный слот - задание скрыто для других пользователей.' : 
                'Задание начато!',
            userTaskId: result.rows[0].id,
            taskHidden: taskHidden,
            remainingSlots: remainingSlots - 1
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Start task error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    } finally {
        client.release();
    }
});
// Get user tasks
app.get('/api/user/:userId/tasks', async (req, res) => {
    const userId = req.params.userId;
    const { status } = req.query;
    
    try {
        let query = `
            SELECT ut.*, t.title, t.description, t.price, t.category
            FROM user_tasks ut 
            JOIN tasks t ON ut.task_id = t.id 
            WHERE ut.user_id = $1
        `;
        let params = [userId];
        
        if (status) {
            query += " AND ut.status = $2";
            params.push(status);
        }
        
        query += " ORDER BY ut.started_at DESC";
        
        const result = await pool.query(query, params);
        
        res.json({
            success: true,
            tasks: result.rows
        });
    } catch (error) {
        console.error('Get user tasks error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// Get user tasks for confirmation
app.get('/api/user/:userId/tasks/active', async (req, res) => {
    const userId = req.params.userId;
    
    try {
        const result = await pool.query(`
            SELECT ut.*, t.title, t.description, t.price, t.category
            FROM user_tasks ut 
            JOIN tasks t ON ut.task_id = t.id 
            WHERE ut.user_id = $1 AND ut.status = 'active'
            ORDER BY ut.started_at DESC
        `, [userId]);
        
        res.json({
            success: true,
            tasks: result.rows
        });
    } catch (error) {
        console.error('Get active tasks error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// В функции initDatabase() добавьте:
async function addAutoVerificationColumn() {
    try {
        await pool.query(`
            ALTER TABLE task_verifications 
            ADD COLUMN IF NOT EXISTS auto_verified BOOLEAN DEFAULT false
        `);
        console.log('✅ Column auto_verified added to task_verifications');
    } catch (error) {
        console.log('ℹ️ Column auto_verified already exists or error:', error.message);
    }
}

// Вызовите эту функцию при инициализации
addAutoVerificationColumn();
// Submit task for verification (WITH FILE UPLOAD)
app.post('/api/user/tasks/:userTaskId/submit', upload.single('screenshot'), async (req, res) => {
    // Перенаправляем на новый endpoint с автоматической проверкой
    const { userTaskId } = req.params;
    const { userId } = req.body;
    
    // Вызываем endpoint с автоматической проверкой
    const newReq = { ...req, params: { userTaskId }, body: { userId } };
    const newRes = {
        json: (data) => res.json(data),
        status: (code) => ({ json: (data) => res.status(code).json(data) })
    };
    
    await exports.submitTaskAuto(newReq, newRes);

    
    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'Missing user ID'
        });
    }
    
    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: 'No screenshot uploaded'
        });
    }
    
    const screenshotUrl = `/uploads/${req.file.filename}`;
    
    try {
        // Update user_task
        await pool.query(`
            UPDATE user_tasks 
            SET status = 'pending_review', screenshot_url = $1, submitted_at = CURRENT_TIMESTAMP 
            WHERE id = $2 AND user_id = $3
        `, [screenshotUrl, userTaskId, userId]);
        
        // Get task info for verification
        const taskInfo = await pool.query(`
            SELECT ut.user_id, ut.task_id, u.first_name, u.last_name, u.username, t.title, t.price 
            FROM user_tasks ut 
            JOIN user_profiles u ON ut.user_id = u.user_id 
            JOIN tasks t ON ut.task_id = t.id 
            WHERE ut.id = $1
        `, [userTaskId]);
        
        if (taskInfo.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Task not found'
            });
        }
        
        const taskData = taskInfo.rows[0];
        const userName = `${taskData.first_name} ${taskData.last_name}`;
        
        // Create verification record
        const verificationResult = await pool.query(`
            INSERT INTO task_verifications 
            (user_task_id, user_id, task_id, user_name, user_username, task_title, task_price, screenshot_url) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [userTaskId, taskData.user_id, taskData.task_id, userName, taskData.username, taskData.title, taskData.price, screenshotUrl]);
        
        res.json({
            success: true,
            message: 'Task submitted for review',
            verificationId: verificationResult.rows[0].id
        });
    } catch (error) {
        console.error('Submit task error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// Обработчик ошибок подключения к БД
pool.on('error', (err, client) => {
    console.error('❌ Database connection error:', err);
    // Можно добавить логику переподключения
});

// Функция переподключения к БД
async function ensureDatabaseConnection() {
    try {
        await pool.query('SELECT 1');
        console.log('✅ Database connection verified');
        return true;
    } catch (error) {
        console.error('❌ Database connection lost:', error);
        // Можно добавить логику переподключения
        return false;
    }
}

// Проверяем подключение каждые 10 минут
setInterval(ensureDatabaseConnection, 10 * 60 * 1000);

// Обновленный endpoint для отмены задания с возвратом в список
app.post('/api/user/tasks/:userTaskId/cancel', async (req, res) => {
    const userTaskId = req.params.userTaskId;
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'Missing user ID'
        });
    }
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // 1. Получаем информацию о задании перед удалением
        const taskInfo = await client.query(`
            SELECT ut.task_id, t.status as task_status, t.people_required
            FROM user_tasks ut 
            JOIN tasks t ON ut.task_id = t.id
            WHERE ut.id = $1 AND ut.user_id = $2 AND ut.status = 'active'
        `, [userTaskId, userId]);
        
        if (taskInfo.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Задание не найдено или уже завершено'
            });
        }
        
        const taskId = taskInfo.rows[0].task_id;
        const taskStatus = taskInfo.rows[0].task_status;
        const peopleRequired = taskInfo.rows[0].people_required;
        
        // 2. Если задание было скрыто (status = 'completed'), возвращаем его обратно
        let taskRestored = false;
        if (taskStatus === 'completed') {
            console.log(`🔄 Restoring task ${taskId} back to active status`);
            
            await client.query(`
                UPDATE tasks 
                SET status = 'active' 
                WHERE id = $1
            `, [taskId]);
            
            taskRestored = true;
        }
        
        // 3. Удаляем запись о выполнении задания
        await client.query(`
            DELETE FROM user_tasks 
            WHERE id = $1 AND user_id = $2
        `, [userTaskId, userId]);
        
        await client.query('COMMIT');
        
        console.log(`✅ Task ${taskId} cancelled by user ${userId}, restored: ${taskRestored}`);
        
        res.json({
            success: true,
            message: taskRestored ? 
                'Задание отменено и возвращено в список доступных!' : 
                'Задание отменено успешно',
            taskId: taskId,
            taskRestored: taskRestored
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Cancel task error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    } finally {
        client.release();
    }
});

// ==================== SUPPORT CHAT ENDPOINTS ====================

// Get or create user chat - ИСПРАВЛЕННАЯ ВЕРСИЯ
app.get('/api/support/user-chat/:userId', async (req, res) => {
    const userId = req.params.userId;
    
    try {
        // Сначала проверяем существующий чат
        let chat = await pool.query(
            'SELECT * FROM support_chats WHERE user_id = $1', 
            [userId]
        );
        
        if (chat.rows.length === 0) {
            // Получаем информацию о пользователе
            const userResult = await pool.query(
                'SELECT first_name, last_name, username FROM user_profiles WHERE user_id = $1',
                [userId]
            );
            
            let user_name = 'Пользователь';
            let user_username = `user_${userId}`;
            
            if (userResult.rows.length > 0) {
                const user = userResult.rows[0];
                user_name = user.username ? `@${user.username}` : `User_${userId}`;
                user_username = user.username || user_username;
            }
            
            // Создаем новый чат
            chat = await pool.query(`
                INSERT INTO support_chats (user_id, user_name, user_username, last_message) 
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [userId, user_name, user_username, 'Чат создан']);
            
            // Добавляем приветственное сообщение
            await pool.query(`
                INSERT INTO support_messages (chat_id, user_id, user_name, user_username, message, is_admin) 
                VALUES ($1, $2, $3, $4, $5, true)
            `, [chat.rows[0].id, ADMIN_ID, 'Администратор', 'linkgold_admin', 'Здравствуйте! Чем могу помочь?']);
        }
        
        res.json({
            success: true,
            chat: chat.rows[0]
        });
    } catch (error) {
        console.error('Get user chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Get chat messages
app.get('/api/support/chats/:chatId/messages', async (req, res) => {
    const chatId = req.params.chatId;
    
    try {
        const result = await pool.query(`
            SELECT * FROM support_messages 
            WHERE chat_id = $1 
            ORDER BY sent_at ASC
        `, [chatId]);
        
        res.json({
            success: true,
            messages: result.rows
        });
    } catch (error) {
        console.error('Get chat messages error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Send message to chat - ИСПРАВЛЕННАЯ ВЕРСИЯ
app.post('/api/support/chats/:chatId/messages', async (req, res) => {
    const chatId = req.params.chatId;
    const { user_id, user_name, user_username, message, is_admin } = req.body;

    if (!message) {
        return res.status(400).json({
            success: false,
            error: 'Message is required'
        });
    }

    try {
        // Save message
        const result = await pool.query(`
            INSERT INTO support_messages (chat_id, user_id, user_name, user_username, message, is_admin) 
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [chatId, user_id, user_name, user_username, message, is_admin || false]);

        // Update chat last message
        await pool.query(`
            UPDATE support_chats 
            SET last_message = $1, last_message_time = CURRENT_TIMESTAMP,
                unread_count = CASE WHEN $2 = true THEN 0 ELSE unread_count + 1 END
            WHERE id = $3
        `, [message, is_admin, chatId]);

        res.json({
            success: true,
            message: 'Message sent',
            messageId: result.rows[0].id
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Get all chats for admin (for all admins) - ИСПРАВЛЕННАЯ ВЕРСИЯ БЕЗ ПРОВЕРОК
app.get('/api/support/chats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM support_chats 
            WHERE is_active = true
            ORDER BY last_message_time DESC
        `);
        
        res.json({
            success: true,
            chats: result.rows
        });
    } catch (error) {
        console.error('Get chats error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Get all chats (including archived) (for all admins) - ИСПРАВЛЕННАЯ ВЕРСИЯ БЕЗ ПРОВЕРОК
app.get('/api/support/all-chats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM support_chats 
            ORDER BY last_message_time DESC
        `);
        
        res.json({
            success: true,
            chats: result.rows
        });
    } catch (error) {
        console.error('Get all chats error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Get archived chats (for all admins) - ИСПРАВЛЕННАЯ ВЕРСИЯ БЕЗ ПРОВЕРОК
app.get('/api/support/archived-chats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM support_chats 
            WHERE is_active = false
            ORDER BY last_message_time DESC
        `);
        
        res.json({
            success: true,
            chats: result.rows
        });
    } catch (error) {
        console.error('Get archived chats error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Archive chat (for all admins) - ИСПРАВЛЕННАЯ ВЕРСИЯ БЕЗ ПРОВЕРОК
app.put('/api/support/chats/:chatId/archive', async (req, res) => {
    const chatId = req.params.chatId;
    
    try {
        await pool.query(`
            UPDATE support_chats 
            SET is_active = false 
            WHERE id = $1
        `, [chatId]);
        
        res.json({
            success: true,
            message: 'Chat archived successfully'
        });
    } catch (error) {
        console.error('Archive chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Restore chat (for all admins) - ИСПРАВЛЕННАЯ ВЕРСИЯ БЕЗ ПРОВЕРОК
app.put('/api/support/chats/:chatId/restore', async (req, res) => {
    const chatId = req.params.chatId;
    
    try {
        await pool.query(`
            UPDATE support_chats 
            SET is_active = true 
            WHERE id = $1
        `, [chatId]);
        
        res.json({
            success: true,
            message: 'Chat restored successfully'
        });
    } catch (error) {
        console.error('Restore chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// ==================== PROMOCODES ENDPOINTS ====================
// Временная функция для полного сброса таблицы промокодов
app.post('/api/admin/promocodes/reset', async (req, res) => {
    try {
        // Удаляем таблицу если существует
        await pool.query('DROP TABLE IF EXISTS promocodes CASCADE');
        await pool.query('DROP TABLE IF EXISTS promocode_activations CASCADE');
        
        // Создаем заново
        await createPromocodesTable();
        
        res.json({
            success: true,
            message: 'Таблицы промокодов полностью пересозданы'
        });
    } catch (error) {
        console.error('Reset promocodes error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/admin/promocodes/create', async (req, res) => {
    const { adminId, code, maxUses, reward, expiresAt } = req.body;
    
    console.log('🎫 Create promocode request:', { adminId, code, maxUses, reward, expiresAt });
    
    // Сначала проверяем и исправляем структуру таблицы
    await fixPromocodesTable();
    
    // Проверка прав - только главный админ
    if (!adminId || parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Только главный администратор может создавать промокоды!'
        });
    }
    
    // Валидация
    if (!code || !maxUses || !reward) {
        return res.status(400).json({
            success: false,
            error: 'Заполните все обязательные поля'
        });
    }
    
    try {
        // Проверяем существование промокода
        const existing = await pool.query(
            'SELECT id FROM promocodes WHERE code = $1 AND is_active = true',
            [code.toUpperCase()]
        );
        
        if (existing.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Промокод с таким кодом уже существует!'
            });
        }
        
        // Создаем промокод
        const result = await pool.query(`
            INSERT INTO promocodes (code, max_uses, reward, expires_at, created_by) 
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [
            code.toUpperCase(), 
            parseInt(maxUses), 
            parseFloat(reward), 
            expiresAt ? new Date(expiresAt) : null, 
            adminId
        ]);
        
        console.log('✅ Promocode created:', result.rows[0]);
        
        res.json({
            success: true,
            message: `Промокод ${code} успешно создан!`,
            promocode: result.rows[0]
        });
        
    } catch (error) {
        console.error('❌ Create promocode error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных: ' + error.message
        });
    }
});

// ==================== ОТМЕНА ВЫПЛАТЫ ====================

// Endpoint для отмены выплаты и возврата средств пользователю
app.post('/api/admin/withdrawal-requests/:requestId/cancel', async (req, res) => {
    const requestId = req.params.requestId;
    const { adminId } = req.body;
    
    console.log('🔄 Отмена выплаты админом:', { requestId, adminId });
    
    // Проверка прав администратора
    const isAdmin = await checkAdminAccess(adminId);
    if (!isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Доступ запрещен. Только администраторы могут отменять выплаты.'
        });
    }
    
    try {
        // Получаем информацию о запросе на вывод
        const requestCheck = await pool.query(
            'SELECT * FROM withdrawal_requests WHERE id = $1',
            [requestId]
        );
        
        if (requestCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Запрос на вывод не найден'
            });
        }
        
        const withdrawalRequest = requestCheck.rows[0];
        
        // Проверяем, что запрос еще не обработан
        if (withdrawalRequest.status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: 'Невозможно отменить уже обработанный запрос'
            });
        }
        
        // Начинаем транзакцию для безопасного возврата средств
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // 1. Возвращаем средства пользователю
            await client.query(`
                UPDATE user_profiles 
                SET balance = COALESCE(balance, 0) + $1
                WHERE user_id = $2
            `, [withdrawalRequest.amount, withdrawalRequest.user_id]);
            
            // 2. Обновляем статус запроса на "отменен"
            await client.query(`
                UPDATE withdrawal_requests 
                SET status = 'cancelled', 
                    completed_at = CURRENT_TIMESTAMP,
                    completed_by = $1
                WHERE id = $2
            `, [adminId, requestId]);
            
            await client.query('COMMIT');
            
            console.log(`✅ Выплата отменена! Средства возвращены пользователю ${withdrawalRequest.user_id}`);
            
            // Отправляем уведомление пользователю через бота
            if (bot) {
                try {
                    await bot.sendMessage(
                        withdrawalRequest.user_id,
                        `❌ Ваша заявка на вывод ${withdrawalRequest.amount}⭐ была отменена администратором. ` +
                        `Средства возвращены на ваш баланс.`
                    );
                } catch (botError) {
                    console.log('Не удалось отправить уведомление пользователю:', botError.message);
                }
            }
            
            res.json({
                success: true,
                message: `Выплата отменена! ${withdrawalRequest.amount}⭐ возвращены пользователю`,
                returnedAmount: withdrawalRequest.amount,
                userId: withdrawalRequest.user_id
            });
            
        } catch (transactionError) {
            await client.query('ROLLBACK');
            throw transactionError;
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('❌ Cancel withdrawal error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при отмене выплаты: ' + error.message
        });
    }
});

// ==================== ИСТОРИЯ ОТМЕНЕННЫХ ВЫПЛАТ ====================

// Получение истории отмененных выплат
app.get('/api/admin/cancelled-withdrawals', async (req, res) => {
    const { adminId } = req.query;
    
    console.log('📋 Запрос истории отмененных выплат от админа:', adminId);
    
    // Проверка прав администратора
    const isAdmin = await checkAdminAccess(adminId);
    if (!isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Доступ запрещен'
        });
    }
    
    try {
        const result = await pool.query(`
            SELECT wr.*, u.username, u.first_name, 
                   up.username as admin_username, up.first_name as admin_name
            FROM withdrawal_requests wr
            LEFT JOIN user_profiles u ON wr.user_id = u.user_id
            LEFT JOIN user_profiles up ON wr.completed_by = up.user_id
            WHERE wr.status = 'cancelled'
            ORDER BY wr.completed_at DESC
            LIMIT 50
        `);
        
        console.log(`✅ Найдено ${result.rows.length} отмененных выплат`);
        
        res.json({
            success: true,
            cancelledWithdrawals: result.rows
        });
    } catch (error) {
        console.error('❌ Get cancelled withdrawals error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Получение списка промокодов
app.get('/api/admin/promocodes/list', async (req, res) => {
    const { adminId } = req.query;
    
    // Только главный админ
    if (!adminId || parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }
    
    try {
        const result = await pool.query(`
            SELECT p.*, 
                   COUNT(pa.id) as used_count
            FROM promocodes p
            LEFT JOIN promocode_activations pa ON p.id = pa.promocode_id
            WHERE p.is_active = true
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `);
        
        res.json({
            success: true,
            promocodes: result.rows
        });
        
    } catch (error) {
        console.error('Get promocodes error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Деактивация промокода
app.post('/api/admin/promocodes/deactivate', async (req, res) => {
    const { adminId, code } = req.body;
    
    // Только главный админ
    if (!adminId || parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }
    
    try {
        await pool.query(
            'UPDATE promocodes SET is_active = false WHERE code = $1',
            [code]
        );
        
        res.json({
            success: true,
            message: `Промокод ${code} успешно удален!`
        });
        
    } catch (error) {
        console.error('Deactivate promocode error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// Получение данных задания для редактирования
app.get('/api/tasks/:taskId', async (req, res) => {
    const taskId = req.params.taskId;
    const adminId = req.query.adminId;
    
    try {
        // Проверяем права администратора
        const adminCheck = await pool.query(
            'SELECT is_admin FROM user_profiles WHERE user_id = $1',
            [adminId]
        );
        
        if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_admin) {
            return res.status(403).json({
                success: false,
                error: 'Только администратор может редактировать задания'
            });
        }
        
        // Получаем данные задания
        const result = await pool.query(`
            SELECT * FROM tasks WHERE id = $1
        `, [taskId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Задание не найдено'
            });
        }
        
        res.json({
            success: true,
            task: result.rows[0]
        });
        
    } catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});

// Обновление задания
app.post('/api/tasks/:taskId/update', upload.single('image'), async (req, res) => {
    const taskId = req.params.taskId;
    const {
        title,
        description,
        price,
        category,
        time_to_complete,
        difficulty,
        people_required,
        task_url,
        adminId
    } = req.body;
    
    try {
        // Проверяем права администратора
        const adminCheck = await pool.query(
            'SELECT is_admin FROM user_profiles WHERE user_id = $1',
            [adminId]
        );
        
        if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_admin) {
            return res.status(403).json({
                success: false,
                error: 'Только администратор может редактировать задания'
            });
        }
        
        // Проверяем существование задания
        const taskCheck = await pool.query(
            'SELECT * FROM tasks WHERE id = $1',
            [taskId]
        );
        
        if (taskCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Задание не найдено'
            });
        }
        
        // Подготавливаем данные для обновления
        let updateFields = [];
        let updateValues = [];
        let paramCount = 1;
        
        const fields = {
            'title': title,
            'description': description,
            'price': price,
            'category': category,
            'time_to_complete': time_to_complete,
            'difficulty': difficulty,
            'people_required': people_required,
            'task_url': task_url,
            'updated_at': new Date()
        };
        
        // Добавляем поля для обновления
        Object.keys(fields).forEach(field => {
            if (fields[field] !== undefined) {
                updateFields.push(`${field} = $${paramCount}`);
                updateValues.push(fields[field]);
                paramCount++;
            }
        });
        
        // Обрабатываем изображение если есть
        if (req.file) {
            const imageUrl = `/uploads/${req.file.filename}`;
            updateFields.push(`image_url = $${paramCount}`);
            updateValues.push(imageUrl);
            paramCount++;
        }
        
        // Добавляем ID задания в конец
        updateValues.push(taskId);
        
        // Выполняем обновление
        const updateQuery = `
            UPDATE tasks 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
        `;
        
        const result = await pool.query(updateQuery, updateValues);
        
        res.json({
            success: true,
            message: 'Задание успешно обновлено',
            task: result.rows[0]
        });
        
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});
// Активация промокода пользователем
app.post('/api/promocodes/activate', async (req, res) => {
    const { userId, code } = req.body;
    
    console.log('🎫 Activate promocode request:', { userId, code });
    
    if (!userId || !code) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    try {
        // Проверяем существование пользователя
        const userResult = await pool.query(
            'SELECT user_id FROM user_profiles WHERE user_id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }
        
        // Проверяем промокод
        const promocodeResult = await pool.query(`
            SELECT * FROM promocodes 
            WHERE code = $1 AND is_active = true
        `, [code]);
        
        if (promocodeResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Промокод не найден или неактивен'
            });
        }
        
        const promocode = promocodeResult.rows[0];
        
        // Проверяем срок действия
        if (promocode.expires_at && new Date(promocode.expires_at) < new Date()) {
            return res.status(400).json({
                success: false,
                error: 'Срок действия промокода истек'
            });
        }
        
        // Проверяем лимит использований
        if (promocode.used_count >= promocode.max_uses) {
            return res.status(400).json({
                success: false,
                error: 'Лимит активаций промокода исчерпан'
            });
        }
        
        // Проверяем, активировал ли пользователь уже этот промокод
        const activationCheck = await pool.query(`
            SELECT pa.id 
            FROM promocode_activations pa
            JOIN promocodes p ON pa.promocode_id = p.id
            WHERE pa.user_id = $1 AND p.code = $2
        `, [userId, code]);
        
        if (activationCheck.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Вы уже активировали этот промокод'
            });
        }
        
        // Начинаем транзакцию
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Добавляем запись об активации
            await client.query(`
                INSERT INTO promocode_activations (user_id, promocode_id) 
                VALUES ($1, $2)
            `, [userId, promocode.id]);
            
            // Обновляем счетчик использований
            await client.query(`
                UPDATE promocodes 
                SET used_count = used_count + 1 
                WHERE id = $1
            `, [promocode.id]);
            
            // Начисляем награду пользователю
            await client.query(`
                UPDATE user_profiles 
                SET balance = COALESCE(balance, 0) + $1
                WHERE user_id = $2
            `, [promocode.reward, userId]);
            
            await client.query('COMMIT');
            
            console.log(`✅ Promocode activated: user ${userId} got ${promocode.reward} stars`);
            
            res.json({
                success: true,
                message: `Промокод активирован! Вы получили ${promocode.reward} ⭐`,
                reward: promocode.reward
            });
            
        } catch (transactionError) {
            await client.query('ROLLBACK');
            throw transactionError;
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('❌ Activate promocode error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// Получение статистики заданий для админ-панели
app.get('/api/admin/tasks-stats', async (req, res) => {
    const { adminId } = req.query;
    
    try {
        // Проверка прав администратора
        const isAdmin = await checkAdminAccess(adminId);
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }
        
        // Получаем статистику по всем заданиям
        const statsResult = await pool.query(`
            SELECT 
                COUNT(*) as total_tasks,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_tasks,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
                COUNT(CASE WHEN created_by = $1 THEN 1 END) as my_tasks
            FROM tasks
        `, [adminId]);
        
        // Получаем статистику по user_tasks для счетчиков
        const userTasksStats = await pool.query(`
            SELECT 
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
                COUNT(CASE WHEN status = 'pending_review' THEN 1 END) as pending_count,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count
            FROM user_tasks
        `);
        
        const stats = statsResult.rows[0];
        const userStats = userTasksStats.rows[0];
        
        res.json({
            success: true,
            statistics: {
                total_tasks: parseInt(stats.total_tasks),
                active_tasks: parseInt(stats.active_tasks),
                completed_tasks: parseInt(stats.completed_tasks),
                my_tasks: parseInt(stats.my_tasks),
                // Добавляем счетчики из user_tasks
                completed_count: parseInt(userStats.completed_count),
                rejected_count: parseInt(userStats.rejected_count),
                pending_count: parseInt(userStats.pending_count),
                active_count: parseInt(userStats.active_count)
            }
        });
        
    } catch (error) {
        console.error('Get admin tasks stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// Delete chat (for all admins) - ИСПРАВЛЕННАЯ ВЕРСИЯ БЕЗ ПРОВЕРОК
app.delete('/api/support/chats/:chatId', async (req, res) => {
    const chatId = req.params.chatId;
    
    try {
        // Delete messages first
        await pool.query(`
            DELETE FROM support_messages 
            WHERE chat_id = $1
        `, [chatId]);
        
        // Then delete chat
        await pool.query(`
            DELETE FROM support_chats 
            WHERE id = $1
        `, [chatId]);
        
        res.json({
            success: true,
            message: 'Chat deleted successfully'
        });
    } catch (error) {
        console.error('Delete chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Функция для отправки информации о пользователе
async function sendUserInfo(chatId, user) {
    const userName = user.first_name + (user.last_name ? ' ' + user.last_name : '');
    const userStatus = user.is_admin ? '👑 Администратор' : '👤 Пользователь';
    const registrationDate = new Date(user.created_at).toLocaleDateString('ru-RU');
    
    const messageText = `
👤 <b>Информация о пользователе</b>

<b>ID:</b> <code>${user.user_id}</code>
<b>Имя:</b> ${userName}
<b>Юзернейм:</b> @${user.username || 'не указан'}
<b>Статус:</b> ${userStatus}
<b>Баланс:</b> ${user.balance || 0}⭐
<b>Регистрация:</b> ${registrationDate}

📊 <b>Статистика заданий:</b>
• Всего заданий: ${user.total_tasks || 0}
• Выполнено: ${user.completed_tasks || 0}
• Отклонено: ${user.rejected_tasks || 0}
• На проверке: ${user.pending_tasks || 0}

👥 <b>Реферальная система:</b>
• Приглашено: ${user.referral_count || 0} чел.
• Заработано: ${user.referral_earned || 0}⭐
    `.trim();

    const keyboard = {
        inline_keyboard: [
            [
                {
                    text: user.is_admin ? '❌ Разжаловать' : '👑 Сделать админом',
                    callback_data: `toggle_admin_${user.user_id}`
                },
                {
                    text: user.balance > 0 ? '💳 Управление счетом' : '💰 Пополнить счет',
                    callback_data: `manage_balance_${user.user_id}`
                }
            ],
            [
                {
                    text: '🔄 Обновить',
                    callback_data: `refresh_user_${user.user_id}`
                },
                {
                    text: '📊 Подробная статистика',
                    callback_data: `user_stats_${user.user_id}`
                }
            ]
        ]
    };

    await bot.sendMessage(
        chatId,
        messageText,
        {
            parse_mode: 'HTML',
            reply_markup: keyboard
        }
    );
}
// ==================== TASK VERIFICATION ENDPOINTS ====================

// Система проверки заданий для ВСЕХ админов
app.get('/api/admin/task-verifications', async (req, res) => {
    const { adminId } = req.query;
    
    console.log('🔄 Запрос на проверку заданий от админа:', adminId);
    
    // Проверка прав администратора - РАЗРЕШАЕМ ВСЕМ АДМИНАМ
    const isAdmin = await checkAdminAccess(adminId);
    if (!isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Доступ запрещен. Только администраторы могут проверять задания.'
        });
    }
    
    try {
        const result = await pool.query(`
            SELECT tv.*, u.username, u.first_name, u.last_name
            FROM task_verifications tv 
            JOIN user_profiles u ON tv.user_id = u.user_id 
            WHERE tv.status = 'pending' 
            ORDER BY tv.submitted_at DESC
        `);
        
        console.log(`✅ Найдено ${result.rows.length} заданий на проверку для админа ${adminId}`);
        
        res.json({
            success: true,
            verifications: result.rows
        });
    } catch (error) {
        console.error('❌ Get verifications error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// Диагностика прав администратора
app.get('/api/admin/debug-rights', async (req, res) => {
    const { userId } = req.query;
    
    console.log('🔍 Debug admin rights for user:', userId);
    
    try {
        const userResult = await pool.query(
            'SELECT user_id, username, is_admin FROM user_profiles WHERE user_id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.json({
                success: false,
                error: 'User not found',
                isAdmin: false
            });
        }
        
        const user = userResult.rows[0];
        const isMainAdmin = parseInt(userId) === ADMIN_ID;
        const isAdmin = user.is_admin === true || isMainAdmin;
        
        res.json({
            success: true,
            user: user,
            isAdmin: isAdmin,
            isMainAdmin: isMainAdmin,
            adminId: ADMIN_ID
        });
        
    } catch (error) {
        console.error('Debug rights error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Добавьте эту функцию перед интервалом
async function checkReferralEarnings() {
    try {
        if (!currentUser || !currentUser.id) return;
        
        // Ваша логика проверки реферальных начислений
        console.log('Checking referral earnings for user:', currentUser.id);
        
    } catch (error) {
        console.error('Error checking referral earnings:', error);
    }
}

// Автоматическая проверка реферальных начислений каждые 30 секунд
setInterval(() => {
    if (currentUser) {
        checkReferralEarnings();
    }
}, 30000);

app.post('/api/admin/task-verifications/:verificationId/approve', async (req, res) => {
    const { verificationId } = req.params;
    const { adminId, forceApprove = false } = req.body;

    console.log('🔄 Admin approving verification:', { verificationId, adminId, forceApprove });

    if (!adminId) {
        return res.status(400).json({
            success: false,
            error: 'ID администратора обязателен'
        });
    }

    try {
        const adminCheck = await pool.query(
            'SELECT is_admin FROM user_profiles WHERE user_id = $1',
            [adminId]
        );

        if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_admin) {
            return res.status(403).json({
                success: false,
                error: 'Недостаточно прав. Только администратор может одобрять задания.'
            });
        }

        const verificationResult = await pool.query(`
            SELECT 
                tv.*,
                t.price as task_price,
                t.title as task_title,
                t.people_required,
                t.completed_count,
                ut.user_id,
                up.first_name as user_name,
                up.username,
                up.tasks_completed
            FROM task_verifications tv
            JOIN user_tasks ut ON tv.user_task_id = ut.id
            JOIN tasks t ON ut.task_id = t.id
            JOIN user_profiles up ON ut.user_id = up.user_id
            WHERE tv.id = $1
        `, [verificationId]);

        if (verificationResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Проверка задания не найдена'
            });
        }

        const verification = verificationResult.rows[0];
        const userId = verification.user_id;
        const taskPrice = verification.task_price;
        const taskId = verification.task_id;
        const taskTitle = verification.task_title;
        const userTasksCompleted = verification.tasks_completed || 0;

        console.log('📊 Verification details:', {
            userId,
            taskPrice,
            taskTitle,
            peopleRequired: verification.people_required,
            completedCount: verification.completed_count,
            userTasksCompleted,
            hasScreenshot: !!verification.screenshot_url
        });

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Обновляем статус user_task на 'completed'
            await client.query(
                'UPDATE user_tasks SET status = $1, completed_at = NOW() WHERE id = $2',
                ['completed', verification.user_task_id]
            );

            // 2. Начисляем ВСЮ сумму пользователю (100%)
            await client.query(
                'UPDATE user_profiles SET balance = balance + $1, tasks_completed = COALESCE(tasks_completed, 0) + 1 WHERE user_id = $2',
                [taskPrice, userId]
            );

            // 3. Обновляем счетчик выполненных заданий
            await client.query(
                'UPDATE tasks SET completed_count = COALESCE(completed_count, 0) + 1 WHERE id = $1',
                [taskId]
            );

            // 4. Помечаем верификацию как обработанную
            await client.query(
                'UPDATE task_verifications SET status = $1, reviewed_at = NOW(), reviewed_by = $2 WHERE id = $3',
                ['approved', adminId, verificationId]
            );

            // 🔥 УВЕДОМЛЯЕМ ПОЛЬЗОВАТЕЛЯ (БЕЗ РЕФЕРАЛЬНОЙ ИНФОРМАЦИИ)
            await sendTaskNotification(userId, taskTitle, 'approved');

            const taskUpdateResult = await client.query(
                'SELECT people_required, completed_count FROM tasks WHERE id = $1',
                [taskId]
            );

            let taskRemoved = false;
            if (taskUpdateResult.rows.length > 0) {
                const task = taskUpdateResult.rows[0];
                const peopleRequired = task.people_required || 1;
                const completedCount = task.completed_count || 0;

                if (completedCount >= peopleRequired) {
                    await client.query(
                        'UPDATE tasks SET status = $1 WHERE id = $2',
                        ['completed', taskId]
                    );
                    taskRemoved = true;
                    console.log('🎯 Task completed and removed:', taskId);
                }
            }

            await client.query('COMMIT');

            const response = {
                success: true,
                message: 'Задание успешно одобрено!',
                amountAdded: taskPrice, // Полная сумма
                taskRemoved: taskRemoved,
                taskCompleted: true,
                userReward: taskPrice,
                originalPrice: taskPrice
            };

            if (!verification.screenshot_url) {
                response.message += " (Одобрено без скриншота)";
            }

            console.log('✅ Verification approved successfully:', response);

            res.json(response);

        } catch (transactionError) {
            await client.query('ROLLBACK');
            console.error('❌ Transaction error:', transactionError);
            
            res.status(500).json({
                success: false,
                error: 'Внутренняя ошибка сервера'
            });
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Approve verification error:', error);
        
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера'
        });
    }
});
// Endpoint для получения обновленного списка проверок после одобрения
app.get('/api/admin/task-verifications/updated', async (req, res) => {
    const { adminId } = req.query;
    
    console.log('🔄 Запрос обновленного списка проверок от админа:', adminId);
    
    // Проверка прав администратора
    const isAdmin = await checkAdminAccess(adminId);
    if (!isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Доступ запрещен'
        });
    }
    
    try {
        const result = await pool.query(`
            SELECT tv.*, u.username, u.first_name, u.last_name
            FROM task_verifications tv 
            JOIN user_profiles u ON tv.user_id = u.user_id 
            WHERE tv.status = 'pending' 
            ORDER BY tv.submitted_at DESC
        `);
        
        console.log(`✅ Обновленный список: ${result.rows.length} заданий на проверку`);
        
        res.json({
            success: true,
            verifications: result.rows,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Get updated verifications error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// 🔧 ENDPOINT ДЛЯ ПРИНУДИТЕЛЬНОГО ОДОБРЕНИЯ БЕЗ СКРИНШОТА
app.post('/api/admin/task-verifications/:verificationId/force-approve', async (req, res) => {
    const { verificationId } = req.params;
    const { adminId, reason } = req.body;

    console.log('🔧 Force approving verification:', { verificationId, adminId, reason });

    try {
        // Используем основную функцию с флагом forceApprove
        const result = await pool.query(`
            SELECT tv.*, ut.user_id, t.price, t.id as task_id
            FROM task_verifications tv
            JOIN user_tasks ut ON tv.user_task_id = ut.id
            JOIN tasks t ON ut.task_id = t.id
            WHERE tv.id = $1
        `, [verificationId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Проверка не найдена'
            });
        }

        const verification = result.rows[0];

        // Вызываем основной endpoint с флагом forceApprove
        const approveResult = await fetch(`http://localhost:${PORT}/api/admin/task-verifications/${verificationId}/approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                adminId: adminId,
                forceApprove: true
            })
        });

        const data = await approveResult.json();

        if (data.success) {
            // Логируем принудительное одобрение
            await pool.query(`
                INSERT INTO admin_actions (admin_id, action_type, target_id, description) 
                VALUES ($1, $2, $3, $4)
            `, [adminId, 'force_approve', verificationId, reason || 'Автоматическое одобрение при ошибке скриншота']);

            res.json({
                success: true,
                message: 'Задание одобрено в принудительном режиме',
                ...data
            });
        } else {
            throw new Error(data.error);
        }

    } catch (error) {
        console.error('❌ Force approve error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка принудительного одобрения: ' + error.message
        });
    }
});
// В server.js добавьте:
app.get('/api/user/:userId/referral-earnings', async (req, res) => {
    const userId = req.params.userId;
    
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as referral_count,
                COALESCE(SUM(referral_earned), 0) as total_earned
            FROM user_profiles 
            WHERE user_id = $1
        `, [userId]);
        
        res.json({
            success: true,
            earnings: result.rows[0]
        });
    } catch (error) {
        console.error('Get referral earnings error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error'
        });
    }
});
// 🗑️ РУЧНОЕ УДАЛЕНИЕ ПРОВЕРКИ ЗАДАНИЯ
// 🗑️ РУЧНОЕ УДАЛЕНИЕ ПРОВЕРКИ ЗАДАНИЯ
app.post('/api/admin/task-verifications/:verificationId/delete', async (req, res) => {
    const verificationId = req.params.verificationId;
    const { adminId } = req.body;
    
    console.log('🗑️ Ручное удаление проверки задания:', { verificationId, adminId });
    
    // Проверка прав администратора
    const isAdmin = await checkAdminAccess(adminId);
    if (!isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Доступ запрещен. Только администраторы могут удалять проверки.'
        });
    }
    
    try {
        // Получаем информацию о проверке
        const verification = await pool.query(
            'SELECT * FROM task_verifications WHERE id = $1', 
            [verificationId]
        );
        
        if (verification.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Проверка не найдена'
            });
        }

        const verificationData = verification.rows[0];
        
        // Удаляем запись проверки
        await pool.query('DELETE FROM task_verifications WHERE id = $1', [verificationId]);
        
        // Обновляем статус user_task обратно на 'active'
        await pool.query(`
            UPDATE user_tasks 
            SET status = 'active', submitted_at = NULL, screenshot_url = NULL
            WHERE id = $1
        `, [verificationData.user_task_id]);
        
        console.log(`✅ Проверка ${verificationId} удалена, задание возвращено в активные`);
        
        res.json({
            success: true,
            message: 'Проверка успешно удалена, задание возвращено пользователю для повторной отправки'
        });
        
    } catch (error) {
        console.error('Delete verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});


// Отклонение задания для ВСЕХ админов - ОБНОВЛЕННАЯ ВЕРСИЯ С УДАЛЕНИЕМ ФАЙЛОВ
app.post('/api/admin/task-verifications/:verificationId/reject', async (req, res) => {
    const verificationId = req.params.verificationId;
    const { adminId, comment = '' } = req.body;
    
    console.log(' ❌ Отклонение задания админом:', { verificationId, adminId, comment });
    
    const isAdmin = await checkAdminAccess(adminId);
    if (!isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Доступ запрещен. Только администраторы могут отклонять задания.'
        });
    }
    
    let screenshotPath = '';
    
    try {
        const verification = await pool.query(`
            SELECT tv.*, t.title as task_title, ut.user_id 
            FROM task_verifications tv
            JOIN user_tasks ut ON tv.user_task_id = ut.id
            JOIN tasks t ON ut.task_id = t.id
            WHERE tv.id = $1
        `, [verificationId]);
        
        if (verification.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Verification not found'
            });
        }

        const verificationData = verification.rows[0];
        const userId = verificationData.user_id;
        const taskTitle = verificationData.task_title;
        
        screenshotPath = verificationData.screenshot_url;
        
        await pool.query(`
            UPDATE task_verifications 
            SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1 
            WHERE id = $2
        `, [adminId, verificationId]);
        
        await pool.query(`
            UPDATE user_tasks 
            SET status = 'rejected', completed_at = CURRENT_TIMESTAMP 
            WHERE id = $1
        `, [verificationData.user_task_id]);
        
        // 🔥 ОТПРАВЛЯЕМ УВЕДОМЛЕНИЕ ОБ ОТКЛОНЕНИИ
        await sendTaskNotification(userId, taskTitle, 'rejected', comment);
        
        if (screenshotPath) {
            await deleteScreenshotFile(screenshotPath);
        }
        
        res.json({
            success: true,
            message: 'Задание отклонено'
        });
    } catch (error) {
        console.error('Reject verification error:', error);
        
        if (screenshotPath) {
            try {
                await deleteScreenshotFile(screenshotPath);
            } catch (deleteError) {
                console.error('Error deleting screenshot after failed rejection:', deleteError);
            }
        }
        
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// 🔧 ФУНКЦИЯ ДЛЯ УДАЛЕНИЯ ФАЙЛОВ СКРИНШОТОВ
async function deleteScreenshotFile(screenshotUrl) {
    try {
        // Извлекаем имя файла из URL
        const filename = screenshotUrl.split('/').pop();
        if (!filename) {
            console.log('❌ Cannot extract filename from URL:', screenshotUrl);
            return;
        }
        
        const filePath = path.join(__dirname, 'uploads', filename);
        
        // Проверяем существование файла
        if (fs.existsSync(filePath)) {
            // Удаляем файл
            fs.unlinkSync(filePath);
            console.log(`✅ Screenshot file deleted: ${filename}`);
            
            // Также удаляем запись из базы данных о скриншоте
            await pool.query(`
                UPDATE user_tasks 
                SET screenshot_url = NULL 
                WHERE screenshot_url LIKE $1
            `, [`%${filename}%`]);
            
        } else {
            console.log(`⚠️ File not found, skipping deletion: ${filename}`);
        }
    } catch (error) {
        console.error('❌ Error deleting screenshot file:', error);
        // Не бросаем ошибку дальше, чтобы не нарушить основной процесс
    }
}
// ==================== WITHDRAWAL ENDPOINTS ====================

// Request withdrawal - ОБНОВЛЕННАЯ ВЕРСИЯ С ПРОВЕРКОЙ МИНИМУМА
// Request withdrawal - ИСПРАВЛЕННАЯ ВЕРСИЯ
app.post('/api/withdrawal/request', async (req, res) => {
    const { user_id, amount, username, first_name } = req.body;
    
    console.log('📨 Получен запрос на вывод:', { user_id, amount, username, first_name });
    
    if (!user_id || !amount) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const allowedAmounts = [50, 100, 150, 200, 250, 300];
        const requestAmount = parseFloat(amount);
        
        // Проверяем что сумма допустима
        if (!allowedAmounts.includes(requestAmount)) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Недопустимая сумма для вывода. Доступные суммы: 50, 100, 150, 200, 250, 300 ⭐'
            });
        }
        
        // Проверяем баланс пользователя (заблокированная строка для предотвращения гонки условий)
        const userResult = await client.query(
            'SELECT balance FROM user_profiles WHERE user_id = $1 FOR UPDATE',
            [user_id]
        );
        
        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        const userBalance = parseFloat(userResult.rows[0].balance) || 0;
        
        console.log(`💰 Баланс пользователя: ${userBalance}, Запрошено: ${requestAmount}`);
        
        // Проверяем достаточно ли средств
        if (requestAmount > userBalance) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Недостаточно средств на балансе'
            });
        }
        
        if (requestAmount <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Сумма должна быть положительной'
            });
        }
        
        // ВЫЧИТАЕМ сумму из баланса пользователя
        const newBalance = userBalance - requestAmount;
        await client.query(
            'UPDATE user_profiles SET balance = $1 WHERE user_id = $2',
            [newBalance, user_id]
        );
        
        // Создаем запрос на вывод
        const result = await client.query(`
            INSERT INTO withdrawal_requests (user_id, username, first_name, amount, status) 
            VALUES ($1, $2, $3, $4, 'pending')
            RETURNING *
        `, [user_id, username, first_name, requestAmount]);
        
        const requestId = result.rows[0].id;
        
        await client.query('COMMIT');
        
        console.log(`✅ Запрос на вывод создан: ID ${requestId}, новый баланс: ${newBalance}`);
        
        res.json({
            success: true,
            message: 'Запрос на вывод отправлен',
            requestId: requestId,
            newBalance: newBalance,
            withdrawnAmount: requestAmount
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Withdrawal error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    } finally {
        client.release();
    }
});

// Проверка доступных сумм для вывода
app.get('/api/withdrawal/available-amounts/:userId', async (req, res) => {
    const userId = req.params.userId;
    
    try {
        const userResult = await pool.query(
            'SELECT balance FROM user_profiles WHERE user_id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        const userBalance = parseFloat(userResult.rows[0].balance) || 0;
        const availableAmounts = [50, 100, 150, 200, 250, 300];
        
        // Фильтруем доступные суммы по балансу
        const allowedAmounts = availableAmounts.filter(amount => amount <= userBalance);
        
        res.json({
            success: true,
            balance: userBalance,
            availableAmounts: allowedAmounts,
            canWithdraw: allowedAmounts.length > 0
        });
        
    } catch (error) {
        console.error('Check available amounts error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Отмена вывода и возврат средств
app.post('/api/withdrawal/:requestId/cancel', async (req, res) => {
    const requestId = req.params.requestId;
    const { userId } = req.body;
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Получаем информацию о запросе
        const requestResult = await client.query(
            'SELECT * FROM withdrawal_requests WHERE id = $1 AND user_id = $2 AND status = $3',
            [requestId, userId, 'pending']
        );
        
        if (requestResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Запрос на вывод не найден или уже обработан'
            });
        }
        
        const withdrawalRequest = requestResult.rows[0];
        const amount = withdrawalRequest.amount;
        
        // Возвращаем средства на баланс
        await client.query(
            'UPDATE user_profiles SET balance = balance + $1 WHERE user_id = $2',
            [amount, userId]
        );
        
        // Удаляем запрос на вывод
        await client.query(
            'DELETE FROM withdrawal_requests WHERE id = $1',
            [requestId]
        );
        
        await client.query('COMMIT');
        
        console.log(`✅ Вывод отменен, средства возвращены: ${amount}⭐ пользователю ${userId}`);
        
        res.json({
            success: true,
            message: 'Вывод отменен, средства возвращены на баланс',
            returnedAmount: amount
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Cancel withdrawal error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    } finally {
        client.release();
    }
});

// Get withdrawal history
app.get('/api/withdraw/history/:userId', async (req, res) => {
    const userId = req.params.userId;
    
    try {
        const result = await pool.query(`
            SELECT * FROM withdrawal_requests 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `, [userId]);
        
        res.json({
            success: true,
            operations: result.rows
        });
    } catch (error) {
        console.error('Get withdrawal history error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// ==================== ADMIN MANAGEMENT ENDPOINTS ====================
// В server.js
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});
// Получение списка всех админов с расширенной статистикой
app.get('/api/admin/admins-list', async (req, res) => {
    const { adminId } = req.query;
    
    console.log('🔄 Loading admins list for admin:', adminId);
    
    if (!adminId || parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied - only main admin can view admins list'
        });
    }
    
    try {
        // Сначала убедимся, что таблица существует
        await createAdminPermissionsTable();
        
        const result = await pool.query(`
            SELECT 
                up.user_id, 
                up.username, 
                up.first_name, 
                up.last_name, 
                up.is_admin,
                up.created_at,
                -- Статистика постов
                (SELECT COUNT(*) FROM posts WHERE author_id = up.user_id) as posts_count,
                -- Статистика заданий
                (SELECT COUNT(*) FROM tasks WHERE created_by = up.user_id) as tasks_count,
                -- Статистика проверок
                (SELECT COUNT(*) FROM task_verifications WHERE reviewed_by = up.user_id) as verifications_count,
                -- Статистика поддержки
                (SELECT COUNT(*) FROM support_messages WHERE user_id = up.user_id AND is_admin = true) as support_count,
                -- Статистика выплат
                (SELECT COUNT(*) FROM withdrawal_requests WHERE completed_by = up.user_id) as payments_count,
                -- Права доступа (используем COALESCE для обработки NULL значений)
                COALESCE(ap.can_posts, true) as can_posts,
                COALESCE(ap.can_tasks, true) as can_tasks,
                COALESCE(ap.can_verification, true) as can_verification,
                COALESCE(ap.can_support, true) as can_support,
                COALESCE(ap.can_payments, true) as can_payments
            FROM user_profiles up
            LEFT JOIN admin_permissions ap ON up.user_id = ap.admin_id
            WHERE up.is_admin = true 
            ORDER BY 
                CASE WHEN up.user_id = $1 THEN 0 ELSE 1 END,
                up.created_at DESC
        `, [ADMIN_ID]);
        
        console.log(`✅ Found ${result.rows.length} admins`);
        
        res.json({
            success: true,
            admins: result.rows
        });
        
    } catch (error) {
        console.error('❌ Get admins list error:', error);
        
        // Если все еще есть ошибка с таблицей, попробуем упрощенный запрос
        if (error.message.includes('admin_permissions')) {
            try {
                console.log('🔄 Trying simplified query without admin_permissions...');
                
                const simpleResult = await pool.query(`
                    SELECT 
                        user_id, 
                        username, 
                        first_name, 
                        last_name, 
                        is_admin,
                        created_at
                    FROM user_profiles 
                    WHERE is_admin = true 
                    ORDER BY 
                        CASE WHEN user_id = $1 THEN 0 ELSE 1 END,
                        created_at DESC
                `, [ADMIN_ID]);
                
                // Добавляем дефолтные права
                const adminsWithDefaults = simpleResult.rows.map(admin => ({
                    ...admin,
                    can_posts: true,
                    can_tasks: true,
                    can_verification: true,
                    can_support: true,
                    can_payments: true,
                    posts_count: 0,
                    tasks_count: 0,
                    verifications_count: 0,
                    support_count: 0,
                    payments_count: 0
                }));
                
                return res.json({
                    success: true,
                    admins: adminsWithDefaults,
                    note: 'Using simplified query'
                });
            } catch (fallbackError) {
                console.error('❌ Fallback query also failed:', fallbackError);
            }
        }
        
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Диагностический endpoint для заданий
app.get('/api/debug/tasks-detailed', async (req, res) => {
    const { userId } = req.query;
    
    try {
        // Получаем все активные задания
        const tasksResult = await pool.query(`
            SELECT t.*, 
                   COUNT(ut.id) as completed_count,
                   EXISTS(
                       SELECT 1 FROM user_tasks ut2 
                       WHERE ut2.task_id = t.id 
                       AND ut2.user_id = $1 
                       AND ut2.status IN ('active', 'pending_review', 'completed')
                   ) as user_has_task
            FROM tasks t 
            LEFT JOIN user_tasks ut ON t.id = ut.task_id AND ut.status = 'completed'
            WHERE t.status = 'active'
            GROUP BY t.id 
            ORDER BY t.created_at DESC
        `, [userId]);
        
        // Получаем задания пользователя
        const userTasksResult = await pool.query(`
            SELECT task_id FROM user_tasks 
            WHERE user_id = $1 AND status IN ('active', 'pending_review', 'completed')
        `, [userId]);
        
        const userTaskIds = userTasksResult.rows.map(row => row.task_id);
        
        // Фильтруем доступные задания
        const availableTasks = tasksResult.rows.filter(task => {
            const completedCount = task.completed_count || 0;
            const peopleRequired = task.people_required || 1;
            const isAvailableByLimit = completedCount < peopleRequired;
            const isAvailableToUser = !userTaskIds.includes(task.id);
            
            return isAvailableByLimit && isAvailableToUser;
        });
        
        res.json({
            success: true,
            debug: {
                total_tasks: tasksResult.rows.length,
                user_task_ids: userTaskIds,
                available_tasks_count: availableTasks.length,
                user_id: userId
            },
            all_tasks: tasksResult.rows,
            available_tasks: availableTasks
        });
        
    } catch (error) {
        console.error('Debug tasks error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Создание таблицы прав администраторов
async function createAdminPermissionsTable() {
    try {
        console.log('🔧 Creating admin_permissions table...');
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_permissions (
                admin_id BIGINT PRIMARY KEY,
                can_posts BOOLEAN DEFAULT true,
                can_tasks BOOLEAN DEFAULT true,
                can_verification BOOLEAN DEFAULT true,
                can_support BOOLEAN DEFAULT true,
                can_payments BOOLEAN DEFAULT true,
                can_admins BOOLEAN DEFAULT false,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES user_profiles(user_id)
            )
        `);
        
        // Устанавливаем права по умолчанию для главного админа
        await pool.query(`
            INSERT INTO admin_permissions (admin_id, can_posts, can_tasks, can_verification, can_support, can_payments, can_admins)
            VALUES ($1, true, true, true, true, true, true)
            ON CONFLICT (admin_id) DO NOTHING
        `, [ADMIN_ID]);
        
        console.log('✅ admin_permissions table created/verified');
    } catch (error) {
        console.error('❌ Error creating admin_permissions table:', error);
    }
}
// Расширенная проверка прав администратора
async function checkAdminPermission(userId, permission) {
    try {
        // Главный админ имеет все права
        if (parseInt(userId) === ADMIN_ID) {
            return true;
        }
        
        // Проверяем базовые права администратора
        const adminCheck = await pool.query(
            'SELECT is_admin FROM user_profiles WHERE user_id = $1',
            [userId]
        );
        
        if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_admin) {
            return false;
        }
        
        // Проверяем конкретные права в таблице разрешений
        const permissionResult = await pool.query(
            `SELECT ${permission} FROM admin_permissions WHERE admin_id = $1`,
            [userId]
        );
        
        // Если запись не найдена, даем доступ по умолчанию
        if (permissionResult.rows.length === 0) {
            return true;
        }
        
        return permissionResult.rows[0][permission] === true;
    } catch (error) {
        console.error('Permission check error:', error);
        return false;
    }
}

// Обновление прав доступа админа
app.post('/api/admin/update-permissions', async (req, res) => {
    const { adminId, targetAdminId, permission, enabled } = req.body;
    
    // Только главный админ может управлять правами
    if (!adminId || parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied - only main admin can update permissions'
        });
    }
    
    try {
        const columnMap = {
            'posts': 'can_posts',
            'tasks': 'can_tasks', 
            'verification': 'can_verification',
            'support': 'can_support',
            'payments': 'can_payments',
            'admins': 'can_admins'
        };
        
        const column = columnMap[permission];
        if (!column) {
            return res.status(400).json({
                success: false,
                error: 'Invalid permission type'
            });
        }
        
        await pool.query(`
            INSERT INTO admin_permissions (admin_id, ${column})
            VALUES ($1, $2)
            ON CONFLICT (admin_id)
            DO UPDATE SET ${column} = $2, updated_at = CURRENT_TIMESTAMP
        `, [targetAdminId, enabled]);
        
        res.json({
            success: true,
            message: 'Права доступа обновлены'
        });
        
    } catch (error) {
        console.error('Update permissions error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
app.post('/api/admin/add-admin', async (req, res) => {
    const { adminId, username } = req.body;
    
    console.log('🛠️ Add admin request:', { adminId, username });
    
    try {
        // Проверяем, что запрос от главного админа
        if (parseInt(adminId) !== 8036875641) {
            return res.status(403).json({
                success: false,
                error: 'Только главный администратор может добавлять админов!'
            });
        }
        
        if (!username || username.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Username не может быть пустым!'
            });
        }
        
        // Очищаем username (убираем @ если есть)
        const cleanUsername = username.replace('@', '').trim();
        
        console.log('🔍 Searching for user with username:', cleanUsername);
        
        // Ищем пользователя по username
        const userResult = await pool.query(
            'SELECT user_id, first_name, last_name, username, is_admin FROM user_profiles WHERE username = $1',
            [cleanUsername]
        );
        
        if (userResult.rows.length === 0) {
            console.log('❌ User not found with username:', cleanUsername);
            return res.status(404).json({
                success: false,
                error: `Пользователь с username "${cleanUsername}" не найден! 
                
Убедитесь, что:
1. Пользователь зарегистрирован в боте @LinkGoldMoney_bot
2. Вы правильно ввели username (без @)
3. Пользователь выполнил команду /start в боте`
            });
        }
        
        const targetUser = userResult.rows[0];
        
        // Проверяем, не является ли пользователь уже админом
        if (targetUser.is_admin) {
            return res.status(400).json({
                success: false,
                error: `Пользователь ${targetUser.first_name} (@${targetUser.username}) уже является администратором!`
            });
        }
        
        console.log('✅ Found user:', targetUser);
        
        // Делаем пользователя админом
        await pool.query(
            'UPDATE user_profiles SET is_admin = true WHERE user_id = $1',
            [targetUser.user_id]
        );
        
        // Добавляем права доступа по умолчанию
        try {
            await pool.query(`
                INSERT INTO admin_permissions (admin_id, can_posts, can_tasks, can_verification, can_support, can_payments)
                VALUES ($1, true, true, true, true, true)
                ON CONFLICT (admin_id) DO UPDATE SET 
                    can_posts = true,
                    can_tasks = true,
                    can_verification = true,
                    can_support = true,
                    can_payments = true,
                    updated_at = CURRENT_TIMESTAMP
            `, [targetUser.user_id]);
        } catch (permsError) {
            console.log('⚠️ Could not set admin permissions:', permsError.message);
            // Продолжаем без прав доступа - они установятся по умолчанию
        }
        
        console.log(`✅ User ${targetUser.username} (ID: ${targetUser.user_id}) promoted to admin`);
        
        // Отправляем уведомление пользователю через бота (если бот активен)
        if (bot) {
            try {
                await bot.sendMessage(
                    targetUser.user_id,
                    `🎉 <b>Поздравляем!</b>\n\n` +
                    `Вы были назначены администратором в LinkGold!\n\n` +
                    `Теперь у вас есть доступ к:\n` +
                    `• 📝 Управлению постами\n` +
                    `• 📋 Созданию заданий\n` +
                    `• ✅ Проверке заданий\n` +
                    `• 💬 Поддержке пользователей\n` +
                    `• 💳 Управлению выплатами\n\n` +
                    `Для доступа к панели администратора откройте приложение LinkGold.`,
                    { parse_mode: 'HTML' }
                );
            } catch (botError) {
                console.log('⚠️ Could not send notification to new admin:', botError.message);
            }
        }
        
        res.json({
            success: true,
            message: `Пользователь ${targetUser.first_name} (@${targetUser.username}) успешно добавлен как администратор!`,
            targetUserId: targetUser.user_id,
            user: {
                id: targetUser.user_id,
                username: targetUser.username,
                firstName: targetUser.first_name
            }
        });
        
    } catch (error) {
        console.error('❌ Add admin error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных: ' + error.message
        });
    }
});
// Поиск пользователя по username (для проверки)
app.get('/api/admin/find-user/:username', async (req, res) => {
    const username = req.params.username;
    
    try {
        const cleanUsername = username.replace('@', '').trim();
        
        const userResult = await pool.query(
            'SELECT user_id, username, first_name, last_name, is_admin, created_at FROM user_profiles WHERE username = $1',
            [cleanUsername]
        );
        
        if (userResult.rows.length === 0) {
            return res.json({
                success: false,
                error: 'Пользователь не найден'
            });
        }
        
        const user = userResult.rows[0];
        
        res.json({
            success: true,
            user: user,
            message: `Найден пользователь: ${user.first_name} (@${user.username})`
        });
        
    } catch (error) {
        console.error('Find user error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// Тестовый endpoint для проверки
app.post('/api/test-admin', async (req, res) => {
    console.log('🧪 Test admin endpoint called:', req.body);
    
    try {
        res.json({
            success: true,
            message: 'Test endpoint works!',
            received_data: req.body,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Test endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// Диагностический endpoint для проверки доступности
app.get('/api/admin/debug', (req, res) => {
    console.log('🔍 Admin debug endpoint hit');
    res.json({
        success: true,
        message: 'Admin endpoints are working!',
        timestamp: new Date().toISOString(),
        endpoints: {
            'POST /api/admin/add-admin': 'Add new admin',
            'GET /api/admin/admins-list': 'Get admins list', 
            'POST /api/admin/remove-admin': 'Remove admin'
        }
    });
});

// Простой тестовый endpoint для добавления админа
app.post('/api/admin/test-add', (req, res) => {
    console.log('🧪 Test add admin endpoint called:', req.body);
    
    const { adminId, username } = req.body;
    
    if (!adminId || !username) {
        return res.status(400).json({
            success: false,
            error: 'Missing adminId or username'
        });
    }
    
    res.json({
        success: true,
        message: 'Test endpoint works!',
        received: {
            adminId: adminId,
            username: username
        },
        timestamp: new Date().toISOString()
    });
});

// Проверка существования всех admin endpoints
app.get('/api/admin/endpoints-check', (req, res) => {
    const endpoints = [
        '/api/admin/add-admin',
        '/api/admin/admins-list', 
        '/api/admin/remove-admin',
        '/api/admin/test-add',
        '/api/admin/debug'
    ];
    
    res.json({
        success: true,
        endpoints: endpoints,
        serverTime: new Date().toISOString()
    });
});
// Удаление админа (только для главного админа)
app.post('/api/admin/remove-admin', async (req, res) => {
    const { adminId, targetAdminId } = req.body;
    
    console.log('🛠️ Received remove-admin request:', { adminId, targetAdminId });
    
    // Проверяем права доступа - только главный админ
    if (!adminId || parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied - only main admin can remove admins'
        });
    }
    
    if (!targetAdminId) {
        return res.status(400).json({
            success: false,
            error: 'Target admin ID is required'
        });
    }
    
    // Нельзя удалить самого себя
    if (parseInt(targetAdminId) === ADMIN_ID) {
        return res.status(400).json({
            success: false,
            error: 'Нельзя удалить главного администратора'
        });
    }
    
    try {
        // Проверяем существование пользователя
        const userResult = await pool.query(
            'SELECT user_id, username, first_name, is_admin FROM user_profiles WHERE user_id = $1',
            [targetAdminId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }
        
        const user = userResult.rows[0];
        
        if (!user.is_admin) {
            return res.status(400).json({
                success: false,
                error: 'Этот пользователь не является администратором'
            });
        }
        
        // Удаляем права админа
        await pool.query(
            'UPDATE user_profiles SET is_admin = false WHERE user_id = $1',
            [targetAdminId]
        );
        
        console.log(`✅ Admin removed: ${user.username} (ID: ${user.user_id})`);
        
        res.json({
            success: true,
            message: `Администратор @${user.username} (${user.first_name}) успешно удален`,
            user: {
                id: user.user_id,
                username: user.username,
                firstName: user.first_name
            }
        });
        
    } catch (error) {
        console.error('❌ Remove admin error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Принудительное обновление прав администратора
app.post('/api/admin/refresh-rights', async (req, res) => {
    const { userId } = req.body;
    
    try {
        // Получаем актуальные данные пользователя из базы
        const userResult = await pool.query(
            'SELECT * FROM user_profiles WHERE user_id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        const user = userResult.rows[0];
        
        res.json({
            success: true,
            user: user,
            message: 'Admin rights refreshed'
        });
        
    } catch (error) {
        console.error('Refresh rights error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// ==================== DEBUG ENDPOINTS ====================

// Debug endpoint to check database state
app.get('/api/debug/tables', async (req, res) => {
    try {
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        const results = {};
        for (let table of tables.rows) {
            const tableName = table.table_name;
            const countResult = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
            results[tableName] = {
                count: parseInt(countResult.rows[0].count),
                sample: countResult.rows[0].count > 0 ? 
                    (await pool.query(`SELECT * FROM ${tableName} LIMIT 3`)).rows : []
            };
        }
        
        res.json({
            success: true,
            tables: results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// В начале server.js, после инициализации pool
async function checkDatabaseConnection() {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Database connection successful:', result.rows[0]);
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        return false;
    }
}
// Diagnostic endpoint
app.get('/api/debug/endpoints', async (req, res) => {
    try {
        const routes = [];
        app._router.stack.forEach(middleware => {
            if (middleware.route) {
                routes.push({
                    path: middleware.route.path,
                    methods: Object.keys(middleware.route.methods)
                });
            } else if (middleware.name === 'router') {
                middleware.handle.stack.forEach(handler => {
                    if (handler.route) {
                        routes.push({
                            path: handler.route.path,
                            methods: Object.keys(handler.route.methods)
                        });
                    }
                });
            }
        });

        res.json({
            success: true,
            endpoints: routes,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Debug endpoints error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Main route - serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error: ' + err.message
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'API endpoint not found'
    });
});

async function initializeServer() {
    await initDatabase();
    await fixUserIdColumns(); // Добавьте эту строку
    await createSampleTasks();
    
    console.log('✅ Server initialization complete');
}
// ДОБАВЬТЕ В server.js ПЕРЕД app.listen
app.get('/api/debug/env', (req, res) => {
  res.json({
    FLYER_APL_KEY: process.env.FLYER_APL_KEY ? '✅ настроен' : '❌ отсутствует',
    FLYER_API_KEY: process.env.FLYER_API_KEY ? '✅ настроен' : '❌ отсутствует', 
    APP_URL: process.env.APP_URL || '❌ не настроен',
    BOT_TOKEN: process.env.BOT_TOKEN ? '✅ настроен' : '❌ отсутствует',
    DATABASE_URL: process.env.DATABASE_URL ? '✅ настроен' : '❌ отсутствует',
    NODE_ENV: process.env.NODE_ENV || 'development'
  });
});
// Замените текущий app.listen на этот:
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/api/health`);
    console.log(`🔐 Admin ID: ${ADMIN_ID}`);
    
    // Инициализируем базу данных с заданиями
    await initializeWithTasks();

    
    // Инициализируем Flyer интеграцию
    await initializeFlyerIntegration();
    // Принудительно исправляем структуру таблиц
    try {
        await fixWithdrawalTable();
        await fixTasksTable();
        await fixReferralLinksTable(); // Добавьте эту строку
        console.log('✅ All table structures verified');
    } catch (error) {
        console.error('❌ Error fixing table structures:', error);
    }
});