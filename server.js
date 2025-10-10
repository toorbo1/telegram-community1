const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Исправленный импорт fetch для Node.js 18+
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('.'));

// Настройка multer для загрузки файлов
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
        cb(null, 'screenshot-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Configure multer for post images
const postStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadsDir = path.join(__dirname, 'uploads/posts');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'post-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const postUpload = multer({ 
    storage: postStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Configure multer for task images
const taskStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadsDir = path.join(__dirname, 'uploads/tasks');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'task-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const taskUpload = multer({ 
    storage: taskStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Путь к базе данных
const dbPath = path.join(__dirname, 'database.db');

// Инициализация базы данных
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Ошибка подключения к базе данных:', err.message);
        return;
    }
    console.log('✅ Подключено к SQLite базе данных');
    initDatabase();
});

// Обработка ошибок базы данных
db.on('error', (err) => {
    console.error('❌ Ошибка базы данных:', err);
});

// Initialize database tables
function initDatabase() {
    db.serialize(() => {
        // User profiles table
        db.run(`CREATE TABLE IF NOT EXISTS user_profiles (
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            photo_url TEXT,
            balance REAL DEFAULT 0, 
            level INTEGER DEFAULT 0,
            experience INTEGER DEFAULT 0,
            tasks_completed INTEGER DEFAULT 0,
            active_tasks INTEGER DEFAULT 0,
            quality_rate REAL DEFAULT 100,
            referral_count INTEGER DEFAULT 0,
            referral_earned REAL DEFAULT 0,
            is_admin BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Posts table
        db.run(`CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            image_url TEXT,
            author TEXT NOT NULL,
            authorId INTEGER NOT NULL,
            isAdmin BOOLEAN DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Tasks table
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT DEFAULT 'general',
            price REAL NOT NULL,
            time_to_complete TEXT,
            difficulty TEXT,
            people_required INTEGER DEFAULT 1,
            repost_time TEXT,
            task_url TEXT,
            image_url TEXT,
            created_by INTEGER NOT NULL,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // User tasks table
        db.run(`CREATE TABLE IF NOT EXISTS user_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            task_id INTEGER NOT NULL,
            status TEXT DEFAULT 'active',
            screenshot_url TEXT,
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            submitted_at DATETIME,
            completed_at DATETIME,
            rejected_at DATETIME,
            rejection_reason TEXT,
            FOREIGN KEY(task_id) REFERENCES tasks(id)
        )`);

        // Support chats table
        db.run(`CREATE TABLE IF NOT EXISTS support_chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            user_name TEXT NOT NULL,
            user_username TEXT,
            last_message TEXT,
            last_message_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            unread_count INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Support messages table
        db.run(`CREATE TABLE IF NOT EXISTS support_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            user_name TEXT NOT NULL,
            message TEXT NOT NULL,
            image_url TEXT,
            is_admin BOOLEAN DEFAULT 0,
            is_read BOOLEAN DEFAULT 0,
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(chat_id) REFERENCES support_chats(id)
        )`);

        // Withdrawal requests table
        db.run(`CREATE TABLE IF NOT EXISTS withdrawal_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            method TEXT NOT NULL,
            details TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME
        )`);

        // Task verification table
        db.run(`CREATE TABLE IF NOT EXISTS task_verifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_task_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            task_id INTEGER NOT NULL,
            user_name TEXT NOT NULL,
            task_title TEXT NOT NULL,
            task_price REAL NOT NULL,
            screenshot_url TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            reviewed_at DATETIME,
            reviewed_by INTEGER,
            FOREIGN KEY(user_task_id) REFERENCES user_tasks(id)
        )`);

        // Withdrawal operations table
        db.run(`CREATE TABLE IF NOT EXISTS withdrawal_operations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            status TEXT DEFAULT 'processing',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            telegram_message_id TEXT,
            FOREIGN KEY(user_id) REFERENCES user_profiles(user_id)
        )`);

        console.log('✅ Все таблицы созданы успешно');
    });
}

const ADMIN_ID = 8036875641;
const TELEGRAM_BOT_TOKEN = 'YOUR_BOT_TOKEN'; // Замените на ваш токен бота
const TELEGRAM_CHANNEL_ID = '@wergqervgba'; // Замените на ID вашего канала

// Функция для отправки сообщения в Telegram
async function sendTelegramNotification(userId, username, amount, operationId) {
    try {
        const message = `🔄 Новая заявка на вывод средств\n\n👤 Пользователь: @${username}\n💰 Сумма: ${amount} ⭐\n🆔 ID операции: ${operationId}\n\nДля подтверждения выплаты нажмите кнопку ниже:`;
        
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHANNEL_ID,
                text: message,
                reply_markup: {
                    inline_keyboard: [[
                        {
                            text: '✅ Перечислил',
                            callback_data: `withdraw_completed_${operationId}`
                        }
                    ]]
                }
            })
        });

        const result = await response.json();
        if (result.ok) {
            // Сохраняем ID сообщения в базе данных
            db.run("UPDATE withdrawal_operations SET telegram_message_id = ? WHERE id = ?", 
                [result.result.message_id, operationId]);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Ошибка отправки в Telegram:', error);
        return false;
    }
}

// Функция для обработки callback от Telegram
app.post('/api/telegram-webhook', express.json(), (req, res) => {
    const { callback_query } = req.body;
    
    if (callback_query && callback_query.data) {
        const data = callback_query.data;
        
        if (data.startsWith('withdraw_completed_')) {
            const operationId = data.split('_')[2];
            
            // Обновляем статус операции
            db.run(`UPDATE withdrawal_operations SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
                    WHERE id = ?`, [operationId], function(err) {
                if (err) {
                    console.error('Ошибка обновления операции:', err);
                    return;
                }
                
                // Отправляем ответ в Telegram
                const answerUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
                fetch(answerUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        callback_query_id: callback_query.id,
                        text: '✅ Выплата подтверждена!'
                    })
                });
                
                // Обновляем сообщение в канале
                const editUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`;
                fetch(editUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        chat_id: TELEGRAM_CHANNEL_ID,
                        message_id: callback_query.message.message_id,
                        text: `✅ Выплата завершена\n\n👤 Пользователь: @${callback_query.from.username}\n💰 Сумма: ${amount} ⭐\n🆔 ID операции: ${operationId}\n\n✅ Операция завершена администратором`,
                        reply_markup: {
                            inline_keyboard: []
                        }
                    })
                });
            });
        }
    }
    
    res.send('OK');
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'LinkGold API is running!',
        timestamp: new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })
    });
});

