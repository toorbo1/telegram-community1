const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

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

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const ADMIN_ID = 8036875641;

// Упрощенная инициализация базы данных
async function initDatabase() {
    try {
        console.log('🔄 Initializing simplified database...');
        
        // Только самые необходимые таблицы
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
// Добавьте эти колонки в таблицу user_profiles
await pool.query(`
    ALTER TABLE user_profiles 
    ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS referred_by BIGINT,
    ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS referral_earned REAL DEFAULT 0
`);

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
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);

        // Упрощенная таблица постов
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
// Таблица для заданий пользователей
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

// Таблица для проверки заданий
await pool.query(`
    CREATE TABLE IF NOT EXISTS task_verifications (
        id SERIAL PRIMARY KEY,
        user_task_id INTEGER NOT NULL,
        user_id BIGINT NOT NULL,
        task_id INTEGER NOT NULL,
        user_name TEXT NOT NULL,
        task_title TEXT NOT NULL,
        task_price REAL NOT NULL,
        screenshot_url TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP,
        reviewed_by BIGINT
    )
`);


// Таблица для запросов на вывод (если еще не добавлена)
await pool.query(`
    CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        amount REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
    )
`);
        // Упрощенная таблица сообщений
        await pool.query(`
            CREATE TABLE IF NOT EXISTS support_messages (
                id SERIAL PRIMARY KEY,
                chat_id INTEGER NOT NULL,
                user_id BIGINT NOT NULL,
                user_name TEXT NOT NULL,
                message TEXT NOT NULL,
                is_admin BOOLEAN DEFAULT false,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )

        `);
// Функция для добавления недостающих колонок
async function migrateDatabase() {
    try {
        console.log('🔄 Checking for database migrations...');
        
        // Добавляем недостающие колонки в support_chats
        await pool.query(`
            ALTER TABLE support_chats 
            ADD COLUMN IF NOT EXISTS user_username TEXT,
            ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0
        `);
        
        // Добавляем недостающие колонки в tasks
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
        
        console.log('✅ Database migrations completed');
    } catch (error) {
        console.error('❌ Database migration error:', error);
    }
}
        // Добавляем примеры если таблицы пустые
        const tasksCount = await pool.query('SELECT COUNT(*) FROM tasks');
        if (parseInt(tasksCount.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO tasks (title, description, price, created_by) 
                VALUES 
                ('Подписаться на канал', 'Подпишитесь на наш Telegram канал', 50, $1),
                ('Посмотреть видео', 'Посмотрите видео до конца', 30, $1),
                ('Сделать репост', 'Сделайте репост записи', 70, $1)
            `, [ADMIN_ID]);
        }

        const postsCount = await pool.query('SELECT COUNT(*) FROM posts');
        if (parseInt(postsCount.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO posts (title, content, author, author_id) 
                VALUES ('Добро пожаловать!', 'Начните зарабатывать выполняя простые задания!', 'Администратор', $1)
            `, [ADMIN_ID]);
        }

        console.log('✅ Simplified database initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
}
// Функция генерации реферального кода
function generateReferralCode(userId) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code + userId.toString().slice(-4);
}

