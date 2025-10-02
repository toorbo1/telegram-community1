const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
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

    // Task submissions for verification
    db.run(`CREATE TABLE IF NOT EXISTS task_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        user_name TEXT NOT NULL,
        screenshot_url TEXT,
        status TEXT DEFAULT 'pending',
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewed_by INTEGER,
        reviewed_at DATETIME,
        rejection_reason TEXT,
        FOREIGN KEY(task_id) REFERENCES tasks(id)
    )`);

    // Support chats
    db.run(`CREATE TABLE IF NOT EXISTS support_chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        user_name TEXT NOT NULL,
        last_message TEXT,
        last_message_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        unread_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1
    )`);

    // Support messages
    db.run(`CREATE TABLE IF NOT EXISTS support_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        sender_name TEXT NOT NULL,
        message TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT 0,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(chat_id) REFERENCES support_chats(id)
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
    
    const { title, content, author, authorId, image_url } = req.body;
    
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
    
    db.run(`INSERT INTO posts (title, content, author, authorId, isAdmin, image_url) 
            VALUES (?, ?, ?, ?, 1, ?)`,
            [title, content, author, authorId, image_url],
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
        title, description, price, created_by, category,
        time_to_complete, difficulty, people_required, repost_time, task_url, image_url
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
    
    db.run(`INSERT INTO tasks (title, description, price, created_by, category,
                              time_to_complete, difficulty, people_required, repost_time, task_url, image_url) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description, price, created_by, category,
             time_to_complete, difficulty, people_required, repost_time, task_url, image_url],
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

app.delete('/api/tasks/:id', (req, res) => {
    const { adminId } = req.body;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({ 
            success: false,
            error: 'Access denied' 
        });
    }

    db.run("DELETE FROM tasks WHERE id = ?", [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ 
                success: false,
                error: 'Database error' 
            });
        }
        res.json({ 
            success: true,
            message: 'Task deleted successfully' 
        });
    });
});

// Task verification endpoints
app.post('/api/task-submissions', (req, res) => {
    const { task_id, user_id, user_name, screenshot_url } = req.body;
    
    if (!task_id || !user_id || !user_name) {
        return res.status(400).json({ 
            success: false,
            error: 'Missing required fields' 
        });
    }

    db.run(`INSERT INTO task_submissions (task_id, user_id, user_name, screenshot_url) 
            VALUES (?, ?, ?, ?)`,
            [task_id, user_id, user_name, screenshot_url],
            function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ 
                success: false,
                error: 'Database error: ' + err.message 
            });
        }
        
        res.json({ 
            success: true,
            message: 'Task submitted for review',
            submissionId: this.lastID
        });
    });
});

app.get('/api/task-submissions', (req, res) => {
    const { adminId } = req.query;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({ 
            success: false,
            error: 'Access denied' 
        });
    }

    db.all(`SELECT ts.*, t.title as task_title, t.price 
            FROM task_submissions ts 
            JOIN tasks t ON ts.task_id = t.id 
            WHERE ts.status = 'pending'
            ORDER BY ts.submitted_at DESC`, 
            [], (err, rows) => {
        if (err) {
            return res.status(500).json({ 
                success: false,
                error: 'Database error' 
            });
        }
        res.json({ 
            success: true,
            submissions: rows 
        });
    });
});

app.put('/api/task-submissions/:id', (req, res) => {
    const { adminId, status, rejection_reason } = req.body;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({ 
            success: false,
            error: 'Access denied' 
        });
    }

    db.run(`UPDATE task_submissions 
            SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, rejection_reason = ?
            WHERE id = ?`,
            [status, ADMIN_ID, rejection_reason, req.params.id],
            function(err) {
        if (err) {
            return res.status(500).json({ 
                success: false,
                error: 'Database error' 
            });
        }
        res.json({ 
            success: true,
            message: `Task submission ${status} successfully` 
        });
    });
});

// Support system endpoints
app.get('/api/support/chats', (req, res) => {
    const { adminId } = req.query;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({ 
            success: false,
            error: 'Access denied' 
        });
    }

    db.all(`SELECT * FROM support_chats WHERE is_active = 1 ORDER BY last_message_time DESC`, 
            [], (err, rows) => {
        if (err) {
            return res.status(500).json({ 
                success: false,
                error: 'Database error' 
            });
        }
        res.json({ 
            success: true,
            chats: rows 
        });
    });
});

app.get('/api/support/chats/:userId', (req, res) => {
    const userId = req.params.userId;

    db.get("SELECT * FROM support_chats WHERE user_id = ?", [userId], (err, chat) => {
        if (err) {
            return res.status(500).json({ 
                success: false,
                error: 'Database error' 
            });
        }

        if (!chat) {
            // Create new chat if doesn't exist
            db.run(`INSERT INTO support_chats (user_id, user_name) VALUES (?, ?)`,
                    [userId, `User_${userId}`], function(err) {
                if (err) {
                    return res.status(500).json({ 
                        success: false,
                        error: 'Database error' 
                    });
                }
                db.get("SELECT * FROM support_chats WHERE id = ?", [this.lastID], (err, newChat) => {
                    if (err) {
                        return res.status(500).json({ 
                            success: false,
                            error: 'Database error' 
                        });
                    }
                    res.json({ 
                        success: true,
                        chat: newChat 
                    });
                });
            });
        } else {
            res.json({ 
                success: true,
                chat: chat 
            });
        }
    });
});

app.get('/api/support/chats/:chatId/messages', (req, res) => {
    const chatId = req.params.chatId;

    db.all(`SELECT * FROM support_messages WHERE chat_id = ? ORDER BY sent_at ASC`, 
            [chatId], (err, rows) => {
        if (err) {
            return res.status(500).json({ 
                success: false,
                error: 'Database error' 
            });
        }
        res.json({ 
            success: true,
            messages: rows 
        });
    });
});

app.post('/api/support/chats/:chatId/messages', (req, res) => {
    const chatId = req.params.chatId;
    const { sender_id, sender_name, message, is_admin } = req.body;

    if (!message) {
        return res.status(400).json({ 
            success: false,
            error: 'Message is required' 
        });
    }

    db.run(`INSERT INTO support_messages (chat_id, sender_id, sender_name, message, is_admin) 
            VALUES (?, ?, ?, ?, ?)`,
            [chatId, sender_id, sender_name, message, is_admin],
            function(err) {
        if (err) {
            return res.status(500).json({ 
                success: false,
                error: 'Database error' 
            });
        }

        // Update chat last message and time
        db.run(`UPDATE support_chats 
                SET last_message = ?, last_message_time = CURRENT_TIMESTAMP, unread_count = unread_count + 1
                WHERE id = ?`,
                [message, chatId]);

        res.json({ 
            success: true,
            message: 'Message sent',
            messageId: this.lastID
        });
    });
});

app.put('/api/support/chats/:chatId/read', (req, res) => {
    const chatId = req.params.chatId;

    db.run("UPDATE support_chats SET unread_count = 0 WHERE id = ?", [chatId], function(err) {
        if (err) {
            return res.status(500).json({ 
                success: false,
                error: 'Database error' 
            });
        }
        res.json({ 
            success: true,
            message: 'Chat marked as read' 
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