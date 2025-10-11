const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
// В server.js после middleware добавьте:

// API routes first
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'LinkGold API is running!',
        timestamp: new Date().toISOString(),
        database: 'PostgreSQL'
    });
});

// Все остальные API routes...

// Then static files
app.use(express.static('.'));

// Then catch-all handler for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
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

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
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
                level INTEGER DEFAULT 1,
                experience INTEGER DEFAULT 0,
                tasks_completed INTEGER DEFAULT 0,
                active_tasks INTEGER DEFAULT 0,
                quality_rate REAL DEFAULT 100,
                referral_count INTEGER DEFAULT 0,
                referral_earned REAL DEFAULT 0,
                is_admin BOOLEAN DEFAULT false,
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

        // Add sample tasks if they don't exist
        const tasksCount = await pool.query('SELECT COUNT(*) FROM tasks');
        if (parseInt(tasksCount.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO tasks (title, description, price, category, time_to_complete, difficulty, created_by) 
                VALUES 
                ('Подписаться на канал', 'Подпишитесь на наш Telegram канал и оставайтесь подписанным', 50, 'subscribe', '2 минуты', 'Легкая', $1),
                ('Посмотреть видео', 'Посмотрите видео до конца и поставьте лайк', 30, 'view', '5 минут', 'Легкая', $1),
                ('Сделать репост', 'Сделайте репост записи к себе в канал', 70, 'repost', '3 минуты', 'Средняя', $1)
            `, [ADMIN_ID]);
            console.log('✅ Sample tasks created');
        }

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
            isAdmin
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
            error: 'Database error'
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
            INSERT INTO posts (title, content, author, author_id, is_admin) 
            VALUES ($1, $2, $3, $4, true)
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
            error: 'Database error'
        });
    }
});

// Get all tasks
app.get('/api/tasks', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM tasks 
            WHERE status = 'active' 
            ORDER BY created_at DESC
        `);
        
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
            error: 'Database error'
        });
    }
});

// Create task (admin only)
app.post('/api/tasks', async (req, res) => {
    const { title, description, price, created_by } = req.body;
    
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
            INSERT INTO tasks (title, description, price, created_by) 
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [title, description, parseFloat(price), created_by]);
        
        res.json({
            success: true,
            message: 'Task created successfully',
            task: result.rows[0]
        });
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error'
        });
    }
});

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
        // Check if user already started this task
        const existingTask = await pool.query(`
            SELECT id FROM user_tasks 
            WHERE user_id = $1 AND task_id = $2 AND status IN ('active', 'pending_review')
        `, [userId, taskId]);
        
        if (existingTask.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Task already started'
            });
        }
        
        // Start the task
        const result = await pool.query(`
            INSERT INTO user_tasks (user_id, task_id, status) 
            VALUES ($1, $2, 'active')
            RETURNING *
        `, [userId, taskId]);
        
        // Update user's active tasks count
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

// Get user tasks - ИСПРАВЛЕННЫЙ ЗАПРОС (без task_url)
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

// Support chat system
app.get('/api/support/user-chat/:userId', async (req, res) => {
    const userId = req.params.userId;
    
    try {
        // Check if chat exists
        const existingChat = await pool.query(
            'SELECT * FROM support_chats WHERE user_id = $1', 
            [userId]
        );
        
        if (existingChat.rows.length > 0) {
            return res.json({
                success: true,
                chat: existingChat.rows[0]
            });
        }
        
        // Create new chat
        const newChat = await pool.query(`
            INSERT INTO support_chats (user_id, user_name, user_username, last_message) 
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [userId, `User_${userId}`, `user_${userId}`, 'Чат создан']);
        
        // Create welcome message
        await pool.query(`
            INSERT INTO support_messages (chat_id, user_id, user_name, message, is_admin, is_read) 
            VALUES ($1, $2, $3, $4, true, true)
        `, [newChat.rows[0].id, ADMIN_ID, 'Администратор LinkGold', 'Здравствуйте! Чем могу помочь?']);
        
        res.json({
            success: true,
            chat: newChat.rows[0]
        });
    } catch (error) {
        console.error('Get user chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error'
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
            error: 'Database error'
        });
    }
});

// Send message to chat
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
            SET last_message = $1, last_message_time = CURRENT_TIMESTAMP 
            WHERE id = $2
        `, [message, chatId]);

        res.json({
            success: true,
            message: 'Message sent',
            messageId: result.rows[0].id
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error'
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
            error: 'Database error'
        });
    }
});

// Approve task verification
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
                experience = COALESCE(experience, 0) + 10
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
            error: 'Database error'
        });
    }
});

// Withdrawal request
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
            message: 'Withdrawal request submitted',
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

// Main route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
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
});