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
app.use('/uploads', express.static('uploads'));

// Подробное логирование для отладки
console.log('🔧 Инициализация сервера...');
console.log('📡 DATABASE_URL:', process.env.DATABASE_URL ? 'Найден' : 'Не найден');
console.log('🚪 PORT:', PORT);

// PostgreSQL подключение для Railway с улучшенной обработкой ошибок
const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    // Увеличиваем таймауты для Railway
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 20
};

const pool = new Pool(poolConfig);

// Тестируем подключение к базе данных при старте
async function testDatabaseConnection() {
    try {
        console.log('🔍 Тестируем подключение к базе данных...');
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as current_time');
        console.log('✅ Подключение к базе данных успешно:', result.rows[0].current_time);
        client.release();
        return true;
    } catch (error) {
        console.error('❌ Ошибка подключения к базе данных:', error.message);
        return false;
    }
}

const ADMIN_ID = 8036875641;

// Инициализация базы данных с улучшенной обработкой ошибок
async function initDatabase() {
    try {
        console.log('🔄 Инициализация базы данных PostgreSQL...');
        
        // Создаем таблицы если их нет
        const tables = [
            `CREATE TABLE IF NOT EXISTS users (
                id BIGINT PRIMARY KEY,
                username VARCHAR(100),
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                photo_url TEXT,
                balance INTEGER DEFAULT 0,
                level INTEGER DEFAULT 1,
                experience INTEGER DEFAULT 0,
                tasks_completed INTEGER DEFAULT 0,
                active_tasks INTEGER DEFAULT 0,
                quality_rate REAL DEFAULT 100,
                referral_count INTEGER DEFAULT 0,
                referral_earned INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS posts (
                id SERIAL PRIMARY KEY,
                title VARCHAR(500) NOT NULL,
                content TEXT NOT NULL,
                image_url TEXT,
                author VARCHAR(200) NOT NULL,
                author_id BIGINT NOT NULL,
                is_admin BOOLEAN DEFAULT false,
                likes INTEGER DEFAULT 0,
                dislikes INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                title VARCHAR(500) NOT NULL,
                description TEXT NOT NULL,
                category VARCHAR(50) DEFAULT 'general',
                price INTEGER NOT NULL,
                time_to_complete VARCHAR(100),
                difficulty VARCHAR(50),
                people_required INTEGER DEFAULT 1,
                repost_time VARCHAR(100),
                task_url TEXT,
                image_url TEXT,
                created_by BIGINT NOT NULL,
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS user_tasks (
                id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                task_id INTEGER NOT NULL,
                status VARCHAR(20) DEFAULT 'active',
                screenshot_url TEXT,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                submitted_at TIMESTAMP,
                completed_at TIMESTAMP,
                rejected_at TIMESTAMP,
                rejection_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS support_chats (
                id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                user_name VARCHAR(200) NOT NULL,
                user_username VARCHAR(100),
                last_message TEXT,
                last_message_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                unread_count INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS support_messages (
                id SERIAL PRIMARY KEY,
                chat_id INTEGER NOT NULL,
                user_id BIGINT NOT NULL,
                user_name VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                image_url TEXT,
                is_admin BOOLEAN DEFAULT false,
                is_read BOOLEAN DEFAULT false,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS withdrawal_operations (
                id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                username VARCHAR(100) NOT NULL,
                amount INTEGER NOT NULL,
                status VARCHAR(20) DEFAULT 'processing',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS task_verifications (
                id SERIAL PRIMARY KEY,
                user_task_id INTEGER NOT NULL,
                user_id BIGINT NOT NULL,
                task_id INTEGER NOT NULL,
                user_name VARCHAR(200) NOT NULL,
                task_title VARCHAR(500) NOT NULL,
                task_price INTEGER NOT NULL,
                screenshot_url TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reviewed_at TIMESTAMP,
                reviewed_by BIGINT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS post_likes (
                id SERIAL PRIMARY KEY,
                post_id INTEGER NOT NULL,
                user_id BIGINT NOT NULL,
                is_like BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(post_id, user_id)
            )`
        ];

        for (const tableQuery of tables) {
            try {
                await pool.query(tableQuery);
                console.log(`✅ Таблица создана/проверена: ${tableQuery.split('TABLE IF NOT EXISTS ')[1]?.split(' ')[0]}`);
            } catch (tableError) {
                console.error(`❌ Ошибка создания таблицы:`, tableError.message);
            }
        }

        // Создаем несколько тестовых заданий если их нет
        const tasksCount = await pool.query('SELECT COUNT(*) FROM tasks');
        if (parseInt(tasksCount.rows[0].count) === 0) {
            console.log('📝 Создаем тестовые задания...');
            await pool.query(`
                INSERT INTO tasks (title, description, price, category, time_to_complete, difficulty, created_by) VALUES
                ('Подписаться на канал', 'Подпишитесь на наш Telegram канал и оставайтесь подписанным', 50, 'subscribe', '2 минуты', 'Легкая', $1),
                ('Посмотреть видео', 'Посмотрите видео до конца и поставьте лайк', 30, 'view', '5 минут', 'Легкая', $1),
                ('Сделать репост', 'Сделайте репост записи к себе в канал', 70, 'repost', '3 минуты', 'Средняя', $1)
            `, [ADMIN_ID]);
            console.log('✅ Тестовые задания созданы');
        }

        console.log('✅ База данных инициализирована успешно');
    } catch (error) {
        console.error('❌ Ошибка инициализации базы данных:', error);
    }
}

