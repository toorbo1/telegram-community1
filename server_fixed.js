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

// 🔧 ИСПРАВЛЕННЫЕ ЭНДПОИНТЫ - убраны task_url из запросов

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'LinkGold API is running!',
        timestamp: new Date().toISOString(),
        database: 'PostgreSQL'
    });
});

// Получение заданий пользователя - ИСПРАВЛЕННЫЙ ЗАПРОС
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

// Получение всех заданий - ИСПРАВЛЕННЫЙ ЗАПРОС
app.get('/api/tasks', async (req, res) => {
    const { search, category } = req.query;
    
    try {
        let query = "SELECT * FROM tasks WHERE status = 'active'";
        let params = [];
        let paramCount = 0;

        if (search) {
            paramCount++;
            query += ` AND (title LIKE $${paramCount} OR description LIKE $${paramCount})`;
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

// Аутентификация пользователя
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
        
        // Сохраняем или обновляем пользователя
        const result = await pool.query(`
            INSERT INTO user_profiles (user_id, username, first_name, last_name, photo_url, is_admin) 
            VALUES ($1, $2, $3, $4, $5, $6)
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

// Получение постов
app.get('/api/posts', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, 
                   COUNT(CASE WHEN pl.is_like = true THEN 1 END) as likes,
                   COUNT(CASE WHEN pl.is_like = false THEN 1 END) as dislikes
            FROM posts p
            LEFT JOIN post_likes pl ON p.id = pl.post_id
            GROUP BY p.id
            ORDER BY p.created_at DESC
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

// Основной маршрут
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Fixed server running on port ${PORT}`);
});