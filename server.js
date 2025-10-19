const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('.'));

// Улучшенная настройка multer
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
        // Сохраняем оригинальное расширение файла
        const fileExt = path.extname(file.originalname);
        cb(null, 'task-' + uniqueSuffix + fileExt);
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


// 🔧 УЛУЧШЕННАЯ функция проверки прав администратора
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
// // Временно добавьте эту функцию для отладки
// function debugWithdrawalSystem() {
//     console.log('🐛 DEBUG Withdrawal System:');
//     console.log('- currentUser:', currentUser); // ← исправлено на английское
//     console.log('- isAdmin:', currentUser?.is_admin);
    
//     // Проверьте, загружаются ли запросы
//     loadWithdrawalRequests().then(() => {
//         console.log('✅ Withdrawal requests loaded');
//     }).catch(error => {
//         console.error('❌ Error loading withdrawal requests:', error);
//     });
// }
// Вызовите для тестирования
// setTimeout(debugWithdrawalSystem, 3000);
// Упрощенная инициализация базы данных
// Упрощенная инициализация базы данных
// Упрощенная инициализация базы данных
async function initDatabase() {
    try {
        console.log('🔄 Initializing simplified database...');
        
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
                image_url TEXT, -- ДОБАВЛЕНА КОЛОНКА ДЛЯ ИЗОБРАЖЕНИЙ
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

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

        // Создаем тестовый пост если нет постов
        const postsCount = await pool.query('SELECT COUNT(*) FROM posts');
        if (parseInt(postsCount.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO posts (title, content, author, author_id) 
                VALUES ('Добро пожаловать!', 'Начните зарабатывать выполняя простые задания!', 'Администратор', $1)
            `, [ADMIN_ID]);
        }

         await createWithdrawalTable();
        await fixWithdrawalTableStructure();
        
        console.log('✅ Database initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
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

// Обработчик команды /start с реферальным кодом
bot.onText(/\/start(.+)?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const referralCode = match[1] ? match[1].trim() : null;
    
    console.log('🎯 Start command received:', { userId, referralCode });
    
    try {
        // Регистрируем пользователя в системе
        const userData = {
            id: userId,
            firstName: msg.from.first_name || 'Пользователь',
            lastName: msg.from.last_name || '',
            username: msg.from.username || `user_${userId}`
        };
        
        let referredBy = null;
        let referrerName = '';
        
        // Если есть реферальный код, находим пригласившего
        if (referralCode) {
            const cleanReferralCode = referralCode.replace('ref_', '');
            const referrerResult = await pool.query(
                `SELECT user_id, first_name, username 
                 FROM user_profiles 
                 WHERE referral_code = $1 OR user_id::text = $1`,
                [cleanReferralCode]
            );
            
            if (referrerResult.rows.length > 0) {
                referredBy = referrerResult.rows[0].user_id;
                referrerName = referrerResult.rows[0].first_name || 
                              referrerResult.rows[0].username || 
                              `Пользователь ${referredBy}`;
                
                console.log(`🔍 Найден реферер: ${referrerName} (ID: ${referredBy})`);
            }
        }
        
        // Генерируем реферальный код для пользователя
        const userReferralCode = `ref_${userId}`;
        
        // Сохраняем/обновляем пользователя
        const userResult = await pool.query(`
            INSERT INTO user_profiles 
            (user_id, username, first_name, last_name, referral_code, referred_by, is_first_login) 
            VALUES ($1, $2, $3, $4, $5, $6, true)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                username = EXCLUDED.username,
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            userId, 
            userData.username,
            userData.firstName,
            userData.lastName,
            userReferralCode,
            referredBy
        ]);
        
        const userProfile = userResult.rows[0];
        
        // Если пользователь пришел по реферальной ссылке и это его первый вход
        if (referredBy && userProfile.is_first_login) {
            // Даем 10⭐ новому пользователю
            await pool.query(`
                UPDATE user_profiles 
                SET balance = COALESCE(balance, 0) + 10,
                    is_first_login = false
                WHERE user_id = $1
            `, [userId]);
            
            // Даем 20⭐ тому, кто пригласил
            await pool.query(`
                UPDATE user_profiles 
                SET balance = COALESCE(balance, 0) + 20,
                    referral_count = COALESCE(referral_count, 0) + 1,
                    referral_earned = COALESCE(referral_earned, 0) + 20
                WHERE user_id = $1
            `, [referredBy]);
            
            console.log(`🎉 Реферальный бонус: пользователь ${userId} получил 10⭐, пригласивший ${referredBy} получил 20⭐`);
            
            // Отправляем уведомление приглашенному с кнопками
            await bot.sendMessage(
                chatId,
                `🎉 <b>Поздравляем, ${userData.firstName}!</b>\n\n` +
                `Вы получили <b>10⭐</b> за регистрацию по приглашению от ${referrerName}!\n\n` +
                `<b>💫 О компании LinkGold:</b>\n` +
                `LinkGold - это современная биржа заработка, где вы можете получать Telegram Stars за выполнение простых и интересных заданий! 🚀\n\n` +
                `📊 <b>Что вас ждет:</b>\n` +
                `• Выполняйте задания и получайте Stars\n` +
                `• Участвуйте в розыгрышах и акциях\n` +
                `• Приглашайте друзей и получайте бонусы\n` +
                `• Выводите заработанные средства\n\n` +
                `🎁 <b>Подписывайтесь на наш канал</b> - там регулярно проходят розыгрыши, публикуются новые задания и эксклюзивные предложения!`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: '',
                                    url: APP_URL
                                }
                            ],
                            [
                                {
                                    text: '📢 Подписаться на канал',
                                    url: 'https://t.me/LinkGoldChannel'
                                }
                            ]
                        ]
                    }
                }
            );
            
            // Отправляем уведомление пригласившему
            try {
                const referrerStats = await pool.query(
                    'SELECT referral_count, referral_earned FROM user_profiles WHERE user_id = $1',
                    [referredBy]
                );
                
                const stats = referrerStats.rows[0];
                
                await bot.sendMessage(
                    referredBy,
                    `🎊 <b>Отличная работа!</b>\n\n` +
                    `Ваш друг ${userData.firstName} зарегистрировался по вашей ссылке!\n\n` +
                    `💫 <b>Вы получили:</b> 20⭐\n` +
                    `👥 <b>Всего приглашено:</b> ${(stats.referral_count || 0)} человек\n` +
                    `💰 <b>Заработано на рефералах:</b> ${(stats.referral_earned || 0)}⭐\n\n` +
                    `🔗 <b>Ваша реферальная ссылка:</b>\nhttps://t.me/LinkGoldMoney_bot?start=ref_${referredBy}`,
                    {
                        parse_mode: 'HTML'
                    }
                );
            } catch (error) {
                console.log('Не удалось отправить уведомление рефереру:', error.message);
            }
        } else {
            // Обычное приветствие с кнопками
            const message = `👋 <b>Добро пожаловать в LinkGold, ${userData.firstName}!</b>\n\n` +
                           `<b>💫 О компании LinkGold:</b>\n` +
                           `LinkGold - это современная биржа заработка, где вы можете получать Telegram Stars за выполнение простых и интересных заданий! 🚀\n\n` +
                           `📊 <b>Что вас ждет:</b>\n` +
                           `• Выполняйте задания и получайте Stars\n` +
                           `• Участвуйте в розыгрышах и акциях\n` +
                           `• Приглашайте друзей и получайте бонусы\n` +
                           `• Выводите заработанные средства\n\n` +
                           `🎁 <b>Подписывайтесь на наш канал</b> - там регулярно проходят розыгрыши, публикуются новые задания и эксклюзивные предложения!\n\n` +
                           ``;
            
            await bot.sendMessage(
                chatId,
                message,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: '🚀 Перейти в приложение',
                                    url: APP_URL
                                }
                            ],
                            [
                                {
                                    text: '📢 Подписаться на канал',
                                    url: 'https://t.me/LinkGoldChannel'
                                }
                            ],
                            [
                                {
                                    text: '',
                                    url: `https://t.me/share/url?url=https://t.me/LinkGoldMoney_bot?start=${userProfile.referral_code}&text=Присоединяйся к LinkGold и начинай зарабатывать Telegram Stars! 🚀`
                                }
                            ]
                        ]
                    }
                }
            );
        }
        
    } catch (error) {
        console.error('❌ Start command error:', error);
        await bot.sendMessage(chatId, '❌ Произошла ошибка при регистрации. Попробуйте позже.');
    }
});

