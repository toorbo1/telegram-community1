const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('.'));

// Initialize database
const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Create tables
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
        category TEXT DEFAULT 'general',
        price REAL NOT NULL,
        time_to_complete TEXT,
        difficulty TEXT,
        people_required INTEGER DEFAULT 1,
        repost_time TEXT,
        task_url TEXT,
        image_url TEXT,
        created_by INTEGER NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

const ADMIN_ID = 8036875641;

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'LinkGold API is running!',
        timestamp: new Date().toISOString()
    });
});

// Posts endpoints
app.get('/api/posts', (req, res) => {
    console.log('GET /api/posts request received');
    
    db.all("SELECT * FROM posts ORDER BY timestamp DESC", (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ 
                success: false,
                error: 'Database error' 
            });
        }
        console.log(`Returning ${rows.length} posts`);
        res.json({ 
            success: true,
            posts: rows 
        });
    });
});

app.post('/api/posts', (req, res) => {
    console.log('POST /api/posts request received:', req.body);
    
    const { title, content, author, authorId } = req.body;
    
    if (!title || !content || !author) {
        console.log('Missing required fields');
        return res.status(400).json({ 
            success: false,
            error: 'Missing required fields' 
        });
    }
    
    // Check admin rights
    if (parseInt(authorId) !== ADMIN_ID) {
        console.log('Access denied for user:', authorId);
        return res.status(403).json({ 
            success: false,
            error: 'Access denied' 
        });
    }
    
    db.run(`INSERT INTO posts (title, content, author, authorId, isAdmin) 
            VALUES (?, ?, ?, ?, 1)`,
            [title, content, author, authorId],
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
            postId: this.lastID
        });
    });
});

app.delete('/api/posts/:id', (req, res) => {
    const { authorId } = req.body;
    
    if (parseInt(authorId) !== ADMIN_ID) {
        return res.status(403).json({ 
            success: false,
            error: 'Access denied' 
        });
    }

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

// Tasks endpoints
app.get('/api/tasks', (req, res) => {
    console.log('GET /api/tasks request received');
    
    db.all("SELECT * FROM tasks WHERE status = 'active'", (err, rows) => {
        if (err) {
            console.error('Database error:', err);
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

app.post('/api/tasks', (req, res) => {
    console.log('POST /api/tasks request received:', req.body);
    
    const { 
        title, description, price, created_by,
        time_to_complete, difficulty, people_required, repost_time, task_url 
    } = req.body;
    
    if (!title || !description || !price || !created_by) {
        console.log('Missing required fields');
        return res.status(400).json({ 
            success: false,
            error: 'Missing required fields' 
        });
    }
    
    // Check admin rights
    if (parseInt(created_by) !== ADMIN_ID) {
        console.log('Access denied for user:', created_by);
        return res.status(403).json({ 
            success: false,
            error: 'Access denied' 
        });
    }
    
    db.run(`INSERT INTO tasks (title, description, price, created_by, 
                              time_to_complete, difficulty, people_required, repost_time, task_url) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description, price, created_by,
             time_to_complete, difficulty, people_required, repost_time, task_url],
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

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle 404
app.use((req, res) => {
    res.status(404).json({ 
        success: false,
        error: 'Endpoint not found' 
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔐 Admin ID: ${ADMIN_ID}`);
});