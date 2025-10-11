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
app.use('/uploads', express.static('uploads'));

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
            level INTEGER DEFAULT 1,
            experience INTEGER DEFAULT 0,
            tasks_completed INTEGER DEFAULT 0,
            active_tasks INTEGER DEFAULT 0,
            quality_rate REAL DEFAULT 100,
            referral_count INTEGER DEFAULT 0,
            referral_earned REAL DEFAULT 0,
            is_admin BOOLEAN DEFAULT 0,
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
            author_id INTEGER NOT NULL,
            is_admin BOOLEAN DEFAULT 0,
            likes INTEGER DEFAULT 0,
            dislikes INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Post likes table
        db.run(`CREATE TABLE IF NOT EXISTS post_likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            is_like BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(post_id, user_id)
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Создаем тестовые задания если их нет
        db.get("SELECT COUNT(*) as count FROM tasks", (err, result) => {
            if (err) {
                console.error('❌ Error checking tasks:', err);
                return;
            }
            
            if (result.count === 0) {
                console.log('📝 Creating sample tasks...');
                const sampleTasks = [
                    ['Подписаться на канал', 'Подпишитесь на наш Telegram канал и оставайтесь подписанным', 50, 'subscribe', '2 минуты', 'Легкая'],
                    ['Посмотреть видео', 'Посмотрите видео до конца и поставьте лайк', 30, 'view', '5 минут', 'Легкая'],
                    ['Сделать репост', 'Сделайте репост записи к себе в канал', 70, 'repost', '3 минуты', 'Средняя']
                ];
                
                const stmt = db.prepare(`INSERT INTO tasks (title, description, price, category, time_to_complete, difficulty, created_by) 
                                        VALUES (?, ?, ?, ?, ?, ?, ?)`);
                
                sampleTasks.forEach(task => {
                    stmt.run([...task, ADMIN_ID]);
                });
                
                stmt.finalize();
                console.log('✅ Sample tasks created');
            }
        });

        // Инициализируем главного администратора
        initMainAdmin();
    });
}

const ADMIN_ID = 8036875641;

// Функция для инициализации главного администратора
function initMainAdmin() {
    const mainAdmin = {
        user_id: ADMIN_ID,
        username: 'linkgold_admin',
        first_name: 'LinkGold',
        last_name: 'Admin',
        is_admin: 1,
        balance: 0,
        level: 10
    };
    
    db.run(`INSERT OR REPLACE INTO user_profiles 
            (user_id, username, first_name, last_name, is_admin, balance, level) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [mainAdmin.user_id, mainAdmin.username, mainAdmin.first_name, 
             mainAdmin.last_name, mainAdmin.is_admin, mainAdmin.balance, mainAdmin.level],
            function(err) {
        if (err) {
            console.error('❌ Error initializing main admin:', err);
        } else {
            console.log('✅ Main admin initialized successfully');
        }
    });
}

// Вспомогательные функции
function getMoscowTime() {
    return new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
}

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