app.post('/api/user/auth', async (req, res) => {
    const { user } = req.body;
    
    if (!user) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    try {
        const isMainAdmin = parseInt(user.id) === ADMIN_ID;
        
        // Сначала получаем текущие данные пользователя из базы
        const existingUser = await pool.query(
            'SELECT * FROM user_profiles WHERE user_id = $1', 
            [user.id]
        );
        
        let isAdmin = isMainAdmin;
        
        // Если пользователь уже существует и был назначен админом, сохраняем его права
        if (existingUser.rows.length > 0) {
            isAdmin = existingUser.rows[0].is_admin || isMainAdmin;
        }
        
        // Обновляем или создаем пользователя
        const result = await pool.query(`
            INSERT INTO user_profiles 
            (user_id, username, first_name, last_name, photo_url, is_admin, updated_at) 
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                username = EXCLUDED.username,
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                photo_url = EXCLUDED.photo_url,
                is_admin = EXCLUDED.is_admin,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            user.id, 
            user.username || `user_${user.id}`,
            user.first_name || 'Пользователь',
            user.last_name || '',
            user.photo_url || '',
            isAdmin  // Сохраняем текущие права админа
        ]);
        
        const userProfile = result.rows[0];
        
        res.json({
            success: true,
            user: userProfile
        });
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// Получение реферальной статистики
app.get('/api/user/:userId/referral-stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT referral_count, referral_earned 
            FROM user_profiles 
            WHERE user_id = $1
        `, [req.params.userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        res.json({
            success: true,
            stats: result.rows[0]
        });
    } catch (error) {
        console.error('Get referral stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// Инициализируем базу данных при запуске
initDatabase();
// Упрощенное создание задания
app.post('/api/simple/tasks', async (req, res) => {
    const { title, description, price, created_by } = req.body;
    
    if (!title || !description || !price) {
        return res.status(400).json({
            success: false,
            error: 'Заполните название, описание и цену'
        });
    }
    
    try {
        const result = await pool.query(`
            INSERT INTO tasks (title, description, price, created_by) 
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [title, description, parseFloat(price), created_by]);
        
        res.json({
            success: true,
            message: 'Задание создано!',
            task: result.rows[0]
        });
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка создания задания'
        });
    }
});
// Добавьте этот endpoint ПЕРВЫМ в server.js
app.get('/api/debug/db-check', async (req, res) => {
    try {
        console.log('🔍 Checking database structure...');
        
        // Проверим существующие таблицы
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        const results = {};
        
        // Проверим структуру каждой таблицы
        for (let table of tables.rows) {
            const tableName = table.table_name;
            const structure = await pool.query(`
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = $1 
                ORDER BY ordinal_position
            `, [tableName]);
            
            results[tableName] = {
                columns: structure.rows,
                count: (await pool.query(`SELECT COUNT(*) FROM ${tableName}`)).rows[0].count
            };
        }
        
        res.json({
            success: true,
            database: results,
            admin_id: ADMIN_ID,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});
// Упрощенный чат
app.get('/api/simple/chats/:userId', async (req, res) => {
    const userId = req.params.userId;
    
    try {
        // Создаем или получаем чат
        let chat = await pool.query(
            'SELECT * FROM support_chats WHERE user_id = $1', 
            [userId]
        );
        
        if (chat.rows.length === 0) {
            const userResult = await pool.query(
                'SELECT first_name FROM user_profiles WHERE user_id = $1',
                [userId]
            );
            
            const userName = userResult.rows[0]?.first_name || `User_${userId}`;
            
            chat = await pool.query(`
                INSERT INTO support_chats (user_id, user_name, last_message) 
                VALUES ($1, $2, $3)
                RETURNING *
            `, [userId, userName, 'Чат создан']);
            
            // Приветственное сообщение
            await pool.query(`
                INSERT INTO support_messages (chat_id, user_id, user_name, message, is_admin) 
                VALUES ($1, $2, $3, $4, true)
            `, [chat.rows[0].id, ADMIN_ID, 'Администратор', 'Здравствуйте! Чем могу помочь?']);
        }
        
        // Получаем сообщения
        const messages = await pool.query(`
            SELECT * FROM support_messages 
            WHERE chat_id = $1 
            ORDER BY sent_at ASC
        `, [chat.rows[0].id]);
        
        res.json({
            success: true,
            chat: chat.rows[0],
            messages: messages.rows
        });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка чата'
        });
    }
});

// Отправка сообщения
app.post('/api/simple/chats/:chatId/messages', async (req, res) => {
    const chatId = req.params.chatId;
    const { user_id, user_name, message, is_admin } = req.body;

    try {
        const result = await pool.query(`
            INSERT INTO support_messages (chat_id, user_id, user_name, message, is_admin) 
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [chatId, user_id, user_name, message, is_admin || false]);

        // Обновляем последнее сообщение в чате
        await pool.query(`
            UPDATE support_chats 
            SET last_message = $1, last_message_time = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [message, chatId]);

        res.json({
            success: true,
            message: 'Сообщение отправлено'
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка отправки'
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
// Обновите endpoint аутентификации пользователя
app.post('/api/user/auth', async (req, res) => {
    const { user, start_param } = req.body;
    
    if (!user) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    try {
        const isMainAdmin = parseInt(user.id) === ADMIN_ID;
        
        // Сначала получаем текущие данные пользователя из базы
        const existingUser = await pool.query(
            'SELECT * FROM user_profiles WHERE user_id = $1', 
            [user.id]
        );
        
        let isAdmin = isMainAdmin;
        
        // Если пользователь уже существует и был назначен админом, сохраняем его права
        if (existingUser.rows.length > 0) {
            isAdmin = existingUser.rows[0].is_admin || isMainAdmin;
        }
        
        // Обновляем или создаем пользователя
        const result = await pool.query(`
            INSERT INTO user_profiles 
            (user_id, username, first_name, last_name, photo_url, is_admin, updated_at) 
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                username = EXCLUDED.username,
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                photo_url = EXCLUDED.photo_url,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            user.id, 
            user.username || `user_${user.id}`,
            user.first_name || 'Пользователь',
            user.last_name || '',
            user.photo_url || '',
            isAdmin  // Сохраняем текущие права админа
        ]);
        
        const userProfile = result.rows[0];
        
        res.json({
            success: true,
            user: userProfile
        });
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// Diagnostic endpoint - check what's actually deployed
app.get('/api/debug/info', async (req, res) => {
    try {
        const dbCheck = await pool.query('SELECT version()');
        const tablesCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            database: {
                version: dbCheck.rows[0].version,
                tables: tablesCheck.rows.map(row => row.table_name)
            },
            environment: {
                node: process.version,
                port: PORT,
                admin_id: ADMIN_ID
            }
        });
    } catch (error) {
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

// Create post (admin only)
app.post('/api/posts', async (req, res) => {
    const { title, content, author, authorId } = req.body;
    
    if (!title || !content || !author) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    // Check admin rights
    if (parseInt(authorId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
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
            message: 'Post created successfully',
            post: result.rows[0]
        });
    } catch (error) {
        console.error('Create post error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Delete post
app.delete('/api/posts/:id', async (req, res) => {
    const { authorId } = req.body;
    
    if (parseInt(authorId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

    try {
        await pool.query("DELETE FROM posts WHERE id = $1", [req.params.id]);
        res.json({
            success: true,
            message: 'Post deleted successfully'
        });
    } catch (error) {
        console.error('Delete post error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Like post
app.post('/api/posts/:postId/like', async (req, res) => {
    const { userId } = req.body;
    
    try {
        const result = await pool.query(`
            UPDATE posts SET likes = COALESCE(likes, 0) + 1 
            WHERE id = $1 
            RETURNING likes
        `, [req.params.postId]);
        
        res.json({
            success: true,
            likes: result.rows[0].likes
        });
    } catch (error) {
        console.error('Like post error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Dislike post
app.post('/api/posts/:postId/dislike', async (req, res) => {
    const { userId } = req.body;
    
    try {
        const result = await pool.query(`
            UPDATE posts SET dislikes = COALESCE(dislikes, 0) + 1 
            WHERE id = $1 
            RETURNING dislikes
        `, [req.params.postId]);
        
        res.json({
            success: true,
            dislikes: result.rows[0].dislikes
        });
    } catch (error) {
        console.error('Dislike post error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Get all tasks
app.get('/api/tasks', async (req, res) => {
    const { search, category } = req.query;
    
    try {
        let query = "SELECT * FROM tasks WHERE status = 'active'";
        let params = [];
        
        if (search) {
            query += " AND (title ILIKE $1 OR description ILIKE $2)";
            params.push(`%${search}%`, `%${search}%`);
        }
        
        if (category && category !== 'all') {
            if (params.length > 0) {
                query += " AND category = $3";
                params.push(category);
            } else {
                query += " AND category = $1";
                params.push(category);
            }
        }
        
        query += " ORDER BY created_at DESC";
        
        const result = await pool.query(query, params);
        
        res.json({
            success: true,
            tasks: result.rows
        });
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Get tasks for admin
app.get('/api/admin/tasks', async (req, res) => {
    const { adminId } = req.query;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

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

// Create task (admin only) - UPDATED VERSION
app.post('/api/tasks', async (req, res) => {
    console.log('🎯 Received task creation request:', req.body);
    
    const { 
        title, 
        description, 
        price, 
        created_by
    } = req.body;
    
    // Validate required fields
    if (!title || !description || !price || !created_by) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: title, description, price, and created_by are required'
        });
    }
    
    // Check admin rights
    if (parseInt(created_by) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied - only admin can create tasks'
        });
    }
    
    try {
        const taskPrice = parseFloat(price);
        if (isNaN(taskPrice) || taskPrice <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Price must be a positive number'
            });
        }

        const result = await pool.query(`
            INSERT INTO tasks (title, description, price, created_by) 
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [title.trim(), description.trim(), taskPrice, created_by]);
        
        console.log('✅ Task created successfully:', result.rows[0]);
        
        res.json({
            success: true,
            message: 'Task created successfully',
            task: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Create task error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
// Delete task - UPDATED
app.delete('/api/tasks/:id', async (req, res) => {
    const { adminId } = req.body;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

    try {
        await pool.query("DELETE FROM tasks WHERE id = $1", [req.params.id]);
        res.json({
            success: true,
            message: 'Task deleted successfully'
        });
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Start task for user - ОБНОВЛЕННАЯ ВЕРСИЯ
app.post('/api/user/tasks/start', async (req, res) => {
    const { userId, taskId } = req.body;
    
    if (!userId || !taskId) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    try {
        // Проверяем, выполнял ли пользователь это задание ЛЮБОЙ раз
        const existingTask = await pool.query(`
            SELECT id FROM user_tasks 
            WHERE user_id = $1 AND task_id = $2
        `, [userId, taskId]);
        
        if (existingTask.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Вы уже выполняли это задание'
            });
        }
        
        // Проверяем, доступно ли задание (не достигнут лимит)
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
        if (task.completed_count >= task.people_required) {
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
            SELECT ut.user_id, ut.task_id, u.first_name, u.last_name, t.title, t.price 
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
            (user_task_id, user_id, task_id, user_name, task_title, task_price, screenshot_url) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [userTaskId, taskData.user_id, taskData.task_id, userName, taskData.title, taskData.price, screenshotUrl]);
        
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

// Cancel task
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
        await pool.query(`
            DELETE FROM user_tasks 
            WHERE id = $1 AND user_id = $2
        `, [userTaskId, userId]);
        
        // Update user's active tasks count
        await pool.query(`
            UPDATE user_profiles 
            SET active_tasks = GREATEST(COALESCE(active_tasks, 0) - 1, 0) 
            WHERE user_id = $1
        `, [userId]);
        
        res.json({
            success: true,
            message: 'Task cancelled successfully'
        });
    } catch (error) {
        console.error('Cancel task error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

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
                user_name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user_name;
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
                INSERT INTO support_messages (chat_id, user_id, user_name, message, is_admin) 
                VALUES ($1, $2, $3, $4, true)
            `, [chat.rows[0].id, ADMIN_ID, 'Администратор', 'Здравствуйте! Чем могу помочь?']);
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

// Send message to chat (FIXED)
app.post('/api/support/chats/:chatId/messages', async (req, res) => {
    const chatId = req.params.chatId;
    const { user_id, user_name, message, is_admin } = req.body;

    if (!message) {
        return res.status(400).json({
            success: false,
            error: 'Message is required'
        });
    }

    try {
        // Save message
        const result = await pool.query(`
            INSERT INTO support_messages (chat_id, user_id, user_name, message, is_admin) 
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [chatId, user_id, user_name, message, is_admin || false]);

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

// Get all chats for admin
app.get('/api/support/chats', async (req, res) => {
    const { adminId } = req.query;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

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

// Get all chats (including archived)
app.get('/api/support/all-chats', async (req, res) => {
    const { adminId } = req.query;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

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

// Get archived chats
app.get('/api/support/archived-chats', async (req, res) => {
    const { adminId } = req.query;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

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



// Archive chat
app.put('/api/support/chats/:chatId/archive', async (req, res) => {
    const chatId = req.params.chatId;
    const { adminId } = req.body;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

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
// Улучшенный endpoint добавления админа
app.post('/api/admin/add-admin', async (req, res) => {
    const { adminId, username } = req.body;
    
    console.log('🛠️ Received add-admin request:', { adminId, username });
    
    // Проверяем права доступа - только главный админ
    if (parseInt(adminId) !== ADMIN_ID) {
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
        const cleanUsername = username.replace('@', '');
        
        const userResult = await pool.query(
            'SELECT user_id, username, first_name, last_name, is_admin FROM user_profiles WHERE username = $1',
            [cleanUsername]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь с таким юзернеймом не найден'
            });
        }
        
        const user = userResult.rows[0];
        
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
        
        res.json({
            success: true,
            message: `Пользователь @${user.username} успешно добавлен как администратор!`,
            user: {
                id: user.user_id,
                username: user.username,
                firstName: user.first_name,
                lastName: user.last_name
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

// Удаление админа (только для главного админа)
app.post('/api/admin/remove-admin', async (req, res) => {
    const { adminId, targetAdminId } = req.body;
    
    console.log('🛠️ Received remove-admin request:', { adminId, targetAdminId });
    
    // Проверяем права доступа - только главный админ
    if (parseInt(adminId) !== ADMIN_ID) {
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
            error: 'Cannot remove main admin'
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
                error: 'User not found'
            });
        }
        
        const user = userResult.rows[0];
        
        if (!user.is_admin) {
            return res.status(400).json({
                success: false,
                error: 'User is not an admin'
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
            message: `Admin @${user.username} (${user.first_name}) successfully removed`,
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


// Функция для отображения секции управления админами
function showAdminAdminsSection() {
    showAdminSection('admins');
    loadAdminsList();
}

// Загрузка списка админов
async function loadAdminsList() {
    console.log('🔄 Loading admins list...');
    
    if (!currentUser || !currentUser.isAdmin) {
        console.log('❌ User is not admin');
        return;
    }
    
    try {
        const result = await makeRequest(`/admin/admins-list?adminId=${currentUser.id}`);
        
        if (result.success) {
            console.log('✅ Admins list loaded:', result.admins);
            displayAdminsList(result.admins);
        } else {
            console.error('❌ Failed to load admins:', result.error);
            showNotification('Ошибка загрузки списка админов: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('❌ Error loading admins list:', error);
        showNotification('Ошибка загрузки списка админов', 'error');
    }
}

// Обновите функцию отображения списка админов
function displayAdminsList(admins) {
    const container = document.getElementById('admins-list');
    if (!container) {
        console.error('❌ Container #admins-list not found');
        return;
    }
    
    container.innerHTML = '';
    
    if (!admins || admins.length === 0) {
        container.innerHTML = `
            <div class="no-tasks" style="text-align: center; padding: 30px;">
                <div style="font-size: 48px; margin-bottom: 16px;">👥</div>
                <div>Нет администраторов</div>
                <div style="font-size: 14px; color: var(--text-secondary); margin-top: 8px;">
                    Добавьте первого администратора
                </div>
            </div>
        `;
        return;
    }
    
    admins.forEach(admin => {
        const adminElement = document.createElement('div');
        adminElement.className = 'admin-task-item';
        
        const isMainAdmin = parseInt(admin.user_id) === ADMIN_ID;
        const joinDate = new Date(admin.created_at).toLocaleDateString('ru-RU');
        const fullName = `${admin.first_name} ${admin.last_name || ''}`.trim();
        const displayName = fullName || `Пользователь ${admin.user_id}`;
        
        adminElement.innerHTML = `
            <div class="admin-task-header">
                <div class="admin-task-title">
                    ${displayName}
                    ${isMainAdmin ? ' <span style="color: var(--gold);">(Главный админ)</span>' : ''}
                </div>
                ${!isMainAdmin ? `
                    <div class="admin-task-actions">
                        <button class="admin-task-delete" onclick="removeAdmin(${admin.user_id})">
                            🗑️ Удалить
                        </button>
                    </div>
                ` : ''}
            </div>
            <div class="admin-task-description">
                @${admin.username} • ID: ${admin.user_id} • Добавлен: ${joinDate}
            </div>
            <div style="margin-top: 8px; font-size: 12px; color: ${admin.is_admin ? 'var(--success)' : 'var(--error)'};">
                ${admin.is_admin ? '✅ Права администратора активны' : '❌ Права администратора не активны'}
            </div>
        `;
        
        container.appendChild(adminElement);
    });
}

// Добавление нового админа
async function addNewAdmin() {
    console.log('🎯 Starting addNewAdmin function...');
    
    const usernameInput = document.getElementById('new-admin-username');
    const messageDiv = document.getElementById('admin-form-message');
    const submitBtn = document.getElementById('add-admin-btn');
    
    if (!usernameInput || !messageDiv) {
        console.error('❌ Required elements not found');
        showNotification('Ошибка: элементы формы не найдены', 'error');
        return;
    }
    
    const username = usernameInput.value.trim();
    
    // Валидация
    if (!username) {
        messageDiv.innerHTML = '<span style="color: var(--error);">Введите юзернейм пользователя</span>';
        return;
    }
    
    // Проверяем права доступа
    if (!currentUser || !currentUser.isAdmin || parseInt(currentUser.id) !== ADMIN_ID) {
        messageDiv.innerHTML = '<span style="color: var(--error);">Только главный администратор может добавлять админов!</span>';
        return;
    }
    
    console.log('👤 Attempting to add admin with username:', username);
    
    // Показываем загрузку
    submitBtn.disabled = true;
    submitBtn.textContent = 'Добавляем...';
    messageDiv.innerHTML = '<span style="color: var(--warning);">Добавляем администратора...</span>';
    
    try {
        const result = await makeRequest('/admin/add-admin', {
            method: 'POST',
            body: JSON.stringify({
                adminId: currentUser.id,
                username: username
            })
        });
        
        console.log('📨 Server response:', result);
        
        if (result.success) {
            messageDiv.innerHTML = `<span style="color: var(--success);">${result.message}</span>`;
            usernameInput.value = ''; // Очищаем поле ввода
            
            // Обновляем список админов
            setTimeout(() => {
                loadAdminsList();
            }, 1000);
            
            showNotification(result.message, 'success');
        } else {
            messageDiv.innerHTML = `<span style="color: var(--error);">Ошибка: ${result.error}</span>`;
            showNotification('Ошибка: ' + result.error, 'error');
        }
        
    } catch (error) {
        console.error('❌ Error adding admin:', error);
        messageDiv.innerHTML = `<span style="color: var(--error);">Ошибка сети: ${error.message}</span>`;
        showNotification('Ошибка сети при добавлении админа', 'error');
    } finally {
        // Восстанавливаем кнопку
        submitBtn.disabled = false;
        submitBtn.textContent = '➕ Добавить администратора';
    }
}

// Удаление админа
async function removeAdmin(targetAdminId) {
    console.log('🗑️ Removing admin:', targetAdminId);
    
    if (!currentUser || !currentUser.isAdmin || parseInt(currentUser.id) !== ADMIN_ID) {
        showNotification('Только главный администратор может удалять админов!', 'error');
        return;
    }
    
    if (!confirm('Вы уверены, что хотите удалить этого администратора?')) {
        return;
    }
    
    try {
        const result = await makeRequest('/admin/remove-admin', {
            method: 'POST',
            body: JSON.stringify({
                adminId: currentUser.id,
                targetAdminId: targetAdminId
            })
        });
        
        if (result.success) {
            showNotification(result.message, 'success');
            loadAdminsList(); // Обновляем список админов
        } else {
            showNotification('Ошибка: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('❌ Error removing admin:', error);
        showNotification('Ошибка удаления админа: ' + error.message, 'error');
    }
}

// Обновите функцию showAdminSection чтобы включить новую секцию
function showAdminSection(section) {
    console.log('🔄 Switching to admin section:', section);
    
    // Скрываем все админ секции
    document.querySelectorAll('.admin-section').forEach(sec => {
        sec.style.display = 'none';
    });
    
    // Показываем выбранную секцию
    const targetSection = document.getElementById('admin-' + section + '-section');
    if (targetSection) {
        targetSection.style.display = 'block';
    }
    
    // Загружаем данные для определенных секций
    if (section === 'admins') {
        setTimeout(() => {
            loadAdminsList();
        }, 100);
    }
}

// Restore chat
app.put('/api/support/chats/:chatId/restore', async (req, res) => {
    const chatId = req.params.chatId;
    const { adminId } = req.body;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

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

// Delete chat
app.delete('/api/support/chats/:chatId', async (req, res) => {
    const chatId = req.params.chatId;
    const { adminId } = req.body;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

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

// Task verification system
app.get('/api/admin/task-verifications', async (req, res) => {
    const { adminId } = req.query;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
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
        
        res.json({
            success: true,
            verifications: result.rows
        });
    } catch (error) {
        console.error('Get verifications error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Approve task verification (FIXED)
app.post('/api/admin/task-verifications/:verificationId/approve', async (req, res) => {
    const verificationId = req.params.verificationId;
    const { adminId } = req.body;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
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
// Function to check and remove completed tasks
async function checkAndRemoveCompletedTasks() {
    try {
        console.log('🔍 Checking for completed tasks...');
        
        // Находим задания, где количество выполненных задач достигло people_required
        const completedTasks = await pool.query(`
            SELECT t.id, t.title, t.people_required,
                   COUNT(ut.id) as completed_count
            FROM tasks t
            LEFT JOIN user_tasks ut ON t.id = ut.task_id AND ut.status = 'completed'
            WHERE t.status = 'active'
            GROUP BY t.id, t.title, t.people_required
            HAVING COUNT(ut.id) >= t.people_required
        `);
        
        if (completedTasks.rows.length > 0) {
            console.log(`📊 Found ${completedTasks.rows.length} completed tasks to deactivate`);
            
            for (const task of completedTasks.rows) {
                console.log(`🔄 Deactivating task: ${task.title} (ID: ${task.id})`);
                
                // Деактивируем задание
                await pool.query(`
                    UPDATE tasks 
                    SET status = 'completed' 
                    WHERE id = $1
                `, [task.id]);
                
                console.log(`✅ Task ${task.id} deactivated - reached ${task.completed_count}/${task.people_required} completions`);
            }
        }
    } catch (error) {
        console.error('❌ Error checking completed tasks:', error);
    }
}

// Запускаем проверку каждые 5 минут
setInterval(checkAndRemoveCompletedTasks, 5 * 60 * 1000);

// Также запускаем при старте сервера
setTimeout(checkAndRemoveCompletedTasks, 10000);
// Reject task verification
app.post('/api/admin/task-verifications/:verificationId/reject', async (req, res) => {
    const verificationId = req.params.verificationId;
    const { adminId } = req.body;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
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
        
        // Update user task
        await pool.query(`
            UPDATE user_tasks 
            SET status = 'rejected', rejected_at = CURRENT_TIMESTAMP 
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

// Добавление админа по юзернейму (только для главного админа)
app.post('/api/admin/add-admin', async (req, res) => {
    const { adminId, username } = req.body;
    
    console.log('🛠️ Received add-admin request:', { adminId, username });
    
    // Проверяем права доступа - только главный админ
    if (parseInt(adminId) !== ADMIN_ID) {
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
        const cleanUsername = username.replace('@', '');
        
        const userResult = await pool.query(
            'SELECT user_id, username, first_name FROM user_profiles WHERE username = $1',
            [cleanUsername]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found with this username'
            });
        }
        
        const user = userResult.rows[0];
        
        // Проверяем, не является ли пользователь уже админом
        if (user.is_admin) {
            return res.status(400).json({
                success: false,
                error: 'User is already an admin'
            });
        }
        
        // Назначаем пользователя админом
        await pool.query(
            'UPDATE user_profiles SET is_admin = true WHERE user_id = $1',
            [user.user_id]
        );
        
        console.log(`✅ Admin added: ${user.username} (ID: ${user.user_id})`);
        
        res.json({
            success: true,
            message: `User @${user.username} (${user.first_name}) successfully added as admin`,
            user: {
                id: user.user_id,
                username: user.username,
                firstName: user.first_name
            }
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
    if (parseInt(adminId) !== ADMIN_ID) {
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
            error: 'Cannot remove main admin'
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
                error: 'User not found'
            });
        }
        
        const user = userResult.rows[0];
        
        if (!user.is_admin) {
            return res.status(400).json({
                success: false,
                error: 'User is not an admin'
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
            message: `Admin @${user.username} (${user.first_name}) successfully removed`,
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

// Получение списка всех админов
// Получение списка всех администраторов
app.get('/api/admin/admins-list', async (req, res) => {
    const { adminId } = req.query;
    
    console.log('🛠️ Received admins-list request from:', adminId);
    
    // Проверяем права доступа - только главный админ
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied - only main admin can view admins list'
        });
    }
    
    try {
        const result = await pool.query(`
            SELECT user_id, username, first_name, last_name, created_at, is_admin
            FROM user_profiles 
            WHERE is_admin = true 
            ORDER BY 
                CASE WHEN user_id = $1 THEN 0 ELSE 1 END,
                created_at DESC
        `, [ADMIN_ID]);
        
        console.log(`✅ Found ${result.rows.length} admins`);
        
        res.json({
            success: true,
            admins: result.rows
        });
        
    } catch (error) {
        console.error('❌ Get admins list error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Добавление администратора по юзернейму
app.post('/api/admin/add-admin', async (req, res) => {
    const { adminId, username } = req.body;
    
    console.log('🛠️ Received add-admin request:', { adminId, username });
    
    // Проверяем права доступа - только главный админ
    if (parseInt(adminId) !== ADMIN_ID) {
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
        
        const userResult = await pool.query(
            'SELECT user_id, username, first_name, last_name, is_admin FROM user_profiles WHERE username = $1',
            [cleanUsername]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь с таким юзернеймом не найден'
            });
        }
        
        const user = userResult.rows[0];
        
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
        
        res.json({
            success: true,
            message: `Пользователь @${user.username} успешно добавлен как администратор!`,
            user: {
                id: user.user_id,
                username: user.username,
                firstName: user.first_name,
                lastName: user.last_name
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

// Удаление администратора
app.post('/api/admin/remove-admin', async (req, res) => {
    const { adminId, targetAdminId } = req.body;
    
    console.log('🛠️ Received remove-admin request:', { adminId, targetAdminId });
    
    // Проверяем права доступа - только главный админ
    if (parseInt(adminId) !== ADMIN_ID) {
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
    
    // Нельзя удалить главного админа
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
            message: `Администратор @${user.username} успешно удален`,
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
            error: 'Ошибка базы данных: ' + error.message
        });
    }
});
// Функция для принудительного обновления данных пользователя после добавления в админы
async function refreshUserData() {
    if (!currentUser) return;
    
    try {
        const result = await makeRequest(`/user/${currentUser.id}`);
        if (result.success) {
            // Обновляем текущего пользователя
            Object.assign(currentUser, result.profile);
            
            // Перепроверяем права администратора
            checkAdminRights();
            
            // Обновляем отображение
            displayUserProfile();
            
            console.log('✅ Данные пользователя обновлены, isAdmin:', currentUser.isAdmin);
        }
    } catch (error) {
        console.error('Ошибка обновления данных пользователя:', error);
    }
}

// Добавьте вызов этой функции после успешного добавления админа
async function addNewAdmin() {
    console.log('🎯 Starting addNewAdmin function...');
    
    const usernameInput = document.getElementById('new-admin-username');
    const messageDiv = document.getElementById('admin-form-message');
    const submitBtn = document.getElementById('add-admin-btn');
    
    if (!usernameInput || !messageDiv) {
        console.error('❌ Required elements not found');
        showNotification('Ошибка: элементы формы не найдены', 'error');
        return;
    }
    
    const username = usernameInput.value.trim();
    
    // Валидация
    if (!username) {
        messageDiv.innerHTML = '<span style="color: var(--error);">Введите юзернейм пользователя</span>';
        return;
    }
    
    // Проверяем права доступа
    if (!currentUser || !currentUser.isAdmin || parseInt(currentUser.id) !== ADMIN_ID) {
        messageDiv.innerHTML = '<span style="color: var(--error);">Только главный администратор может добавлять админов!</span>';
        return;
    }
    
    console.log('👤 Attempting to add admin with username:', username);
    
    // Показываем загрузку
    submitBtn.disabled = true;
    submitBtn.textContent = 'Добавляем...';
    messageDiv.innerHTML = '<span style="color: var(--warning);">Добавляем администратора...</span>';
    
    try {
        const result = await makeRequest('/admin/add-admin', {
            method: 'POST',
            body: JSON.stringify({
                adminId: currentUser.id,
                username: username
            })
        });
        
        console.log('📨 Server response:', result);
        
        if (result.success) {
            messageDiv.innerHTML = `<span style="color: var(--success);">${result.message}</span>`;
            usernameInput.value = ''; // Очищаем поле ввода
            
            // Обновляем список админов
            setTimeout(() => {
                loadAdminsList();
            }, 1000);
            
            showNotification(result.message, 'success');
            
            // Если добавленный админ - это текущий пользователь, обновляем его права
            if (result.user && parseInt(result.user.id) === parseInt(currentUser.id)) {
                setTimeout(() => {
                    refreshUserData();
                }, 1500);
            }
        } else {
            messageDiv.innerHTML = `<span style="color: var(--error);">Ошибка: ${result.error}</span>`;
            showNotification('Ошибка: ' + result.error, 'error');
        }
        
    } catch (error) {
        console.error('❌ Error adding admin:', error);
        messageDiv.innerHTML = `<span style="color: var(--error);">Ошибка сети: ${error.message}</span>`;
        showNotification('Ошибка сети при добавлении админа', 'error');
    } finally {
        // Восстанавливаем кнопку
        submitBtn.disabled = false;
        submitBtn.textContent = '➕ Добавить администратора';
    }
}
// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/api/health`);
    console.log(`🔐 Admin ID: ${ADMIN_ID}`);
    console.log(`🗄️ Database: PostgreSQL`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});