// Настройка загрузки файлов
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadsDir = 'uploads';
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

// Вспомогательные функции
function formatMoscowTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString("ru-RU", { 
        timeZone: "Europe/Moscow",
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatMoscowTimeShort(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
        return date.toLocaleString("ru-RU", { 
            timeZone: "Europe/Moscow",
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    return date.toLocaleString("ru-RU", { 
        timeZone: "Europe/Moscow",
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getMoscowTime() {
    return new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
}

// 🎯 ОСНОВНЫЕ ЭНДПОИНТЫ

// Health check с проверкой базы данных
app.get('/api/health', async (req, res) => {
    try {
        const dbCheck = await pool.query('SELECT NOW() as db_time, version() as db_version');
        
        res.json({ 
            status: 'OK', 
            message: 'LinkGold API работает с PostgreSQL!',
            timestamp: getMoscowTime(),
            database: {
                status: 'Connected',
                time: dbCheck.rows[0].db_time,
                version: dbCheck.rows[0].db_version
            },
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: 'Database connection failed',
            error: error.message,
            timestamp: getMoscowTime()
        });
    }
});

// 🔐 АУТЕНТИФИКАЦИЯ И ПОЛЬЗОВАТЕЛИ
app.post('/api/user/auth', async (req, res) => {
    console.log('🔐 Auth request:', req.body);
    try {
        const { user } = req.body;
        
        if (!user) {
            return res.status(400).json({
                success: false,
                error: 'Отсутствуют данные пользователя'
            });
        }
        
        const query = `
            INSERT INTO users (id, username, first_name, last_name, photo_url)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) 
            DO UPDATE SET 
                username = EXCLUDED.username,
                first_name = EXCLUDED.first_name, 
                last_name = EXCLUDED.last_name,
                photo_url = EXCLUDED.photo_url,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;

        const values = [
            user.id,
            user.username || `user_${user.id}`,
            user.first_name || 'Пользователь',
            user.last_name || '',
            user.photo_url || ''
        ];

        const result = await pool.query(query, values);
        
        const userData = {
            ...result.rows[0],
            isAdmin: parseInt(result.rows[0].id) === ADMIN_ID
        };
        
        console.log('✅ User auth success:', userData.id);
        res.json({ 
            success: true, 
            user: userData 
        });
        
    } catch (error) {
        console.error('❌ Auth error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Внутренняя ошибка сервера: ' + error.message 
        });
    }
});

app.get('/api/user/:userId', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.userId]);
        
        if (result.rows.length === 0) {
            return res.json({ 
                success: false, 
                error: 'Пользователь не найден' 
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
            error: 'Внутренняя ошибка сервера: ' + error.message
        });
    }
});

// 📝 ПОСТЫ
app.get('/api/posts', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, 
                   COALESCE(SUM(CASE WHEN pl.is_like = true THEN 1 ELSE 0 END), 0) as likes,
                   COALESCE(SUM(CASE WHEN pl.is_like = false THEN 1 ELSE 0 END), 0) as dislikes
            FROM posts p
            LEFT JOIN post_likes pl ON p.id = pl.post_id
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `);
        
        const postsWithMoscowTime = result.rows.map(post => ({
            ...post,
            moscow_time: formatMoscowTime(post.created_at)
        }));
        
        res.json({
            success: true,
            posts: postsWithMoscowTime
        });
    } catch (error) {
        console.error('Get posts error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных: ' + error.message
        });
    }
});

app.post('/api/posts', async (req, res) => {
    try {
        const { title, content, author, authorId, image_url } = req.body;
        
        if (!title || !content || !author) {
            return res.status(400).json({
                success: false,
                error: 'Заполните обязательные поля'
            });
        }
        
        if (parseInt(authorId) !== ADMIN_ID) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }
        
        const result = await pool.query(
            `INSERT INTO posts (title, content, author, author_id, is_admin, image_url) 
             VALUES ($1, $2, $3, $4, true, $5) 
             RETURNING *`,
            [title, content, author, authorId, image_url]
        );
        
        res.json({
            success: true,
            message: 'Пост успешно создан',
            postId: result.rows[0].id
        });
        
    } catch (error) {
        console.error('Create post error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных: ' + error.message
        });
    }
});

// 📋 ЗАДАНИЯ - УЛУЧШЕННАЯ ВЕРСИЯ
app.get('/api/tasks', async (req, res) => {
    try {
        const { search, category } = req.query;
        let query = "SELECT * FROM tasks WHERE status = 'active'";
        let params = [];

        if (search) {
            query += " AND (title ILIKE $1 OR description ILIKE $2)";
            params.push(`%${search}%`, `%${search}%`);
        }

        if (category && category !== 'all') {
            const paramIndex = params.length + 1;
            query += ` AND category = $${paramIndex}`;
            params.push(category);
        }

        query += " ORDER BY created_at DESC";

        console.log('📋 Fetching tasks with query:', query, params);
        const result = await pool.query(query, params);
        
        res.json({
            success: true,
            tasks: result.rows
        });
    } catch (error) {
        console.error('❌ Get tasks error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка загрузки заданий: ' + error.message
        });
    }
});

// 🔥 КРИТИЧЕСКИ ВАЖНО: Исправленный эндпоинт для начала задания
app.post('/api/user/tasks/start', async (req, res) => {
    console.log('🚀 Starting task:', req.body);
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const { userId, taskId } = req.body;
        
        // Валидация входных данных
        if (!userId || !taskId) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Отсутствуют обязательные поля: userId и taskId'
            });
        }

        // Проверяем существование пользователя
        const userCheck = await client.query(
            'SELECT id, username FROM users WHERE id = $1', 
            [userId]
        );
        
        if (userCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }

        // Проверяем существование задания
        const taskCheck = await client.query(
            'SELECT id, title, price FROM tasks WHERE id = $1 AND status = $2', 
            [taskId, 'active']
        );
        
        if (taskCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Задание не найдено или неактивно'
            });
        }

        // Проверяем, не начал ли пользователь уже это задание
        const existingTask = await client.query(
            `SELECT id, status FROM user_tasks 
             WHERE user_id = $1 AND task_id = $2 
             AND status IN ('active', 'pending_review')`,
            [userId, taskId]
        );
        
        if (existingTask.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Вы уже начали это задание'
            });
        }

        // Добавляем задание пользователю
        const insertResult = await client.query(
            `INSERT INTO user_tasks (user_id, task_id, status, started_at) 
             VALUES ($1, $2, 'active', CURRENT_TIMESTAMP) 
             RETURNING id`,
            [userId, taskId]
        );

        const userTaskId = insertResult.rows[0].id;

        // Обновляем счетчик активных заданий пользователя
        await client.query(
            `UPDATE users 
             SET active_tasks = COALESCE(active_tasks, 0) + 1,
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1`,
            [userId]
        );

        await client.query('COMMIT');
        
        console.log(`✅ Task started successfully: user ${userId}, task ${taskId}, userTaskId ${userTaskId}`);
        
        res.json({
            success: true,
            message: 'Задание успешно начато!',
            userTaskId: userTaskId,
            task: taskCheck.rows[0]
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Start task error:', error);
        
        // Детализированные ошибки для разных случаев
        let errorMessage = 'Ошибка начала задания';
        
        if (error.code === '23503') { // foreign key violation
            errorMessage = 'Ошибка: неверный пользователь или задание';
        } else if (error.code === '23505') { // unique violation
            errorMessage = 'Задание уже начато';
        }
        
        res.status(500).json({
            success: false,
            error: errorMessage + ': ' + error.message
        });
    } finally {
        client.release();
    }
});