function formatMoscowTimeShort(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
        return date.toLocaleString("ru-RU", { 
            timeZone: "Europe/Moscow",
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    return date.toLocaleString("ru-RU", { 
        timeZone: "Europe/Moscow",
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 🎯 ОСНОВНЫЕ ЭНДПОИНТЫ

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'LinkGold API is running!',
        timestamp: getMoscowTime(),
        database: 'SQLite'
    });
});

// 🔐 АУТЕНТИФИКАЦИЯ И ПОЛЬЗОВАТЕЛИ
app.post('/api/user/auth', (req, res) => {
    const { user } = req.body;
    
    if (!user) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    console.log('🔐 User auth request for:', user.id, user.username);
    
    // Сначала проверяем, есть ли пользователь в базе и является ли он админом
    db.get("SELECT * FROM user_profiles WHERE user_id = ?", [user.id], (err, existingUser) => {
        if (err) {
            console.error('❌ Database error checking user:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        const isMainAdmin = parseInt(user.id) === ADMIN_ID;
        const isAdmin = isMainAdmin || (existingUser && existingUser.is_admin === 1);
        
        console.log(`👤 User ${user.id} admin status:`, { isAdmin, isMainAdmin, existingUser: existingUser?.is_admin });
        
        const userProfile = {
            user_id: user.id,
            username: user.username || `user_${user.id}`,
            first_name: user.first_name || 'Пользователь',
            last_name: user.last_name || '',
            photo_url: user.photo_url || '',
            isAdmin: isAdmin,
            isMainAdmin: isMainAdmin
        };
        
        // Сохраняем или обновляем профиль пользователя
        db.run(`INSERT OR REPLACE INTO user_profiles 
                (user_id, username, first_name, last_name, photo_url, is_admin, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [userProfile.user_id, userProfile.username, userProfile.first_name, 
                 userProfile.last_name, userProfile.photo_url, isAdmin ? 1 : 0],
                function(err) {
            if (err) {
                console.error('❌ Database error saving user:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Database error'
                });
            }
            
            // Получаем полный профиль пользователя
            db.get("SELECT * FROM user_profiles WHERE user_id = ?", [userProfile.user_id], (err, profile) => {
                if (err) {
                    console.error('❌ Database error fetching profile:', err);
                    return res.status(500).json({
                        success: false,
                        error: 'Database error'
                    });
                }
                
                const responseData = {
                    success: true,
                    user: {
                        ...userProfile,
                        balance: profile?.balance || 0,
                        level: profile?.level || 1,
                        experience: profile?.experience || 0,
                        tasks_completed: profile?.tasks_completed || 0,
                        active_tasks: profile?.active_tasks || 0,
                        quality_rate: profile?.quality_rate || 100,
                        referral_count: profile?.referral_count || 0,
                        referral_earned: profile?.referral_earned || 0
                    }
                };
                
                console.log(`✅ User ${user.id} authenticated successfully`);
                res.json(responseData);
            });
        });
    });
});

app.get('/api/user/:userId', (req, res) => {
    const userId = req.params.userId;
    
    db.get("SELECT * FROM user_profiles WHERE user_id = ?", [userId], (err, profile) => {
        if (err) {
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

// 📝 ПОСТЫ
app.get('/api/posts', (req, res) => {
    db.all(`
        SELECT p.*, 
               COUNT(CASE WHEN pl.is_like = 1 THEN 1 END) as likes,
               COUNT(CASE WHEN pl.is_like = 0 THEN 1 END) as dislikes
        FROM posts p
        LEFT JOIN post_likes pl ON p.id = pl.post_id
        GROUP BY p.id
        ORDER BY p.created_at DESC
    `, (err, rows) => {
        if (err) {
            console.error('Get posts error:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        const postsWithMoscowTime = rows.map(post => ({
            ...post,
            moscow_time: formatMoscowTime(post.created_at)
        }));
        
        res.json({
            success: true,
            posts: postsWithMoscowTime
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
    
    db.run(`INSERT INTO posts (title, content, author, author_id, is_admin, image_url) 
            VALUES (?, ?, ?, ?, 1, ?)`,
            [title, content, author, authorId, image_url],
            function(err) {
        if (err) {
            console.error('Create post error:', err);
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

// Лайки и дизлайки постов
app.post('/api/posts/:postId/like', (req, res) => {
    const postId = req.params.postId;
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'User ID is required'
        });
    }

    db.serialize(() => {
        // Удаляем существующие лайки/дизлайки пользователя
        db.run("DELETE FROM post_likes WHERE post_id = ? AND user_id = ?", [postId, userId], function(err) {
            if (err) {
                console.error('Error removing existing like:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Database error'
                });
            }
            
            // Добавляем лайк
            db.run("INSERT INTO post_likes (post_id, user_id, is_like) VALUES (?, ?, 1)", [postId, userId], function(err) {
                if (err) {
                    console.error('Error adding like:', err);
                    return res.status(500).json({
                        success: false,
                        error: 'Database error'
                    });
                }
                
                // Получаем обновленные счетчики
                db.get(`
                    SELECT 
                        COUNT(CASE WHEN is_like = 1 THEN 1 END) as likes,
                        COUNT(CASE WHEN is_like = 0 THEN 1 END) as dislikes
                    FROM post_likes 
                    WHERE post_id = ?
                `, [postId], (err, result) => {
                    if (err) {
                        console.error('Error getting like counts:', err);
                        return res.status(500).json({
                            success: false,
                            error: 'Database error'
                        });
                    }
                    
                    res.json({
                        success: true,
                        likes: result.likes || 0,
                        dislikes: result.dislikes || 0
                    });
                });
            });
        });
    });
});

app.post('/api/posts/:postId/dislike', (req, res) => {
    const postId = req.params.postId;
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'User ID is required'
        });
    }

    db.serialize(() => {
        // Удаляем существующие лайки/дизлайки пользователя
        db.run("DELETE FROM post_likes WHERE post_id = ? AND user_id = ?", [postId, userId], function(err) {
            if (err) {
                console.error('Error removing existing dislike:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Database error'
                });
            }
            
            // Добавляем дизлайк
            db.run("INSERT INTO post_likes (post_id, user_id, is_like) VALUES (?, ?, 0)", [postId, userId], function(err) {
                if (err) {
                    console.error('Error adding dislike:', err);
                    return res.status(500).json({
                        success: false,
                        error: 'Database error'
                    });
                }
                
                // Получаем обновленные счетчики
                db.get(`
                    SELECT 
                        COUNT(CASE WHEN is_like = 1 THEN 1 END) as likes,
                        COUNT(CASE WHEN is_like = 0 THEN 1 END) as dislikes
                    FROM post_likes 
                    WHERE post_id = ?
                `, [postId], (err, result) => {
                    if (err) {
                        console.error('Error getting dislike counts:', err);
                        return res.status(500).json({
                            success: false,
                            error: 'Database error'
                        });
                    }
                    
                    res.json({
                        success: true,
                        likes: result.likes || 0,
                        dislikes: result.dislikes || 0
                    });
                });
            });
        });
    });
});

// 📋 ЗАДАНИЯ
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
            console.error('Get tasks error:', err);
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

// 👤 ЗАДАНИЯ ПОЛЬЗОВАТЕЛЯ - ИСПРАВЛЕННАЯ ВЕРСИЯ
app.post('/api/user/tasks/start', (req, res) => {
    const { userId, taskId } = req.body;
    
    console.log('🚀 Starting task:', { userId, taskId });
    
    if (!userId || !taskId) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: userId and taskId'
        });
    }
    
    // Проверяем существование пользователя
    db.get("SELECT user_id FROM user_profiles WHERE user_id = ?", [userId], (err, user) => {
        if (err) {
            console.error('❌ Database error checking user:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found. Please authenticate first.'
            });
        }
        
        // Проверяем существование задания
        db.get("SELECT id, title FROM tasks WHERE id = ? AND status = 'active'", [taskId], (err, task) => {
            if (err) {
                console.error('❌ Database error checking task:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Database error'
                });
            }
            
            if (!task) {
                return res.status(404).json({
                    success: false,
                    error: 'Task not found or inactive'
                });
            }
            
            // Проверяем, не начал ли пользователь уже это задание
            db.get("SELECT id FROM user_tasks WHERE user_id = ? AND task_id = ? AND status IN ('active', 'pending_review')", 
                  [userId, taskId], (err, existingTask) => {
                if (err) {
                    console.error('❌ Database error checking existing task:', err);
                    return res.status(500).json({
                        success: false,
                        error: 'Database error'
                    });
                }
                
                if (existingTask) {
                    return res.status(400).json({
                        success: false,
                        error: 'Task already started'
                    });
                }
                
                // Добавляем задание пользователю
                db.run(`INSERT INTO user_tasks (user_id, task_id, status) VALUES (?, ?, 'active')`,
                        [userId, taskId], function(err) {
                    if (err) {
                        console.error('❌ Database error starting task:', err);
                        return res.status(500).json({
                            success: false,
                            error: 'Database error'
                        });
                    }
                    
                    // Обновляем счетчик активных заданий
                    db.run("UPDATE user_profiles SET active_tasks = COALESCE(active_tasks, 0) + 1 WHERE user_id = ?", [userId]);
                    
                    console.log(`✅ Task started successfully: user ${userId}, task ${taskId}, userTaskId ${this.lastID}`);
                    
                    res.json({
                        success: true,
                        message: 'Task started successfully',
                        userTaskId: this.lastID
                    });
                });
            });
        });
    });
});

app.get('/api/user/:userId/tasks', (req, res) => {
    const userId = req.params.userId;
    const { status } = req.query;
    
    let query = `
        SELECT ut.*, t.title, t.description, t.price, t.category
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
            console.error('Get user tasks error:', err);
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
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        db.all(`SELECT ut.*, t.title, t.description, t.price, t.category
        FROM user_tasks ut 
        JOIN tasks t ON ut.task_id = t.id 
        WHERE ut.user_id = ?`, [userId], (err, rows) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    error: 'Database error'
                });
            }
            
            if (!row) {
                return res.status(404).json({
                    success: false,
                    error: 'Task not found'
                });
            }
            
            // Создаем запись в task_verifications
            const userName = `${row.first_name} ${row.last_name || ''}`.trim();
            db.run(`INSERT INTO task_verifications (user_task_id, user_id, task_id, user_name, task_title, task_price, screenshot_url) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [userTaskId, row.user_id, row.task_id, userName, row.title, row.price, screenshotUrl],
                    function(err) {
                if (err) {
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

// ✅ ВЕРИФИКАЦИЯ ЗАДАНИЙ (АДМИН)
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
            error: 'Доступ запрещен'
        });
    }

    // Валидация
    if (!verificationId || !adminId) {
        return res.status(400).json({
            success: false,
            error: 'Отсутствуют обязательные параметры'
        });
    }

    console.log(`🔍 Начинаем одобрение верификации: ${verificationId}`);

    db.serialize(() => {
        // Получаем информацию о верификации
        db.get("SELECT * FROM task_verifications WHERE id = ?", [verificationId], (err, verification) => {
            if (err) {
                console.error('❌ Ошибка базы данных:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Ошибка базы данных'
                });
            }
            
            if (!verification) {
                console.error('❌ Верификация не найдена:', verificationId);
                return res.status(404).json({
                    success: false,
                    error: 'Верификация не найдена'
                });
            }
            
            console.log(`📋 Найдена верификация:`, verification);
            
            // Проверяем, что задание еще не обработано
            if (verification.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: `Задание уже обработано. Статус: ${verification.status}`
                });
            }

            // Проверяем сумму
            if (!verification.task_price || verification.task_price <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Неверная сумма задания'
                });
            }
            
            // Обновляем статус верификации
            db.run(`UPDATE task_verifications SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? 
                    WHERE id = ?`, [adminId, verificationId], function(err) {
                if (err) {
                    console.error('❌ Ошибка обновления верификации:', err);
                    return res.status(500).json({
                        success: false,
                        error: 'Ошибка обновления статуса верификации'
                    });
                }
                
                // Обновляем user_task
                db.run(`UPDATE user_tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
                        WHERE id = ?`, [verification.user_task_id], function(err) {
                    if (err) {
                        console.error('❌ Ошибка обновления user_task:', err);
                        return res.status(500).json({
                            success: false,
                            error: 'Ошибка обновления задания пользователя'
                        });
                    }
                    
                    // Обновляем баланс пользователя и статистику
                    db.run(`UPDATE user_profiles 
                            SET balance = COALESCE(balance, 0) + ?, 
                                tasks_completed = COALESCE(tasks_completed, 0) + 1,
                                active_tasks = COALESCE(active_tasks, 0) - 1,
                                experience = COALESCE(experience, 0) + 10,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE user_id = ?`, 
                            [verification.task_price, verification.user_id], function(err) {
                        if (err) {
                            console.error('❌ Ошибка обновления баланса:', err);
                            return res.status(500).json({
                                success: false,
                                error: 'Ошибка обновления баланса пользователя'
                            });
                        }
                        
                        console.log(`✅ Пользователь ${verification.user_id} получил ${verification.task_price} ★ за задание ${verification.task_id}`);
                        
                        res.json({
                            success: true,
                            message: 'Задание одобрено и баланс пользователя обновлен',
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
            error: 'Доступ запрещен'
        });
    }

    db.run(`UPDATE task_verifications SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? 
            WHERE id = ?`, [adminId, verificationId], function(err) {
        if (err) {
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        // Обновляем user_task
        db.get("SELECT user_task_id FROM task_verifications WHERE id = ?", [verificationId], (err, row) => {
            if (err) {
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

// 💬 СИСТЕМА ПОДДЕРЖКИ
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
        
        const chatsWithMoscowTime = rows.map(chat => ({
            ...chat,
            moscow_time: formatMoscowTimeShort(chat.last_message_time)
        }));
        
        res.json({
            success: true,
            chats: chatsWithMoscowTime
        });
    });
});

// Получение или создание чата для пользователя
app.get('/api/support/user-chat/:userId', (req, res) => {
    const userId = req.params.userId;
    
    console.log(`🔍 Getting user chat for user ID: ${userId}`);

    // Сначала проверяем существующий чат
    db.get("SELECT * FROM support_chats WHERE user_id = ?", [userId], (err, chat) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error: ' + err.message
            });
        }

        if (chat) {
            console.log(`✅ Found existing chat: ${chat.id}`);
            res.json({
                success: true,
                chat: {
                    ...chat,
                    moscow_time: formatMoscowTimeShort(chat.last_message_time)
                }
            });
        } else {
            console.log(`📝 Creating new chat for user: ${userId}`);
            
            // Получаем данные пользователя
            db.get("SELECT first_name, last_name, username FROM user_profiles WHERE user_id = ?", [userId], (err, user) => {
                let userName = `User_${userId}`;
                let userUsername = `user_${userId}`;
                
                if (user) {
                    userName = `${user.first_name} ${user.last_name || ''}`.trim();
                    userUsername = user.username || userUsername;
                }
                
                // Создаем новый чат
                db.run(`INSERT INTO support_chats (user_id, user_name, user_username, last_message, last_message_time) 
                        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                        [userId, userName, userUsername, 'Чат создан'], function(err) {
                    if (err) {
                        console.error('❌ Error creating chat:', err);
                        return res.status(500).json({
                            success: false,
                            error: 'Database error: ' + err.message
                        });
                    }
                    
                    const newChatId = this.lastID;
                    console.log(`✅ Created new chat with ID: ${newChatId}`);
                    
                    // Создаем приветственное сообщение от админа
                    db.run(`INSERT INTO support_messages (chat_id, user_id, user_name, message, is_admin, is_read) 
                            VALUES (?, ?, ?, ?, 1, 1)`,
                            [newChatId, ADMIN_ID, 'Администратор LinkGold', 'Здравствуйте! Чем могу помочь?'], function(err) {
                        if (err) {
                            console.error('❌ Error creating welcome message:', err);
                        } else {
                            console.log(`✅ Created welcome message for chat ${newChatId}`);
                        }
                    });
                    
                    // Получаем созданный чат
                    db.get("SELECT * FROM support_chats WHERE id = ?", [newChatId], (err, newChat) => {
                        if (err) {
                            console.error('❌ Error fetching new chat:', err);
                            return res.status(500).json({
                                success: false,
                                error: 'Database error: ' + err.message
                            });
                        }
                        
                        res.json({
                            success: true,
                            chat: {
                                ...newChat,
                                moscow_time: formatMoscowTimeShort(newChat.last_message_time)
                            }
                        });
                    });
                });
            });
        }
    });
});

