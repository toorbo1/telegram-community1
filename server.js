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
    ssl: { rejectUnauthorized: false }
});

const ADMIN_ID = 8036875641;

// 🔧 ВСЕ ЗАПРОСЫ ИСПРАВЛЕНЫ - убраны problem columns

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
    
    if (!user) {
        return res.status(400).json({ success: false, error: 'Missing user data' });
    }
    
    try {
        const isAdmin = parseInt(user.id) === ADMIN_ID;
        
        const result = await pool.query(`
            INSERT INTO user_profiles (user_id, username, first_name, last_name, photo_url, is_admin) 
            VALUES ($1, $2, $3, $4, $5, $6)
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
            user.first_name || 'User',
            user.last_name || '',
            user.photo_url || '',
            isAdmin
        ]);
        
        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
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
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        res.json({ success: true, profile: result.rows[0] });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// Get tasks - FIXED QUERY
app.get('/api/tasks', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, title, description, price, category, time_to_complete, difficulty, created_at
            FROM tasks 
            WHERE status = 'active' 
            ORDER BY created_at DESC
        `);
        
        res.json({ success: true, tasks: result.rows });
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// Get user tasks - FIXED QUERY (без task_url)
app.get('/api/user/:userId/tasks', async (req, res) => {
    const { status } = req.query;
    
    try {
        let query = `
            SELECT ut.*, t.title, t.description, t.price, t.category
            FROM user_tasks ut 
            JOIN tasks t ON ut.task_id = t.id 
            WHERE ut.user_id = $1
        `;
        let params = [req.params.userId];
        
        if (status) {
            query += " AND ut.status = $2";
            params.push(status);
        }
        
        query += " ORDER BY ut.started_at DESC";
        
        const result = await pool.query(query, params);
        res.json({ success: true, tasks: result.rows });
    } catch (error) {
        console.error('Get user tasks error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// Start task
app.post('/api/user/tasks/start', async (req, res) => {
    const { userId, taskId } = req.body;
    
    try {
        const result = await pool.query(`
            INSERT INTO user_tasks (user_id, task_id, status) 
            VALUES ($1, $2, 'active')
            RETURNING *
        `, [userId, taskId]);
        
        res.json({ success: true, userTaskId: result.rows[0].id });
    } catch (error) {
        console.error('Start task error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// Get posts
app.get('/api/posts', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM posts 
            ORDER BY created_at DESC
        `);
        
        res.json({ success: true, posts: result.rows });
    } catch (error) {
        console.error('Get posts error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// Create post (admin only)
app.post('/api/posts', async (req, res) => {
    const { title, content, author, authorId } = req.body;
    
    if (parseInt(authorId) !== ADMIN_ID) {
        return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    try {
        const result = await pool.query(`
            INSERT INTO posts (title, content, author, author_id) 
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [title, content, author, authorId]);
        
        res.json({ success: true, post: result.rows[0] });
    } catch (error) {
        console.error('Create post error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// Support chats
app.get('/api/support/chats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM support_chats 
            ORDER BY last_message_time DESC
        `);
        
        res.json({ success: true, chats: result.rows });
    } catch (error) {
        console.error('Get chats error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// Main route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
});