// Команда для получения реферальной ссылки
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
        const shareText = `Присоединяйся к LinkGold - бирже заработка Telegram Stars! 🚀 Выполняй задания, участвуй в розыгрышах и зарабатывай вместе со мной!`;
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`;
        
        await bot.sendMessage(
            chatId,
            `📢 <b>Реферальная программа LinkGold</b>\n\n` +
            `<b>💫 О компании:</b>\n` +
            `LinkGold - современная биржа заработка Telegram Stars! Выполняйте простые задания, участвуйте в розыгрышах и приглашайте друзей.\n\n` +
            `🎁 <b>Бонусы за приглашение:</b>\n` +
            `• Вы получаете: <b>20⭐</b> за друга\n` +
            `• Друг получает: <b>10⭐</b> при регистрации\n\n` +
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
                                text: '🚀 Перейти в приложение',
                                url: APP_URL
                            }
                        ],
                        [
                            {
                                text: '📢 Подписаться на канал',
                                url: 'https://t.me/LinkGoldChannel'
                            }
                        ],
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
                                text: '🚀 Перейти в приложение',
                                url: APP_URL
                            }
                        ],
                        [
                            {
                                text: '📢 Наш канал',
                                url: 'https://t.me/LinkGoldChannel'
                            }
                        ],
                        [
                            {
                                text: '👥 Пригласить друзей',
                                callback_data: 'referral'
                            }
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
                    `• Вы получаете: 20⭐\n` +
                    `• Друг получает: 10⭐`,
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
        
        // Подтверждаем обработку callback
        await bot.answerCallbackQuery(callbackQuery.id);
        
    } catch (error) {
        console.error('Callback query error:', error);
        await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Произошла ошибка' });
    }
});

// ... остальные endpoints остаются без изменений ...

// Health check с информацией о конфигурации
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        
        const healthInfo = {
            status: 'OK',
            timestamp: new Date().toISOString(),
            database: 'PostgreSQL',
            bot: {
                enabled: !!BOT_TOKEN,
                hasToken: !!BOT_TOKEN
            },
            app: {
                url: APP_URL,
                adminId: ADMIN_ID
            },
            environment: {
                node: process.version,
                platform: process.platform
            }
        };
        
        res.json(healthInfo);
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: 'Database connection failed',
            error: error.message
        });
    }
});

// ==================== WITHDRAWAL REQUESTS FOR ADMINS ====================

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
    
    // 🔧 ДОБАВЬТЕ ПРОВЕРКУ ПРАВ АДМИНА
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
// Health check
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ 
            status: 'OK', 
            message: 'LinkGold API is running!',
            timestamp: new Date().toISOString(),
            database: 'PostgreSQL'
        });
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: 'Database connection failed',
            error: error.message
        });
    }
});
// ==================== WITHDRAWAL REQUESTS FOR ADMINS ====================
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
// Обновим endpoint /api/user/auth
app.post('/api/user/auth', async (req, res) => {
    const { user, referralCode } = req.body; // Добавляем referralCode
    
    if (!user) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    try {
        const isMainAdmin = parseInt(user.id) === ADMIN_ID;
        
        // Генерируем реферальный код для пользователя
        const userReferralCode = `ref_${user.id}_${Date.now()}`;
        
        let referredBy = null;
        let referralBonusGiven = false;
        
        // Если есть реферальный код, находим того кто пригласил
        if (referralCode) {
            const referrerResult = await pool.query(
                'SELECT user_id FROM user_profiles WHERE referral_code = $1',
                [referralCode]
            );
            
            if (referrerResult.rows.length > 0) {
                referredBy = referrerResult.rows[0].user_id;
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
        
        // Если это первый вход и пользователь пришел по реферальной ссылке
        if (userProfile.is_first_login && referredBy) {
            // Даем 5 звезд новому пользователю
            await pool.query(`
                UPDATE user_profiles 
                SET balance = COALESCE(balance, 0) + 5,
                    is_first_login = false
                WHERE user_id = $1
            `, [user.id]);
            
            // Даем 20 звезд тому, кто пригласил
            await pool.query(`
                UPDATE user_profiles 
                SET balance = COALESCE(balance, 0) + 20,
                    referral_count = COALESCE(referral_count, 0) + 1,
                    referral_earned = COALESCE(referral_earned, 0) + 20
                WHERE user_id = $1
            `, [referredBy]);
            
            referralBonusGiven = true;
            
            console.log(`🎉 Реферальный бонус: пользователь ${user.id} получил 5⭐, пригласивший ${referredBy} получил 20⭐`);
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

// Получение заданий с правильной обработкой изображений
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
        
        console.log('📊 Выполняем запрос:', query, params);
        
        const result = await pool.query(query, params);
        
        // Фильтруем задания: показываем только те, которые пользователь еще не начал
        const filteredTasks = result.rows.filter(task => !task.user_has_task);
        
        // 🔧 ИСПРАВЛЕНИЕ: Обеспечиваем правильные URL для изображений
        const tasksWithCorrectedImages = filteredTasks.map(task => {
            if (task.image_url) {
                // Если URL относительный, делаем его абсолютным
                if (!task.image_url.startsWith('http')) {
                    task.image_url = `${APP_URL}${task.image_url}`;
                }
                // Добавляем временную метку для избежания кэширования
                task.image_url += `${task.image_url.includes('?') ? '&' : '?'}t=${Date.now()}`;
            }
            return task;
        });
        
        console.log(`✅ Найдено заданий: ${result.rows.length}, доступно пользователю: ${filteredTasks.length}`);
        
        res.json({
            success: true,
            tasks: tasksWithCorrectedImages,
            totalCount: result.rows.length,
            availableCount: filteredTasks.length
        });
    } catch (error) {
        console.error('❌ Get tasks error:', error);
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

// Get tasks for admin (for all admins)
app.get('/api/admin/tasks', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM tasks 
            ORDER BY created_at DESC
        `);
        
        res.json({
            success: true,
            tasks: result.rows
        });
    } catch (error) {
        console.error('Get admin tasks error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// ==================== USER TASKS ENDPOINTS ====================

// В server.js - обновите endpoint начала задания
app.post('/api/user/tasks/start', async (req, res) => {
    const { userId, taskId } = req.body;
    
    console.log('🚀 Start task request:', { userId, taskId });
    
    if (!userId || !taskId) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    try {
        // Проверяем, выполнял ли пользователь это задание
        const existingTask = await pool.query(`
            SELECT id FROM user_tasks 
            WHERE user_id = $1 AND task_id = $2 AND status IN ('active', 'pending_review', 'completed')
        `, [userId, taskId]);
        
        if (existingTask.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Вы уже выполняли это задание'
            });
        }
        
        // Проверяем лимит выполнений
        const taskInfo = await pool.query(`
            SELECT t.*, 
                   COUNT(ut.id) as completed_count
            FROM tasks t
            LEFT JOIN user_tasks ut ON t.id = ut.task_id AND ut.status = 'completed'
            WHERE t.id = $1 AND t.status = 'active'
            GROUP BY t.id
        `, [taskId]);
        
        if (taskInfo.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Задание не найдено или недоступно'
            });
        }
        
        const task = taskInfo.rows[0];
        const peopleRequired = task.people_required || 1;
        
        if (task.completed_count >= peopleRequired) {
            return res.status(400).json({
                success: false,
                error: 'Достигнут лимит выполнения этого задания'
            });
        }
        
        // Start the task
        const result = await pool.query(`
            INSERT INTO user_tasks (user_id, task_id, status) 
            VALUES ($1, $2, 'active')
            RETURNING *
        `, [userId, taskId]);
        
        console.log('✅ Task started successfully:', result.rows[0]);
        
        res.json({
            success: true,
            message: 'Задание начато!',
            userTaskId: result.rows[0].id
        });
    } catch (error) {
        console.error('❌ Start task error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
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
// Submit task for verification (WITH FILE UPLOAD)
app.post('/api/user/tasks/:userTaskId/submit', upload.single('screenshot'), async (req, res) => {
    const userTaskId = req.params.userTaskId;
    const { userId } = req.body;
    
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

// В server.js - обновите endpoint отмены задания
app.post('/api/user/tasks/:userTaskId/cancel', async (req, res) => {
    const userTaskId = req.params.userTaskId;
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'Missing user ID'
        });
    }
    
    try {
        // Получаем информацию о задании перед удалением
        const taskInfo = await pool.query(`
            SELECT task_id FROM user_tasks 
            WHERE id = $1 AND user_id = $2 AND status = 'active'
        `, [userTaskId, userId]);
        
        if (taskInfo.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Задание не найдено или уже завершено'
            });
        }
        
        const taskId = taskInfo.rows[0].task_id;
        
        // Удаляем запись о выполнении задания
        await pool.query(`
            DELETE FROM user_tasks 
            WHERE id = $1 AND user_id = $2
        `, [userTaskId, userId]);
        
        console.log(`✅ Task ${taskId} cancelled by user ${userId}`);
        
        res.json({
            success: true,
            message: 'Задание отменено успешно',
            taskId: taskId
        });
    } catch (error) {
        console.error('Cancel task error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
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
// Подтверждение задания для ВСЕХ админов
app.post('/api/admin/task-verifications/:verificationId/approve', async (req, res) => {
    const verificationId = req.params.verificationId;
    const { adminId } = req.body;
    
    console.log('✅ Подтверждение задания админом:', { verificationId, adminId });
    
    // Проверка прав администратора - РАЗРЕШАЕМ ВСЕМ АДМИНАМ
    const isAdmin = await checkAdminAccess(adminId);
    if (!isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Доступ запрещен. Только администраторы могут подтверждать задания.'
        });
    }
    
    try {
        // Get verification info
        const verification = await pool.query(
            'SELECT * FROM task_verifications WHERE id = $1', 
            [verificationId]
        );
        
        if (verification.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Verification not found'
            });
        }

        const verificationData = verification.rows[0];
        
        // Update verification status
        await pool.query(`
            UPDATE task_verifications 
            SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1 
            WHERE id = $2
        `, [adminId, verificationId]);
        
        // Update user task
        await pool.query(`
            UPDATE user_tasks 
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
            WHERE id = $1
        `, [verificationData.user_task_id]);
        
        // Update user balance and stats
        await pool.query(`
            UPDATE user_profiles 
            SET 
                balance = COALESCE(balance, 0) + $1,
                tasks_completed = COALESCE(tasks_completed, 0) + 1,
                active_tasks = GREATEST(COALESCE(active_tasks, 0) - 1, 0),
                experience = COALESCE(experience, 0) + 10,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
        `, [verificationData.task_price, verificationData.user_id]);
        
        res.json({
            success: true,
            message: 'Task approved successfully',
            amountAdded: verificationData.task_price
        });
    } catch (error) {
        console.error('Approve verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// В server.js - обновим endpoint отклонения задания
app.post('/api/admin/task-verifications/:verificationId/reject', async (req, res) => {
    const verificationId = req.params.verificationId;
    const { adminId } = req.body;
    
    console.log('❌ Отклонение задания админом:', { verificationId, adminId });
    
    // Проверка прав администратора
    const isAdmin = await checkAdminAccess(adminId);
    if (!isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Доступ запрещен. Только администраторы могут отклонять задания.'
        });
    }
    
    try {
        // Get verification info
        const verification = await pool.query(
            'SELECT * FROM task_verifications WHERE id = $1', 
            [verificationId]
        );
        
        if (verification.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Verification not found'
            });
        }

        const verificationData = verification.rows[0];
        
        // Update verification status
        await pool.query(`
            UPDATE task_verifications 
            SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1 
            WHERE id = $2
        `, [adminId, verificationId]);
        
        // ВАЖНОЕ ИЗМЕНЕНИЕ: Обновляем статус задания пользователя на 'rejected'
        await pool.query(`
            UPDATE user_tasks 
            SET status = 'rejected', completed_at = CURRENT_TIMESTAMP 
            WHERE id = $1
        `, [verificationData.user_task_id]);
        
        res.json({
            success: true,
            message: 'Task rejected successfully'
        });
    } catch (error) {
        console.error('Reject verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// ==================== WITHDRAWAL ENDPOINTS ====================

// Request withdrawal - ОБНОВЛЕННАЯ ВЕРСИЯ С ПРОВЕРКОЙ МИНИМУМА
app.post('/api/withdrawal/request', async (req, res) => {
    const { user_id, amount, username, first_name } = req.body;
    
    console.log('📨 Получен запрос на вывод:', { user_id, amount, username, first_name });
    
    if (!user_id || !amount) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    try {
        const MIN_WITHDRAWAL = 200; // Минимальная сумма вывода
        
        // Проверяем баланс пользователя
        const userResult = await pool.query(
            'SELECT balance FROM user_profiles WHERE user_id = $1',
            [user_id]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        const userBalance = parseFloat(userResult.rows[0].balance) || 0;
        const requestAmount = parseFloat(amount);
        
        console.log(`💰 Баланс пользователя: ${userBalance}, Запрошено: ${requestAmount}`);
        
        // Проверка минимальной суммы
        if (requestAmount < MIN_WITHDRAWAL) {
            return res.status(400).json({
                success: false,
                error: `Минимальная сумма для вывода: ${MIN_WITHDRAWAL} ⭐`
            });
        }
        
        if (requestAmount > userBalance) {
            return res.status(400).json({
                success: false,
                error: 'Недостаточно средств на балансе'
            });
        }
        
        if (requestAmount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Сумма должна быть положительной'
            });
        }
        
        // Обнуляем баланс пользователя
        await pool.query(
            'UPDATE user_profiles SET balance = 0 WHERE user_id = $1',
            [user_id]
        );
        
        // Создаем запрос на вывод
        const result = await pool.query(`
            INSERT INTO withdrawal_requests (user_id, username, first_name, amount, status) 
            VALUES ($1, $2, $3, $4, 'pending')
            RETURNING *
        `, [user_id, username, first_name, requestAmount]);
        
        const requestId = result.rows[0].id;
        
        console.log(`✅ Запрос на вывод создан: ID ${requestId}`);
        
        res.json({
            success: true,
            message: 'Запрос на вывод отправлен',
            requestId: requestId,
            newBalance: 0
        });
        
    } catch (error) {
        console.error('❌ Withdrawal error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
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
// Добавление нового админа по юзернейму - ТОЛЬКО для главного админа
app.post('/api/admin/add-admin', async (req, res) => {
    const { adminId, username } = req.body;
    
    console.log('🛠️ Received add-admin request:', { adminId, username });
    
    // Проверяем права доступа - только главный админ
    if (!adminId || parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied - only main admin can add admins'
        });
    }
    
    if (!username) {
        return res.status(400).json({
            success: false,
            error: 'Username is required'
        });
    }
    
    try {
        // Ищем пользователя по юзернейму (убираем @ если есть)
        const cleanUsername = username.replace('@', '').trim();
        
        console.log('🔍 Searching for user with username:', cleanUsername);
        
        const userResult = await pool.query(
            'SELECT user_id, username, first_name, is_admin FROM user_profiles WHERE username = $1',
            [cleanUsername]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь с таким юзернеймом не найден'
            });
        }
        
        const user = userResult.rows[0];
        
        console.log('👤 Found user:', user);
        
        // Проверяем, не является ли пользователь уже админом
        if (user.is_admin) {
            return res.status(400).json({
                success: false,
                error: 'Этот пользователь уже является администратором'
            });
        }
        
        // Назначаем пользователя админом
        await pool.query(
            'UPDATE user_profiles SET is_admin = true, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
            [user.user_id]
        );
        
        console.log(`✅ Admin added: ${user.username} (ID: ${user.user_id})`);
        
        // Получаем обновленные данные пользователя
        const updatedUserResult = await pool.query(
            'SELECT * FROM user_profiles WHERE user_id = $1',
            [user.user_id]
        );
        
        const updatedUser = updatedUserResult.rows[0];
        
        res.json({
            success: true,
            message: `Пользователь @${user.username} (${user.first_name}) успешно добавлен как администратор`,
            user: updatedUser,
            targetUserId: user.user_id
        });
        
    } catch (error) {
        console.error('❌ Add admin error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
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

// Start server
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/api/health`);
    console.log(`🔐 Admin ID: ${ADMIN_ID}`);
    console.log(`🗄️ Database: PostgreSQL`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Принудительно исправляем структуру таблиц при запуске
    try {
        await fixWithdrawalTable();
        await fixTasksTable(); // ← ДОБАВЬТЕ ЭТУ СТРОКУ
        console.log('✅ Table structures verified');
    } catch (error) {
        console.error('❌ Error fixing table structures:', error);
    }
});