// Получение сообщений чата
app.get('/api/support/chats/:chatId/messages', (req, res) => {
    const chatId = req.params.chatId;
    
    console.log(`📨 Loading messages for chat ${chatId}`);
    
    db.all("SELECT * FROM support_messages WHERE chat_id = ? ORDER BY sent_at ASC", [chatId], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }

        const messagesWithMoscowTime = rows.map(message => ({
            ...message,
            moscow_time: formatMoscowTimeShort(message.sent_at)
        }));

        console.log(`✅ Loaded ${messagesWithMoscowTime.length} messages for chat ${chatId}`);
        
        res.json({
            success: true,
            messages: messagesWithMoscowTime
        });
    });
});

app.post('/api/support/chats/:chatId/messages', (req, res) => {
    const chatId = req.params.chatId;
    const { user_id, user_name, message, image_url, is_admin } = req.body;

    if (!message && !image_url) {
        return res.status(400).json({
            success: false,
            error: 'Message or image is required'
        });
    }

    console.log(`💬 Saving message for chat ${chatId}:`, { 
        user_id, user_name, 
        message: message ? message.substring(0, 50) + '...' : 'IMAGE', 
        is_admin 
    });

    // Для сообщений от пользователей - получаем актуальные данные из профиля
    if (!is_admin) {
        db.get("SELECT first_name, last_name, username FROM user_profiles WHERE user_id = ?", [user_id], (err, userProfile) => {
            if (err) {
                console.error('Error fetching user profile:', err);
                saveMessage(chatId, user_id, user_name, message, image_url, is_admin, res);
            } else if (userProfile) {
                const actualUserName = userProfile.first_name + (userProfile.last_name ? ' ' + userProfile.last_name : '');
                const actualUserUsername = userProfile.username;
                
                console.log(`Using actual user data: ${actualUserName} (@${actualUserUsername})`);
                
                // Обновляем имя в чате если оно изменилось
                db.run("UPDATE support_chats SET user_name = ?, user_username = ? WHERE user_id = ?", 
                    [actualUserName, actualUserUsername, user_id]);
                
                saveMessage(chatId, user_id, actualUserName, message, image_url, is_admin, res);
            } else {
                saveMessage(chatId, user_id, user_name, message, image_url, is_admin, res);
            }
        });
    } else {
        saveMessage(chatId, user_id, user_name, message, image_url, is_admin, res);
    }
});

