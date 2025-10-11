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

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const ADMIN_ID = 8036875641;

// Инициализация базы данных
async function initDatabase() {
    try {
        console.log('🔄 Initializing database...');
        
        // User profiles table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_profiles (
                user_id BIGINT PRIMARY KEY,
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Posts table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS posts (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                image_url TEXT,
                author TEXT NOT NULL,
                author_id BIGINT NOT NULL,
                is_admin BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tasks table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
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
                created_by BIGINT NOT NULL,
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // User tasks table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_tasks (
                id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                task_id INTEGER NOT NULL,
                status TEXT DEFAULT 'active',
                screenshot_url TEXT,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                submitted_at TIMESTAMP,
                completed_at TIMESTAMP,
                rejected_at TIMESTAMP,
                rejection_reason TEXT
            )
        `);

        // Support chats table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS support_chats (
                id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                user_name TEXT NOT NULL,
                user_username TEXT,
                last_message TEXT,
                last_message_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                unread_count INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Support messages table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS support_messages (
                id SERIAL PRIMARY KEY,
                chat_id INTEGER NOT NULL,
                user_id BIGINT NOT NULL,
                user_name TEXT NOT NULL,
                message TEXT NOT NULL,
                image_url TEXT,
                is_admin BOOLEAN DEFAULT false,
                is_read BOOLEAN DEFAULT false,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Withdrawal requests table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS withdrawal_requests (
                id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                amount REAL NOT NULL,
                method TEXT NOT NULL,
                details TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Task verification table
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

        console.log('✅ Database initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
}

// Инициализируем базу данных при запуске
initDatabase();

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'LinkGold API is running!',
        timestamp: new Date().toISOString(),
        database: 'PostgreSQL'
    });
});

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
        const isAdmin = parseInt(user.id) === ADMIN_ID;
        
        const result = await pool.query(`
            INSERT INTO user_profiles 
            (user_id, username, first_name, last_name, photo_url, updated_at) 
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
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
            user.photo_url || ''
        ]);
        
        const userProfile = result.rows[0];
        
        res.json({
            success: true,
            user: {
                ...userProfile,
                isAdmin: isAdmin
            }
        });
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error'
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
            error: 'Database error'
        });
    }
});

// Posts endpoints
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
            error: 'Database error'
        });
    }
});

app.post('/api/posts', async (req, res) => {
    const { title, content, author, authorId, image_url } = req.body;
    
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
            INSERT INTO posts (title, content, author, author_id, is_admin, image_url) 
            VALUES ($1, $2, $3, $4, true, $5)
            RETURNING *
        `, [title, content, author, authorId, image_url]);
        
        res.json({
            success: true,
            message: 'Post created successfully',
            postId: result.rows[0].id
        });
    } catch (error) {
        console.error('Create post error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error'
        });
    }
});

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
            error: 'Database error'
        });
    }
});

// Tasks endpoints - ВСЕ ЗАПРОСЫ ИСПРАВЛЕНЫ (без task_url)
app.get('/api/tasks', async (req, res) => {
    const { search, category } = req.query;
    
    try {
        let query = "SELECT * FROM tasks WHERE status = 'active'";
        let params = [];
        let paramCount = 0;

        if (search) {
            paramCount++;
            query += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        if (category && category !== 'all') {
            paramCount++;
            query += ` AND category = $${paramCount}`;
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
            error: 'Database error'
        });
    }
});

app.get('/api/admin/tasks', async (req, res) => {
    const { adminId } = req.query;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

    try {
        const result = await pool.query("SELECT * FROM tasks ORDER BY created_at DESC");
        
        res.json({
            success: true,
            tasks: result.rows
        });
    } catch (error) {
        console.error('Get admin tasks error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error'
        });
    }
});

app.post('/api/tasks', async (req, res) => {
    const { 
        title, description, price, created_by, category,
        time_to_complete, difficulty, people_required, repost_time, task_url, image_url
    } = req.body;
    
    console.log('Creating task with data:', req.body);
    
    if (!title || !description || !price || !created_by) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    // Check admin rights
    if (parseInt(created_by) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }
    
    try {
        const result = await pool.query(`
            INSERT INTO tasks (title, description, price, created_by, category,
                              time_to_complete, difficulty, people_required, repost_time, task_url, image_url) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [
            title, description, parseFloat(price), created_by, category || 'general',
            time_to_complete || '5 минут', difficulty || 'Легкая', 
            people_required || 1, repost_time || '1 день', task_url || '', image_url || ''
        ]);
        
        res.json({
            success: true,
            message: 'Task created successfully',
            taskId: result.rows[0].id
        });
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error'
        });
    }
});

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
            error: 'Database error'
        });
    }
});

