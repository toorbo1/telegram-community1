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

// Функция проверки прав администратора
async function checkAdminAccess(userId) {
    try {
        const result = await pool.query(
            'SELECT is_admin FROM user_profiles WHERE user_id = $1',
            [userId]
        );
        
        if (result.rows.length > 0) {
            return result.rows[0].is_admin === true || parseInt(userId) === ADMIN_ID;
        }
        return parseInt(userId) === ADMIN_ID;
    } catch (error) {
        return parseInt(userId) === ADMIN_ID;
    }
}

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

        // Таблица заданий
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
// Таблица запросов на вывод - ИСПРАВЛЕННАЯ ВЕРСИЯ
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

// Добавляем недостающие колонки если таблица уже существует
await pool.query(`
    DO $$ 
    BEGIN
        -- Добавляем username если не существует
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='withdrawal_requests' AND column_name='username') THEN
            ALTER TABLE withdrawal_requests ADD COLUMN username TEXT;
        END IF;
        
        -- Добавляем first_name если не существует
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='withdrawal_requests' AND column_name='first_name') THEN
            ALTER TABLE withdrawal_requests ADD COLUMN first_name TEXT;
        END IF;
        
        -- Добавляем completed_by если не существует
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='withdrawal_requests' AND column_name='completed_by') THEN
            ALTER TABLE withdrawal_requests ADD COLUMN completed_by BIGINT;
        END IF;
    END $$;
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

        // Таблица запросов на вывод
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
// В функции initDatabase() убедитесь, что задания создаются
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
        // // Добавляем примеры если таблицы пустые
        // const tasksCount = await pool.query('SELECT COUNT(*) FROM tasks');
        // if (parseInt(tasksCount.rows[0].count) === 0) {
        //     await pool.query(`
        //         INSERT INTO tasks (title, description, price, created_by) 
        //         VALUES 
        //         ('Подписаться на канал', 'Подпишитесь на наш Telegram канал', 50, $1),
        //         ('Посмотреть видео', 'Посмотрите видео до конца', 30, $1),
        //         ('Сделать репост', 'Сделайте репост записи', 70, $1)
        //     `, [ADMIN_ID]);
        // }

        const postsCount = await pool.query('SELECT COUNT(*) FROM posts');
        if (parseInt(postsCount.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO posts (title, content, author, author_id) 
                VALUES ('Добро пожаловать!', 'Начните зарабатывать выполняя простые задания!', 'Администратор', $1)
            `, [ADMIN_ID]);
        }

await fixWithdrawalTable();

         console.log('✅ Simplified database initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
}

// Инициализируем базу данных при запуске
initDatabase();

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
        const columnsToCheck = ['username', 'first_name', 'completed_by'];
        
        for (const column of columnsToCheck) {
            const columnExists = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'withdrawal_requests' AND column_name = $1
                );
            `, [column]);
            
            if (!columnExists.rows[0].exists) {
                console.log(`❌ Колонка ${column} отсутствует, добавляем...`);
                
                if (column === 'completed_by') {
                    await pool.query(`ALTER TABLE withdrawal_requests ADD COLUMN ${column} BIGINT`);
                } else {
                    await pool.query(`ALTER TABLE withdrawal_requests ADD COLUMN ${column} TEXT`);
                }
                
                console.log(`✅ Колонка ${column} добавлена`);
            } else {
                console.log(`✅ Колонка ${column} существует`);
            }
        }
        
        console.log('✅ Структура таблицы проверена и исправлена');
    } catch (error) {
        console.error('❌ Ошибка при исправлении таблицы:', error);
    }
}

// Вызовите эту функцию при инициализации сервера
fixWithdrawalTable();

// ==================== WITHDRAWAL REQUESTS FOR ADMINS ====================


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

