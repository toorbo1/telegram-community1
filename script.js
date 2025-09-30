// Конфигурация Firebase - ЗАМЕНИТЕ на свою!
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id"
};

// Инициализация Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// Текущий пользователь
let currentUser = null;
const ADMIN_ID = 8036875641;

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupRealtimePosts();
});

// Инициализация Telegram Web App и данных пользователя
function initializeApp() {
    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        const tgUser = tg.initDataUnsafe.user;
        currentUser = {
            id: tgUser.id,
            firstName: tgUser.first_name || 'Неизвестно',
            username: tgUser.username || 'пользователь',
            photoUrl: tgUser.photo_url || ''
        };
        
        displayUserProfile();
        checkAdminRights();
    } else {
        // Заглушка для тестирования
        currentUser = {
            id: 123456789,
            firstName: 'Тестовый',
            username: 'test_user',
            photoUrl: ''
        };
        displayUserProfile();
        checkAdminRights();
    }
}

// Отображение профиля пользователя
function displayUserProfile() {
    if (!currentUser) return;

    document.getElementById('user-first-name').textContent = currentUser.firstName;
    document.getElementById('user-username').textContent = currentUser.username;
    
    const userPhoto = document.getElementById('user-photo');
    if (currentUser.photoUrl) {
        userPhoto.src = currentUser.photoUrl;
    } else {
        userPhoto.style.display = 'none';
    }
    
    // Генерация реферальной ссылки
    const referralLink = `https://t.me/share/url?url=https://yourdomain.com/ref/${currentUser.id}`;
    document.getElementById('referral-link').value = referralLink;
}

// Проверка прав администратора
function checkAdminRights() {
    if (currentUser && currentUser.id === ADMIN_ID) {
        document.getElementById('admin-section').style.display = 'block';
        setupAdminFeatures();
    }
}

// Настройка функций администратора
function setupAdminFeatures() {
    const postForm = document.getElementById('post-form');
    postForm.addEventListener('submit', function(e) {
        e.preventDefault();
        addNewPost();
    });
}

// Добавление нового поста в Firebase
function addNewPost() {
    const contentInput = document.getElementById('post-content');
    const content = contentInput.value.trim();
    
    if (!content) return;
    
    const newPost = {
        content: content,
        author: currentUser.firstName,
        authorId: currentUser.id,
        timestamp: new Date().toISOString(),
        isAdmin: true
    };
    
    // Сохраняем пост в Firebase
    const postsRef = database.ref('posts');
    postsRef.push(newPost)
        .then(() => {
            contentInput.value = '';
            showNotification('Пост опубликован для всех пользователей!');
        })
        .catch((error) => {
            console.error('Ошибка:', error);
            showNotification('Ошибка публикации поста');
        });
}

// Настройка реального времени для постов
function setupRealtimePosts() {
    const postsRef = database.ref('posts');
    
    postsRef.on('value', (snapshot) => {
        const postsData = snapshot.val();
        displayPosts(postsData);
    });
}

// Отображение постов
function displayPosts(postsData) {
    const container = document.getElementById('posts-container');
    
    if (!postsData) {
        container.innerHTML = '<p>Пока нет постов. Будьте первым!</p>';
        return;
    }
    
    // Преобразуем объект в массив и сортируем по времени
    const posts = Object.entries(postsData)
        .map(([id, post]) => ({ id, ...post }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    container.innerHTML = posts.map(post => `
        <div class="post">
            <div class="post-content">${escapeHtml(post.content)}</div>
            <div class="post-meta">
                ${post.isAdmin ? '<span class="admin-badge">Админ</span>' : ''}
                Автор: ${escapeHtml(post.author)} | ${new Date(post.timestamp).toLocaleString('ru-RU')}
            </div>
        </div>
    `).join('');
}

// Копирование реферальной ссылки
function copyReferralLink() {
    const referralInput = document.getElementById('referral-link');
    referralInput.select();
    
    navigator.clipboard.writeText(referralInput.value).then(() => {
        showNotification('Реферальная ссылка скопирована!');
    }).catch(() => {
        // Fallback
        document.execCommand('copy');
        showNotification('Реферальная ссылка скопирована!');
    });
}

// Показать уведомление
function showNotification(message) {
    if (tg.showPopup) {
        tg.showPopup({
            title: 'Успех!',
            message: message,
            buttons: [{ type: 'ok' }]
        });
    } else {
        alert(message);
    }
}

// Экранирование HTML для безопасности
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}