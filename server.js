const express = require('express');
const sqlite3 = require('sqlite3').verbose();
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

// Путь к базе данных
const dbPath = path.join(__dirname, 'database.db');

// Инициализация базы данных
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Ошибка подключения к базе данных:', err.message);
        return;
    }
    console.log('✅ Подключено к SQLite базе данных');
    initDatabase();
});

// Обработка ошибок базы данных
db.on('error', (err) => {
    console.error('❌ Ошибка базы данных:', err);
});

const ADMIN_ID = 8036875641;

// Initialize database tables
function initDatabase() {
    db.serialize(() => {
        // User profiles table
        db.run(`CREATE TABLE IF NOT EXISTS user_profiles (
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            photo_url TEXT,
            balance REAL DEFAULT 0,
            level INTEGER DEFAULT 0,
            experience INTEGER DEFAULT 0,
            tasks_completed INTEGER DEFAULT 0,
            active_tasks INTEGER DEFAULT 0,
            quality_rate REAL DEFAULT 100,
            referral_count INTEGER DEFAULT 0,
            referral_earned REAL DEFAULT 0,
            is_admin BOOLEAN DEFAULT 0,
            is_main_admin BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

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

        // User tasks table
        db.run(`CREATE TABLE IF NOT EXISTS user_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            task_id INTEGER NOT NULL,
            status TEXT DEFAULT 'active',
            screenshot_url TEXT,
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            submitted_at DATETIME,
            completed_at DATETIME,
            rejected_at DATETIME,
            rejection_reason TEXT,
            FOREIGN KEY(task_id) REFERENCES tasks(id)
        )`);

        // Support chats table
        db.run(`CREATE TABLE IF NOT EXISTS support_chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            user_name TEXT NOT NULL,
            user_username TEXT,
            last_message TEXT,
            last_message_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            unread_count INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Support messages table
        db.run(`CREATE TABLE IF NOT EXISTS support_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            user_name TEXT NOT NULL,
            message TEXT NOT NULL,
            image_url TEXT,
            is_admin BOOLEAN DEFAULT 0,
            is_read BOOLEAN DEFAULT 0,
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(chat_id) REFERENCES support_chats(id)
        )`);

        // Withdrawal requests table
        db.run(`CREATE TABLE IF NOT EXISTS withdrawal_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            method TEXT NOT NULL,
            details TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Task verification table
        db.run(`CREATE TABLE IF NOT EXISTS task_verifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_task_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            task_id INTEGER NOT NULL,
            user_name TEXT NOT NULL,
            task_title TEXT NOT NULL,
            task_price REAL NOT NULL,
            screenshot_url TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            reviewed_at DATETIME,
            reviewed_by INTEGER,
            FOREIGN KEY(user_task_id) REFERENCES user_tasks(id)
        )`);

        // Убедимся, что главный админ существует
        db.get("SELECT * FROM user_profiles WHERE user_id = ?", [ADMIN_ID], (err, row) => {
            if (err) {
                console.error('Error checking main admin:', err);
                return;
            }
            
            if (!row) {
                console.log('Creating main admin user...');
                db.run(`INSERT INTO user_profiles (user_id, username, first_name, last_name, is_admin, is_main_admin) 
                        VALUES (?, ?, ?, ?, 1, 1)`,
                        [ADMIN_ID, 'linkgold_admin', 'LinkGold', 'Admin'], function(err) {
                    if (err) {
                        console.error('Error creating main admin:', err);
                    } else {
                        console.log('Main admin created successfully');
                    }
                });
            } else {
                // Обновляем существующего пользователя до главного админа
                db.run("UPDATE user_profiles SET is_admin = 1, is_main_admin = 1 WHERE user_id = ?", [ADMIN_ID]);
                console.log('Main admin verified');
            }
        });
    });
}

// Функция для получения московского времени
function getMoscowTime() {
    return new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
}

// Функция для форматирования времени в московском часовом поясе
function formatMoscowTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString("ru-RU", { 
        timeZone: "Europe/Moscow",
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Функция для форматирования времени в коротком формате (для чатов)
function formatMoscowTimeShort(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Если сообщение сегодняшнее - показываем только время
    if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
        return date.toLocaleString("ru-RU", { 
            timeZone: "Europe/Moscow",
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    // Иначе показываем дату и время
    return date.toLocaleString("ru-RU", { 
        timeZone: "Europe/Moscow",
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'LinkGold API is running!',
        timestamp: getMoscowTime()
    });
});

// Эндпоинты для управления админами
app.get('/api/admin/admins', (req, res) => {
    const { adminId } = req.query;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

    db.all("SELECT user_id, username, first_name, last_name, is_admin, is_main_admin FROM user_profiles WHERE is_admin = 1", [], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        res.json({
            success: true,
            admins: rows
        });
    });
});

app.post('/api/admin/admins', (req, res) => {
    const { adminId, username } = req.body;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

    if (!username) {
        return res.status(400).json({
            success: false,
            error: 'Username is required'
        });
    }

    // Ищем пользователя по username
    const cleanUsername = username.replace('@', ''); // Убираем @ если есть
    db.get("SELECT * FROM user_profiles WHERE username = ?", [cleanUsername], (err, user) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Проверяем, не является ли пользователь уже админом
        if (user.is_admin) {
            return res.status(400).json({
                success: false,
                error: 'User is already an admin'
            });
        }

        // Делаем пользователя админом
        db.run("UPDATE user_profiles SET is_admin = 1 WHERE user_id = ?", [user.user_id], function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Database error'
                });
            }

            res.json({
                success: true,
                message: 'User promoted to admin successfully',
                admin: {
                    user_id: user.user_id,
                    username: user.username,
                    first_name: user.first_name,
                    last_name: user.last_name
                }
            });
        });
    });
});

app.delete('/api/admin/admins/:userId', (req, res) => {
    const { adminId } = req.body;
    const userId = req.params.userId;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

    // Не позволяем удалить главного админа
    if (parseInt(userId) === ADMIN_ID) {
        return res.status(400).json({
            success: false,
            error: 'Cannot remove main admin'
        });
    }

    db.run("UPDATE user_profiles SET is_admin = 0 WHERE user_id = ?", [userId], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }

        res.json({
            success: true,
            message: 'Admin removed successfully'
        });
    });
});

// User profile endpoints
app.post('/api/user/auth', (req, res) => {
    const { user } = req.body;
    
    if (!user) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    const isMainAdmin = parseInt(user.id) === ADMIN_ID;
    
    const userProfile = {
        user_id: user.id,
        username: user.username || `user_${user.id}`,
        first_name: user.first_name || 'Пользователь',
        last_name: user.last_name || '',
        photo_url: user.photo_url || '',
        isAdmin: false,
        isMainAdmin: isMainAdmin
    };
    
    // Сначала проверяем существующего пользователя
    db.get("SELECT * FROM user_profiles WHERE user_id = ?", [user.id], (err, existingUser) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        // Определяем, является ли пользователь админом
        if (existingUser) {
            userProfile.isAdmin = Boolean(existingUser.is_admin) || isMainAdmin;
        } else {
            userProfile.isAdmin = isMainAdmin;
        }
        
        // Сохраняем или обновляем профиль пользователя
        db.run(`INSERT OR REPLACE INTO user_profiles 
                (user_id, username, first_name, last_name, photo_url, is_admin, is_main_admin, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [userProfile.user_id, userProfile.username, userProfile.first_name, 
                 userProfile.last_name, userProfile.photo_url, userProfile.isAdmin ? 1 : 0, isMainAdmin ? 1 : 0],
                function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Database error'
                });
            }
            
            // Получаем полный профиль пользователя
            db.get("SELECT * FROM user_profiles WHERE user_id = ?", [userProfile.user_id], (err, profile) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({
                        success: false,
                        error: 'Database error'
                    });
                }
                
                const responseUser = {
                    ...userProfile,
                    balance: profile.balance || 0,
                    level: profile.level || 0,
                    experience: profile.experience || 0,
                    tasks_completed: profile.tasks_completed || 0,
                    active_tasks: profile.active_tasks || 0,
                    quality_rate: profile.quality_rate || 0,
                    referral_count: profile.referral_count || 0,
                    referral_earned: profile.referral_earned || 0
                };
                
                res.json({
                    success: true,
                    user: responseUser
                });
            });
        });
    });
});

