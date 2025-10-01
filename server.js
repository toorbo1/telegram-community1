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

// Раздаем статические файлы (фронтенд)
app.use(express.static('.'));

// Инициализация SQLite базы
const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Создаем таблицы
db.serialize(() => {
    // Таблица постов
    db.run(`CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        author TEXT NOT NULL,
        authorId INTEGER NOT NULL,
        isAdmin BOOLEAN DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating posts table:', err);
        } else {
            console.log('Posts table ready');
        }
    });

    // Таблица чатов
    db.run(`CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        user_name TEXT NOT NULL,
        last_message TEXT,
        unread BOOLEAN DEFAULT 1,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating chats table:', err);
        } else {
            console.log('Chats table ready');
        }
    });

    // Таблица сообщений
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(chat_id) REFERENCES chats(id)
    )`, (err) => {
        if (err) {
            console.error('Error creating messages table:', err);
        } else {
            console.log('Messages table ready');
        }
    });
});

const ADMIN_ID = 8036875641;

// API Роуты
// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'LinkGold API is running!',
        timestamp: new Date().toISOString()
    });
});

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
    
    if (authorId !== ADMIN_ID) {
        return res.status(403).json({ error: 'Access denied' });
    }

    db.run("DELETE FROM posts WHERE id = ?", [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Post deleted' });
    });
});

// Получить все чаты (для админа)
app.get('/api/chats', (req, res) => {
    db.all("SELECT * FROM chats ORDER BY last_activity DESC", (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// Для корневого пути - отдаем index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});