// Get withdrawal requests for admin - ИСПРАВЛЕННАЯ ВЕРСИЯ
app.get('/api/admin/withdrawal-requests', async (req, res) => {
    const { adminId } = req.query;
    
    console.log('🔄 Запрос на получение заявок на вывод от админа:', adminId);
    
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
            SELECT wr.*, u.username, u.first_name 
            FROM withdrawal_requests wr
            LEFT JOIN user_profiles u ON wr.user_id = u.user_id
            WHERE wr.status = 'pending'
            ORDER BY wr.created_at DESC
        `);
        
        console.log(`✅ Найдено ${result.rows.length} заявок на вывод`);
        
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

// Complete withdrawal request - ИСПРАВЛЕННАЯ ВЕРСИЯ
app.post('/api/admin/withdrawal-requests/:requestId/complete', async (req, res) => {
    const requestId = req.params.requestId;
    const { adminId } = req.body;
    
    console.log('✅ Подтверждение выплаты:', { requestId, adminId });
    
    // Проверка прав администратора
    const isAdmin = await checkAdminAccess(adminId);
    if (!isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Доступ запрещен'
        });
    }
    
    try {
        // Обновляем статус заявки
        const result = await pool.query(`
            UPDATE withdrawal_requests 
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP, completed_by = $1
            WHERE id = $2 AND status = 'pending'
            RETURNING *
        `, [adminId, requestId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Запрос не найден или уже обработан'
            });
        }
        
        const request = result.rows[0];
        
        console.log(`✅ Выплата подтверждена: ${request.amount}⭐ для пользователя ${request.user_id}`);
        
        res.json({
            success: true,
            message: 'Выплата подтверждена'
        });
        
    } catch (error) {
        console.error('❌ Complete withdrawal error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
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
        const columnsToCheck = ['username', 'first_name', 'completed_by'];
        
        for (const column of columnsToCheck) {
            const columnExists = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'withdrawal_requests' AND column_name = $1
                );
            `, [column]);
            
            if (!columnExists.rows[0].exists) {
                console.log(`❌ Колонка ${column} отсутствует, добавляем...`);
                
                if (column === 'completed_by') {
                    await pool.query(`ALTER TABLE withdrawal_requests ADD COLUMN ${column} BIGINT`);
                } else {
                    await pool.query(`ALTER TABLE withdrawal_requests ADD COLUMN ${column} TEXT`);
                }
                
                console.log(`✅ Колонка ${column} добавлена`);
            } else {
                console.log(`✅ Колонка ${column} существует`);
            }
        }
        
        console.log('✅ Структура таблицы проверена и исправлена');
    } catch (error) {
        console.error('❌ Ошибка при исправлении таблицы:', error);
    }
}

// Вызовите эту функцию при инициализации сервера
fixWithdrawalTable();

// User authentication
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
                is_admin = COALESCE(user_profiles.is_admin, EXCLUDED.is_admin),
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            user.id, 
            user.username || `user_${user.id}`,
            user.first_name || 'Пользователь',
            user.last_name || '',
            user.photo_url || '',
            isMainAdmin
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

// Get all tasks - ИСПРАВЛЕННАЯ ВЕРСИЯ
app.get('/api/tasks', async (req, res) => {
    const { search, category } = req.query;
    
    console.log('📥 Получен запрос на задания:', { search, category });
    
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
        
        console.log('📊 Выполняем запрос:', query, params);
        
        const result = await pool.query(query, params);
        
        console.log(`✅ Найдено заданий: ${result.rows.length}`);
        
        res.json({
            success: true,
            tasks: result.rows
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
// Create task (for all admins) - УПРОЩЕННАЯ ВЕРСИЯ БЕЗ ПРОВЕРОК
app.post('/api/tasks', async (req, res) => {
    const { title, description, price, created_by } = req.body;
    
    if (!title || !description || !price) {
        return res.status(400).json({
            success: false,
            error: 'Заполните название, описание и цену'
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

        const result = await pool.query(`
            INSERT INTO tasks (title, description, price, created_by) 
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [title.trim(), description.trim(), taskPrice, created_by]);
        
        res.json({
            success: true,
            message: 'Задание успешно создано!',
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

// Start task for user
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

// Task verification system (for all admins) - ИСПРАВЛЕННАЯ ВЕРСИЯ БЕЗ ПРОВЕРОК
app.get('/api/admin/task-verifications', async (req, res) => {
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

// Approve task verification (for all admins) - ИСПРАВЛЕННАЯ ВЕРСИЯ БЕЗ ПРОВЕРОК
app.post('/api/admin/task-verifications/:verificationId/approve', async (req, res) => {
    const verificationId = req.params.verificationId;
    const { adminId } = req.body;
    
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

// Reject task verification (for all admins) - ИСПРАВЛЕННАЯ ВЕРСИЯ БЕЗ ПРОВЕРОК
app.post('/api/admin/task-verifications/:verificationId/reject', async (req, res) => {
    const verificationId = req.params.verificationId;
    const { adminId } = req.body;
    
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

// ==================== WITHDRAWAL ENDPOINTS ====================

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
    
    try {
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

// Получение списка всех админов - ТОЛЬКО для главного админа
app.get('/api/admin/admins-list', async (req, res) => {
    const { adminId } = req.query;
    
    console.log('🛠️ Received admins-list request from:', adminId);
    
    // Проверяем права доступа - только главный админ
    if (!adminId || parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied - only main admin can view admins list'
        });
    }
    
    try {
        const result = await pool.query(`
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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/api/health`);
    console.log(`🔐 Admin ID: ${ADMIN_ID}`);
    console.log(`🗄️ Database: PostgreSQL`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});