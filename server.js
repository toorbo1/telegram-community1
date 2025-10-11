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
                likes INTEGER DEFAULT 0,
                dislikes INTEGER DEFAULT 0,
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
                reviewed_by INTEGER
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

        // Add sample post
        const postsCount = await pool.query('SELECT COUNT(*) FROM posts');
        if (parseInt(postsCount.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO posts (title, content, author, author_id) 
                VALUES ('Добро пожаловать в LinkGold!', 'Мы рады приветствовать вас в нашем сервисе заработка. Выполняйте задания, приглашайте друзей и зарабатывайте вместе с нами!', 'Администратор', $1)
            `, [ADMIN_ID]);
            console.log('✅ Sample post created');
        }

        console.log('✅ Database initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
}

// Инициализируем базу данных при запуске
initDatabase();

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

// Create task (admin only) - UPDATED WITH ALL FIELDS
app.post('/api/tasks', async (req, res) => {
    const { 
        title, 
        description, 
        price, 
        created_by,
        time_to_complete,
        difficulty,
        people_required,
        repost_time,
        task_url
    } = req.body;
    
    console.log('📝 Creating task with data:', req.body);
    
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
            INSERT INTO tasks (
                title, description, price, created_by,
                time_to_complete, difficulty, people_required,
                repost_time, task_url
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [
            title, 
            description, 
            parseFloat(price), 
            created_by,
            time_to_complete || '5 минут',
            difficulty || 'Легкая',
            parseInt(people_required) || 1,
            repost_time || '1 день',
            task_url || ''
        ]);
        
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

// Support chat system - FIXED VERSION
app.get('/api/support/user-chat/:userId', async (req, res) => {
    const userId = req.params.userId;
    
    console.log('💬 Getting user chat for:', userId);
    
    try {
        // Check if chat exists
        const existingChat = await pool.query(
            'SELECT * FROM support_chats WHERE user_id = $1', 
            [userId]
        );
        
        if (existingChat.rows.length > 0) {
            console.log('✅ Found existing chat:', existingChat.rows[0].id);
            return res.json({
                success: true,
                chat: existingChat.rows[0]
            });
        }
        
        // Create new chat
        const user_name = `User_${userId}`;
        const user_username = `user_${userId}`;
        const last_message = 'Чат создан';
        
        console.log('📝 Creating new chat for user:', userId);
        
        const newChat = await pool.query(`
            INSERT INTO support_chats (user_id, user_name, user_username, last_message) 
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [userId, user_name, user_username, last_message]);
        
        const chatId = newChat.rows[0].id;
        console.log('✅ Created new chat with ID:', chatId);
        
        // Create welcome message
        try {
            await pool.query(`
                INSERT INTO support_messages (chat_id, user_id, user_name, message, is_admin, is_read) 
                VALUES ($1, $2, $3, $4, true, true)
            `, [chatId, ADMIN_ID, 'Администратор LinkGold', 'Здравствуйте! Чем могу помочь?']);
            console.log('✅ Created welcome message for chat:', chatId);
        } catch (messageError) {
            console.error('❌ Error creating welcome message:', messageError);
            // Continue even if message creation fails
        }
        
        res.json({
            success: true,
            chat: newChat.rows[0]
        });
    } catch (error) {
        console.error('❌ Get user chat error:', error);
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

// Mark chat as read
app.put('/api/support/chats/:chatId/read', async (req, res) => {
    const chatId = req.params.chatId;

    try {
        await pool.query(`
            UPDATE support_chats 
            SET unread_count = 0 
            WHERE id = $1
        `, [chatId]);
        
        // Also mark messages as read
        await pool.query(`
            UPDATE support_messages 
            SET is_read = true 
            WHERE chat_id = $1 AND is_admin = false
        `, [chatId]);
        
        res.json({
            success: true,
            message: 'Chat marked as read'
        });
    } catch (error) {
        console.error('Mark chat as read error:', error);
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