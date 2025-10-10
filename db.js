// db.js - упрощенная версия
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync('db.json');
const db = low(adapter);

// Инициализация структуры базы данных
db.defaults({
  users: {},
  tasks: {},
  user_tasks: {},
  verifications: {},
  support_chats: {},
  support_messages: {},
  posts: [],
  withdraw_operations: []
}).write();

// Вспомогательные функции для работы с базой
const dbHelper = {
  // Работа с пользователями
  getUser: (userId) => db.get('users').get(userId).value(),
  saveUser: (userId, userData) => db.get('users').set(userId, userData).write(),
  
  // Работа с задачами
  getTasks: () => db.get('tasks').value(),
  getTask: (taskId) => db.get('tasks').get(taskId).value(),
  saveTask: (taskId, taskData) => db.get('tasks').set(taskId, taskData).write(),
  deleteTask: (taskId) => db.get('tasks').unset(taskId).write(),
  
  // Работа с пользовательскими задачами
  getUserTasks: (userId, status = null) => {
    let userTasks = db.get('user_tasks').value();
    let result = [];
    
    for (let id in userTasks) {
      if (userTasks[id].user_id == userId) {
        if (!status || userTasks[id].status === status) {
          result.push({ id, ...userTasks[id] });
        }
      }
    }
    return result;
  },
  
  saveUserTask: (userTaskId, data) => db.get('user_tasks').set(userTaskId, data).write(),
  
  // Работа с постами
  getPosts: () => db.get('posts').value(),
  addPost: (post) => db.get('posts').push(post).write(),
  deletePost: (postId) => {
    const posts = db.get('posts').value();
    const filtered = posts.filter(post => post.id !== postId);
    db.set('posts', filtered).write();
  },
  
  // Работа с верификациями
  getVerifications: () => db.get('verifications').value(),
  saveVerification: (verificationId, data) => db.get('verifications').set(verificationId, data).write(),
  
  // Работа с чатами поддержки
  getSupportChats: () => db.get('support_chats').value(),
  saveSupportChat: (chatId, data) => db.get('support_chats').set(chatId, data).write(),
  
  // Работа с сообщениями поддержки
  getSupportMessages: (chatId) => {
    const messages = db.get('support_messages').value();
    return Object.values(messages).filter(msg => msg.chat_id == chatId);
  },
  saveSupportMessage: (messageId, data) => db.get('support_messages').set(messageId, data).write(),
  
  // Генерация ID
  generateId: () => Date.now().toString() + Math.random().toString(36).substr(2, 5)
};

module.exports = { db, dbHelper };