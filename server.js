const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { Pool } = require('pg');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
app.use('/uploads', express.static('uploads'));

const ADMIN_ID = 8036875641;

// PostgreSQL подключение
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Инициализация базы данных
async function initDatabase() {
  try {
    // Создаем таблицы если их нет
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT PRIMARY KEY,
        username VARCHAR(100),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        photo_url TEXT,
        balance INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        experience INTEGER DEFAULT 0,
        tasks_completed INTEGER DEFAULT 0,
        active_tasks INTEGER DEFAULT 0,
        quality_rate REAL DEFAULT 100,
        referral_count INTEGER DEFAULT 0,
        referral_earned INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        category VARCHAR(50) DEFAULT 'general',
        price INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_tasks (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        task_id INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        screenshot_url TEXT,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        submitted_at TIMESTAMP,
        completed_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS task_verifications (
        id SERIAL PRIMARY KEY,
        user_task_id INTEGER NOT NULL,
        user_id BIGINT NOT NULL,
        task_id INTEGER NOT NULL,
        user_name VARCHAR(200) NOT NULL,
        task_title VARCHAR(500) NOT NULL,
        task_price INTEGER NOT NULL,
        screenshot_url TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP,
        reviewed_by BIGINT,
        FOREIGN KEY (user_task_id) REFERENCES user_tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS support_chats (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        user_name VARCHAR(200) NOT NULL,
        last_message TEXT,
        last_message_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        unread_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS support_messages (
        id SERIAL PRIMARY KEY,
        chat_id INTEGER NOT NULL,
        user_id BIGINT NOT NULL,
        user_name VARCHAR(200) NOT NULL,
        message TEXT,
        is_admin BOOLEAN DEFAULT false,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES support_chats(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        content TEXT NOT NULL,
        author VARCHAR(200) NOT NULL,
        author_id BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS withdrawal_operations (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        username VARCHAR(100) NOT NULL,
        amount INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'processing',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Создаем несколько тестовых заданий если их нет
    const tasksCount = await pool.query('SELECT COUNT(*) FROM tasks');
    if (parseInt(tasksCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO tasks (title, description, price, category) VALUES
        ('Подписаться на канал', 'Подпишитесь на наш Telegram канал и оставайтесь подписанным', 50, 'subscribe'),
        ('Посмотреть видео', 'Посмотрите видео до конца и поставьте лайк', 30, 'view'),
        ('Сделать репост', 'Сделайте репост записи к себе в канал', 70, 'repost')
      `);
    }

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
}

// Настройка загрузки файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = 'uploads';
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir);
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'screenshot-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// 🔧 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
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

// 🎯 ОСНОВНЫЕ ЭНДПОИНТЫ

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'LinkGold API is running with PostgreSQL!',
    timestamp: new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })
  });
});

// Аутентификация пользователя
app.post('/api/user/auth', async (req, res) => {
  try {
    const { user } = req.body;
    
    if (!user) {
      return res.json({ success: false, error: 'Missing user data' });
    }
    
    const query = `
      INSERT INTO users (id, username, first_name, last_name, photo_url)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) 
      DO UPDATE SET 
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name, 
        last_name = EXCLUDED.last_name,
        photo_url = EXCLUDED.photo_url,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      user.id,
      user.username || `user_${user.id}`,
      user.first_name || 'Пользователь',
      user.last_name || '',
      user.photo_url || ''
    ];

    const result = await pool.query(query, values);
    res.json({ success: true, user: result.rows[0] });
    
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Получение данных пользователя
app.get('/api/user/:userId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.userId]);
    
    if (result.rows.length === 0) {
      return res.json({ success: false, error: 'User not found' });
    }
    
    res.json({ success: true, profile: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Получение заданий
app.get('/api/tasks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks WHERE status = $1 ORDER BY created_at DESC', ['active']);
    res.json({ success: true, tasks: result.rows });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Создание задания (админ)
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, description, price, created_by } = req.body;
    
    if (parseInt(created_by) !== ADMIN_ID) {
      return res.json({ success: false, error: 'Access denied' });
    }
    
    const result = await pool.query(
      'INSERT INTO tasks (title, description, price, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, description, price, created_by]
    );
    
    res.json({ success: true, taskId: result.rows[0].id, message: 'Task created successfully' });
    
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Начало задания пользователем
app.post('/api/user/tasks/start', async (req, res) => {
  try {
    const { userId, taskId } = req.body;
    
    // Создаем запись о задании пользователя
    const result = await pool.query(
      'INSERT INTO user_tasks (user_id, task_id) VALUES ($1, $2) RETURNING *',
      [userId, taskId]
    );
    
    // Обновляем счетчик активных заданий
    await pool.query(
      'UPDATE users SET active_tasks = active_tasks + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );
    
    res.json({ success: true, userTaskId: result.rows[0].id, message: 'Task started successfully' });
    
  } catch (error) {
    console.error('Start task error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Получение заданий пользователя
app.get('/api/user/:userId/tasks', async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT ut.*, t.title, t.description, t.price, t.category 
      FROM user_tasks ut 
      JOIN tasks t ON ut.task_id = t.id 
      WHERE ut.user_id = $1
    `;
    const values = [req.params.userId];

    if (status) {
      query += ' AND ut.status = $2';
      values.push(status);
    }

    query += ' ORDER BY ut.started_at DESC';

    const result = await pool.query(query, values);
    res.json({ success: true, tasks: result.rows });
  } catch (error) {
    console.error('Get user tasks error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Отправка скриншота задания
app.post('/api/user/tasks/:userTaskId/submit', upload.single('screenshot'), async (req, res) => {
  try {
    const userTaskId = req.params.userTaskId;
    const { userId } = req.body;
    
    if (!req.file) {
      return res.json({ success: false, error: 'No screenshot uploaded' });
    }
    
    const screenshotUrl = `/uploads/${req.file.filename}`;
    
    // Обновляем задание пользователя
    await pool.query(
      'UPDATE user_tasks SET status = $1, screenshot_url = $2, submitted_at = CURRENT_TIMESTAMP WHERE id = $3',
      ['pending_review', screenshotUrl, userTaskId]
    );
    
    // Получаем данные для верификации
    const userTaskResult = await pool.query(
      `SELECT ut.*, t.title, t.price, u.first_name, u.last_name 
       FROM user_tasks ut 
       JOIN tasks t ON ut.task_id = t.id 
       JOIN users u ON ut.user_id = u.id 
       WHERE ut.id = $1`,
      [userTaskId]
    );
    
    const userTask = userTaskResult.rows[0];
    if (!userTask) {
      return res.json({ success: false, error: 'Task not found' });
    }
    
    // Создаем верификацию
    const verificationResult = await pool.query(
      `INSERT INTO task_verifications 
       (user_task_id, user_id, task_id, user_name, task_title, task_price, screenshot_url) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [
        userTaskId,
        userId,
        userTask.task_id,
        `${userTask.first_name} ${userTask.last_name || ''}`.trim(),
        userTask.title,
        userTask.price,
        screenshotUrl
      ]
    );
    
    res.json({ success: true, verificationId: verificationResult.rows[0].id, message: 'Screenshot submitted for review' });
    
  } catch (error) {
    console.error('Submit task error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Получение верификаций (админ)
app.get('/api/admin/task-verifications', async (req, res) => {
  try {
    const { adminId } = req.query;
    
    if (parseInt(adminId) !== ADMIN_ID) {
      return res.json({ success: false, error: 'Access denied' });
    }
    
    const result = await pool.query(
      'SELECT * FROM task_verifications WHERE status = $1 ORDER BY submitted_at DESC',
      ['pending']
    );
    
    res.json({ success: true, verifications: result.rows });
    
  } catch (error) {
    console.error('Get verifications error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Одобрение верификации (админ)
app.post('/api/admin/task-verifications/:verificationId/approve', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { adminId } = req.body;
    
    if (parseInt(adminId) !== ADMIN_ID) {
      throw new Error('Access denied');
    }

    // Получаем верификацию
    const verificationResult = await client.query(
      'SELECT * FROM task_verifications WHERE id = $1 FOR UPDATE',
      [req.params.verificationId]
    );
    
    const verification = verificationResult.rows[0];
    if (!verification) {
      throw new Error('Verification not found');
    }

    // Обновляем верификацию
    await client.query(
      'UPDATE task_verifications SET status = $1, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $2 WHERE id = $3',
      ['approved', adminId, req.params.verificationId]
    );

    // Обновляем задание пользователя
    await client.query(
      'UPDATE user_tasks SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['completed', verification.user_task_id]
    );

    // Обновляем баланс пользователя
    await client.query(
      `UPDATE users 
       SET balance = balance + $1, 
           tasks_completed = tasks_completed + 1,
           active_tasks = active_tasks - 1,
           experience = experience + 10,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [verification.task_price, verification.user_id]
    );

    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: `Task approved! User received ${verification.task_price} stars`,
      amountAdded: verification.task_price
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Approve verification error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Система поддержки
app.get('/api/support/user-chat/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Получаем пользователя
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.json({ success: false, error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Ищем существующий чат
    let chatResult = await pool.query(
      'SELECT * FROM support_chats WHERE user_id = $1 AND is_active = true',
      [userId]
    );
    
    let chat = chatResult.rows[0];
    
    if (!chat) {
      // Создаем новый чат
      chatResult = await pool.query(
        `INSERT INTO support_chats (user_id, user_name, last_message) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [userId, `${user.first_name} ${user.last_name || ''}`.trim(), 'Чат создан']
      );
      chat = chatResult.rows[0];
    }
    
    res.json({ success: true, chat });
    
  } catch (error) {
    console.error('Get support chat error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.get('/api/support/chats/:chatId/messages', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM support_messages WHERE chat_id = $1 ORDER BY sent_at ASC',
      [req.params.chatId]
    );
    
    res.json({ success: true, messages: result.rows });
  } catch (error) {
    console.error('Get support messages error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.post('/api/support/chats/:chatId/messages', async (req, res) => {
  try {
    const { user_id, user_name, message, is_admin } = req.body;
    
    const result = await pool.query(
      `INSERT INTO support_messages (chat_id, user_id, user_name, message, is_admin) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [req.params.chatId, user_id, user_name, message, is_admin]
    );

    // Обновляем последнее сообщение в чате
    await pool.query(
      'UPDATE support_chats SET last_message = $1, last_message_time = CURRENT_TIMESTAMP WHERE id = $2',
      [message, req.params.chatId]
    );

    res.json({ success: true, messageId: result.rows[0].id });
    
  } catch (error) {
    console.error('Create support message error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Посты
app.get('/api/posts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM posts ORDER BY created_at DESC');
    res.json({ success: true, posts: result.rows });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.post('/api/posts', async (req, res) => {
  try {
    const { title, content, author, authorId } = req.body;
    
    if (parseInt(authorId) !== ADMIN_ID) {
      return res.json({ success: false, error: 'Access denied' });
    }
    
    await pool.query(
      'INSERT INTO posts (title, content, author, author_id) VALUES ($1, $2, $3, $4)',
      [title, content, author, authorId]
    );
    
    res.json({ success: true, message: 'Post created successfully' });
    
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Вывод средств
app.post('/api/withdrawal/request', async (req, res) => {
  try {
    const { user_id, amount } = req.body;
    
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [user_id]);
    if (userResult.rows.length === 0) {
      return res.json({ success: false, error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    if (user.balance < amount) {
      return res.json({ success: false, error: 'Insufficient balance' });
    }
    
    // Создаем операцию вывода
    const operationResult = await pool.query(
      'INSERT INTO withdrawal_operations (user_id, username, amount) VALUES ($1, $2, $3) RETURNING *',
      [user_id, user.username, amount]
    );
    
    // Обновляем баланс пользователя
    await pool.query(
      'UPDATE users SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [amount, user_id]
    );
    
    res.json({ 
      success: true, 
      message: 'Withdrawal request submitted',
      operationId: operationResult.rows[0].id,
      newBalance: user.balance - amount
    });
    
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.get('/api/withdraw/history/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM withdrawal_operations WHERE user_id = $1 ORDER BY created_at DESC',
      [req.params.userId]
    );
    
    res.json({ success: true, operations: result.rows });
  } catch (error) {
    console.error('Get withdrawal history error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`👤 Admin ID: ${ADMIN_ID}`);
  console.log(`🗄️ Database: PostgreSQL`);
  
  // Инициализируем базу данных
  await initDatabase();
});