app.get('/api/user/:userId', (req, res) => {
    const userId = req.params.userId;
    
    db.get("SELECT * FROM user_profiles WHERE user_id = ?", [userId], (err, profile) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        res.json({
            success: true,
            profile: profile
        });
    });
});

// Posts endpoints
app.get('/api/posts', (req, res) => {
    db.all("SELECT * FROM posts ORDER BY timestamp DESC", (err, rows) => {
        if (err) {
            console.error('Database error:', err);
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

app.post('/api/posts', (req, res) => {
    const { title, content, author, authorId, image_url } = req.body;
    
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
            console.error('Database error:', err);
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
    const { search, category } = req.query;
    let query = "SELECT * FROM tasks WHERE status = 'active'";
    let params = [];

    if (search) {
        query += " AND (title LIKE ? OR description LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
    }

    if (category && category !== 'all') {
        query += " AND category = ?";
        params.push(category);
    }

    query += " ORDER BY created_at DESC";

    db.all(query, params, (err, rows) => {
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

app.get('/api/admin/tasks', (req, res) => {
    const { adminId } = req.query;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

    db.all("SELECT * FROM tasks ORDER BY created_at DESC", (err, rows) => {
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
    const { 
        title, description, price, created_by, category,
        time_to_complete, difficulty, people_required, repost_time, task_url, image_url
    } = req.body;
    
    console.log('Creating task with data:', req.body);
    
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
    
    db.run(`INSERT INTO tasks (title, description, price, created_by, category,
                              time_to_complete, difficulty, people_required, repost_time, task_url, image_url) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description, parseFloat(price), created_by, category || 'general',
             time_to_complete || '5 минут', difficulty || 'Легкая', 
             people_required || 1, repost_time || '1 день', task_url || '', image_url || ''],
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
            console.error('Database error:', err);
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

// User tasks endpoints
app.post('/api/user/tasks/start', (req, res) => {
    const { userId, taskId } = req.body;
    
    if (!userId || !taskId) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    // Проверяем, не начал ли пользователь уже это задание
    db.get("SELECT * FROM user_tasks WHERE user_id = ? AND task_id = ?", [userId, taskId], (err, existing) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        if (existing) {
            return res.status(400).json({
                success: false,
                error: 'Task already started'
            });
        }
        
        // Добавляем задание пользователю
        db.run(`INSERT INTO user_tasks (user_id, task_id, status) VALUES (?, ?, 'active')`,
                [userId, taskId], function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Database error'
                });
            }
            
            // Обновляем счетчик активных заданий
            db.run("UPDATE user_profiles SET active_tasks = active_tasks + 1 WHERE user_id = ?", [userId]);
            
            res.json({
                success: true,
                message: 'Task started successfully',
                userTaskId: this.lastID
            });
        });
    });
});

app.get('/api/user/:userId/tasks', (req, res) => {
    const userId = req.params.userId;
    const { status } = req.query;
    
    let query = `
        SELECT ut.*, t.title, t.description, t.price, t.category, t.task_url
        FROM user_tasks ut 
        JOIN tasks t ON ut.task_id = t.id 
        WHERE ut.user_id = ?
    `;
    let params = [userId];
    
    if (status) {
        query += " AND ut.status = ?";
        params.push(status);
    }
    
    query += " ORDER BY ut.started_at DESC";
    
    db.all(query, params, (err, rows) => {
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

// Submit task for verification
app.post('/api/user/tasks/:userTaskId/submit', upload.single('screenshot'), (req, res) => {
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
    
    // Обновляем user_task
    db.run(`UPDATE user_tasks SET status = 'pending_review', screenshot_url = ?, submitted_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [screenshotUrl, userTaskId], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        // Получаем информацию о задании и пользователе для verification
        db.get(`SELECT ut.user_id, ut.task_id, u.first_name, u.last_name, t.title, t.price 
                FROM user_tasks ut 
                JOIN user_profiles u ON ut.user_id = u.user_id 
                JOIN tasks t ON ut.task_id = t.id 
                WHERE ut.id = ?`, [userTaskId], (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Database error'
                });
            }
            
            // Создаем запись в task_verifications
            const userName = `${row.first_name} ${row.last_name}`;
            db.run(`INSERT INTO task_verifications (user_task_id, user_id, task_id, user_name, task_title, task_price, screenshot_url) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [userTaskId, row.user_id, row.task_id, userName, row.title, row.price, screenshotUrl],
                    function(err) {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({
                        success: false,
                        error: 'Database error'
                    });
                }
                
                res.json({
                    success: true,
                    message: 'Task submitted for review',
                    verificationId: this.lastID
                });
            });
        });
    });
});

// Cancel task (user didn't complete it)
app.post('/api/user/tasks/:userTaskId/cancel', (req, res) => {
    const userTaskId = req.params.userTaskId;
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'Missing user ID'
        });
    }
    
    db.run("DELETE FROM user_tasks WHERE id = ? AND user_id = ?", [userTaskId, userId], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        // Обновляем счетчик активных заданий
        db.run("UPDATE user_profiles SET active_tasks = active_tasks - 1 WHERE user_id = ?", [userId]);
        
        res.json({
            success: true,
            message: 'Task cancelled successfully'
        });
    });
});

// Task verification endpoints for admin
app.get('/api/admin/task-verifications', (req, res) => {
    const { adminId } = req.query;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

    db.all(`SELECT tv.*, u.username, u.photo_url 
            FROM task_verifications tv 
            JOIN user_profiles u ON tv.user_id = u.user_id 
            WHERE tv.status = 'pending' 
            ORDER BY tv.submitted_at DESC`, 
            [], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
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

app.post('/api/admin/task-verifications/:verificationId/approve', (req, res) => {
    const verificationId = req.params.verificationId;
    const { adminId } = req.body;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

    // Валидация
    if (!verificationId || !adminId) {
        return res.status(400).json({
            success: false,
            error: 'Missing required parameters'
        });
    }

    console.log(`Approving verification: ${verificationId}`);

    db.serialize(() => {
        // Получаем информацию о верификации
        db.get("SELECT * FROM task_verifications WHERE id = ?", [verificationId], (err, verification) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Database error'
                });
            }
            
            if (!verification) {
                return res.status(404).json({
                    success: false,
                    error: 'Verification not found'
                });
            }
            
            // Проверяем, что задание еще не обработано
            if (verification.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: `Task already processed. Status: ${verification.status}`
                });
            }

            // Обновляем статус верификации
            db.run(`UPDATE task_verifications SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? 
                    WHERE id = ?`, [adminId, verificationId], function(err) {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({
                        success: false,
                        error: 'Database error updating verification'
                    });
                }
                
                // Обновляем user_task
                db.run(`UPDATE user_tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
                        WHERE id = ?`, [verification.user_task_id], function(err) {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({
                            success: false,
                            error: 'Database error updating user task'
                        });
                    }
                    
                    // Обновляем баланс пользователя и статистику
                    db.run(`UPDATE user_profiles 
                            SET balance = balance + ?, 
                                tasks_completed = tasks_completed + 1,
                                active_tasks = active_tasks - 1,
                                experience = experience + 10,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE user_id = ?`, 
                            [verification.task_price, verification.user_id], function(err) {
                        if (err) {
                            console.error('Database error:', err);
                            return res.status(500).json({
                                success: false,
                                error: 'Database error updating user balance'
                            });
                        }
                        
                        console.log(`User ${verification.user_id} received ${verification.task_price} for task ${verification.task_id}`);
                        
                        res.json({
                            success: true,
                            message: 'Task approved and user balance updated',
                            amountAdded: verification.task_price
                        });
                    });
                });
            });
        });
    });
});

app.post('/api/admin/task-verifications/:verificationId/reject', (req, res) => {
    const verificationId = req.params.verificationId;
    const { adminId } = req.body;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

    db.run(`UPDATE task_verifications SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? 
            WHERE id = ?`, [adminId, verificationId], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        // Обновляем user_task
        db.get("SELECT user_task_id FROM task_verifications WHERE id = ?", [verificationId], (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Database error'
                });
            }
            
            if (row) {
                db.run(`UPDATE user_tasks SET status = 'rejected', rejected_at = CURRENT_TIMESTAMP 
                        WHERE id = ?`, [row.user_task_id]);
            }
        });
        
        res.json({
            success: true,
            message: 'Task rejected successfully'
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
            console.error('Database error:', err);
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

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Основной маршрут для HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔐 Admin ID: ${ADMIN_ID}`);
    console.log(`⏰ Moscow time: ${getMoscowTime()}`);
    console.log(`📁 Uploads directory: ${path.join(__dirname, 'uploads')}`);
});