// User tasks endpoints - ИСПРАВЛЕННЫЕ ЗАПРОСЫ (без task_url)
app.post('/api/user/tasks/start', async (req, res) => {
    const { userId, taskId } = req.body;
    
    if (!userId || !taskId) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    try {
        // Проверяем, не начал ли пользователь уже это задание
        const existingResult = await pool.query(
            "SELECT * FROM user_tasks WHERE user_id = $1 AND task_id = $2", 
            [userId, taskId]
        );
        
        if (existingResult.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Task already started'
            });
        }
        
        // Добавляем задание пользователю
        const result = await pool.query(`
            INSERT INTO user_tasks (user_id, task_id, status) 
            VALUES ($1, $2, 'active')
            RETURNING *
        `, [userId, taskId]);
        
        // Обновляем счетчик активных заданий
        await pool.query(`
            UPDATE user_profiles 
            SET active_tasks = COALESCE(active_tasks, 0) + 1 
            WHERE user_id = $1
        `, [userId]);
        
        res.json({
            success: true,
            message: 'Task started successfully',
            userTaskId: result.rows[0].id
        });
    } catch (error) {
        console.error('Start task error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error'
        });
    }
});

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
            error: 'Database error'
        });
    }
});

// Support system endpoints
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
            error: 'Database error'
        });
    }
});

