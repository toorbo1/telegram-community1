// db.js - создаем отдельный файл для базы данных
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync('db.json');
const db = low(adapter);

// Инициализация структуры базы данных
db.defaults({
    users: {},
    tasks: {
        // Пример заданий с разными ценами
        '1': {
            id: 1,
            title: 'Подписаться на канал',
            description: 'Подпишитесь на наш Telegram канал',
            price: 50,
            category: 'subscribe'
        },
        '2': {
            id: 2,
            title: 'Посмотреть видео',
            description: 'Посмотрите видео до конца и поставьте лайк',
            price: 30,
            category: 'view'
        },
        '3': {
            id: 3,
            title: 'Сделать репост',
            description: 'Сделайте репост записи',
            price: 70,
            category: 'repost'
        }
    },
    user_tasks: {},
    support_chats: {},
    withdraw_operations: {},
    posts: []
}).write();

module.exports = db;