// Получение заданий пользователя
app.get('/api/user/:userId/tasks', async (req, res) => {
    try {
        const userId = req.params.userId;
        const { status } = req.query;
        
        let query = `
            SELECT ut.*, t.title, t.description, t.price, t.category, t.task_url
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
            error: 'Ошибка загрузки заданий: ' + error.message
        });
    }
});

// 📸 Отправка скриншота задания
app.post('/api/user/tasks/:userTaskId/submit', upload.single('screenshot'), async (req, res) => {
    console.log('📸 Submitting screenshot for task:', req.params.userTaskId);
    
    try {
        const userTaskId = req.params.userTaskId;
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'Отсутствует ID пользователя'
            });
        }
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Скриншот не загружен'
            });
        }
        
        const screenshotUrl = `/uploads/${req.file.filename}`;
        
        // Обновляем user_task
        await pool.query(
            `UPDATE user_tasks SET status = 'pending_review', screenshot_url = $1, submitted_at = CURRENT_TIMESTAMP 
             WHERE id = $2 AND user_id = $3`,
            [screenshotUrl, userTaskId, userId]
        );
        
        // Получаем информацию о задании для verification
        const userTaskResult = await pool.query(
            `SELECT ut.user_id, ut.task_id, u.first_name, u.last_name, t.title, t.price 
             FROM user_tasks ut 
             JOIN users u ON ut.user_id = u.id 
             JOIN tasks t ON ut.task_id = t.id 
             WHERE ut.id = $1`, 
            [userTaskId]
        );
        
        if (userTaskResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Задание не найдено'
            });
        }
        
        const row = userTaskResult.rows[0];
        
        // Создаем запись в task_verifications
        const userName = `${row.first_name} ${row.last_name || ''}`.trim();
        const verificationResult = await pool.query(
            `INSERT INTO task_verifications (user_task_id, user_id, task_id, user_name, task_title, task_price, screenshot_url) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING *`,
            [userTaskId, row.user_id, row.task_id, userName, row.title, row.price, screenshotUrl]
        );
        
        console.log(`✅ Screenshot submitted for verification: ${verificationResult.rows[0].id}`);
        
        res.json({
            success: true,
            message: 'Задание отправлено на проверку',
            verificationId: verificationResult.rows[0].id
        });
        
    } catch (error) {
        console.error('❌ Submit task error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка отправки задания: ' + error.message
        });
    }
});

// ✅ ВЕРИФИКАЦИЯ ЗАДАНИЙ (АДМИН)
app.get('/api/admin/task-verifications', async (req, res) => {
    try {
        const { adminId } = req.query;
        
        if (parseInt(adminId) !== ADMIN_ID) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        const result = await pool.query(
            `SELECT tv.*, u.username, u.photo_url 
             FROM task_verifications tv 
             JOIN users u ON tv.user_id = u.id 
             WHERE tv.status = 'pending' 
             ORDER BY tv.submitted_at DESC`
        );
        
        res.json({
            success: true,
            verifications: result.rows
        });
    } catch (error) {
        console.error('Get task verifications error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка загрузки верификаций: ' + error.message
        });
    }
});

app.post('/api/admin/task-verifications/:verificationId/approve', async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        const verificationId = req.params.verificationId;
        const { adminId } = req.body;
        
        if (parseInt(adminId) !== ADMIN_ID) {
            throw new Error('Доступ запрещен');
        }

        if (!verificationId || !adminId) {
            throw new Error('Отсутствуют обязательные параметры');
        }

        console.log(`🔍 Одобрение верификации: ${verificationId}`);

        // Получаем информацию о верификации
        const verificationResult = await client.query(
            "SELECT * FROM task_verifications WHERE id = $1 FOR UPDATE", 
            [verificationId]
        );
        
        if (verificationResult.rows.length === 0) {
            throw new Error('Верификация не найдена');
        }
        
        const verification = verificationResult.rows[0];
        
        if (verification.status !== 'pending') {
            throw new Error(`Задание уже обработано. Статус: ${verification.status}`);
        }

        if (!verification.task_price || verification.task_price <= 0) {
            throw new Error('Неверная сумма задания');
        }
        
        // Обновляем статус верификации
        await client.query(
            `UPDATE task_verifications SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1 
             WHERE id = $2`, 
            [adminId, verificationId]
        );
        
        // Обновляем user_task
        await client.query(
            `UPDATE user_tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
             WHERE id = $1`, 
            [verification.user_task_id]
        );
        
        // Обновляем баланс пользователя и статистику
        await client.query(
            `UPDATE users 
             SET balance = COALESCE(balance, 0) + $1, 
                 tasks_completed = COALESCE(tasks_completed, 0) + 1,
                 active_tasks = GREATEST(COALESCE(active_tasks, 0) - 1, 0),
                 experience = COALESCE(experience, 0) + 10,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`, 
            [verification.task_price, verification.user_id]
        );
        
        await client.query('COMMIT');
        
        console.log(`✅ Задание одобрено! Пользователь ${verification.user_id} получил ${verification.task_price} ⭐`);
        
        res.json({
            success: true,
            message: 'Задание одобрено и баланс пользователя обновлен',
            amountAdded: verification.task_price
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Ошибка одобрения верификации:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка одобрения задания: ' + error.message
        });
    } finally {
        client.release();
    }
});

// 💬 СИСТЕМА ПОДДЕРЖКИ (основные функции)
app.get('/api/support/user-chat/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        // Сначала проверяем существующий чат
        const chatResult = await pool.query(
            "SELECT * FROM support_chats WHERE user_id = $1 AND is_active = true", 
            [userId]
        );
        
        let chat = chatResult.rows[0];

        if (chat) {
            res.json({
                success: true,
                chat: {
                    ...chat,
                    moscow_time: formatMoscowTimeShort(chat.last_message_time)
                }
            });
        } else {
            // Получаем данные пользователя
            const userResult = await pool.query(
                "SELECT first_name, last_name, username FROM users WHERE id = $1", 
                [userId]
            );
            
            let userName = `User_${userId}`;
            let userUsername = `user_${userId}`;
            
            if (userResult.rows.length > 0) {
                const user = userResult.rows[0];
                userName = `${user.first_name} ${user.last_name || ''}`.trim();
                userUsername = user.username || userUsername;
            }
            
            // Создаем новый чат
            const newChatResult = await pool.query(
                `INSERT INTO support_chats (user_id, user_name, user_username, last_message, last_message_time) 
                 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) 
                 RETURNING *`,
                [userId, userName, userUsername, 'Чат создан']
            );
            
            const newChat = newChatResult.rows[0];
            
            // Создаем приветственное сообщение от админа
            await pool.query(
                `INSERT INTO support_messages (chat_id, user_id, user_name, message, is_admin, is_read) 
                 VALUES ($1, $2, $3, $4, true, true)`,
                [newChat.id, ADMIN_ID, 'Администратор LinkGold', 'Здравствуйте! Чем могу помочь?']
            );
            
            res.json({
                success: true,
                chat: {
                    ...newChat,
                    moscow_time: formatMoscowTimeShort(newChat.last_message_time)
                }
            });
        }
    } catch (error) {
        console.error('Get user chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка создания чата: ' + error.message
        });
    }
});

// 💳 ВЫВОД СРЕДСТВ
app.post('/api/withdrawal/request', async (req, res) => {
    try {
        const { user_id, amount } = req.body;
        
        if (!user_id || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Заполните все поля'
            });
        }
        
        const userResult = await pool.query(
            "SELECT * FROM users WHERE id = $1", 
            [user_id]
        );
        
        if (userResult.rows.length === 0) {
            return res.json({ 
                success: false, 
                error: 'Пользователь не найден' 
            });
        }
        
        const user = userResult.rows[0];
        
        if (user.balance < amount) {
            return res.json({ 
                success: false, 
                error: 'Недостаточно средств на балансе' 
            });
        }
        
        // Создаем операцию вывода
        const operationResult = await pool.query(
            `INSERT INTO withdrawal_operations (user_id, username, amount) 
             VALUES ($1, $2, $3) 
             RETURNING *`,
            [user_id, user.username, amount]
        );
        
        // Обновляем баланс пользователя
        await pool.query(
            "UPDATE users SET balance = balance - $1 WHERE id = $2",
            [amount, user_id]
        );
        
        res.json({ 
            success: true, 
            message: 'Запрос на вывод отправлен',
            operationId: operationResult.rows[0].id,
            newBalance: user.balance - amount
        });
        
    } catch (error) {
        console.error('Withdrawal error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка вывода средств: ' + error.message
        });
    }
});

// Обработка ошибок для multer
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'Файл слишком большой. Максимальный размер 10MB.'
            });
        }
    }
    next(error);
});

// Глобальный обработчик ошибок
app.use((error, req, res, next) => {
    console.error('🚨 Global error handler:', error);
    res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера: ' + error.message
    });
});

// Основной маршрут для HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Запуск сервера
async function startServer() {
    try {
        // Тестируем подключение к базе данных
        const dbConnected = await testDatabaseConnection();
        
        if (!dbConnected) {
            console.error('❌ Не удалось подключиться к базе данных. Проверьте DATABASE_URL.');
            process.exit(1);
        }
        
        // Инициализируем базу данных
        await initDatabase();
        
        // Запускаем сервер
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Сервер запущен на порту ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
            console.log(`👤 Admin ID: ${ADMIN_ID}`);
            console.log(`⏰ Moscow time: ${getMoscowTime()}`);
            console.log(`🗄️ Database: PostgreSQL на Railway`);
            console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Запускаем сервер
startServer();