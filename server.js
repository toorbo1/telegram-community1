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

// 🔧 ПРАВИЛЬНОЕ подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Дополнительные настройки для надежности
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Тестируем подключение при запуске
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL connected successfully');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    return false;
  }
}

// Инициализация базы данных
async function initDatabase() {
  try {
    console.log('🔄 Initializing database...');
    
    // Проверяем подключение
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to PostgreSQL');
    }

    // Создаем таблицы
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
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        category VARCHAR(50) DEFAULT 'general',
        price INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
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
    `);

    // Добавляем тестовые задания если их нет
    const tasksCount = await pool.query('SELECT COUNT(*) FROM tasks');
    if (parseInt(tasksCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO tasks (title, description, price, category) VALUES
        ('Подписаться на канал', 'Подпишитесь на наш Telegram канал', 50, 'subscribe'),
        ('Посмотреть видео', 'Посмотрите видео до конца', 30, 'view'),
        ('Сделать репост', 'Сделайте репост записи', 70, 'repost')
      `);
      console.log('✅ Test tasks created');
    }

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    throw error;
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
app.get('/api/health', async (req, res) => {
  try {
    // Проверяем подключение к базе
    await pool.query('SELECT 1');
    
    res.json({ 
      status: 'OK', 
      message: 'LinkGold API is running with PostgreSQL!',
      database: 'Connected',
      timestamp: new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      message: 'Database connection failed',
      error: error.message 
    });
  }
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
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получение заданий
app.get('/api/tasks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks WHERE status = $1 ORDER BY created_at DESC', ['active']);
    res.json({ success: true, tasks: result.rows });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// Простые эндпоинты для остального функционала
app.get('/api/posts', async (req, res) => {
  try {
    // Временная реализация - возвращаем пустой массив
    res.json({ success: true, posts: [] });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/admin/task-verifications', async (req, res) => {
  try {
    const { adminId } = req.query;
    
    if (parseInt(adminId) !== ADMIN_ID) {
      return res.json({ success: false, error: 'Access denied' });
    }
    
    // Временная реализация
    res.json({ success: true, verifications: [] });
  } catch (error) {
    console.error('Get verifications error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Обработка ошибок
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'production' ? undefined : error.message 
  });
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`👤 Admin ID: ${ADMIN_ID}`);
  console.log(`🗄️ Database: PostgreSQL`);
  console.log(`🔗 DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'Not set'}`);
  
  try {
    // Инициализируем базу данных
    await initDatabase();
  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message);
    console.log('🔄 Continuing with limited functionality...');
  }
});