// Получение или создание чата для пользователя
app.get('/api/support/user-chat/:userId', async (req, res) => {
    const userId = req.params.userId;
    
    console.log(`🔍 Getting user chat for user ID: ${userId}`);

    try {
        // Сначала проверяем существующий чат
        const existingChat = await pool.query(
            "SELECT * FROM support_chats WHERE user_id = $1", 
            [userId]
        );

        if (existingChat.rows.length > 0) {
            console.log(`✅ Found existing chat: ${existingChat.rows[0].id}`);
            res.json({
                success: true,
                chat: existingChat.rows[0]
            });
        } else {
            console.log(`📝 Creating new chat for user: ${userId}`);
            
            // Создаем новый чат
            const userName = `User_${userId}`;
            const userUsername = `user_${userId}`;
            
            const result = await pool.query(`
                INSERT INTO support_chats (user_id, user_name, user_username, last_message) 
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [userId, userName, userUsername, 'Чат создан']);
            
            const newChat = result.rows[0];
            console.log(`✅ Created new chat with ID: ${newChat.id}`);
            
            // Создаем приветственное сообщение от админа
            await pool.query(`
                INSERT INTO support_messages (chat_id, user_id, user_name, message, is_admin, is_read) 
                VALUES ($1, $2, $3, $4, true, true)
            `, [newChat.id, ADMIN_ID, 'Администратор LinkGold', 'Здравствуйте! Чем могу помочь?']);
            
            console.log(`✅ Created welcome message for chat ${newChat.id}`);
            
            res.json({
                success: true,
                chat: newChat
            });
        }
    } catch (error) {
        console.error('❌ User chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Получение сообщений чата
app.get('/api/support/chats/:chatId/messages', async (req, res) => {
    const chatId = req.params.chatId;
    
    console.log(`📨 Loading messages for chat ${chatId}`);
    
    try {
        const result = await pool.query(`
            SELECT * FROM support_messages 
            WHERE chat_id = $1 
            ORDER BY sent_at ASC
        `, [chatId]);

        console.log(`✅ Loaded ${result.rows.length} messages for chat ${chatId}`);
        
        res.json({
            success: true,
            messages: result.rows
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error'
        });
    }
});

app.post('/api/support/chats/:chatId/messages', async (req, res) => {
    const chatId = req.params.chatId;
    const { user_id, user_name, message, image_url, is_admin } = req.body;

    if (!message && !image_url) {
        return res.status(400).json({
            success: false,
            error: 'Message or image is required'
        });
    }

    console.log(`💬 Saving message for chat ${chatId}:`, { 
        user_id, user_name, 
        message: message ? message.substring(0, 50) + '...' : 'IMAGE', 
        is_admin 
    });

    try {
        // Сохраняем сообщение
        const result = await pool.query(`
            INSERT INTO support_messages (chat_id, user_id, user_name, message, image_url, is_admin) 
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [chatId, user_id, user_name, message, image_url, is_admin]);

        // Обновляем чат
        const displayMessage = message || '📷 Фото';
        
        if (is_admin) {
            await pool.query(`
                UPDATE support_chats 
                SET last_message = $1, last_message_time = CURRENT_TIMESTAMP, unread_count = 0 
                WHERE id = $2
            `, [displayMessage, chatId]);
        } else {
            await pool.query(`
                UPDATE support_chats 
                SET last_message = $1, last_message_time = CURRENT_TIMESTAMP, unread_count = unread_count + 1 
                WHERE id = $2
            `, [displayMessage, chatId]);
        }

        res.json({
            success: true,
            message: 'Message sent',
            messageId: result.rows[0].id
        });
    } catch (error) {
        console.error('❌ Send message error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

// Withdrawal endpoints
app.post('/api/withdrawal/request', async (req, res) => {
    const { user_id, amount, method, details } = req.body;
    
    if (!user_id || !amount || !method || !details) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    try {
        const result = await pool.query(`
            INSERT INTO withdrawal_requests (user_id, amount, method, details) 
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [user_id, amount, method, details]);
        
        res.json({
            success: true,
            message: 'Withdrawal request submitted successfully',
            requestId: result.rows[0].id
        });
    } catch (error) {
        console.error('Withdrawal error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error'
        });
    }
});

// Task verification endpoints
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
            SELECT tv.*, u.username, u.photo_url 
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
            error: 'Database error'
        });
    }
});

app.post('/api/admin/task-verifications/:verificationId/approve', async (req, res) => {
    const verificationId = req.params.verificationId;
    const { adminId } = req.body;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Доступ запрещен'
        });
    }

    try {
        // Получаем информацию о верификации
        const verificationResult = await pool.query(
            "SELECT * FROM task_verifications WHERE id = $1", 
            [verificationId]
        );
        
        if (verificationResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Верификация не найдена'
            });
        }
        
        const verification = verificationResult.rows[0];
        
        if (verification.status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: `Задание уже обработано. Статус: ${verification.status}`
            });
        }

        // Обновляем статус верификации
        await pool.query(`
            UPDATE task_verifications 
            SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1 
            WHERE id = $2
        `, [adminId, verificationId]);
        
        // Обновляем user_task
        await pool.query(`
            UPDATE user_tasks 
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
            WHERE id = $1
        `, [verification.user_task_id]);
        
        // Обновляем баланс пользователя и статистику
        await pool.query(`
            UPDATE user_profiles 
            SET balance = COALESCE(balance, 0) + $1, 
                tasks_completed = COALESCE(tasks_completed, 0) + 1,
                active_tasks = COALESCE(active_tasks, 0) - 1,
                experience = COALESCE(experience, 0) + 10,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
        `, [verification.task_price, verification.user_id]);
        
        console.log(`✅ Пользователь ${verification.user_id} получил ${verification.task_price} ★`);
        
        res.json({
            success: true,
            message: 'Задание одобрено и баланс пользователя обновлен',
            amountAdded: verification.task_price
        });
    } catch (error) {
        console.error('Approve verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error'
        });
    }
});

// Основной маршрут для HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔐 Admin ID: ${ADMIN_ID}`);
    console.log(`🗄️ Database: PostgreSQL`);
});