const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { db, dbHelper } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Настройка загрузки файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'screenshot-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

const ADMIN_ID = 8036875641;

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
    message: 'LinkGold API is running!',
    timestamp: new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })
  });
});

// Аутентификация пользователя
app.post('/api/user/auth', (req, res) => {
  const { user } = req.body;
  
  if (!user) {
    return res.json({ success: false, error: 'Missing user data' });
  }
  
  const userProfile = {
    id: user.id,
    username: user.username || `user_${user.id}`,
    first_name: user.first_name || 'Пользователь',
    last_name: user.last_name || '',
    photo_url: user.photo_url || '',
    balance: 0,
    level: 1,
    experience: 0,
    tasks_completed: 0,
    active_tasks: 0,
    quality_rate: 100,
    referral_count: 0,
    referral_earned: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  // Проверяем существующего пользователя
  const existingUser = dbHelper.getUser(user.id);
  if (existingUser) {
    // Обновляем только основные данные
    const updatedUser = {
      ...existingUser,
      username: userProfile.username,
      first_name: userProfile.first_name,
      last_name: userProfile.last_name,
      photo_url: userProfile.photo_url,
      updated_at: new Date().toISOString()
    };
    dbHelper.saveUser(user.id, updatedUser);
    res.json({ success: true, user: updatedUser });
  } else {
    // Создаем нового пользователя
    dbHelper.saveUser(user.id, userProfile);
    res.json({ success: true, user: userProfile });
  }
});

// Получение данных пользователя
app.get('/api/user/:userId', (req, res) => {
  const user = dbHelper.getUser(req.params.userId);
  if (!user) {
    return res.json({ success: false, error: 'User not found' });
  }
  res.json({ success: true, profile: user });
});

// Получение заданий
app.get('/api/tasks', (req, res) => {
  const tasks = dbHelper.getTasks();
  const taskList = Object.values(tasks).filter(task => task.status !== 'inactive');
  res.json({ success: true, tasks: taskList });
});

// Создание задания (админ)
app.post('/api/tasks', (req, res) => {
  const { title, description, price, created_by } = req.body;
  
  if (parseInt(created_by) !== ADMIN_ID) {
    return res.json({ success: false, error: 'Access denied' });
  }
  
  const taskId = dbHelper.generateId();
  const task = {
    id: taskId,
    title,
    description,
    price: parseFloat(price),
    created_by,
    status: 'active',
    created_at: new Date().toISOString()
  };
  
  dbHelper.saveTask(taskId, task);
  res.json({ success: true, taskId, message: 'Task created successfully' });
});

// Начало задания пользователем
app.post('/api/user/tasks/start', (req, res) => {
  const { userId, taskId } = req.body;
  
  const task = dbHelper.getTask(taskId);
  if (!task) {
    return res.json({ success: false, error: 'Task not found' });
  }
  
  const userTaskId = dbHelper.generateId();
  const userTask = {
    id: userTaskId,
    user_id: parseInt(userId),
    task_id: taskId,
    status: 'active',
    started_at: new Date().toISOString(),
    task_title: task.title,
    task_price: task.price
  };
  
  dbHelper.saveUserTask(userTaskId, userTask);
  
  // Обновляем счетчик активных заданий пользователя
  const user = dbHelper.getUser(userId);
  if (user) {
    user.active_tasks = (user.active_tasks || 0) + 1;
    dbHelper.saveUser(userId, user);
  }
  
  res.json({ success: true, userTaskId, message: 'Task started successfully' });
});

// Отправка скриншота задания
app.post('/api/user/tasks/:userTaskId/submit', upload.single('screenshot'), (req, res) => {
  const userTaskId = req.params.userTaskId;
  const { userId } = req.body;
  
  if (!req.file) {
    return res.json({ success: false, error: 'No screenshot uploaded' });
  }
  
  const userTask = db.get('user_tasks').get(userTaskId).value();
  if (!userTask || userTask.user_id != userId) {
    return res.json({ success: false, error: 'Task not found' });
  }
  
  // Обновляем задание пользователя
  userTask.status = 'pending_review';
  userTask.screenshot_url = `/uploads/${req.file.filename}`;
  userTask.submitted_at = new Date().toISOString();
  dbHelper.saveUserTask(userTaskId, userTask);
  
  // Создаем запись для верификации
  const user = dbHelper.getUser(userId);
  const verificationId = dbHelper.generateId();
  const verification = {
    id: verificationId,
    user_task_id: userTaskId,
    user_id: parseInt(userId),
    user_name: user.first_name + (user.last_name ? ' ' + user.last_name : ''),
    task_id: userTask.task_id,
    task_title: userTask.task_title,
    task_price: userTask.task_price,
    screenshot_url: `/uploads/${req.file.filename}`,
    status: 'pending',
    submitted_at: new Date().toISOString()
  };
  
  dbHelper.saveVerification(verificationId, verification);
  
  res.json({ success: true, verificationId, message: 'Screenshot submitted for review' });
});

// Получение заданий пользователя
app.get('/api/user/:userId/tasks', (req, res) => {
  const { status } = req.query;
  const userTasks = dbHelper.getUserTasks(req.params.userId, status);
  
  // Добавляем информацию о задании
  const tasksWithInfo = userTasks.map(userTask => {
    const task = dbHelper.getTask(userTask.task_id);
    return {
      ...userTask,
      task_info: task
    };
  });
  
  res.json({ success: true, tasks: tasksWithInfo });
});

// Одобрение задания (админ)
app.post('/api/admin/task-verifications/:verificationId/approve', (req, res) => {
  const { adminId } = req.body;
  
  if (parseInt(adminId) !== ADMIN_ID) {
    return res.json({ success: false, error: 'Access denied' });
  }
  
  const verification = db.get('verifications').get(req.params.verificationId).value();
  if (!verification) {
    return res.json({ success: false, error: 'Verification not found' });
  }
  
  // Обновляем верификацию
  verification.status = 'approved';
  verification.reviewed_at = new Date().toISOString();
  verification.reviewed_by = adminId;
  dbHelper.saveVerification(req.params.verificationId, verification);
  
  // Обновляем задание пользователя
  const userTask = db.get('user_tasks').get(verification.user_task_id).value();
  userTask.status = 'completed';
  userTask.completed_at = new Date().toISOString();
  dbHelper.saveUserTask(verification.user_task_id, userTask);
  
  // Обновляем баланс пользователя
  const user = dbHelper.getUser(verification.user_id);
  user.balance = (user.balance || 0) + verification.task_price;
  user.tasks_completed = (user.tasks_completed || 0) + 1;
  user.active_tasks = Math.max(0, (user.active_tasks || 0) - 1);
  user.experience = (user.experience || 0) + 10;
  user.updated_at = new Date().toISOString();
  dbHelper.saveUser(verification.user_id, user);
  
  res.json({ 
    success: true, 
    message: `Task approved! User received ${verification.task_price} stars`,
    amountAdded: verification.task_price
  });
});

// Получение верификаций (админ)
app.get('/api/admin/task-verifications', (req, res) => {
  const { adminId } = req.query;
  
  if (parseInt(adminId) !== ADMIN_ID) {
    return res.json({ success: false, error: 'Access denied' });
  }
  
  const verifications = dbHelper.getVerifications();
  const pendingVerifications = Object.values(verifications).filter(v => v.status === 'pending');
  
  res.json({ success: true, verifications: pendingVerifications });
});

// Работа с постами
app.get('/api/posts', (req, res) => {
  const posts = dbHelper.getPosts();
  res.json({ success: true, posts });
});

app.post('/api/posts', (req, res) => {
  const { title, content, author, authorId } = req.body;
  
  if (parseInt(authorId) !== ADMIN_ID) {
    return res.json({ success: false, error: 'Access denied' });
  }
  
  const post = {
    id: dbHelper.generateId(),
    title,
    content,
    author,
    authorId,
    timestamp: new Date().toISOString(),
    moscow_time: formatMoscowTime(new Date())
  };
  
  dbHelper.addPost(post);
  res.json({ success: true, message: 'Post created successfully' });
});

// Запрос на вывод средств
app.post('/api/withdrawal/request', (req, res) => {
  const { user_id, amount, method, details } = req.body;
  
  const user = dbHelper.getUser(user_id);
  if (!user) {
    return res.json({ success: false, error: 'User not found' });
  }
  
  if (user.balance < amount) {
    return res.json({ success: false, error: 'Insufficient balance' });
  }
  
  // Создаем запрос на вывод
  const operation = {
    id: dbHelper.generateId(),
    user_id: parseInt(user_id),
    username: user.username,
    amount: parseFloat(amount),
    method,
    details,
    status: 'pending',
    created_at: new Date().toISOString()
  };
  
  // Сохраняем операцию
  const operations = db.get('withdraw_operations').value();
  operations.push(operation);
  db.set('withdraw_operations', operations).write();
  
  // Обновляем баланс пользователя
  user.balance -= amount;
  dbHelper.saveUser(user_id, user);
  
  res.json({ 
    success: true, 
    message: 'Withdrawal request submitted',
    operationId: operation.id,
    newBalance: user.balance
  });
});

// Получение истории выводов
app.get('/api/withdraw/history/:userId', (req, res) => {
  const operations = db.get('withdraw_operations').value();
  const userOperations = operations.filter(op => op.user_id == req.params.userId);
  res.json({ success: true, operations: userOperations });
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Simple Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});