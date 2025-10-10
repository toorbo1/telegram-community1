const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('.'));

// PostgreSQL подключение для Railway
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const ADMIN_ID = 8036875641;

// Инициализация базы данных
async function initDatabase() {
  try {
    console.log('🔄 Инициализация базы данных...');
    
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

    console.log('✅ База данных инициализирована успешно');
  } catch (error) {
    console.error('❌ Ошибка инициализации базы данных:', error);
  }
}

// Настройка загрузки файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = 'uploads';
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

const upload = multer({ storage });

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'LinkGold API работает!',
    database: 'PostgreSQL на Railway',
    timestamp: new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })
  });
});

// Базовые эндпоинты для тестирования
app.post('/api/user/auth', async (req, res) => {
  try {
    const { user } = req.body;
    
    if (!user) {
      return res.json({ success: false, error: 'Отсутствуют данные пользователя' });
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
    
    const userData = {
      ...result.rows[0],
      isAdmin: parseInt(result.rows[0].id) === ADMIN_ID
    };
    
    res.json({ success: true, user: userData });
    
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

app.get('/api/user/:userId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.userId]);
    
    if (result.rows.length === 0) {
      return res.json({ success: false, error: 'Пользователь не найден' });
    }
    
    res.json({ success: true, profile: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

// Получение заданий
app.get('/api/tasks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks WHERE status = $1 ORDER BY created_at DESC', ['active']);
    res.json({ success: true, tasks: result.rows });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

// Получение постов
app.get('/api/posts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM posts ORDER BY created_at DESC');
    res.json({ success: true, posts: result.rows });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

// Создание поста (админ)
app.post('/api/posts', async (req, res) => {
  try {
    const { title, content, author, authorId } = req.body;
    
    if (!title || !content || !author) {
      return res.json({ success: false, error: 'Заполните все поля' });
    }
    
    if (parseInt(authorId) !== ADMIN_ID) {
      return res.json({ success: false, error: 'Доступ запрещен' });
    }
    
    await pool.query(
      'INSERT INTO posts (title, content, author, author_id) VALUES ($1, $2, $3, $4)',
      [title, content, author, authorId]
    );
    
    res.json({ success: true, message: 'Пост успешно создан' });
    
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

// Начало задания
app.post('/api/user/tasks/start', async (req, res) => {
  try {
    const { userId, taskId } = req.body;
    
    const result = await pool.query(
      'INSERT INTO user_tasks (user_id, task_id) VALUES ($1, $2) RETURNING *',
      [userId, taskId]
    );
    
    await pool.query(
      'UPDATE users SET active_tasks = active_tasks + 1 WHERE id = $1',
      [userId]
    );
    
    res.json({ success: true, userTaskId: result.rows[0].id, message: 'Задание начато' });
    
  } catch (error) {
    console.error('Start task error:', error);
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

// Отправка скриншота
app.post('/api/user/tasks/:userTaskId/submit', upload.single('screenshot'), async (req, res) => {
  try {
    const userTaskId = req.params.userTaskId;
    const { userId } = req.body;
    
    if (!req.file) {
      return res.json({ success: false, error: 'Скриншот не загружен' });
    }
    
    const screenshotUrl = `/uploads/${req.file.filename}`;
    
    await pool.query(
      'UPDATE user_tasks SET status = $1, screenshot_url = $2, submitted_at = CURRENT_TIMESTAMP WHERE id = $3',
      ['pending_review', screenshotUrl, userTaskId]
    );
    
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
      return res.json({ success: false, error: 'Задание не найдено' });
    }
    
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
    
    res.json({ success: true, verificationId: verificationResult.rows[0].id, message: 'Скриншот отправлен на проверку' });
    
  } catch (error) {
    console.error('Submit task error:', error);
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

// Верификация заданий (админ)
app.get('/api/admin/task-verifications', async (req, res) => {
  try {
    const { adminId } = req.query;
    
    if (parseInt(adminId) !== ADMIN_ID) {
      return res.json({ success: false, error: 'Доступ запрещен' });
    }
    
    const result = await pool.query(
      'SELECT * FROM task_verifications WHERE status = $1 ORDER BY submitted_at DESC',
      ['pending']
    );
    
    res.json({ success: true, verifications: result.rows });
    
  } catch (error) {
    console.error('Get verifications error:', error);
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

// Одобрение задания
app.post('/api/admin/task-verifications/:verificationId/approve', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { adminId } = req.body;
    
    if (parseInt(adminId) !== ADMIN_ID) {
      throw new Error('Доступ запрещен');
    }

    const verificationResult = await client.query(
      'SELECT * FROM task_verifications WHERE id = $1 FOR UPDATE',
      [req.params.verificationId]
    );
    
    const verification = verificationResult.rows[0];
    if (!verification) {
      throw new Error('Верификация не найдена');
    }

    await client.query(
      'UPDATE task_verifications SET status = $1, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $2 WHERE id = $3',
      ['approved', adminId, req.params.verificationId]
    );

    await client.query(
      'UPDATE user_tasks SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['completed', verification.user_task_id]
    );

    await client.query(
      `UPDATE users 
       SET balance = balance + $1, 
           tasks_completed = tasks_completed + 1,
           active_tasks = active_tasks - 1,
           experience = experience + 10
       WHERE id = $2`,
      [verification.task_price, verification.user_id]
    );

    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: `Задание одобрено! Пользователь получил ${verification.task_price} звезд`,
      amountAdded: verification.task_price
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Approve verification error:', error);
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  } finally {
    client.release();
  }
});

// Основной маршрут
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`👤 Admin ID: ${ADMIN_ID}`);
  
  // Инициализируем базу данных
  await initDatabase();
});