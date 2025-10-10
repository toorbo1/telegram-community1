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

// PostgreSQL подключение для Railway
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const ADMIN_ID = 8036875641;

// Инициализация базы данных
async function initDatabase() {
    try {
        console.log('🔄 Инициализация базы данных PostgreSQL...');
        
        // Создаем таблицы если их нет
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
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
            );

            CREATE TABLE IF NOT EXISTS posts (
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
            );

            CREATE TABLE IF NOT EXISTS tasks (
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
            );

            CREATE TABLE IF NOT EXISTS user_tasks (
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
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS support_chats (
                id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                user_name VARCHAR(200) NOT NULL,
                user_username VARCHAR(100),
                last_message TEXT,
                last_message_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                unread_count INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS support_messages (
                id SERIAL PRIMARY KEY,
                chat_id INTEGER NOT NULL,
                user_id BIGINT NOT NULL,
                user_name VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                image_url TEXT,
                is_admin BOOLEAN DEFAULT false,
                is_read BOOLEAN DEFAULT false,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chat_id) REFERENCES support_chats(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS withdrawal_operations (
                id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                username VARCHAR(100) NOT NULL,
                amount INTEGER NOT NULL,
                status VARCHAR(20) DEFAULT 'processing',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS task_verifications (
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
                FOREIGN KEY (user_task_id) REFERENCES user_tasks(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS post_likes (
                id SERIAL PRIMARY KEY,
                post_id INTEGER NOT NULL,
                user_id BIGINT NOT NULL,
                is_like BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                UNIQUE(post_id, user_id)
            );
        `);

        // Создаем несколько тестовых заданий если их нет
        const tasksCount = await pool.query('SELECT COUNT(*) FROM tasks');
        if (parseInt(tasksCount.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO tasks (title, description, price, category, time_to_complete, difficulty) VALUES
                ('Подписаться на канал', 'Подпишитесь на наш Telegram канал и оставайтесь подписанным', 50, 'subscribe', '2 минуты', 'Легкая'),
                ('Посмотреть видео', 'Посмотрите видео до конца и поставьте лайк', 30, 'view', '5 минут', 'Легкая'),
                ('Сделать репост', 'Сделайте репост записи к себе в канал', 70, 'repost', '3 минуты', 'Средняя')
            `);
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
    
    // Если сообщение сегодняшнее - показываем только время
    if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
        return date.toLocaleString("ru-RU", { 
            timeZone: "Europe/Moscow",
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    // Иначе показываем дату и время
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

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'LinkGold API работает с PostgreSQL!',
        timestamp: getMoscowTime(),
        database: 'PostgreSQL на Railway'
    });
});

// 🔐 АУТЕНТИФИКАЦИЯ И ПОЛЬЗОВАТЕЛИ
app.post('/api/user/auth', async (req, res) => {
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
        
        res.json({ 
            success: true, 
            user: userData 
        });
        
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Внутренняя ошибка сервера' 
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
            error: 'Внутренняя ошибка сервера' 
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
        
        // Форматируем время для каждого поста
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
            error: 'Ошибка базы данных'
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
        
        // Проверка прав администратора
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

app.delete('/api/posts/:id', async (req, res) => {
    try {
        const { authorId } = req.body;
        
        if (parseInt(authorId) !== ADMIN_ID) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        await pool.query("DELETE FROM posts WHERE id = $1", [req.params.id]);
        
        res.json({
            success: true,
            message: 'Пост успешно удален'
        });
    } catch (error) {
        console.error('Delete post error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});

// Лайки и дизлайки постов
app.post('/api/posts/:postId/like', async (req, res) => {
    try {
        const { userId } = req.body;
        const postId = req.params.postId;
        
        // Удаляем существующие лайки/дизлайки пользователя
        await pool.query(
            "DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2",
            [postId, userId]
        );
        
        // Добавляем лайк
        await pool.query(
            "INSERT INTO post_likes (post_id, user_id, is_like) VALUES ($1, $2, true)",
            [postId, userId]
        );
        
        // Получаем обновленные счетчики
        const result = await pool.query(`
            SELECT 
                COUNT(CASE WHEN is_like = true THEN 1 END) as likes,
                COUNT(CASE WHEN is_like = false THEN 1 END) as dislikes
            FROM post_likes 
            WHERE post_id = $1
        `, [postId]);
        
        res.json({
            success: true,
            likes: parseInt(result.rows[0].likes) || 0,
            dislikes: parseInt(result.rows[0].dislikes) || 0
        });
        
    } catch (error) {
        console.error('Like post error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});

app.post('/api/posts/:postId/dislike', async (req, res) => {
    try {
        const { userId } = req.body;
        const postId = req.params.postId;
        
        // Удаляем существующие лайки/дизлайки пользователя
        await pool.query(
            "DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2",
            [postId, userId]
        );
        
        // Добавляем дизлайк
        await pool.query(
            "INSERT INTO post_likes (post_id, user_id, is_like) VALUES ($1, $2, false)",
            [postId, userId]
        );
        
        // Получаем обновленные счетчики
        const result = await pool.query(`
            SELECT 
                COUNT(CASE WHEN is_like = true THEN 1 END) as likes,
                COUNT(CASE WHEN is_like = false THEN 1 END) as dislikes
            FROM post_likes 
            WHERE post_id = $1
        `, [postId]);
        
        res.json({
            success: true,
            likes: parseInt(result.rows[0].likes) || 0,
            dislikes: parseInt(result.rows[0].dislikes) || 0
        });
        
    } catch (error) {
        console.error('Dislike post error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});

// 📋 ЗАДАНИЯ
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

        const result = await pool.query(query, params);
        res.json({
            success: true,
            tasks: result.rows
        });
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});

app.get('/api/admin/tasks', async (req, res) => {
    try {
        const { adminId } = req.query;
        
        if (parseInt(adminId) !== ADMIN_ID) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        const result = await pool.query("SELECT * FROM tasks ORDER BY created_at DESC");
        res.json({
            success: true,
            tasks: result.rows
        });
    } catch (error) {
        console.error('Get admin tasks error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});

app.post('/api/tasks', async (req, res) => {
    try {
        const { 
            title, description, price, created_by, category,
            time_to_complete, difficulty, people_required, repost_time, task_url, image_url
        } = req.body;
        
        console.log('Creating task with data:', req.body);
        
        if (!title || !description || !price || !created_by) {
            return res.status(400).json({
                success: false,
                error: 'Заполните обязательные поля'
            });
        }
        
        // Проверка прав администратора
        if (parseInt(created_by) !== ADMIN_ID) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }
        
        const result = await pool.query(
            `INSERT INTO tasks (title, description, price, created_by, category,
                              time_to_complete, difficulty, people_required, repost_time, task_url, image_url) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
             RETURNING *`,
            [
                title, description, parseFloat(price), created_by, category || 'general',
                time_to_complete || '5 минут', difficulty || 'Легкая', 
                people_required || 1, repost_time || '1 день', task_url || '', image_url || ''
            ]
        );
        
        res.json({
            success: true,
            message: 'Задание успешно создано',
            taskId: result.rows[0].id
        });
        
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных: ' + error.message
        });
    }
});

app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const { adminId } = req.body;
        
        if (parseInt(adminId) !== ADMIN_ID) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        await pool.query("DELETE FROM tasks WHERE id = $1", [req.params.id]);
        
        res.json({
            success: true,
            message: 'Задание успешно удалено'
        });
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});

// 👤 ЗАДАНИЯ ПОЛЬЗОВАТЕЛЯ
app.post('/api/user/tasks/start', async (req, res) => {
    try {
        const { userId, taskId } = req.body;
        
        if (!userId || !taskId) {
            return res.status(400).json({
                success: false,
                error: 'Отсутствуют обязательные поля'
            });
        }
        
        // Проверяем, не начал ли пользователь уже это задание
        const existing = await pool.query(
            "SELECT * FROM user_tasks WHERE user_id = $1 AND task_id = $2", 
            [userId, taskId]
        );
        
        if (existing.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Задание уже начато'
            });
        }
        
        // Добавляем задание пользователю
        const result = await pool.query(
            `INSERT INTO user_tasks (user_id, task_id, status) VALUES ($1, $2, 'active') RETURNING *`,
            [userId, taskId]
        );
        
        // Обновляем счетчик активных заданий
        await pool.query(
            "UPDATE users SET active_tasks = active_tasks + 1 WHERE id = $1", 
            [userId]
        );
        
        res.json({
            success: true,
            message: 'Задание успешно начато',
            userTaskId: result.rows[0].id
        });
        
    } catch (error) {
        console.error('Start task error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});

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
            error: 'Ошибка базы данных'
        });
    }
});

// Отправка скриншота задания
app.post('/api/user/tasks/:userTaskId/submit', upload.single('screenshot'), async (req, res) => {
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
             WHERE id = $2`,
            [screenshotUrl, userTaskId]
        );
        
        // Получаем информацию о задании и пользователе для verification
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
        
        res.json({
            success: true,
            message: 'Задание отправлено на проверку',
            verificationId: verificationResult.rows[0].id
        });
        
    } catch (error) {
        console.error('Submit task error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});

// Отмена задания (пользователь не выполнил)
app.post('/api/user/tasks/:userTaskId/cancel', async (req, res) => {
    try {
        const userTaskId = req.params.userTaskId;
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'Отсутствует ID пользователя'
            });
        }
        
        await pool.query(
            "DELETE FROM user_tasks WHERE id = $1 AND user_id = $2", 
            [userTaskId, userId]
        );
        
        // Обновляем счетчик активных заданий
        await pool.query(
            "UPDATE users SET active_tasks = active_tasks - 1 WHERE id = $1", 
            [userId]
        );
        
        res.json({
            success: true,
            message: 'Задание успешно отменено'
        });
        
    } catch (error) {
        console.error('Cancel task error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
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
            error: 'Ошибка базы данных'
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

        // Валидация
        if (!verificationId || !adminId) {
            throw new Error('Отсутствуют обязательные параметры');
        }

        console.log(`🔍 Начинаем одобрение верификации: ${verificationId}`);

        // Получаем информацию о верификации
        const verificationResult = await client.query(
            "SELECT * FROM task_verifications WHERE id = $1 FOR UPDATE", 
            [verificationId]
        );
        
        if (verificationResult.rows.length === 0) {
            throw new Error('Верификация не найдена');
        }
        
        const verification = verificationResult.rows[0];
        console.log(`📋 Найдена верификация:`, verification);
        
        // Проверяем, что задание еще не обработано
        if (verification.status !== 'pending') {
            throw new Error(`Задание уже обработано. Статус: ${verification.status}`);
        }

        // Проверяем сумму
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
             SET balance = balance + $1, 
                 tasks_completed = tasks_completed + 1,
                 active_tasks = active_tasks - 1,
                 experience = experience + 10,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`, 
            [verification.task_price, verification.user_id]
        );
        
        await client.query('COMMIT');
        
        console.log(`✅ Пользователь ${verification.user_id} получил ${verification.task_price} ⭐ за задание ${verification.task_id}`);
        
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
            error: 'Ошибка базы данных: ' + error.message
        });
    } finally {
        client.release();
    }
});

app.post('/api/admin/task-verifications/:verificationId/reject', async (req, res) => {
    try {
        const verificationId = req.params.verificationId;
        const { adminId } = req.body;
        
        if (parseInt(adminId) !== ADMIN_ID) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        await pool.query(
            `UPDATE task_verifications SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1 
             WHERE id = $2`, 
            [adminId, verificationId]
        );
        
        // Обновляем user_task
        const verificationResult = await pool.query(
            "SELECT user_task_id FROM task_verifications WHERE id = $1", 
            [verificationId]
        );
        
        if (verificationResult.rows.length > 0) {
            await pool.query(
                `UPDATE user_tasks SET status = 'rejected', rejected_at = CURRENT_TIMESTAMP 
                 WHERE id = $1`, 
                [verificationResult.rows[0].user_task_id]
            );
        }
        
        res.json({
            success: true,
            message: 'Задание отклонено'
        });
        
    } catch (error) {
        console.error('Reject verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});

// 💬 СИСТЕМА ПОДДЕРЖКИ
app.get('/api/support/chats', async (req, res) => {
    try {
        const { adminId } = req.query;
        
        if (parseInt(adminId) !== ADMIN_ID) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        const result = await pool.query(
            `SELECT * FROM support_chats WHERE is_active = true ORDER BY last_message_time DESC`
        );
        
        // Форматируем время для каждого чата
        const chatsWithMoscowTime = result.rows.map(chat => ({
            ...chat,
            moscow_time: formatMoscowTimeShort(chat.last_message_time)
        }));
        
        res.json({
            success: true,
            chats: chatsWithMoscowTime
        });
    } catch (error) {
        console.error('Get support chats error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});

// Получение или создание чата для пользователя
app.get('/api/support/user-chat/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        console.log(`🔍 Getting user chat for user ID: ${userId}`);

        // Сначала проверяем существующий чат
        const chatResult = await pool.query(
            "SELECT * FROM support_chats WHERE user_id = $1 AND is_active = true", 
            [userId]
        );
        
        let chat = chatResult.rows[0];

        if (chat) {
            console.log(`✅ Found existing chat: ${chat.id}`);
            // Форматируем время для чата
            res.json({
                success: true,
                chat: {
                    ...chat,
                    moscow_time: formatMoscowTimeShort(chat.last_message_time)
                }
            });
        } else {
            console.log(`📝 Creating new chat for user: ${userId}`);
            
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
            console.log(`✅ Created new chat with ID: ${newChat.id}`);
            
            // Создаем приветственное сообщение от админа
            await pool.query(
                `INSERT INTO support_messages (chat_id, user_id, user_name, message, is_admin, is_read) 
                 VALUES ($1, $2, $3, $4, true, true)`,
                [newChat.id, ADMIN_ID, 'Администратор LinkGold', 'Здравствуйте! Чем могу помочь?']
            );
            
            console.log(`✅ Created welcome message for chat ${newChat.id}`);
            
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
            error: 'Ошибка базы данных: ' + error.message
        });
    }
});

// Получение сообщений чата
app.get('/api/support/chats/:chatId/messages', async (req, res) => {
    try {
        const chatId = req.params.chatId;
        
        console.log(`📨 Loading messages for chat ${chatId}`);
        
        const result = await pool.query(
            "SELECT * FROM support_messages WHERE chat_id = $1 ORDER BY sent_at ASC", 
            [chatId]
        );

        // Форматируем время для каждого сообщения
        const messagesWithMoscowTime = result.rows.map(message => ({
            ...message,
            moscow_time: formatMoscowTimeShort(message.sent_at)
        }));

        console.log(`✅ Loaded ${messagesWithMoscowTime.length} messages for chat ${chatId}`);
        
        res.json({
            success: true,
            messages: messagesWithMoscowTime
        });
    } catch (error) {
        console.error('Get support messages error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});

app.post('/api/support/chats/:chatId/messages', async (req, res) => {
    try {
        const chatId = req.params.chatId;
        const { user_id, user_name, message, image_url, is_admin } = req.body;

        if (!message && !image_url) {
            return res.status(400).json({
                success: false,
                error: 'Сообщение или изображение обязательно'
            });
        }

        console.log(`💬 Saving message for chat ${chatId}:`, { 
            user_id, user_name, 
            message: message ? message.substring(0, 50) + '...' : 'IMAGE', 
            is_admin 
        });

        // Для сообщений от пользователей - получаем актуальные данные из профиля
        let actualUserName = user_name;
        let actualUserUsername = `user_${user_id}`;
        
        if (!is_admin) {
            const userProfileResult = await pool.query(
                "SELECT first_name, last_name, username FROM users WHERE id = $1", 
                [user_id]
            );
            
            if (userProfileResult.rows.length > 0) {
                const userProfile = userProfileResult.rows[0];
                actualUserName = `${userProfile.first_name} ${userProfile.last_name || ''}`.trim();
                actualUserUsername = userProfile.username || actualUserUsername;
                
                console.log(`Using actual user data: ${actualUserName} (@${actualUserUsername})`);
                
                // Обновляем имя в чате если оно изменилось
                await pool.query(
                    "UPDATE support_chats SET user_name = $1, user_username = $2 WHERE user_id = $3", 
                    [actualUserName, actualUserUsername, user_id]
                );
            }
        }

        // Сохраняем сообщение
        const messageResult = await pool.query(
            `INSERT INTO support_messages (chat_id, user_id, user_name, message, image_url, is_admin) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING *`,
            [chatId, user_id, actualUserName, message, image_url, is_admin]
        );

        // Обновляем чат (последнее сообщение и время)
        const displayMessage = message || '📷 Фото';
        let updateQuery;
        let updateParams;

        if (is_admin) {
            // Сообщение от админа - сбрасываем счетчик непрочитанных
            updateQuery = `UPDATE support_chats SET last_message = $1, last_message_time = CURRENT_TIMESTAMP, unread_count = 0 WHERE id = $2`;
            updateParams = [displayMessage, chatId];
        } else {
            // Сообщение от пользователя - увеличиваем счетчик непрочитанных
            updateQuery = `UPDATE support_chats SET last_message = $1, last_message_time = CURRENT_TIMESTAMP, unread_count = unread_count + 1 WHERE id = $2`;
            updateParams = [displayMessage, chatId];
        }
        
        await pool.query(updateQuery, updateParams);
        console.log(`✅ Chat ${chatId} updated successfully`);

        res.json({
            success: true,
            message: 'Сообщение отправлено',
            messageId: messageResult.rows[0].id
        });
        
    } catch (error) {
        console.error('❌ Error saving message:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных: ' + error.message
        });
    }
});

app.put('/api/support/chats/:chatId/read', async (req, res) => {
    try {
        const chatId = req.params.chatId;

        await pool.query(
            "UPDATE support_chats SET unread_count = 0 WHERE id = $1", 
            [chatId]
        );
        
        // Также помечаем сообщения как прочитанные
        await pool.query(
            "UPDATE support_messages SET is_read = true WHERE chat_id = $1 AND is_admin = false", 
            [chatId]
        );
        
        res.json({
            success: true,
            message: 'Чат помечен как прочитанный'
        });
        
    } catch (error) {
        console.error('Mark chat as read error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});

// Управление чатами (админ)
app.delete('/api/support/chats/:chatId', async (req, res) => {
    try {
        const chatId = req.params.chatId;
        const { adminId } = req.body;
        
        if (parseInt(adminId) !== ADMIN_ID) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        console.log(`🗑️ Admin ${adminId} deleting chat ${chatId}`);

        // Сначала удаляем все сообщения в чате
        await pool.query("DELETE FROM support_messages WHERE chat_id = $1", [chatId]);
        
        // Затем удаляем сам чат
        await pool.query("DELETE FROM support_chats WHERE id = $1", [chatId]);
        
        console.log(`✅ Chat ${chatId} deleted successfully`);
        
        res.json({
            success: true,
            message: 'Чат успешно удален'
        });
        
    } catch (error) {
        console.error('Delete chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});

app.put('/api/support/chats/:chatId/archive', async (req, res) => {
    try {
        const chatId = req.params.chatId;
        const { adminId } = req.body;
        
        if (parseInt(adminId) !== ADMIN_ID) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        await pool.query(
            "UPDATE support_chats SET is_active = false WHERE id = $1", 
            [chatId]
        );
        
        res.json({
            success: true,
            message: 'Чат перемещен в архив'
        });
        
    } catch (error) {
        console.error('Archive chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});

app.put('/api/support/chats/:chatId/restore', async (req, res) => {
    try {
        const chatId = req.params.chatId;
        const { adminId } = req.body;
        
        if (parseInt(adminId) !== ADMIN_ID) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        await pool.query(
            "UPDATE support_chats SET is_active = true WHERE id = $1", 
            [chatId]
        );
        
        res.json({
            success: true,
            message: 'Чат восстановлен из архива'
        });
        
    } catch (error) {
        console.error('Restore chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});

app.get('/api/support/archived-chats', async (req, res) => {
    try {
        const { adminId } = req.query;
        
        if (parseInt(adminId) !== ADMIN_ID) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        const result = await pool.query(
            `SELECT * FROM support_chats WHERE is_active = false ORDER BY last_message_time DESC`
        );
        
        res.json({
            success: true,
            chats: result.rows
        });
    } catch (error) {
        console.error('Get archived chats error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});

app.get('/api/support/all-chats', async (req, res) => {
    try {
        const { adminId } = req.query;
        
        if (parseInt(adminId) !== ADMIN_ID) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        const result = await pool.query(
            `SELECT * FROM support_chats ORDER BY last_message_time DESC`
        );
        
        // Форматируем время для каждого чата
        const chatsWithMoscowTime = result.rows.map(chat => ({
            ...chat,
            moscow_time: formatMoscowTimeShort(chat.last_message_time)
        }));
        
        res.json({
            success: true,
            chats: chatsWithMoscowTime
        });
    } catch (error) {
        console.error('Get all chats error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});

app.get('/api/support/chats/:chatId', async (req, res) => {
    try {
        const chatId = req.params.chatId;
        const { adminId } = req.query;
        
        if (parseInt(adminId) !== ADMIN_ID) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        const result = await pool.query(
            "SELECT * FROM support_chats WHERE id = $1", 
            [chatId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Чат не найден'
            });
        }
        
        res.json({
            success: true,
            chat: {
                ...result.rows[0],
                moscow_time: formatMoscowTimeShort(result.rows[0].last_message_time)
            }
        });
    } catch (error) {
        console.error('Get chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});

// 💳 ВЫВОД СРЕДСТВ
app.post('/api/withdrawal/request', async (req, res) => {
    try {
        const { user_id, amount, method, details } = req.body;
        
        if (!user_id || !amount || !method || !details) {
            return res.status(400).json({
                success: false,
                error: 'Заполните все поля'
            });
        }
        
        // Проверяем существование пользователя
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
        
        // Проверяем баланс
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
            error: 'Ошибка базы данных' 
        });
    }
});

app.get('/api/withdraw/history/:userId', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM withdrawal_operations WHERE user_id = $1 ORDER BY created_at DESC",
            [req.params.userId]
        );
        
        res.json({ 
            success: true, 
            operations: result.rows 
        });
    } catch (error) {
        console.error('Get withdrawal history error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка базы данных' 
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

// Основной маршрут для HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`👤 Admin ID: ${ADMIN_ID}`);
    console.log(`⏰ Moscow time: ${getMoscowTime()}`);
    console.log(`🗄️ Database: PostgreSQL на Railway`);
    
    // Инициализируем базу данных
    await initDatabase();
});