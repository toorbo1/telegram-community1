// 🔧 КОНФИГУРАЦИЯ - ЗАМЕНИ НА СВОЙ URL!
const API_URL = 'https://telegram-community1-production.up.railway.app/api'; // ЗАМЕНИ!

// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// Текущий пользователь
let currentUser = null;
const ADMIN_ID = 8036875641;

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing app...');
    console.log('API URL:', API_URL);
    initializeApp();
    loadPosts();
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
        
        console.log('Telegram user:', currentUser);
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
        console.log('Test user:', currentUser);
        displayUserProfile();
        checkAdminRights();
    }
}

// Отображение профиля пользователя
function displayUserProfile() {
    if (!currentUser) return;

    document.getElementById('user-first-name').textContent = currentUser.firstName;
    document.getElementById('user-username').textContent = currentUser.username;
    document.getElementById('user-id').textContent = currentUser.id;
    
    const userPhoto = document.getElementById('user-photo');
    if (currentUser.photoUrl) {
        userPhoto.src = currentUser.photoUrl;
    } else {
        userPhoto.style.display = 'none';
    }
    
    // Генерация реферальной ссылки
    const referralLink = `https://t.me/share/url?url=https://your-app.railway.app/ref/${currentUser.id}`;
    document.getElementById('referral-link').value = referralLink;
}

// Проверка прав администратора
function checkAdminRights() {
    if (currentUser && currentUser.id === ADMIN_ID) {
        console.log('User is ADMIN');
        document.getElementById('admin-section').style.display = 'block';
        setupAdminFeatures();
    } else {
        console.log('User is not admin');
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

// Загрузка постов с сервера
async function loadPosts() {
    console.log('Loading posts from:', `${API_URL}/posts`);
    
    const container = document.getElementById('posts-container');
    container.innerHTML = '<div class="loading">Загрузка постов...</div>';
    
    try {
        const response = await fetch(`${API_URL}/posts`);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const posts = await response.json();
        console.log('Loaded posts:', posts);
        displayPosts(posts);
        
    } catch (error) {
        console.error('Error loading posts:', error);
        container.innerHTML = `
            <div class="error">
                Ошибка загрузки постов: ${error.message}
                <br><button onclick="loadPosts()">Попробовать снова</button>
            </div>
        `;
    }
}

// Добавление нового поста
async function addNewPost() {
    const contentInput = document.getElementById('post-content');
    const content = contentInput.value.trim();
    const formStatus = document.getElementById('form-status');
    const submitButton = document.querySelector('#post-form button[type="submit"]');
    
    if (!content) {
        showFormStatus('Введите текст поста!', 'error');
        return;
    }
    
    const newPost = {
        content: content,
        author: currentUser.firstName,
        authorId: currentUser.id,
        isAdmin: true
    };
    
    console.log('Sending post:', newPost);
    console.log('To URL:', `${API_URL}/posts`);
    
    // Блокируем кнопку
    submitButton.disabled = true;
    submitButton.textContent = 'Публикация...';
    showFormStatus('Публикация поста...', 'loading');
    
    try {
        const response = await fetch(`${API_URL}/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newPost)
        });

        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error(`Ошибка сервера: ${response.status}`);
        }

        const result = await response.json();
        console.log('Post created:', result);

        // Очищаем форму
        contentInput.value = '';
        showFormStatus('Пост успешно опубликован для всех пользователей!', 'success');
        showNotification('Пост опубликован для всех пользователей!');
        
        // Перезагружаем посты
        setTimeout(() => {
            loadPosts();
            formStatus.innerHTML = '';
        }, 2000);
        
    } catch (error) {
        console.error('Error adding post:', error);
        showFormStatus(`Ошибка: ${error.message}`, 'error');
    } finally {
        // Разблокируем кнопку
        submitButton.disabled = false;
        submitButton.textContent = 'Опубликовать для всех';
    }
}

// Показать статус формы
function showFormStatus(message, type) {
    const formStatus = document.getElementById('form-status');
    formStatus.innerHTML = `<div class="status-${type}">${message}</div>`;
}

// Отображение постов
function displayPosts(posts) {
    const container = document.getElementById('posts-container');
    
    if (!posts || posts.length === 0) {
        container.innerHTML = '<p>Пока нет постов. Будьте первым!</p>';
        return;
    }
    
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
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}