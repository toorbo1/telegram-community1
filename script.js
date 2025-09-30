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
    loadPosts();
});

// Инициализация Telegram Web App и данных пользователя
function initializeApp() {
    // Получаем данные пользователя из Telegram
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
        // Заглушка для тестирования вне Telegram
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

// Добавление нового поста
function addNewPost() {
    const contentInput = document.getElementById('post-content');
    const content = contentInput.value.trim();
    
    if (!content) return;
    
    const newPost = {
        id: Date.now(),
        content: content,
        author: currentUser.firstName,
        authorId: currentUser.id,
        timestamp: new Date().toLocaleString('ru-RU'),
        isAdmin: true
    };
    
    savePost(newPost);
    contentInput.value = '';
    loadPosts();
    
    // Уведомление об успешной публикации
    if (tg.showPopup) {
        tg.showPopup({
            title: 'Успех!',
            message: 'Пост опубликован для всех пользователей',
            buttons: [{ type: 'ok' }]
        });
    } else {
        alert('Пост опубликован для всех пользователей!');
    }
}

// Сохранение поста в локальное хранилище
function savePost(post) {
    const posts = getStoredPosts();
    posts.unshift(post); // Добавляем в начало
    localStorage.setItem('website-posts', JSON.stringify(posts));
}

// Получение постов из локального хранилища
function getStoredPosts() {
    const stored = localStorage.getItem('website-posts');
    return stored ? JSON.parse(stored) : [];
}

// Загрузка и отображение постов
function loadPosts() {
    const posts = getStoredPosts();
    const container = document.getElementById('posts-container');
    
    if (posts.length === 0) {
        container.innerHTML = '<p>Пока нет постов. Будьте первым!</p>';
        return;
    }
    
    container.innerHTML = posts.map(post => `
        <div class="post">
            <div class="post-content">${escapeHtml(post.content)}</div>
            <div class="post-meta">
                ${post.isAdmin ? '<span class="admin-badge">Админ</span>' : ''}
                Автор: ${escapeHtml(post.author)} | ${post.timestamp}
            </div>
        </div>
    `).join('');
}

// Копирование реферальной ссылки
function copyReferralLink() {
    const referralInput = document.getElementById('referral-link');
    referralInput.select();
    referralInput.setSelectionRange(0, 99999);
    
    try {
        navigator.clipboard.writeText(referralInput.value).then(() => {
            if (tg.showPopup) {
                tg.showPopup({
                    title: 'Скопировано!',
                    message: 'Реферальная ссылка скопирована в буфер',
                    buttons: [{ type: 'ok' }]
                });
            } else {
                alert('Реферальная ссылка скопирована!');
            }
        });
    } catch (err) {
        // Fallback для старых браузеров
        document.execCommand('copy');
        if (tg.showPopup) {
            tg.showPopup({
                title: 'Скопировано!',
                message: 'Реферальная ссылка скопирована в буфер',
                buttons: [{ type: 'ok' }]
            });
        } else {
            alert('Реферальная ссылка скопирована!');
        }
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

// Обработка изменений темы Telegram
tg.onEvent('themeChanged', function() {
    document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff');
    document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#000000');
    document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color || '#40a7e3');
    document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color || '#ffffff');
});