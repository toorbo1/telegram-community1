const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files
app.use(express.static('.'));
app.use('/uploads', express.static(uploadsDir));

// Initialize database
const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Posts table
        db.run(`CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            image_url TEXT,
            author TEXT NOT NULL,
            authorId INTEGER NOT NULL,
            isAdmin BOOLEAN DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Tasks table
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL,
            time_to_complete TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            people_required INTEGER NOT NULL,
            repost_time TEXT NOT NULL,
            task_url TEXT NOT NULL,
            image_url TEXT,
            created_by INTEGER NOT NULL,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Task progress table
        db.run(`CREATE TABLE IF NOT EXISTS task_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            status TEXT NOT NULL,
            screenshot_url TEXT,
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            submitted_at DATETIME,
            completed_at DATETIME,
            FOREIGN KEY(task_id) REFERENCES tasks(id)
        )`);

        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT NOT NULL,
            first_name TEXT NOT NULL,
            photo_url TEXT,
            balance REAL DEFAULT 0,
            level INTEGER DEFAULT 0,
            completed_tasks INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    });
}

const ADMIN_ID = 8036875641;

// 🔐 Middleware для проверки прав администратора
function requireAdmin(req, res, next) {
    const { authorId } = req.body;
    
    if (!authorId || parseInt(authorId) !== ADMIN_ID) {
        return res.status(403).json({ 
            success: false,
            error: 'Access denied. Admin rights required.' 
        });
    }
    next();
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'LinkGold API is running!',
        timestamp: new Date().toISOString()
    });
});

// User management
app.post('/api/users', (req, res) => {
    const { id, username, first_name, photo_url } = req.body;
    
    db.run(`INSERT OR REPLACE INTO users (id, username, first_name, photo_url) 
            VALUES (?, ?, ?, ?)`, 
            [id, username, first_name, photo_url], 
            function(err) {
        if (err) {
            return res.status(500).json({ 
                success: false,
                error: 'Database error: ' + err.message 
            });
        }
        res.json({ 
            success: true,
            message: 'User created/updated' 
        });
    });
});

// 📝 Posts endpoints
app.get('/api/posts', (req, res) => {
    db.all("SELECT * FROM posts ORDER BY timestamp DESC", (err, rows) => {
        if (err) {
            return res.status(500).json({ 
                success: false,
                error: 'Database error' 
            });
        }
        res.json({
            success: true,
            posts: rows
        });
    });
});

app.post('/api/posts', requireAdmin, (req, res) => {
    const { title, content, image_url, author, authorId } = req.body;
    
    console.log('Creating post with data:', { title, content, author, authorId });
    
    if (!title || !content || !author) {
        return res.status(400).json({ 
            success: false,
            error: 'Missing required fields: title, content, and author are required' 
        });
    }
    
    db.run(`INSERT INTO posts (title, content, image_url, author, authorId, isAdmin) 
            VALUES (?, ?, ?, ?, ?, 1)`,
            [title, content, image_url, author, authorId],
            function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ 
                success: false,
                error: 'Database error: ' + err.message 
            });
        }
        
        console.log('Post created successfully with ID:', this.lastID);
        
        res.json({ 
            success: true,
            message: 'Post created successfully',
            post: { 
                id: this.lastID,
                title, content, image_url, author, authorId,
                timestamp: new Date().toISOString()
            }
        });
    });
});

app.delete('/api/posts/:id', requireAdmin, (req, res) => {
    db.run("DELETE FROM posts WHERE id = ?", [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ 
                success: false,
                error: 'Database error' 
            });
        }
        res.json({ 
            success: true,
            message: 'Post deleted successfully' 
        });
    });
});

// 📋 Tasks endpoints
app.get('/api/tasks', (req, res) => {
    const { status, user_id } = req.query;
    
    let query = "SELECT * FROM tasks WHERE status = 'active'";
    
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ 
                success: false,
                error: 'Database error' 
            });
        }
        res.json({
            success: true,
            tasks: rows
        });
    });
});

app.post('/api/tasks', requireAdmin, (req, res) => {
    const { 
        title, description, category, price, time_to_complete, 
        difficulty, people_required, repost_time, task_url, image_url, created_by 
    } = req.body;
    
    console.log('Creating task with data:', { 
        title, description, category, price, created_by 
    });
    
    if (!title || !description || !price) {
        return res.status(400).json({ 
            success: false,
            error: 'Missing required fields' 
        });
    }
    
    db.run(`INSERT INTO tasks (title, description, category, price, time_to_complete, 
                              difficulty, people_required, repost_time, task_url, image_url, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description, category || 'general', price, time_to_complete || '5 minutes', 
             difficulty || 'easy', people_required || 1, repost_time || '1 day', 
             task_url || '', image_url, created_by],
            function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ 
                success: false,
                error: 'Database error: ' + err.message 
            });
        }
        
        console.log('Task created successfully with ID:', this.lastID);
        
        res.json({ 
            success: true,
            message: 'Task created successfully',
            taskId: this.lastID
        });
    });
});

// Task progress endpoints
app.post('/api/tasks/:id/start', (req, res) => {
    const { user_id } = req.body;
    
    db.run(`INSERT INTO task_progress (task_id, user_id, status) 
            VALUES (?, ?, 'started')`,
            [req.params.id, user_id],
            function(err) {
        if (err) {
            return res.status(500).json({ 
                success: false,
                error: 'Database error' 
            });
        }
        res.json({ 
            success: true,
            progress_id: this.lastID 
        });
    });
});

// Admin task verification
app.get('/api/admin/task-verification', requireAdmin, (req, res) => {
    const query = `
        SELECT tp.*, t.title, t.price, u.username, u.first_name
        FROM task_progress tp
        JOIN tasks t ON tp.task_id = t.id
        JOIN users u ON tp.user_id = u.id
        WHERE tp.status = 'waiting_verification'
        ORDER BY tp.submitted_at DESC
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ 
                success: false,
                error: 'Database error' 
            });
        }
        res.json({
            success: true,
            verifications: rows
        });
    });
});

app.post('/api/admin/task-progress/:id/approve', requireAdmin, (req, res) => {
    db.serialize(() => {
        db.get(`SELECT tp.user_id, t.price FROM task_progress tp 
                JOIN tasks t ON tp.task_id = t.id 
                WHERE tp.id = ?`, [req.params.id], (err, row) => {
            if (err) {
                return res.status(500).json({ 
                    success: false,
                    error: 'Database error' 
                });
            }
            
            db.run(`UPDATE task_progress SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
                    WHERE id = ?`, [req.params.id]);
            
            db.run(`UPDATE users SET balance = balance + ?, completed_tasks = completed_tasks + 1 
                    WHERE id = ?`, [row.price, row.user_id]);
            
            db.run(`UPDATE users SET level = CAST(completed_tasks / 10 AS INTEGER) 
                    WHERE id = ?`, [row.user_id]);
            
            res.json({ 
                success: true,
                message: 'Task approved successfully' 
            });
        });
    });
});

app.post('/api/admin/task-progress/:id/reject', requireAdmin, (req, res) => {
    db.run(`UPDATE task_progress SET status = 'rejected' WHERE id = ?`,
            [req.params.id],
            function(err) {
        if (err) {
            return res.status(500).json({ 
                success: false,
                error: 'Database error' 
            });
        }
        res.json({ 
            success: true,
            message: 'Task rejected successfully' 
        });
    });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔐 Admin ID: ${ADMIN_ID}`);
});