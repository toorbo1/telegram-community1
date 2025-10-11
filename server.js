const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
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
                level INTEGER DEFAULT 1,
                is_admin BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Simple tasks table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                price REAL NOT NULL,
                category TEXT DEFAULT 'general',
                created_by BIGINT NOT NULL,
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Simple support chats table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS support_chats (
                id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                user_name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Simple messages table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                chat_id INTEGER NOT NULL,
                user_id BIGINT NOT NULL,
                message TEXT NOT NULL,
                is_admin BOOLEAN DEFAULT false,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add sample data
        await pool.query(`
            INSERT INTO user_profiles (user_id, username, first_name, is_admin) 
            VALUES ($1, 'admin', 'Администратор', true)
            ON CONFLICT (user_id) DO NOTHING
        `, [ADMIN_ID]);

        console.log('✅ Database initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
}

// Инициализируем базу данных
initDatabase();

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'LinkGold API is running!',
        timestamp: new Date().toISOString()
    });
});

// User authentication
app.post('/api/user/auth', async (req, res) => {
    const { user } = req.body;
    
    if (!user || !user.id) {
        return res.status(400).json({
            success: false,
            error: 'Missing user data'
        });
    }
    
    try {
        const isAdmin = parseInt(user.id) === ADMIN_ID;
        
        const result = await pool.query(`
            INSERT INTO user_profiles 
            (user_id, username, first_name, last_name, photo_url, is_admin) 
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                username = EXCLUDED.username,
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                photo_url = EXCLUDED.photo_url,
                is_admin = EXCLUDED.is_admin
            RETURNING *
        `, [
            user.id, 
            user.username || `user_${user.id}`,
            user.first_name || 'Пользователь',
            user.last_name || '',
            user.photo_url || '',
            isAdmin
        ]);
        
        res.json({
            success: true,
            user: result.rows[0]
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

// Create task (admin only) - SIMPLE VERSION
app.post('/api/tasks', async (req, res) => {
    const { title, description, price, created_by } = req.body;
    
    console.log('📝 Creating task:', { title, description, price, created_by });
    
    // Basic validation
    if (!title || !description || !price || !created_by) {
        return res.status(400).json({
            success: false,
            error: 'Все поля обязательны: название, описание, цена'
        });
    }
    
    // Check admin rights
    if (parseInt(created_by) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Только администратор может создавать задания'
        });
    }
    
    try {
        const result = await pool.query(`
            INSERT INTO tasks (title, description, price, created_by) 
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [title, description, parseFloat(price), created_by]);
        
        console.log('✅ Task created successfully');
        
        res.json({
            success: true,
            message: 'Задание создано успешно',
            task: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Create task error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});

// Get admin tasks
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

// Delete task
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

// SIMPLE CHAT SYSTEM

// Get or create user chat
app.get('/api/support/user-chat/:userId', async (req, res) => {
    const userId = req.params.userId;
    
    console.log('💬 Getting chat for user:', userId);
    
    try {
        // Check if chat exists
        const existingChat = await pool.query(
            'SELECT * FROM support_chats WHERE user_id = $1', 
            [userId]
        );
        
        if (existingChat.rows.length > 0) {
            console.log('✅ Found existing chat');
            return res.json({
                success: true,
                chat: existingChat.rows[0]
            });
        }
        
        // Get user name
        const userResult = await pool.query(
            'SELECT first_name FROM user_profiles WHERE user_id = $1',
            [userId]
        );
        
        const userName = userResult.rows.length > 0 
            ? userResult.rows[0].first_name 
            : `User_${userId}`;
        
        // Create new chat
        const newChat = await pool.query(`
            INSERT INTO support_chats (user_id, user_name) 
            VALUES ($1, $2)
            RETURNING *
        `, [userId, userName]);
        
        console.log('✅ Created new chat');
        
        res.json({
            success: true,
            chat: newChat.rows[0]
        });
    } catch (error) {
        console.error('❌ Get user chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка создания чата'
        });
    }
});

// Get chat messages
app.get('/api/support/chats/:chatId/messages', async (req, res) => {
    const chatId = req.params.chatId;
    
    try {
        const result = await pool.query(`
            SELECT * FROM messages 
            WHERE chat_id = $1 
            ORDER BY sent_at ASC
        `, [chatId]);
        
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

// Send message
app.post('/api/support/chats/:chatId/messages', async (req, res) => {
    const chatId = req.params.chatId;
    const { user_id, message, is_admin } = req.body;

    console.log('💬 Sending message:', { chatId, user_id, message, is_admin });

    if (!message || !user_id) {
        return res.status(400).json({
            success: false,
            error: 'Message and user_id are required'
        });
    }

    try {
        // Get user name
        const userResult = await pool.query(
            'SELECT first_name FROM user_profiles WHERE user_id = $1',
            [user_id]
        );
        
        const userName = userResult.rows.length > 0 
            ? userResult.rows[0].first_name 
            : (is_admin ? 'Администратор' : `User_${user_id}`);

        // Save message
        const result = await pool.query(`
            INSERT INTO messages (chat_id, user_id, message, is_admin) 
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [chatId, user_id, message, is_admin || false]);

        console.log('✅ Message sent successfully');

        res.json({
            success: true,
            message: 'Message sent',
            messageId: result.rows[0].id
        });
    } catch (error) {
        console.error('❌ Send message error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка отправки сообщения'
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
            SELECT sc.*, 
                   (SELECT message FROM messages WHERE chat_id = sc.id ORDER BY sent_at DESC LIMIT 1) as last_message,
                   (SELECT sent_at FROM messages WHERE chat_id = sc.id ORDER BY sent_at DESC LIMIT 1) as last_message_time
            FROM support_chats sc
            ORDER BY last_message_time DESC NULLS LAST
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

// Posts endpoints (simple version)
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
            posts: [] // Return empty array instead of error
        });
    }
});

app.post('/api/posts', async (req, res) => {
    const { title, content, author, authorId } = req.body;
    
    if (!title || !content) {
        return res.status(400).json({
            success: false,
            error: 'Title and content are required'
        });
    }
    
    try {
        const result = await pool.query(`
            INSERT INTO posts (title, content, author, author_id) 
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [title, content, author || 'Администратор', authorId]);
        
        res.json({
            success: true,
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

// Start task for user (simplified)
app.post('/api/user/tasks/start', async (req, res) => {
    const { userId, taskId } = req.body;
    
    if (!userId || !taskId) {
        return res.status(400).json({
            success: false,
            error: 'User ID and Task ID are required'
        });
    }
    
    try {
        // In a real app, you would create a user_task record
        // For now, we'll just return success
        res.json({
            success: true,
            message: 'Task started successfully'
        });
    } catch (error) {
        console.error('Start task error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error'
        });
    }
});

// Main route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔐 Admin ID: ${ADMIN_ID}`);
});