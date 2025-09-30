const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Логирование всех запросов
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Инициализация SQLite базы
const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
// остальной код без изменений
// остальной код без изменений
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Создаем таблицу постов
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        author TEXT NOT NULL,
        authorId INTEGER NOT NULL,
        isAdmin BOOLEAN DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating table:', err);
        } else {
            console.log('Posts table ready');
        }
    });
});

// Роуты
// Получить все посты
app.get('/api/posts', (req, res) => {
    console.log('GET /api/posts request');
    
    db.all("SELECT * FROM posts ORDER BY timestamp DESC", (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        console.log(`Returning ${rows.length} posts`);
        res.json(rows);
    });
});

// Добавить новый пост
app.post('/api/posts', (req, res) => {
    console.log('POST /api/posts request:', req.body);
    
    const { content, author, authorId, isAdmin } = req.body;
    
    if (!content || !author || !authorId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const stmt = db.prepare("INSERT INTO posts (content, author, authorId, isAdmin) VALUES (?, ?, ?, ?)");
    stmt.run([content, author, authorId, isAdmin ? 1 : 0], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        const newPost = {
            id: this.lastID,
            content,
            author,
            authorId,
            isAdmin: !!isAdmin,
            timestamp: new Date().toISOString()
        };
        
        console.log('Post created:', newPost);
        res.status(201).json(newPost);
    });
    stmt.finalize();
});

// Удалить пост (только админ)
app.delete('/api/posts/:id', (req, res) => {
    const { authorId } = req.body;
    
    if (authorId !== 8036875641) {
        return res.status(403).json({ error: 'Access denied' });
    }

    db.run("DELETE FROM posts WHERE id = ?", [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Post deleted' });
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Telegram Community API is running!',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({ 
        message: 'Telegram Community API',
        endpoints: {
            health: '/api/health',
            getPosts: 'GET /api/posts',
            createPost: 'POST /api/posts',
            deletePost: 'DELETE /api/posts/:id'
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});