// 🔧 ЭНДПОИНТЫ ДЛЯ УПРАВЛЕНИЯ АДМИНАМИ
app.get('/api/admin/admins', (req, res) => {
    const { adminId } = req.query;
    
    console.log('🔍 GET /api/admin/admins called with adminId:', adminId);
    
    // Проверяем, что запрос от главного админа
    if (!adminId || parseInt(adminId) !== ADMIN_ID) {
        console.log('❌ Access denied for adminId:', adminId);
        return res.status(403).json({
            success: false,
            error: 'Access denied. Only main admin can manage admins.'
        });
    }

    // Получаем всех админов
    db.all("SELECT user_id, username, first_name, last_name FROM user_profiles WHERE is_admin = 1", (err, rows) => {
        if (err) {
            console.error('❌ Database error in /api/admin/admins:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        console.log(`✅ Found ${rows.length} admins`);
        res.json({
            success: true,
            admins: rows || []
        });
    });
});

app.post('/api/admin/admins', (req, res) => {
    const { adminId, username } = req.body;
    
    console.log('🔍 POST /api/admin/admins called with:', { adminId, username });
    
    // Проверяем, что запрос от главного админа
    if (!adminId || parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied. Only main admin can add admins.'
        });
    }

    if (!username) {
        return res.status(400).json({
            success: false,
            error: 'Username is required'
        });
    }

    // Ищем пользователя по username (без @)
    const cleanUsername = username.replace('@', '').trim();
    
    // Сначала создаем пользователя если его нет
    const userProfile = {
        user_id: Date.now(), // Временный ID, будет обновлен при реальной регистрации
        username: cleanUsername,
        first_name: cleanUsername,
        last_name: '',
        is_admin: 0
    };
    
    // Вставляем или обновляем пользователя
    db.run(`INSERT OR REPLACE INTO user_profiles 
            (user_id, username, first_name, last_name, is_admin, updated_at) 
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [userProfile.user_id, userProfile.username, userProfile.first_name, 
             userProfile.last_name, 1], // Сразу делаем админом
            function(err) {
        if (err) {
            console.error('❌ Error creating admin user:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }

        console.log(`✅ User ${cleanUsername} promoted to admin`);
        
        res.json({
            success: true,
            message: 'Пользователь успешно добавлен как администратор!',
            admin: {
                user_id: userProfile.user_id,
                username: userProfile.username,
                first_name: userProfile.first_name,
                last_name: userProfile.last_name
            }
        });
    });
});

app.delete('/api/admin/admins/:userId', (req, res) => {
    const { adminId } = req.body;
    const userId = req.params.userId;
    
    console.log('🔍 DELETE /api/admin/admins called with:', { adminId, userId });
    
    // Проверяем, что запрос от главного админа
    if (!adminId || parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied. Only main admin can remove admins.'
        });
    }

    // Не позволяем удалить главного админа
    if (parseInt(userId) === ADMIN_ID) {
        return res.status(400).json({
            success: false,
            error: 'Нельзя удалить главного администратора'
        });
    }

    db.run("UPDATE user_profiles SET is_admin = 0 WHERE user_id = ?", [userId], function(err) {
        if (err) {
            console.error('❌ Error removing admin:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }

        console.log(`✅ Admin ${userId} removed`);
        
        res.json({
            success: true,
            message: 'Администратор успешно удален!'
        });
    });
});

// 🔧 СИСТЕМА ВЫВОДА СРЕДСТВ
app.post('/api/withdrawal/request', (req, res) => {
    const { user_id, amount } = req.body;
    
    if (!user_id || !amount) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }

    // Проверяем баланс пользователя
    db.get("SELECT balance, username FROM user_profiles WHERE user_id = ?", [user_id], (err, user) => {
        if (err) {
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        if (user.balance < amount) {
            return res.status(400).json({
                success: false,
                error: 'Insufficient balance'
            });
        }

        // Обнуляем баланс пользователя
        db.run("UPDATE user_profiles SET balance = 0 WHERE user_id = ?", [user_id], function(err) {
            if (err) {
                return res.status(500).json({
                    success: false,
                    error: 'Database error'
                });
            }

            // Создаем запись о выводе
            db.run(`INSERT INTO withdrawal_operations (user_id, amount, status) 
                    VALUES (?, ?, 'processing')`,
                    [user_id, amount], async function(err) {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        error: 'Database error'
                    });
                }

                const operationId = this.lastID;

                // Отправляем уведомление в Telegram
                const telegramSent = await sendTelegramNotification(user_id, user.username, amount, operationId);

                res.json({
                    success: true,
                    message: 'Запрос на вывод отправлен!',
                    operationId: operationId,
                    telegramSent: telegramSent
                });
            });
        });
    });
});

// Получение истории выводов
app.get('/api/withdrawal/history/:userId', (req, res) => {
    const userId = req.params.userId;
    
    db.all(`SELECT * FROM withdrawal_operations WHERE user_id = ? ORDER BY created_at DESC`, 
            [userId], (err, rows) => {
        if (err) {
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        res.json({
            success: true,
            operations: rows || []
        });
    });
});

// Подтверждение вывода админом
app.post('/api/withdrawal/complete/:operationId', (req, res) => {
    const operationId = req.params.operationId;
    const { adminId } = req.body;
    
    if (!adminId || parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

    db.run(`UPDATE withdrawal_operations SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
            WHERE id = ?`, [operationId], function(err) {
        if (err) {
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        res.json({
            success: true,
            message: 'Вывод подтвержден'
        });
    });
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Добавьте этот эндпоинт для получения конкретного чата
app.get('/api/support/chats/:chatId', (req, res) => {
    const chatId = req.params.chatId;
    const { adminId } = req.query;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

    db.get("SELECT * FROM support_chats WHERE id = ?", [chatId], (err, chat) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        if (!chat) {
            return res.status(404).json({
                success: false,
                error: 'Chat not found'
            });
        }
        
        res.json({
            success: true,
            chat: chat
        });
    });
});

// Добавьте обработку ошибок для multer
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File too large. Maximum size is 10MB.'
            });
        }
    }
    next(error);
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Основной маршрут для HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔐 Admin ID: ${ADMIN_ID}`);
    console.log(`⏰ Moscow time: ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}`);
    console.log(`📁 Uploads directory: ${path.join(__dirname, 'uploads')}`);
});