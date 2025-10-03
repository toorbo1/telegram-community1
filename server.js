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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use(express.static('.'));

// Initialize database
const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initDatabase();
    }
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
            level INTEGER DEFAULT 0,
            experience INTEGER DEFAULT 0,
            tasks_completed INTEGER DEFAULT 0,
            active_tasks INTEGER DEFAULT 0,
            quality_rate REAL DEFAULT 100,
            referral_count INTEGER DEFAULT 0,
            referral_earned REAL DEFAULT 0,
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
            completed_at DATETIME,
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
    });
}

const ADMIN_ID = 8036875641;

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

// User profile endpoints
app.post('/api/user/auth', (req, res) => {
    const { user } = req.body;
    
    if (!user) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    const userProfile = {
        user_id: user.id,
        username: user.username || `user_${user.id}`,
        first_name: user.first_name || 'Пользователь',
        last_name: user.last_name || '',
        photo_url: user.photo_url || '',
        isAdmin: parseInt(user.id) === ADMIN_ID
    };
    
    // Сохраняем или обновляем профиль пользователя
    db.run(`INSERT OR REPLACE INTO user_profiles 
            (user_id, username, first_name, last_name, photo_url, updated_at) 
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [userProfile.user_id, userProfile.username, userProfile.first_name, 
             userProfile.last_name, userProfile.photo_url],
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
                return res.status(500).json({
                    success: false,
                    error: 'Database error'
                });
            }
            
            res.json({
                success: true,
                user: {
                    ...userProfile,
                    balance: profile.balance || 0,
                    level: profile.level || 0,
                    experience: profile.experience || 0,
                    tasks_completed: profile.tasks_completed || 0,
                    active_tasks: profile.active_tasks || 0,
                    quality_rate: profile.quality_rate || 0,
                    referral_count: profile.referral_count || 0,
                    referral_earned: profile.referral_earned || 0
                }
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

// Posts endpoints
app.get('/api/posts', (req, res) => {
    db.all("SELECT * FROM posts ORDER BY timestamp DESC", (err, rows) => {
        if (err) {
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        // Форматируем время для каждого поста
        const postsWithMoscowTime = rows.map(post => ({
            ...post,
            moscow_time: formatMoscowTime(post.timestamp)
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
    
    db.run(`INSERT INTO posts (title, content, author, authorId, isAdmin, image_url) 
            VALUES (?, ?, ?, ?, 1, ?)`,
            [title, content, author, authorId, image_url],
            function(err) {
        if (err) {
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
        
        // Форматируем время для каждого чата
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
            // Форматируем время для чата
            res.json({
                success: true,
                chat: {
                    ...chat,
                    moscow_time: formatMoscowTimeShort(chat.last_message_time)
                }
            });
        } else {
            console.log(`📝 Creating new chat for user: ${userId}`);
            
            // Создаем новый чат
            const userName = `User_${userId}`;
            const userUsername = `user_${userId}`;
            
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
                
                // Получаем созданный чат
                db.get("SELECT * FROM support_chats WHERE id = ?", [newChatId], (err, newChat) => {
                    if (err) {
                        console.error('❌ Error fetching new chat:', err);
                        return res.status(500).json({
                            success: false,
                            error: 'Database error: ' + err.message
                        });
                    }
                    
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
                    
                    res.json({
                        success: true,
                        chat: {
                            ...newChat,
                            moscow_time: formatMoscowTimeShort(newChat.last_message_time)
                        }
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

        // Форматируем время для каждого сообщения
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
                // Продолжаем с исходными данными если ошибка
                saveMessage(chatId, user_id, user_name, message, image_url, is_admin, res);
            } else if (userProfile) {
                // Используем актуальные данные из профиля
                const actualUserName = userProfile.first_name + (userProfile.last_name ? ' ' + userProfile.last_name : '');
                const actualUserUsername = userProfile.username;
                
                console.log(`Using actual user data: ${actualUserName} (@${actualUserUsername})`);
                
                // Обновляем имя в чате если оно изменилось
                db.run("UPDATE support_chats SET user_name = ?, user_username = ? WHERE user_id = ?", 
                    [actualUserName, actualUserUsername, user_id]);
                
                saveMessage(chatId, user_id, actualUserName, message, image_url, is_admin, res);
            } else {
                // Профиль не найден, используем исходные данные
                saveMessage(chatId, user_id, user_name, message, image_url, is_admin, res);
            }
        });
    } else {
        // Для админа используем исходные данные
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

        // Update chat last message and time
        const displayMessage = message || '📷 Фото';
        let updateQuery;
        let updateParams;

        if (is_admin) {
            // Сообщение от админа - сбрасываем счетчик непрочитанных
            updateQuery = `UPDATE support_chats SET last_message = ?, last_message_time = CURRENT_TIMESTAMP, unread_count = 0 WHERE id = ?`;
            updateParams = [displayMessage, chatId];
        } else {
            // Сообщение от пользователя - увеличиваем счетчик непрочитанных
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
        
        // Also mark messages as read
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

    // Сначала удаляем все сообщения в чате
    db.run("DELETE FROM support_messages WHERE chat_id = ?", [chatId], function(err) {
        if (err) {
            console.error('❌ Error deleting messages:', err);
            return res.status(500).json({
                success: false,
                error: 'Database error'
            });
        }
        
        console.log(`✅ Deleted ${this.changes} messages from chat ${chatId}`);
        
        // Затем удаляем сам чат
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

// Эндпоинт для архивации чата (альтернатива удалению)
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

// Withdrawal endpoints
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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔐 Admin ID: ${ADMIN_ID}`);
    console.log(`⏰ Moscow time: ${getMoscowTime()}`);
});