// Вынесенная функция сохранения сообщения
function saveMessage(chatId, user_id, user_name, message, image_url, is_admin, res) {
    db.run(`INSERT INTO support_messages (chat_id, user_id, user_name, message, image_url, is_admin) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [chatId, user_id, user_name, message, image_url, is_admin],
            function(err) {
        if (err) {
            console.error('❌ Error saving message:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error: ' + err.message
            });
        }

        const displayMessage = message || '📷 Фото';
        let updateQuery;
        let updateParams;

        if (is_admin) {
            updateQuery = `UPDATE support_chats SET last_message = ?, last_message_time = CURRENT_TIMESTAMP, unread_count = 0 WHERE id = ?`;
            updateParams = [displayMessage, chatId];
        } else {
            updateQuery = `UPDATE support_chats SET last_message = ?, last_message_time = CURRENT_TIMESTAMP, unread_count = unread_count + 1 WHERE id = ?`;
            updateParams = [displayMessage, chatId];
        }
        
        db.run(updateQuery, updateParams, function(updateErr) {
            if (updateErr) {
                console.error('❌ Error updating chat:', updateErr);
            } else {
                console.log(`✅ Chat ${chatId} updated successfully`);
            }
        });

        res.json({
            success: true,
            message: 'Message sent',
            messageId: this.lastID
        });
    });
}

app.put('/api/support/chats/:chatId/read', (req, res) => {
    const chatId = req.params.chatId;

    db.run("UPDATE support_chats SET unread_count = 0 WHERE id = ?", [chatId], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        db.run("UPDATE support_messages SET is_read = 1 WHERE chat_id = ? AND is_admin = 0", [chatId]);
        
        res.json({
            success: true,
            message: 'Chat marked as read'
        });
    });
});

// Эндпоинт для удаления чата админом
app.delete('/api/support/chats/:chatId', (req, res) => {
    const chatId = req.params.chatId;
    const { adminId } = req.body;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

    console.log(`🗑️ Admin ${adminId} deleting chat ${chatId}`);

    db.run("DELETE FROM support_messages WHERE chat_id = ?", [chatId], function(err) {
        if (err) {
            console.error('❌ Error deleting messages:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        console.log(`✅ Deleted ${this.changes} messages from chat ${chatId}`);
        
        db.run("DELETE FROM support_chats WHERE id = ?", [chatId], function(chatErr) {
            if (chatErr) {
                console.error('❌ Error deleting chat:', chatErr);
                return res.status(500).json({
                    success: false,
                    error: 'Database error'
                });
            }
            
            console.log(`✅ Chat ${chatId} deleted successfully`);
            
            res.json({
                success: true,
                message: 'Chat deleted successfully',
                deletedMessages: this.changes
            });
        });
    });
});

// Эндпоинт для архивации чата
app.put('/api/support/chats/:chatId/archive', (req, res) => {
    const chatId = req.params.chatId;
    const { adminId } = req.body;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

    db.run("UPDATE support_chats SET is_active = 0 WHERE id = ?", [chatId], function(err) {
        if (err) {
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        res.json({
            success: true,
            message: 'Chat archived successfully'
        });
    });
});

// Эндпоинт для восстановления чата из архива
app.put('/api/support/chats/:chatId/restore', (req, res) => {
    const chatId = req.params.chatId;
    const { adminId } = req.body;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

    db.run("UPDATE support_chats SET is_active = 1 WHERE id = ?", [chatId], function(err) {
        if (err) {
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        res.json({
            success: true,
            message: 'Chat restored successfully'
        });
    });
});

// Эндпоинт для получения архивных чатов
app.get('/api/support/archived-chats', (req, res) => {
    const { adminId } = req.query;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

    db.all(`SELECT * FROM support_chats WHERE is_active = 0 ORDER BY last_message_time DESC`, 
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

// Эндпоинт для получения всех чатов
app.get('/api/support/all-chats', (req, res) => {
    const { adminId } = req.query;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

    db.all(`SELECT * FROM support_chats ORDER BY last_message_time DESC`, 
            [], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        const chatsWithMoscowTime = rows.map(chat => ({
            ...chat,
            moscow_time: formatMoscowTimeShort(chat.last_message_time)
        }));
        
        res.json({
            success: true,
            chats: chatsWithMoscowTime
        });
    });
});

app.get('/api/support/chats/:chatId', (req, res) => {
    const chatId = req.params.chatId;
    const { adminId } = req.query;
    
    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

    db.get("SELECT * FROM support_chats WHERE id = ?", [chatId], (err, chat) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        if (!chat) {
            return res.status(404).json({
                success: false,
                error: 'Chat not found'
            });
        }
        
        res.json({
            success: true,
            chat: {
                ...chat,
                moscow_time: formatMoscowTimeShort(chat.last_message_time)
            }
        });
    });
});

// 💳 ВЫВОД СРЕДСТВ
app.post('/api/withdrawal/request', (req, res) => {
    const { user_id, amount, method, details } = req.body;
    
    if (!user_id || !amount || !method || !details) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    db.run(`INSERT INTO withdrawal_requests (user_id, amount, method, details) 
            VALUES (?, ?, ?, ?)`,
            [user_id, amount, method, details],
            function(err) {
        if (err) {
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        res.json({
            success: true,
            message: 'Withdrawal request submitted successfully',
            requestId: this.lastID
        });
    });
});

app.get('/api/withdraw/history/:userId', (req, res) => {
    const userId = req.params.userId;
    
    db.all("SELECT * FROM withdrawal_requests WHERE user_id = ? ORDER BY created_at DESC", [userId], (err, rows) => {
        if (err) {
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        res.json({
            success: true,
            operations: rows
        });
    });
});

// 🔧 ЭНДПОИНТЫ ДЛЯ УПРАВЛЕНИЯ АДМИНАМИ
app.get('/api/admin/admins', (req, res) => {
    const { adminId } = req.query;
    
    console.log('🔍 GET /api/admin/admins called with adminId:', adminId);
    
    if (!adminId || parseInt(adminId) !== ADMIN_ID) {
        console.log('❌ Access denied for adminId:', adminId);
        return res.status(403).json({
            success: false,
            error: 'Access denied. Only main admin can manage admins.'
        });
    }

    db.all("SELECT user_id, username, first_name, last_name FROM user_profiles WHERE is_admin = 1", (err, rows) => {
        if (err) {
            console.error('❌ Database error in /api/admin/admins:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        console.log(`✅ Found ${rows.length} admins`);
        res.json({
            success: true,
            admins: rows || []
        });
    });
});

app.post('/api/admin/admins', (req, res) => {
    const { adminId, username } = req.body;
    
    console.log('🔍 POST /api/admin/admins called with:', { adminId, username });
    
    if (!adminId || parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied. Only main admin can add admins.'
        });
    }

    if (!username) {
        return res.status(400).json({
            success: false,
            error: 'Username is required'
        });
    }

    const cleanUsername = username.replace('@', '').trim();
    const tempUserId = Date.now();
    
    db.run(`INSERT OR REPLACE INTO user_profiles 
            (user_id, username, first_name, last_name, is_admin, updated_at) 
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [tempUserId, cleanUsername, cleanUsername, '', 1],
            function(err) {
        if (err) {
            console.error('❌ Error creating admin user:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }

        console.log(`✅ User ${cleanUsername} promoted to admin`);
        
        res.json({
            success: true,
            message: 'Пользователь успешно добавлен как администратор!',
            admin: {
                user_id: tempUserId,
                username: cleanUsername,
                first_name: cleanUsername,
                last_name: ''
            }
        });
    });
});

app.delete('/api/admin/admins/:userId', (req, res) => {
    const { adminId } = req.body;
    const userId = req.params.userId;
    
    console.log('🔍 DELETE /api/admin/admins called with:', { adminId, userId });
    
    if (!adminId || parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({
            success: false,
            error: 'Access denied. Only main admin can remove admins.'
        });
    }

    if (parseInt(userId) === ADMIN_ID) {
        return res.status(400).json({
            success: false,
            error: 'Нельзя удалить главного администратора'
        });
    }

    db.run("UPDATE user_profiles SET is_admin = 0 WHERE user_id = ?", [userId], function(err) {
        if (err) {
            console.error('❌ Error removing admin:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }

        console.log(`✅ Admin ${userId} removed`);
        
        res.json({
            success: true,
            message: 'Администратор успешно удален!'
        });
    });
});

// 🩺 ДИАГНОСТИЧЕСКИЕ ЭНДПОИНТЫ
app.get('/api/debug/tasks', (req, res) => {
    console.log('🔧 Debug: Checking tasks in database...');
    
    db.all("SELECT * FROM tasks", (err, tasks) => {
        if (err) {
            console.error('❌ Debug tasks error:', err);
            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
        
        db.all("SELECT user_id, username, is_admin FROM user_profiles LIMIT 5", (err, users) => {
            if (err) {
                console.error('❌ Debug users error:', err);
                return res.status(500).json({
                    success: false,
                    error: err.message
                });
            }
            
            res.json({
                success: true,
                tasks: tasks,
                users: users,
                totalTasks: tasks.length,
                totalUsers: users.length
            });
        });
    });
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Добавьте обработку ошибок для multer
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File too large. Maximum size is 10MB.'
            });
        }
    }
    next(error);
});

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
    console.log(`🗄️ Database: SQLite (${dbPath})`);
});