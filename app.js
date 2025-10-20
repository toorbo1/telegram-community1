        // 🔧 КОНФИГУРАЦИЯ
        console.log('🌐 Current URL:', window.location.href);
        const API_BASE_URL = window.location.origin;
        console.log('🔗 API Base URL:', API_BASE_URL);
        
        const tg = window.Telegram.WebApp;
        const ADMIN_ID = 8036875641;

     // 🔧 ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
let currentUser = null;
let currentChatId = null;
let currentAdminChat = null;
let selectedTaskId = null;
let allTasks = [];
let chatUpdateInterval = null;
let currentUserTaskId = null;
let currentVerificationId = null;
let currentTaskImage = null; // ← ДОБАВЬТЕ ЭТУ СТРОКУ

// Функции для работы с загрузкой изображений
// Middleware для сжатия
const compression = require('compression');
app.use(compression());

// Кэширование статических файлов
app.use(express.static(__dirname, {
    maxAge: '1d',
    etag: false
}));
// В app.js
function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
            }
        });
    });

    images.forEach(img => imageObserver.observe(img));
}
// В server.js добавьте
app.use((req, res, next) => {
    // Кэширование для статических ресурсов
    if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|mp4)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
    }
    next();
});
function previewTaskImage(input) {
    if (!input.files || !input.files[0]) return;
    
    const file = input.files[0];
    const preview = document.getElementById('task-image-preview');
    const placeholder = document.querySelector('.upload-placeholder');
    
    // Сохраняем файл в глобальную переменную
    currentTaskImage = file;
    
    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
        showNotification('Пожалуйста, выберите изображение', 'error');
        currentTaskImage = null;
        return;
    }
    
    // Проверка размера файла
    if (file.size > 5 * 1024 * 1024) {
        showNotification('Размер изображения не должен превышать 5MB', 'error');
        currentTaskImage = null;
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        preview.src = e.target.result;
        preview.style.display = 'block';
        if (placeholder) {
            placeholder.style.display = 'none';
        }
    };
    
    reader.onerror = function() {
        showNotification('Ошибка при загрузке изображения', 'error');
        currentTaskImage = null;
    };
    
    reader.readAsDataURL(file);
}
// Инициализация при загрузке страницы
// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing LinkGold app...');
    
    // Инициализация drag and drop
    initImageUploadDragDrop();
    
    if (typeof tg !== 'undefined') {
        tg.expand();
        tg.ready();
        initializeTelegramUser();
    } else {
        console.log('Telegram Web App context not available');
        initializeTestUser();
    }
});

// Улучшенная функция для запросов
// 🔧 УЛУЧШЕННАЯ ФУНКЦИЯ ДЛЯ ЗАПРОСОВ
async function makeRequest(endpoint, options = {}) {
    try {
        // Формируем полный URL
        let url;
        if (endpoint.startsWith('http')) {
            url = endpoint;
        } else if (endpoint.startsWith('/api')) {
            url = API_BASE_URL + endpoint;
        } else {
            url = API_BASE_URL + '/api' + (endpoint.startsWith('/') ? endpoint : '/' + endpoint);
        }
        
        console.log(`🚀 Making ${options.method || 'GET'} request to: ${url}`);
        
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('📨 Response received:', data);
        return data;
        
    } catch (error) {
        console.error('💥 Request failed:', error);
        showNotification(`⚠️ Ошибка: ${error.message}`, 'error');
        throw error;
    }
}

function addTasksDebugButton() {
    const debugBtn = document.createElement('button');
    
    debugBtn.style.position = 'fixed';
    debugBtn.style.top = '50px';
    debugBtn.style.right = '10px';
    debugBtn.style.zIndex = '10000';
    debugBtn.style.padding = '10px';
    debugBtn.style.background = 'red';
    debugBtn.style.color = 'white';
    debugBtn.style.border = 'none';
    debugBtn.style.borderRadius = '5px';
    debugBtn.style.fontSize = '12px';
    debugBtn.onclick = function() {
        
        console.log('- currentUser:', currentUser);
        console.log('- API_BASE_URL:', API_BASE_URL);
        loadTasksForCategory('new');
    };
    document.body.appendChild(debugBtn);
}

// Вызовите при загрузке
setTimeout(addTasksDebugButton, 2000);

// Функция для тестирования endpoint'ов
async function testEndpoints() {
    if (!currentUser || parseInt(currentUser.id) !== ADMIN_ID) return;
    
    try {
        console.log('🧪 Testing endpoints...');
        
        // Тестируем базовый endpoint
        const health = await makeRequest('/health');
        console.log('✅ Health endpoint:', health);
        
        // Тестируем debug endpoints
        const debug = await makeRequest('/debug/endpoints');
        console.log('✅ Debug endpoints:', debug);
        
        // Тестируем admins-list endpoint
        const admins = await makeRequest(`/admin/admins-list?adminId=${currentUser.id}`);
        console.log('✅ Admins list endpoint:', admins);
        
    } catch (error) {
        console.error('❌ Endpoint test failed:', error);
    }
}

// Вызов для тестирования
setTimeout(() => {
    if (currentUser && parseInt(currentUser.id) === ADMIN_ID) {
        testEndpoints();
    }
}, 5000);
        // Инициализация приложения
        document.addEventListener('DOMContentLoaded', function() {
            console.log('Initializing LinkGold app...');
            
            if (typeof tg !== 'undefined') {
                tg.expand();
                tg.ready();
                initializeTelegramUser();
            } else {
                console.log('Telegram Web App context not available');
                initializeTestUser();
            }
        });

async function initializeTelegramUser() {
    try {
        if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
            const tgUser = tg.initDataUnsafe.user;
            
            currentUser = {
                id: tgUser.id,
                firstName: tgUser.first_name || 'Пользователь',
                lastName: tgUser.last_name || '',
                username: tgUser.username || `user_${tgUser.id}`,
                photoUrl: tgUser.photo_url || '',
                isAdmin: parseInt(tgUser.id) === ADMIN_ID
            };
            
            // Простая аутентификация без реферального кода (он обрабатывается в боте)
            try {
                const authResult = await makeRequest('/user/auth', {
                    method: 'POST',
                    body: JSON.stringify({
                        user: currentUser
                    })
                });
                
                if (authResult.success) {
                    Object.assign(currentUser, authResult.user);
                }
            } catch (authError) {
                console.log('Auth endpoint not available, continuing with basic user data');
            }
            
            initializeApp();
        } else {
            console.log('Telegram user data not available');
            initializeTestUser();
        }
    } catch (error) {
        console.error('Error initializing Telegram user:', error);
        initializeTestUser();
    }
}

function debugWithdrawalSystem() {
    console.log('🐛 DEBUG Withdrawal System:');
    console.log('- currentUser:', currentUser); // ← исправлено на английское
    console.log('- isAdmin:', currentUser?.is_admin);
    
    // Проверьте, загружаются ли запросы
    loadWithdrawalRequests().then(() => {
        console.log('✅ Withdrawal requests loaded');
    }).catch(error => {
        console.error('❌ Error loading withdrawal requests:', error);
    });
}
// 🔄 Функция для обновления интерфейса проверки заданий
function updateVerificationInterface() {
    if (document.getElementById('admin-verification-section').style.display === 'block') {
        loadTaskVerifications();
    }
}

// Автоматическое обновление списка проверки каждые 30 секунд
setInterval(updateVerificationInterface, 30000);
// Вызовите для тестирования
// setTimeout(debugWithdrawalSystem, 3000);
// 📝 Функции для админов (без админ-панели)
async function addNewPostAsAdmin() {
    if (!currentUser) return;
    
    const title = prompt('Введите заголовок поста:');
    if (!title) return;
    
    const content = prompt('Введите содержание поста:');
    if (!content) return;
    
    // Проверяем права
    const isAdmin = await checkAdminAccess(currentUser.id);
    if (!isAdmin) {
        showNotification('Только администратор может публиковать посты!', 'error');
        return;
    }
    
    try {
        const result = await makeRequest('/posts', {
            method: 'POST',
            body: JSON.stringify({
                title: title,
                content: content,
                author: currentUser.firstName,
                authorId: currentUser.id
            })
        });

        if (result.success) {
            showNotification('Пост успешно опубликован!', 'success');
            loadMainPagePosts();
        } else {
            showNotification('Ошибка: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error adding post:', error);
        showNotification('Ошибка публикации поста', 'error');
    }
}

// 🗑️ Удаление поста
async function deletePostAsAdmin(postId) {
    if (!currentUser) return;
    
    if (!confirm('Удалить этот пост?')) return;
    
    // Проверяем права
    const isAdmin = await checkAdminAccess(currentUser.id);
    if (!isAdmin) {
        showNotification('Только администратор может удалять посты!', 'error');
        return;
    }
    
    try {
        const result = await makeRequest(`/posts/${postId}`, {
            method: 'DELETE',
            body: JSON.stringify({ authorId: currentUser.id })
        });

        if (result.success) {
            showNotification('Пост успешно удален!', 'success');
            loadMainPagePosts();
        } else {
            showNotification('Ошибка: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error deleting post:', error);
        showNotification('Ошибка удаления поста', 'error');
    }
}

// 📋 Создание задания
async function addTaskAsAdmin() {
    if (!currentUser) return;
    
    const title = prompt('Введите название задания:');
    if (!title) return;
    
    const description = prompt('Введите описание задания:');
    if (!description) return;
    
    const price = prompt('Введите цену задания (в рублях):');
    if (!price) return;
    
    // Проверяем права
    const isAdmin = await checkAdminAccess(currentUser.id);
    if (!isAdmin) {
        showNotification('Только администратор может создавать задания!', 'error');
        return;
    }
    
    try {
        const result = await makeRequest('/tasks', {
            method: 'POST',
            body: JSON.stringify({
                title: title,
                description: description,
                price: parseFloat(price),
                created_by: currentUser.id
            })
        });

        if (result.success) {
            showNotification('Задание успешно создано!', 'success');
            loadTasks();
        } else {
            showNotification('Ошибка: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error adding task:', error);
        showNotification('Ошибка создания задания', 'error');
    }
}

// 🗑️ Удаление задания
async function deleteTaskAsAdmin(taskId) {
    if (!currentUser) return;
    
    if (!confirm('Удалить это задание?')) return;
    
    // Проверяем права
    const isAdmin = await checkAdminAccess(currentUser.id);
    if (!isAdmin) {
        showNotification('Только администратор может удалять задания!', 'error');
        return;
    }
    
    try {
        const result = await makeRequest(`/tasks/${taskId}`, {
            method: 'DELETE',
            body: JSON.stringify({ adminId: currentUser.id })
        });

        if (result.success) {
            showNotification('Задание успешно удалено!', 'success');
            loadTasks();
        } else {
            showNotification('Ошибка: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        showNotification('Ошибка удаления задания', 'error');
    }
}

// ✅ Проверка заданий (для админов)
async function loadTaskVerificationsForAdmin() {
    if (!currentUser) return;
    
    // Проверяем права
    const isAdmin = await checkAdminAccess(currentUser.id);
    if (!isAdmin) return;
    
    try {
        const result = await makeRequest(`/admin/task-verifications?adminId=${currentUser.id}`);
        if (result.success) {
            showVerificationsModal(result.verifications);
        }
    } catch (error) {
        console.error('Error loading verifications:', error);
    }
}

// 🎨 Модальное окно проверки заданий

function showVerificationsModal(verifications) {
    let modalHTML = `
        <div class="modal active" id="verifications-modal">
            <div class="modal-content" style="max-width: 600px; max-height: 80vh; overflow-y: auto;">
                <div class="modal-header">
                    <div class="modal-title">✅ Проверка заданий</div>
                    <button class="modal-close" onclick="closeModal('verifications-modal')">×</button>
                </div>
                <div class="modal-body">
    `;
    
    if (!verifications || verifications.length === 0) {
        modalHTML += `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
                <div>Нет заданий на проверке</div>
            </div>
        `;
    } else {
        verifications.forEach(verification => {
            modalHTML += `
                <div class="verification-item" style="margin-bottom: 16px; padding: 16px; border: 1px solid var(--border); border-radius: 12px;">
                    <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 12px;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600;">${verification.user_name}</div>
                            <div style="color: var(--text-secondary); font-size: 14px;">${verification.task_title}</div>
                        </div>
                        <div style="font-weight: 700; color: var(--gold);">${verification.task_price} ⭐</div>
                    </div>
                    <div style="margin-bottom: 12px;">
                        <img src="${verification.screenshot_url}" alt="Скриншот" style="width: 100%; border-radius: 8px;">
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-success" style="flex: 1;" onclick="approveVerification(${verification.id})">✅ Одобрить</button>
                        <button class="btn btn-error" style="flex: 1;" onclick="rejectVerification(${verification.id})">❌ Отклонить</button>
                    </div>
                </div>
            `;
        });
    }
    
    modalHTML += `
                </div>
            </div>
        </div>
    `;
    
    // Добавляем модальное окно в DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// 💬 Админ-чат с пользователями
async function openAdminSupportChat() {
    if (!currentUser) return;
    
    // Проверяем права
    const isAdmin = await checkAdminAccess(currentUser.id);
    if (!isAdmin) {
        showNotification('Только администратор может отвечать в чате!', 'error');
        return;
    }
    
    try {
        const result = await makeRequest(`/support/chats?adminId=${currentUser.id}`);
        if (result.success) {
            showAdminChatsModal(result.chats);
        }
    } catch (error) {
        console.error('Error loading admin chats:', error);
    }
}

// 🎨 Модальное окно чатов для админа
function showAdminChatsModal(chats) {
    let modalHTML = `
        <div class="modal active" id="admin-chats-modal">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <div class="modal-title">💬 Чаты с пользователями</div>
                    <button class="modal-close" onclick="closeModal('admin-chats-modal')">×</button>
                </div>
                <div class="modal-body">
    `;
    
    if (!chats || chats.length === 0) {
        modalHTML += `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 16px;">💬</div>
                <div>Нет активных чатов</div>
            </div>
        `;
    } else {
        chats.forEach(chat => {
            modalHTML += `
                <div class="chat-item" style="display: flex; align-items: center; padding: 12px; border: 1px solid var(--border); border-radius: 12px; margin-bottom: 8px; cursor: pointer;" onclick="openChatWithUser(${chat.id})">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--purple-gradient); display: flex; align-items: center; justify-content: center; margin-right: 12px; color: white; font-weight: 600;">
                        ${chat.user_name ? chat.user_name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600;">${chat.user_name}</div>
                        <div style="color: var(--text-secondary); font-size: 12px;">${chat.last_message || 'Нет сообщений'}</div>
                    </div>
                </div>
            `;
        });
    }
    
    modalHTML += `
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// 🔧 Обновление интерфейса для админов
function updateAdminInterface() {
    if (!currentUser) return;
    
    // Проверяем права асинхронно и обновляем интерфейс
    checkAdminAccess(currentUser.id).then(isAdmin => {
        if (isAdmin) {
            // Добавляем кнопки для админов в главную страницу
            addAdminButtonsToMainPage();
        }
    });
}

// 🎨 Добавление кнопок админа на главную страницу
function addAdminButtonsToMainPage() {
    // Проверяем, не добавлены ли кнопки уже
    if (document.getElementById('admin-buttons-container')) return;
    
    const adminButtonsHTML = `
        <div id="admin-buttons-container" class="card fade-in" style="margin-top: 20px;">
            <h3 style="margin-bottom: 16px; text-align: center;">⚙️ Панель администратора</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <button class="btn btn-primary" onclick="addNewPostAsAdmin()">📝 Добавить пост</button>
                <button class="btn btn-primary" onclick="addTaskAsAdmin()">📋 Добавить задание</button>
                <button class="btn btn-warning" onclick="loadTaskVerificationsForAdmin()">✅ Проверить задания</button>
                <button class="btn btn-success" onclick="openAdminSupportChat()">💬 Ответить в чатах</button>
            </div>
        </div>
    `;
    
    const mainTab = document.getElementById('main-tab');
    if (mainTab) {
        mainTab.insertAdjacentHTML('beforeend', adminButtonsHTML);
    }
}



// Функция проверки прав администратора
async function isUserAdmin(userId) {
    try {
        const result = await pool.query(
            'SELECT is_admin FROM user_profiles WHERE user_id = $1',
            [userId]
        );
        
        if (result.rows.length > 0) {
            return result.rows[0].is_admin === true || parseInt(userId) === ADMIN_ID;
        }
        return parseInt(userId) === ADMIN_ID;
    } catch (error) {
        return parseInt(userId) === ADMIN_ID;
    }
}

// Создание поста - для всех админов
app.post('/api/posts', async (req, res) => {
    const { title, content, author, authorId } = req.body;
    
    if (!title || !content || !author) {
        return res.status(400).json({
            success: false,
            error: 'Заполните все поля'
        });
    }
    
    // ✅ ПРАВИЛЬНАЯ ПРОВЕРКА - все админы могут создавать посты
    const userIsAdmin = await isUserAdmin(authorId);
    if (!userIsAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Только администратор может публиковать посты!'
        });
    }
    
    try {
        const result = await pool.query(`
            INSERT INTO posts (title, content, author, author_id) 
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [title, content, author, authorId]);
        
        res.json({
            success: true,
            message: 'Пост успешно опубликован!',
            post: result.rows[0]
        });
    } catch (error) {
        console.error('Create post error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка базы данных'
        });
    }
});

// 🔧 ФУНКЦИЯ ДЛЯ ДИАГНОСТИКИ ПРОБЛЕМЫ С ЗАГРУЗКОЙ
function debugTasksLoading() {
    console.log('🔍 ДИАГНОСТИКА ЗАГРУЗКИ ЗАДАНИЙ:');
    
    const tasksTab = document.getElementById('tasks-tab');
    const newTasksContainer = document.getElementById('new-tasks');
    const activeTasksContainer = document.querySelector('#new-tasks.active');
    
    console.log('- tasks-tab exists:', !!tasksTab);
    console.log('- tasks-tab active:', tasksTab?.classList.contains('active'));
    console.log('- new-tasks container exists:', !!newTasksContainer);
    console.log('- new-tasks container active:', !!activeTasksContainer);
    console.log('- new-tasks display:', newTasksContainer?.style.display);
    console.log('- currentUser exists:', !!currentUser);
    console.log('- allTasks count:', allTasks?.length || 0);
    
    // Проверяем видимость контейнера
    if (newTasksContainer) {
        const rect = newTasksContainer.getBoundingClientRect();
        console.log('- new-tasks visible:', rect.width > 0 && rect.height > 0);
    }
}
// 🔍 Функция проверки прав администратора
async function checkUserIsAdmin(userId) {
    try {
        const result = await makeRequest(`/user/${userId}`);
        if (result.success) {
            return result.profile.is_admin === true || parseInt(userId) === ADMIN_ID;
        }
        return false;
    } catch (error) {
        console.error('Admin check error:', error);
        return false;
    }
}

// 📝 Функция создания поста (для всех админов)
async function addNewPostAsAdmin() {
    if (!currentUser) {
        showNotification('Пользователь не авторизован', 'error');
        return;
    }
    
    // ✅ ПРАВИЛЬНАЯ ПРОВЕРКА
    const isAdmin = await checkUserIsAdmin(currentUser.id);
    if (!isAdmin) {
        showNotification('Только администратор может публиковать посты!', 'error');
        return;
    }
    
    const title = prompt('Введите заголовок поста:');
    if (!title) return;
    
    const content = prompt('Введите содержание поста:');
    if (!content) return;
    
    try {
        const result = await makeRequest('/posts', {
            method: 'POST',
            body: JSON.stringify({
                title: title,
                content: content,
                author: currentUser.firstName,
                authorId: currentUser.id
            })
        });

        if (result.success) {
            showNotification('Пост успешно опубликован!', 'success');
            loadMainPagePosts();
        } else {
            showNotification('Ошибка: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error adding post:', error);
        showNotification('Ошибка публикации поста', 'error');
    }
}

// 📋 Функция создания задания (для всех админов)
async function addTaskAsAdmin() {
    if (!currentUser) {
        showNotification('Пользователь не авторизован', 'error');
        return;
    }
    
    // ✅ ПРАВИЛЬНАЯ ПРОВЕРКА
    const isAdmin = await checkUserIsAdmin(currentUser.id);
    if (!isAdmin) {
        showNotification('Только администратор может создавать задания!', 'error');
        return;
    }
    
    const title = prompt('Введите название задания:');
    if (!title) return;
    
    const description = prompt('Введите описание задания:');
    if (!description) return;
    
    const price = prompt('Введите цену задания (в рублях):');
    if (!price) return;
    
    try {
        const result = await makeRequest('/tasks', {
            method: 'POST',
            body: JSON.stringify({
                title: title,
                description: description,
                price: parseFloat(price),
                created_by: currentUser.id
            })
        });

        if (result.success) {
            showNotification('Задание успешно создано!', 'success');
            loadTasks();
        } else {
            showNotification('Ошибка: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error adding task:', error);
        showNotification('Ошибка создания задания', 'error');
    }
}

// Функция для отладки прав администратора
function debugAdminRights() {
    console.log('🐛 DEBUG Admin Rights:');
    console.log('- Current User:', currentUser);
    console.log('- ADMIN_ID:', ADMIN_ID);
    console.log('- is_admin:', currentUser?.is_admin);
    console.log('- isMainAdmin:', currentUser?.id === ADMIN_ID.toString());
    console.log('- Admin Nav Visible:', document.getElementById('admin-nav-item')?.style.display);
    console.log('- Admin Panel Visible:', document.getElementById('admin-panel')?.style.display);
}

// Вызов для отладки (можно убрать после тестирования)
setTimeout(debugAdminRights, 2000);



        // Функция для кнопки повторной попытки
        function showRetryButton() {
            const retryBtn = document.createElement('button');
            retryBtn.textContent = '🔄 Попробовать снова';
            retryBtn.className = 'btn btn-primary';
            retryBtn.style.margin = '20px auto';
            retryBtn.style.display = 'block';
            retryBtn.onclick = function() {
                retryBtn.remove();
                initializeApp();
            };
            
            document.body.appendChild(retryBtn);
        }

        // Автоматическое обновление данных пользователя
        function startUserDataAutoUpdate() {
            // Обновляем каждые 30 секунд
            setInterval(() => {
                if (currentUser) {
                    updateUserData();
                }
            }, 30000);
        }

        // Обновление данных пользователя
        async function updateUserData() {
            if (!currentUser) return;
            
            try {
                const result = await makeRequest(`/user/${currentUser.id}`);
                if (result.success) {
                    // Обновляем текущего пользователя
                    currentUser = { ...currentUser, ...result.profile };
                    
                    // Обновляем отображение во всех местах
                    displayUserProfile();
                    
                    console.log('✅ Данные пользователя обновлены:', currentUser.balance);
                }
            } catch (error) {
                console.error('Ошибка обновления данных пользователя:', error);
            }
        }

        // Отображение профиля пользователя
        function displayUserProfile() {
            if (!currentUser) return;

            const firstNameElement = document.getElementById('user-first-name');
            const usernameElement = document.getElementById('user-username');
            const levelElement = document.getElementById('user-level');
            const balanceElement = document.getElementById('user-balance-main');
            const withdrawBalanceElement = document.getElementById('withdraw-balance');
            const withdrawBalanceDisplay = document.getElementById('withdraw-balance-display');
            
            if (firstNameElement) {
                const fullName = currentUser.lastName ? 
                    `${currentUser.firstName} ${currentUser.lastName}` : 
                    currentUser.firstName;
                firstNameElement.textContent = fullName;
            }
            
            if (usernameElement) usernameElement.textContent = currentUser.username;
            if (levelElement) levelElement.textContent = currentUser.level || 0;
            
            // ОБНОВЛЯЕМ БАЛАНС ВО ВСЕХ МЕСТАХ
            const userBalance = currentUser.balance || 0;
            if (balanceElement) balanceElement.textContent = `${userBalance} ⭐`;
            if (withdrawBalanceElement) withdrawBalanceElement.textContent = `${userBalance} ⭐`;
            if (withdrawBalanceDisplay) withdrawBalanceDisplay.textContent = `${userBalance} ⭐`;
            
            // Обновляем аватар
            const userPhotoElement = document.getElementById('user-photo');
            if (userPhotoElement) {
                if (currentUser.photoUrl) {
                    userPhotoElement.src = currentUser.photoUrl;
                    userPhotoElement.alt = 'Фото профиля';
                } else {
                    userPhotoElement.style.display = 'flex';
                    userPhotoElement.style.alignItems = 'center';
                    userPhotoElement.style.justifyContent = 'center';
                    userPhotoElement.style.backgroundColor = '#6366f1';
                    userPhotoElement.style.color = 'white';
                    userPhotoElement.style.fontWeight = 'bold';
                    userPhotoElement.textContent = currentUser.firstName.charAt(0);
                }
            }
            
            updateProfileStats();
            updateReferralSystem();
            updateLevelProgress();
        }

        // Обновление статистики профиля
        function updateProfileStats() {
            if (!currentUser) return;
            
            const stats = document.querySelectorAll('.profile-stat .stat-value');
            if (stats.length >= 4) {
                stats[0].textContent = `${currentUser.balance || 0} ⭐`; // Баланс
                stats[1].textContent = currentUser.tasks_completed || 0; // Выполнено
                stats[2].textContent = currentUser.active_tasks || 0; // Активных
                stats[3].textContent = `${currentUser.quality_rate || 0}%`; // Качество
            }
        }

// Обновление реферальной системы
function updateReferralSystem() {
    if (!currentUser) return;
    
    // Генерируем реферальную ссылку для бота
    const referralCode = currentUser.referral_code || `ref_${currentUser.id}`;
    const referralLink = `https://t.me/LinkGoldMoney_bot?start=${referralCode}`;
    
    const referralInput = document.getElementById('referral-link');
    if (referralInput) referralInput.value = referralLink;
    
    const refInvited = document.getElementById('ref-invited');
    const refEarned = document.getElementById('ref-earned');
    
    if (refInvited) refInvited.textContent = currentUser.referral_count || 0;
    if (refEarned) refEarned.textContent = `${currentUser.referral_earned || 0} ⭐`;
    
    // Обновляем текст с информацией о бонусах
    const referralInfo = document.querySelector('.referral-info');
    if (referralInfo) {
        referralInfo.innerHTML = `
            
            🎁 Вы получаете: <strong>20⭐</strong> за друга<br>
            🎁 Друг получает: <strong>10⭐</strong> при регистрации<br><br>
            🔗 Просто отправьте другу эту ссылку в Telegram
        `;
    }
}
// Получение детальной информации о рефералах
app.get('/api/user/:userId/referrals/detailed', async (req, res) => {
    const userId = req.params.userId;
    
    try {
        const result = await pool.query(`
            SELECT 
                u.user_id,
                u.first_name,
                u.username,
                u.created_at,
                u.balance as friend_balance,
                CASE 
                    WHEN u.is_first_login = false THEN 'active'
                    ELSE 'pending'
                END as status
            FROM user_profiles u
            WHERE u.referred_by = $1
            ORDER BY u.created_at DESC
        `, [userId]);
        
        res.json({
            success: true,
            referrals: result.rows
        });
    } catch (error) {
        console.error('Get detailed referrals error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});
        // Обновление прогресса уровня
        function updateLevelProgress() {
            if (!currentUser) return;
            
            const experience = currentUser.experience || 0;
            const currentLevel = currentUser.level || 0;
            const experienceForNextLevel = (currentLevel + 1) * 100;
            const experienceInCurrentLevel = experience % 100;
            const progressPercent = (experienceInCurrentLevel / 100) * 100;
            
            const progressBar = document.getElementById('level-progress-bar');
            const levelCount = document.querySelector('.level-count');
            
            if (progressBar) {
                progressBar.style.width = `${progressPercent}%`;
            }
            
            if (levelCount) {
                levelCount.textContent = `${experienceInCurrentLevel}/100 опыта`;
            }
        }

        // Проверка прав администратора
// Проверка прав администратора
// Проверка прав администратора - ОБНОВЛЕННАЯ ВЕРСИЯ
// Проверка прав администратора - ОБНОВЛЕННАЯ ВЕРСИЯ
function checkAdminRights() {
    const adminNavItem = document.getElementById('admin-nav-item');
    
    const isMainAdmin = parseInt(currentUser?.id) === ADMIN_ID;
    const isRegularAdmin = currentUser?.is_admin === true;
    
    if (currentUser && (isMainAdmin || isRegularAdmin)) {
        if (adminNavItem) {
            adminNavItem.style.display = 'flex';
            console.log('✅ Admin nav item shown - user is admin');
        }
    } else {
        if (adminNavItem) {
            adminNavItem.style.display = 'none';
            console.log('❌ Admin nav item hidden - user is not admin');
        }
    }
}
// В функции инициализации админ-панели добавьте:
if (parseInt(currentUser.id) === ADMIN_ID) {
    // Показываем кнопку управления админами только главному админу
    const adminButtons = document.querySelector('.admin-buttons');
    if (adminButtons) {
        adminButtons.innerHTML += `
            <button class="admin-btn" onclick="showAdminSection('admins')">👥 Админы</button>
        `;
    }
}
// Обновите функцию инициализации приложения



function showTaskCategory(category) {
    console.log('🔄 Переключение на категорию:', category);
    
    // Скрываем все вкладки
    const tabs = document.querySelectorAll('.task-tab');
    const containers = document.querySelectorAll('.tasks-grid');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    containers.forEach(container => {
        container.classList.remove('active');
        container.style.display = 'none';
    });
    
    // Активируем выбранную вкладку
    const activeTab = Array.from(tabs).find(tab => 
        tab.textContent.toLowerCase().includes(getCategoryName(category))
    );
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // Показываем выбранный контейнер
    const targetContainer = document.getElementById(`${category}-tasks`);
    if (targetContainer) {
        targetContainer.classList.add('active');
        targetContainer.style.display = 'block';
        console.log(`✅ Контейнер ${category}-tasks показан`);
        
        // Загружаем данные для категории
        loadTasksForCategory(category);
    }
}

function getCategoryName(category) {
    const names = {
        'new': 'новые',
        'confirmation': 'подтверждение', 
        'completed': 'выполненные',
        'rejected': 'отклоненные'
    };
    return names[category] || category;
}


// В index.html - обновим функцию загрузки отклоненных заданий
async function loadTasksForCategory(category) {
    try {
        console.log(`🔄 Загружаем задания для категории: ${category} для пользователя:`, currentUser?.id);
        
        if (!currentUser) {
            console.log('❌ Пользователь не авторизован');
            return;
        }

        let endpoint = '';
        let params = new URLSearchParams();
        
        switch(category) {
            case 'new':
                endpoint = '/api/tasks';
                params.append('userId', currentUser.id);
                break;
            case 'confirmation':
                endpoint = `/api/user/${currentUser.id}/tasks/active`;
                break;
            case 'completed':
                endpoint = `/api/user/${currentUser.id}/tasks?status=completed`;
                break;
            case 'rejected':
                // Загружаем отклоненные задания
                endpoint = `/api/user/${currentUser.id}/tasks?status=rejected`;
                break;
        }
        
        const url = endpoint + (params.toString() ? `?${params.toString()}` : '');
        console.log('📡 Request URL:', url);

        const result = await makeRequest(url);
        
        if (result.success) {
            displayTasksForCategory(result.tasks || [], category);
        } else {
            console.error(`❌ Ошибка загрузки ${category} заданий:`, result.error);
            showNotification(`Ошибка загрузки ${category} заданий`, 'error');
        }
    } catch (error) {
        console.error(`❌ Ошибка загрузки ${category} заданий:`, error);
        showNotification(`Ошибка загрузки ${category} заданий`, 'error');
    }
}
function displayTasksForCategory(tasks, category) {
    const container = document.getElementById(`${category}-tasks`);
    if (!container) {
        console.error(`❌ Контейнер ${category}-tasks не найден`);
        return;
    }
    
    container.innerHTML = '';
    
    if (!tasks || tasks.length === 0) {
        let message = '';
        switch(category) {
            case 'new':
                message = 'Новых заданий пока нет';
                break;
            case 'confirmation':
                message = 'Нет заданий на подтверждении';
                break;
            case 'completed':
                message = 'Нет выполненных заданий';
                break;
            case 'rejected':
                message = 'Нет отклоненных заданий';
                break;
        }
        
        container.innerHTML = `
            <div class="no-tasks" style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                <div style="font-size: 18px; margin-bottom: 8px;">${message}</div>
                <div style="font-size: 14px; color: var(--text-secondary);">
                    ${category === 'new' ? 'Новые задания появятся позже' : 'Следите за обновлениями'}
                </div>
            </div>
        `;
        return;
    }
    
    console.log(`🎯 Отображаем ${tasks.length} заданий в категории ${category}`);
    
    tasks.forEach((task, index) => {
        const taskElement = createTaskCardWithImage(task, category, index);
        container.appendChild(taskElement);
    });
}
        // 🔧 ФУНКЦИЯ СОЗДАНИЯ ЭЛЕМЕНТА ЗАДАНИЯ
        function createTaskElement(task, category, index) {
            const taskElement = document.createElement('div');
            taskElement.className = 'task-card';
            taskElement.style.animationDelay = `${index * 0.1}s`;
            
            // Форматируем данные в зависимости от категории
            let taskHTML = '';
            
            switch(category) {
                case 'new':
                    taskHTML = createNewTaskHTML(task);
                    break;
                case 'confirmation':
                    taskHTML = createConfirmationTaskHTML(task);
                    break;
                case 'completed':
                    taskHTML = createCompletedTaskHTML(task);
                    break;
                case 'rejected':
                    taskHTML = createRejectedTaskHTML(task);
                    break;
            }
            
            taskElement.innerHTML = taskHTML;
            
            // Добавляем обработчики событий
            if (category === 'new') {
                taskElement.addEventListener('click', function(e) {
                    if (!e.target.classList.contains('task-btn')) {
                        openTaskModal(task.id);
                    }
                });
            }
            
            return taskElement;
        }


// 🚀 ОПТИМИЗАЦИИ ДЛЯ ПЛАВНОСТИ И ОТЗЫВЧИВОСТИ

// 🔧 ФУНКЦИЯ ДЛЯ ПЛАВНЫХ ПЕРЕХОДОВ МЕЖДУ СТРАНИЦАМИ
function smoothShowTab(tabId) {
    return new Promise((resolve) => {
        // Скрываем все вкладки
        const allTabs = document.querySelectorAll('.tab-content, .page');
        
        // Анимация скрытия текущей активной вкладки
        const activeTab = document.querySelector('.tab-content.active, .page.active');
        if (activeTab) {
            activeTab.style.opacity = '0';
            activeTab.style.transform = 'translateY(10px)';
            
            setTimeout(() => {
                activeTab.classList.remove('active');
                
                // Показываем новую вкладку
                const targetTab = document.getElementById(tabId);
                if (targetTab) {
                    targetTab.classList.add('active');
                    
                    // Запускаем анимацию появления
                    requestAnimationFrame(() => {
                        targetTab.style.opacity = '0';
                        targetTab.style.transform = 'translateY(-10px)';
                        
                        requestAnimationFrame(() => {
                            targetTab.style.transition = 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                            targetTab.style.opacity = '1';
                            targetTab.style.transform = 'translateY(0)';
                            
                            setTimeout(() => {
                                targetTab.style.transition = '';
                                resolve();
                            }, 400);
                        });
                    });
                }
            }, 50);
        }
    });
}

// 🔧 УЛУЧШЕННАЯ ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ ВКЛАДОК
function enhancedShowTab(tabId) {
    // Используем requestAnimationFrame для плавности
    requestAnimationFrame(() => {
        hideAllTabs();
        const targetTab = document.getElementById(tabId);
        if (targetTab) {
            targetTab.classList.add('active');
            updateNavState(tabId.replace('-tab', ''));
            
            // Запускаем микро-задержку для браузера
            setTimeout(() => {
                // Принудительный reflow для запуска анимации
                targetTab.offsetHeight;
            }, 10);
        }
    });
}

// 🔧 ПЛАВНОЕ ОТКРЫТИЕ/ЗАКРЫТИЕ МОДАЛЬНЫХ ОКОН
function smoothOpenModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.style.display = 'flex';
    
    requestAnimationFrame(() => {
        modal.classList.add('active');
    });
}

function smoothCloseModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.classList.remove('active');
    
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

// 🌊 ФУНКЦИЯ ДЛЯ RIPPLE ЭФФЕКТА
function createRipple(event) {
    const button = event.currentTarget;
    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;
    
    const rect = button.getBoundingClientRect();
    
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - rect.left - radius}px`;
    circle.style.top = `${event.clientY - rect.top - radius}px`;
    circle.classList.add('ripple');
    
    const ripple = button.getElementsByClassName('ripple')[0];
    if (ripple) {
        ripple.remove();
    }
    
    button.appendChild(circle);
}

// 🔧 ДОБАВЛЕНИЕ RIPPLE ЭФФЕКТА КО ВСЕМ КНОПКАМ
function initializeRippleEffects() {
    const buttons = document.querySelectorAll('.btn, .task-btn, .nav-item');
    buttons.forEach(button => {
        button.addEventListener('click', createRipple);
    });
}

// 🚀 ОПТИМИЗАЦИЯ ПРОКРУТКИ
function smoothScrollTo(element, duration = 500) {
    const target = typeof element === 'string' ? document.querySelector(element) : element;
    if (!target) return;
    
    const targetPosition = target.getBoundingClientRect().top + window.pageYOffset;
    const startPosition = window.pageYOffset;
    const distance = targetPosition - startPosition;
    let startTime = null;
    
    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const run = easeInOutQuad(timeElapsed, startPosition, distance, duration);
        window.scrollTo(0, run);
        if (timeElapsed < duration) requestAnimationFrame(animation);
    }
    
    function easeInOutQuad(t, b, c, d) {
        t /= d/2;
        if (t < 1) return c/2*t*t + b;
        t--;
        return -c/2 * (t*(t-2) - 1) + b;
    }
    
    requestAnimationFrame(animation);
}

// 🔧 ПРЕДЗАГРУЗКА РЕСУРСОВ ДЛЯ БОЛЕЕ ПЛАВНЫХ ПЕРЕХОДОВ
function preloadResources() {
    // Предзагрузка важных изображений
    const imagesToPreload = [
        'free-icon-home-7102764.png',
        'free-icon-task-list-4173330.png',
        'free-icon-profile-4042565.png'
    ];
    
    imagesToPreload.forEach(src => {
        const img = new Image();
        img.src = src;
    });
}

// 🎯 ОПТИМИЗАЦИЯ АНИМАЦИЙ С ИСПОЛЬЗОВАНИЕМ WILL-CHANGE
function optimizeAnimations() {
    const animatedElements = document.querySelectorAll('.task-card, .card, .modal-content');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.willChange = 'transform, opacity';
            } else {
                // Освобождаем ресурсы когда элемент не виден
                setTimeout(() => {
                    entry.target.style.willChange = 'auto';
                }, 300);
            }
        });
    });
    
    animatedElements.forEach(el => observer.observe(el));
}

// 🔧 ФУНКЦИЯ ДЛЯ ОТЛОЖЕННОЙ ЗАГРУЗКИ НЕКРИТИЧНЫХ РЕСУРСОВ
function lazyLoadImages() {
    const lazyImages = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy-load');
                img.classList.add('loaded');
                imageObserver.unobserve(img);
            }
        });
    });
    
    lazyImages.forEach(img => imageObserver.observe(img));
}

// 🚀 ОБНОВЛЕННЫЕ ФУНКЦИИ НАВИГАЦИИ С АНИМАЦИЯМИ
function smoothShowMainTab() {
    smoothShowTab('main-tab');
}

function smoothShowTasksTab() {
    smoothShowTab('tasks-tab').then(() => {
        // Дополнительные действия после перехода
        loadTasksForCategory('new');
    });
}

function smoothShowProfileTab() {
    smoothShowTab('profile-tab');
}

function smoothShowAdminTab() {
    smoothShowTab('admin-tab');
}

// 🔧 ОБНОВЛЕНИЕ СУЩЕСТВУЮЩИХ ФУНКЦИЙ ДЛЯ ПЛАВНОСТИ
// Переопределяем существующие функции навигации
window.showMainTab = smoothShowMainTab;
window.showTasksTab = smoothShowTasksTab;
window.showProfileTab = smoothShowProfileTab;
window.showAdminTab = smoothShowAdminTab;

// Обновляем функции модальных окон
window.openTaskModal = function(taskId) {
    // ... существующий код ...
    smoothOpenModal('task-modal');
};

window.closeModal = function(modalId) {
    smoothCloseModal(modalId);
};

// 🎯 ИНИЦИАЛИЗАЦИЯ ОПТИМИЗАЦИЙ ПРИ ЗАГРУЗКЕ
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация ripple эффектов
    initializeRippleEffects();
    
    // Оптимизация анимаций
    optimizeAnimations();
    
    // Ленивая загрузка изображений
    lazyLoadImages();
    
    // Предзагрузка ресурсов
    preloadResources();
    
    // Оптимизация для тач-устройств
    if ('ontouchstart' in window) {
        document.body.classList.add('touch-device');
    }
    
    console.log('🚀 Smooth animations initialized');
});

// 🔧 ДОПОЛНИТЕЛЬНЫЕ ОПТИМИЗАЦИИ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
// Дебаунс для частых операций
function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

// Троттлинг для скролла и ресайза
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// Применяем оптимизации к обработчикам
window.addEventListener('scroll', throttle(function() {
    // Оптимизированные операции при скролле
}, 100));

window.addEventListener('resize', debounce(function() {
    // Оптимизированные операции при ресайзе
}, 250));

// 🔧 ФИКС ДЛЯ iOS SMOOTH SCROLL
if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    document.body.style['-webkit-overflow-scrolling'] = 'touch';
}

        // 🔧 HTML ДЛЯ НОВЫХ ЗАДАНИЙ
        function createNewTaskHTML(task) {
            const categoryDisplay = formatCategory(task.category);
            const shortDescription = task.description.length > 120 
                ? task.description.substring(0, 120) + '...' 
                : task.description;
            
            const peopleRequired = task.people_required || 1;
            const completedCount = task.completed_count || 0;
            const availableTasks = Math.max(0, peopleRequired - completedCount);
            
            return `
                ${availableTasks > 0 ? `<div class="task-availability">${availableTasks} осталось</div>` : ''}
                
                <div class="task-header">
                    <div class="task-title">${escapeHtml(task.title)}</div>
                    <div class="task-price">${task.price} ⭐</div>
                </div>
                
                <div class="task-meta">
                    <div class="task-category">${categoryDisplay}</div>
                    ${task.difficulty ? `<div class="task-difficulty ${task.difficulty.toLowerCase()}">${task.difficulty}</div>` : ''}
                </div>
                
                
                ${peopleRequired > 1 ? `
                    <div class="task-progress">
                        <div class="task-progress-bar" style="width: ${Math.min(100, (completedCount / peopleRequired) * 100)}%"></div>
                    </div>
                    <div class="task-progress-text">
                        Выполнено: ${completedCount}/${peopleRequired}
                    </div>
                ` : ''}
                
                <div class="task-footer">
                    <div class="task-time">${task.time_to_complete || '5-10 минут'}</div>
                    <button class="task-btn" onclick="event.stopPropagation(); openTaskModal(${task.id})">
                        Начать задание
                    </button>
                </div>
            `;
        }

        // 🔧 HTML ДЛЯ ЗАДАНИЙ НА ПОДТВЕРЖДЕНИИ
        function createConfirmationTaskHTML(task) {
            return `
                <div class="task-header">
                    <div style="flex: 1;">
                        <div class="task-title">${escapeHtml(task.title)}</div>
                        <div class="task-category">${task.category || 'Общее'}</div>
                    </div>
                    <div class="task-price">${task.price} ⭐</div>
                </div>
                <div class="task-description">${escapeHtml(task.description)}</div>
                <div class="task-footer">
                    <div class="task-time">Ожидает подтверждения</div>
                    <button class="task-btn" onclick="event.stopPropagation(); showTaskConfirmation(${task.id}, '${escapeHtml(task.title)}')">
                        Подтвердить выполнение
                    </button>
                </div>
            `;
        }

        // 🔧 HTML ДЛЯ ВЫПОЛНЕННЫХ ЗАДАНИЙ
        function createCompletedTaskHTML(task) {
            return `
                <div class="task-header">
                    <div style="flex: 1;">
                        <div class="task-title">${escapeHtml(task.title)}</div>
                        <div class="task-category">${task.category || 'Общее'}</div>
                    </div>
                    <div class="task-price">${task.price} ⭐</div>
                </div>
                <div class="task-description">${escapeHtml(task.description)}</div>
                <div class="task-footer">
                    <div class="task-time">Выполнено</div>
                    <div class="task-status completed">✅</div>
                </div>
            `;
        }

     // В index.html - обновим функцию создания карточки отклоненного задания
function createRejectedTaskHTML(task) {
    return `
        <div class="task-header">
            <div style="flex: 1;">
                <div class="task-title">${escapeHtml(task.title)}</div>
                <div class="task-category">${task.category || 'Общее'}</div>
            </div>
            <div class="task-price">${task.price} ⭐</div>
        </div>
        <div class="task-description">${escapeHtml(task.description)}</div>
        
        <!-- Блок с информацией об отклонении -->
        <div class="rejection-info" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 10px; margin: 10px 0;">
            <div style="color: var(--error); font-size: 12px; font-weight: 600; margin-bottom: 5px;">
                ❌ Задание отклонено администратором
            </div>
            <div style="color: var(--text-secondary); font-size: 11px;">
                Если вы считаете, что это ошибка, напишите в поддержку
            </div>
        </div>
        
        <div class="task-footer">
            <div class="task-time">Отклонено</div>
            <button class="support-btn" onclick="openAdminChat()" style="background: var(--accent); color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
                Написать в поддержку
            </button>
        </div>
    `;
}
// В index.html - добавим функцию для открытия чата с контекстом задания
function openSupportChatForTask(task) {
    // Сохраняем информацию о задании для поддержки
    const taskInfo = {
        id: task.id,
        title: task.title,
        price: task.price,
        category: task.category
    };
    
    // Можно сохранить в localStorage или глобальную переменную
    localStorage.setItem('supportTaskContext', JSON.stringify(taskInfo));
    
    // Открываем чат поддержки
    openAdminChat();
    
    // Автоматически добавляем информацию о задании в первое сообщение
    setTimeout(() => {
        const chatInput = document.getElementById('chat-input-field');
        if (chatInput) {
            chatInput.placeholder = `Вопрос по отклоненному заданию: "${task.title}"...`;
        }
    }, 500);
}

// Обновим функцию открытия чата для обработки контекста задания
async function openAdminChat() {
    if (!currentUser) {
        showNotification('Пользователь не авторизован', 'error');
        return;
    }
    
    try {
        console.log('👤 User opening support chat, ID:', currentUser.id);
        
        // Получаем или создаем чат для пользователя
        const chatResult = await makeRequest(`/support/user-chat/${currentUser.id}`);
        
        if (chatResult.success) {
            currentChatId = chatResult.chat.id;
            console.log('✅ Chat ID:', currentChatId);
            
            // Проверяем есть ли контекст задания
            const taskContext = localStorage.getItem('supportTaskContext');
            if (taskContext) {
                const taskInfo = JSON.parse(taskContext);
                
                // Добавляем автоматическое сообщение о задании
                const autoMessage = `Здравствуйте! У меня вопрос по отклоненному заданию: "${taskInfo.title}" (${taskInfo.price}⭐). `;
                const chatInput = document.getElementById('chat-input-field');
                if (chatInput) {
                    chatInput.value = autoMessage;
                }
                
                // Очищаем контекст после использования
                localStorage.removeItem('supportTaskContext');
            }
            
            // Загружаем сообщения
            try {
                const messagesResult = await makeRequest(`/support/chats/${currentChatId}/messages`);
                if (messagesResult.success) {
                    displayChatMessages(messagesResult.messages);
                }
            } catch (messagesError) {
                console.log('No messages yet or error loading messages:', messagesError);
                // Показываем пустой чат с приветствием
                displayChatMessages([]);
            }
            
            // Показываем чат
            document.getElementById('admin-chat').classList.add('active');
            
        } else {
            throw new Error(chatResult.error || 'Failed to create chat');
        }
    } catch (error) {
        console.error('❌ Error opening user chat:', error);
        showNotification('Ошибка открытия чата: ' + error.message, 'error');
    }
}

        // 🔧 ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
        document.addEventListener('DOMContentLoaded', function() {
            // Гарантируем, что изначально показаны новые задания
            setTimeout(() => {
                const newTasksContainer = document.getElementById('new-tasks');
                if (newTasksContainer) {
                    newTasksContainer.classList.add('active');
                    newTasksContainer.style.display = 'block';
                }
                
                // Загружаем новые задания
                loadTasksForCategory('new');
            }, 500);
        });

        // 🔧 ЭКСПОРТ ФУНКЦИЙ
        window.showTaskCategory = showTaskCategory;
        window.loadTasksForCategory = loadTasksForCategory;
        window.displayTasksForCategory = displayTasksForCategory;

// Функция для диагностики подтверждения заданий
function debugTaskConfirmation() {
   
    
    // Проверяем текущие данные
    console.log('- currentUser:', currentUser);
    console.log('- currentUserTaskId:', currentUserTaskId);
    
    // Проверяем модальные окна
    console.log('- confirmation-modal:', document.getElementById('confirmation-modal'));
    console.log('- screenshot-modal:', document.getElementById('screenshot-modal'));
    
    // Проверяем загружены ли задания пользователя
    loadUserTasksForCategory('active').then(() => {
        console.log('✅ Active tasks loaded for debugging');
    });
}

// Временно добавьте кнопку для тестирования
function addConfirmationDebugButton() {
    const debugBtn = document.createElement('button');
    debugBtn.textContent = '🐛 Debug Confirmation';
    debugBtn.style.position = 'fixed';
    debugBtn.style.top = '200px';
    debugBtn.style.right = '10px';
    debugBtn.style.zIndex = '10000';
    debugBtn.style.padding = '10px';
    debugBtn.style.background = 'orange';
    debugBtn.style.color = 'white';
    debugBtn.style.border = 'none';
    debugBtn.style.borderRadius = '5px';
    debugBtn.style.fontSize = '12px';
    debugBtn.onclick = debugTaskConfirmation;
    document.body.appendChild(debugBtn);
}

// Вызовите при загрузке
setTimeout(addConfirmationDebugButton, 3000);

// Добавьте кнопку для тестирования
function addConfirmationDebugButton() {
    const debugBtn = document.createElement('button');
    debugBtn.textContent = '🐛 Debug Confirmation';
    debugBtn.style.position = 'fixed';
    debugBtn.style.top = '200px';
    debugBtn.style.right = '10px';
    debugBtn.style.zIndex = '10000';
    debugBtn.style.padding = '10px';
    debugBtn.style.background = 'orange';
    debugBtn.style.color = 'white';
    debugBtn.style.border = 'none';
    debugBtn.style.borderRadius = '5px';
    debugBtn.style.fontSize = '12px';
    debugBtn.onclick = debugTaskConfirmation;
    document.body.appendChild(debugBtn);
}

// Вызовите при загрузке
setTimeout(addConfirmationDebugButton, 3000);

function checkAdminPanelLoaded() {
    const adminTasksSection = document.getElementById('admin-tasks-section');
    const addTaskButton = document.querySelector('#admin-tasks-section .admin-submit');
    
    console.log('🔍 Checking admin panel:');
    console.log('- Admin tasks section:', !!adminTasksSection);
    console.log('- Add task button:', !!addTaskButton);
    
    if (adminTasksSection && addTaskButton) {
        console.log('✅ Admin panel is properly loaded');
    } else {
        console.log('❌ Admin panel elements missing');
        // Перезагружаем админ-панель через 1 секунду
        setTimeout(() => {
            showAdminSection('tasks');
        }, 1000);
    }
}

// 🔧 РАСШИРЕННАЯ ДИАГНОСТИКА АДМИН-ПАНЕЛИ
function debugAdminPanelFull() {
    console.log('🔍 FULL ADMIN PANEL DEBUG:');
    
    // 1. Проверяем структуру DOM
    console.log('1. DOM STRUCTURE:');
    const adminTab = document.getElementById('admin-tab');
    console.log('- admin-tab:', adminTab);
    console.log('- admin-tab active:', adminTab?.classList.contains('active'));
    
    // 2. Проверяем все секции
    console.log('2. ADMIN SECTIONS:');
    const sections = ['posts', 'tasks', 'verification', 'support', 'payments', 'admins'];
    sections.forEach(section => {
        const sectionEl = document.getElementById(`admin-${section}-section`);
        console.log(`- admin-${section}-section:`, sectionEl);
        console.log(`  display: ${sectionEl?.style.display}`);
        console.log(`  classList: ${sectionEl?.classList}`);
    });
    
    // 3. Проверяем кнопки
    console.log('3. ADMIN BUTTONS:');
    const buttons = document.querySelectorAll('.admin-btn');
    buttons.forEach((btn, index) => {
        console.log(`- Button ${index}:`, btn.textContent);
        console.log(`  onclick:`, btn.getAttribute('onclick'));
    });
    
    // 4. Проверяем текущего пользователя
    console.log('4. CURRENT USER:');
    console.log('- currentUser:', currentUser);
    console.log('- isAdmin:', currentUser?.is_admin);
    console.log('- isMainAdmin:', parseInt(currentUser?.id) === ADMIN_ID);
}

// Вызовем диагностику сразу
setTimeout(debugAdminPanelFull, 1000);
// 🔧 КНОПКА ДЛЯ ПРИНУДИТЕЛЬНОГО ИСПРАВЛЕНИЯ
function addEmergencyFixButton() {
    const fixBtn = document.createElement('button');
    fixBtn.textContent = '🚨 FIX ADMIN PANEL';
    fixBtn.style.position = 'fixed';
    fixBtn.style.top = '150px';
    fixBtn.style.right = '10px';
    fixBtn.style.zIndex = '10000';
    fixBtn.style.padding = '12px';
    fixBtn.style.background = 'red';
    fixBtn.style.color = 'white';
    fixBtn.style.border = 'none';
    fixBtn.style.borderRadius = '5px';
    fixBtn.style.fontSize = '14px';
    fixBtn.style.fontWeight = 'bold';
    
    fixBtn.onclick = function() {
        console.log('🚨 EMERGENCY FIX ACTIVATED');
        emergencyFixAdminPanel();
    };
    
    document.body.appendChild(fixBtn);
}

// 🔧 АВАРИЙНОЕ ИСПРАВЛЕНИЕ АДМИН-ПАНЕЛИ
function emergencyFixAdminPanel() {
    console.log('🔧 Applying emergency fixes...');
    
    // 1. Гарантируем что админ-панель существует
    let adminTab = document.getElementById('admin-tab');
    if (!adminTab) {
        console.log('❌ Admin tab not found, creating...');
        adminTab = document.createElement('div');
        adminTab.id = 'admin-tab';
        adminTab.className = 'tab-content';
        document.querySelector('.main-content').appendChild(adminTab);
    }
    
    // 2. Гарантируем что секция заданий существует
    let tasksSection = document.getElementById('admin-tasks-section');
    if (!tasksSection) {
        console.log('❌ Tasks section not found, creating...');
        tasksSection = document.createElement('div');
        tasksSection.id = 'admin-tasks-section';
        tasksSection.className = 'admin-section';
        tasksSection.style.display = 'none';
        adminTab.appendChild(tasksSection);
        
        // Добавляем базовое содержимое
        tasksSection.innerHTML = `
            <div class="admin-form">
                <h3>➕ Добавить новое задание (EMERGENCY)</h3>
                <p>Секция была восстановлена аварийно</p>
                <button class="admin-submit" onclick="testAddTask()">✅ Тестовая кнопка</button>
            </div>
        `;
    }
    
    // 3. Принудительно показываем секцию
    tasksSection.style.display = 'block';
    tasksSection.style.opacity = '1';
    tasksSection.style.visibility = 'visible';
    
    console.log('✅ Emergency fixes applied');
}



// 🔧 ФУНКЦИЯ ДЛЯ ПРИНУДИТЕЛЬНОГО ИСПРАВЛЕНИЯ LAYOUT
function fixTasksLayout() {
    const tasksTab = document.getElementById('tasks-tab');
    if (!tasksTab) return;
    
    // Принудительно устанавливаем высоту
    tasksTab.style.minHeight = '500px';
    
    // Обновляем все контейнеры заданий
    const containers = ['new-tasks', 'confirmation-tasks', 'completed-tasks', 'rejected-tasks'];
    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            container.style.position = 'relative';
            container.style.minHeight = '300px';
            // Убираем все transition
            container.style.transition = 'none';
        }
    });
    
    console.log('✅ Tasks layout fixed');
}
function showTasksTab() {
    console.log('🎯 ПЕРЕХОД НА ВКЛАДКУ ЗАДАНИЙ - НАЧАЛО');
    
    // 1. Скрываем все вкладки
    hideAllTabs();
    
    // 2. Показываем вкладку заданий
    const tasksTab = document.getElementById('tasks-tab');
    if (tasksTab) {
        tasksTab.classList.add('active');
        console.log('✅ Вкладка заданий активирована');
    }
    
    // 3. Обновляем навигацию
    updateNavState('tasks');
    
    // 4. Сразу активируем вкладку "Новые"
    setTimeout(() => {
        console.log('🔄 Активируем вкладку "Новые"');
        
        // Сбрасываем все активные вкладки
        document.querySelectorAll('.task-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Скрываем все контейнеры
        const containers = ['new-tasks', 'confirmation-tasks', 'completed-tasks', 'rejected-tasks'];
        containers.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container) {
                container.style.display = 'none';
                container.classList.remove('active');
            }
        });
        
        // Активируем вкладку "Новые"
        const newTab = document.querySelector('.task-tab:nth-child(1)');
        const newContainer = document.getElementById('new-tasks');
        
        if (newTab && newContainer) {
            newTab.classList.add('active');
            newContainer.style.display = 'block';
            newContainer.classList.add('active');
            console.log('✅ Вкладка "Новые" активирована');
            
            // НЕМЕДЛЕННО загружаем задания
            console.log('🚀 НЕМЕДЛЕННАЯ ЗАГРУЗКА ЗАДАНИЙ');
            loadTasks();
        }
        
        // Диагностика
        debugTasksLoading();
        
    }, 50); // Уменьшаем задержку
}
// 🔧 ИСПРАВЛЕННАЯ ФУНКЦИЯ ЗАГРУЗКИ ЗАДАНИЙ
async function loadTasks(search = '', category = 'all') {
    try {
        console.log('🎯 START loadTasks:', { 
            search, 
            category, 
            userId: currentUser?.id,
            hasUser: !!currentUser
        });

        // Проверяем авторизацию
        if (!currentUser) {
            console.log('❌ No current user, aborting loadTasks');
            showNotification('Пользователь не авторизован', 'error');
            return;
        }

        const newTasksContainer = document.getElementById('new-tasks');
        
        if (!newTasksContainer) {
            console.log('❌ new-tasks container not found');
            return;
        }

        // Показываем индикатор загрузки
        newTasksContainer.innerHTML = `
            <div class="no-tasks" style="min-height: 200px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                <div class="loading-spinner">⏳</div>
                <div style="margin-top: 16px;">Загружаем задания...</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                    ID: ${currentUser.id}
                </div>
            </div>
        `;

        // Формируем URL с правильными параметрами
        const params = new URLSearchParams();
        params.append('userId', currentUser.id);
        if (search) params.append('search', search);
        if (category && category !== 'all') params.append('category', category);
        
        const url = `/api/tasks?${params.toString()}`;
        console.log('📡 Request URL:', url);

        // Выполняем запрос
        const response = await fetch(API_BASE_URL + url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('📨 Server response:', result);

        if (result.success) {
            allTasks = result.tasks || [];
            console.log(`✅ Loaded ${allTasks.length} tasks:`, allTasks);
            
            // Отображаем задания
            displayTasks(allTasks, 'new');
            
        } else {
            throw new Error(result.error || 'Unknown server error');
        }

    } catch (error) {
        console.error('💥 loadTasks error:', error);
        
        const newTasksContainer = document.getElementById('new-tasks');
        if (newTasksContainer) {
            newTasksContainer.innerHTML = `
                <div class="no-tasks" style="min-height: 200px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                    <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
                    <div>Ошибка загрузки заданий</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin: 8px 0;">
                        ${error.message}
                    </div>
                    <button class="btn btn-primary" onclick="loadTasks()" style="margin-top: 16px;">
                        Попробовать снова
                    </button>
                </div>
            `;
        }
        
        showNotification(`Ошибка загрузки заданий: ${error.message}`, 'error');
    }
}


// В index.html - добавьте функцию для автоматического обновления интерфейса
function updateTaskInterfaces() {
    if (document.getElementById('tasks-tab').classList.contains('active')) {
        const activeCategory = document.querySelector('.task-tab.active');
        if (activeCategory) {
            const category = getActiveCategoryName(activeCategory);
            loadTasksForCategory(category);
        }
    }
}

function getActiveCategoryName(activeTab) {
    const text = activeTab.textContent.toLowerCase();
    if (text.includes('новые')) return 'new';
    if (text.includes('подтверждение')) return 'confirmation';
    if (text.includes('выполненные')) return 'completed';
    if (text.includes('отклоненные')) return 'rejected';
    return 'new';
}


function displayTasks(tasks, category) {
    console.log(`🎯 START displayTasks: ${tasks?.length} tasks for ${category}`);
    
    const container = document.getElementById(category + '-tasks');
    if (!container) {
        console.error('❌ Container not found:', category + '-tasks');
        return;
    }

    console.log('📦 Container found, clearing...');
    container.innerHTML = '';

    if (!tasks || tasks.length === 0) {
        console.log('📭 No tasks to display');
        container.innerHTML = `
            <div class="no-tasks" style="min-height: 200px; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                <div style="font-size: 18px; margin-bottom: 8px;">Заданий пока нет</div>
                <div style="font-size: 14px; color: var(--text-secondary);">
                    Новые задания появятся позже<br>
                    <small>Следите за обновлениями</small>
                </div>
            </div>
        `;
        return;
    }

    console.log(`🎨 Rendering ${tasks.length} tasks...`);
    
    tasks.forEach((task, index) => {
        console.log(`📋 Task ${index}:`, task);
        
        const taskElement = createTaskCardWithImage(task, category, index);
        container.appendChild(taskElement);
    });
    
    console.log('✅ Tasks displayed successfully');
}
// 🔧 КНОПКА ЭКСТРЕННОГО ИСПРАВЛЕНИЯ ДЛЯ ТЕСТИРОВАНИЯ
function addMobileFixButton() {
    const fixBtn = document.createElement('button');
    fixBtn.textContent = '📱 FIX MOBILE';
    fixBtn.style.position = 'fixed';
    fixBtn.style.top = '120px';
    fixBtn.style.right = '10px';
    fixBtn.style.zIndex = '10000';
    fixBtn.style.padding = '10px';
    fixBtn.style.background = 'green';
    fixBtn.style.color = 'white';
    fixBtn.style.border = 'none';
    fixBtn.style.borderRadius = '5px';
    fixBtn.style.fontSize = '12px';
    
    fixBtn.onclick = function() {
        console.log('🚨 APPLYING MOBILE FIXES');
        emergencyMobileFix();
    };
    
    document.body.appendChild(fixBtn);
}

function emergencyMobileFix() {
    // Принудительно сбрасываем все возможные проблемы
    document.querySelectorAll('*').forEach(el => {
        el.style.maxWidth = '100%';
        el.style.boxSizing = 'border-box';
    });
    
    document.body.style.overflowX = 'hidden';
    document.documentElement.style.overflowX = 'hidden';
    
    console.log('✅ Emergency mobile fixes applied');
}

// Добавляем кнопку при загрузке
setTimeout(addMobileFixButton, 2000);
// 🔧 ФУНКЦИЯ ФОРМАТИРОВАНИЯ КАТЕГОРИИ
function formatCategory(category) {
    const categoryMap = {
        'social': '👥 Соцсети',
        'subscribe': '📱 Подписки', 
        'view': '👀 Просмотры',
        'comment': '💬 Комментарии',
        'repost': '🔄 Репосты',
        'general': '📋 Общее',
        'other': '🎯 Другое'
    };
    
    return categoryMap[category] || category;
}
// 🔧 ЗАГРУЗКА ЗАДАНИЙ ПРИ ЗАПУСКЕ ПРИЛОЖЕНИЯ
async function initializeApp() {
    console.log('🎮 Initializing LinkGold app...');

    // 🔥 ПРИНУДИТЕЛЬНАЯ ЗАГРУЗКА ЗАДАНИЙ ПРИ СТАРТЕ
    console.log('🚀 FORCE loading tasks on app start...');
    setTimeout(() => {
        if (currentUser) {
            console.log('👤 User authenticated, loading tasks...');
            loadTasksForCategory('new');
        } else {
            console.log('❌ No user for task loading');
        }
    }, 1000);




    // Показываем загрузку
    showNotification('🔄 Подключаемся к серверу...', 'info');
     // 🔥 ДОБАВИТЬ ЭТО: Предварительная загрузка заданий
    console.log('🚀 ПРЕДВАРИТЕЛЬНАЯ ЗАГРУЗКА ЗАДАНИЙ ПРИ СТАРТЕ');
    setTimeout(() => {
        if (currentUser) {
            loadTasks();
        }
    }, 2000);
    // Проверяем соединение с API
    try {
        console.log('🔍 Testing API connection...');
        const health = await makeRequest('/api/health');
        console.log('✅ API connection successful:', health);
        showNotification('✅ Соединение с сервером установлено!', 'success');
        
        // 🔥 ДИАГНОСТИКА: Проверяем доступность заданий
        console.log('🔍 Проверяем доступность заданий...');
        const debugResult = await makeRequest('/api/debug/tasks');
        console.log('📊 Статус заданий:', debugResult);
        
    } catch (error) {
        console.error('❌ API connection failed:', error);
        showNotification('❌ Не удалось подключиться к серверу', 'error');
        showRetryButton();
        return;
    }
    
    // Принудительно обновляем права администратора
    await refreshAdminRights();
    
    // Настраиваем админ-панель
    setupAdminPanel();
    
    // Инициализируем приложение
    displayUserProfile();
    checkAdminRights();
    loadMainPagePosts();
    
    // 🔥 ВАЖНО: ЗАГРУЖАЕМ ЗАДАНИЯ ПРИ ЗАПУСКЕ ПРИЛОЖЕНИЯ
    console.log('🚀 Pre-loading tasks on app start...');
    loadTasks();
    
    initializeSearch();
    loadUserTasks();
    
    // Запускаем автообновление данных
    startUserDataAutoUpdate();
    
    // Если пользователь админ, загружаем админ-данные
    if (currentUser && (currentUser.is_admin || parseInt(currentUser.id) === ADMIN_ID)) {
        loadAdminChats();
        loadAdminTasks();
        loadTaskVerifications();
        
        // Если это главный админ, загружаем список админов
        if (parseInt(currentUser.id) === ADMIN_ID) {
            setTimeout(() => {
                loadAdminsList();
            }, 500);
        }
    }
    
    console.log('🎉 App initialized successfully');
}
async function loadUserTasksForCategory(status) {
    if (!currentUser) return;
    
    try {
        console.log(`🔄 Loading user tasks for category: ${status}`);
        
        let endpoint = '';
        switch(status) {
            case 'active':
                endpoint = `/api/user/${currentUser.id}/tasks/active`;
                break;
            case 'completed':
                endpoint = `/api/user/${currentUser.id}/tasks?status=completed`;
                break;
            case 'rejected':
                endpoint = `/api/user/${currentUser.id}/tasks?status=rejected`;
                break;
            default:
                return;
        }
        
        const result = await makeRequest(endpoint);
        
        if (result.success) {
            // Для заданий на подтверждение используем user_task_id
            const tasksWithCorrectId = result.tasks.map(task => ({
                ...task,
                id: task.id // это user_task_id для заданий на подтверждение
            }));
            
            displayUserTasksForCategory(tasksWithCorrectId, status);
        } else {
            console.error('❌ Error loading user tasks:', result.error);
        }
    } catch (error) {
        console.error(`❌ Error loading ${status} tasks:`, error);
    }
}

function displayUserTasksForCategory(tasks, status) {
    let container = null;
    
    switch(status) {
        case 'active':
            container = document.getElementById('confirmation-tasks');
            break;
        case 'completed':
            container = document.getElementById('completed-tasks');
            break;
        case 'rejected':
            container = document.getElementById('rejected-tasks');
            break;
    }
    
    if (!container) {
        console.error(`❌ Container not found for status: ${status}`);
        return;
    }
    
    container.innerHTML = '';

    if (!tasks || tasks.length === 0) {
        let message = '';
        switch(status) {
            case 'active':
                message = 'Нет заданий на подтверждение';
                break;
            case 'completed':
                message = 'Нет выполненных заданий';
                break;
            case 'rejected':
                message = 'Нет отклоненных заданий';
                break;
        }
        
        container.innerHTML = `
            <div class="no-tasks" style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                <div style="font-size: 18px; margin-bottom: 8px;">${message}</div>
                <div style="font-size: 14px; color: var(--text-secondary);">
                    ${status === 'active' ? 'Выполненные задания появятся здесь' : 'Следите за обновлениями'}
                </div>
            </div>
        `;
        return;
    }

    console.log(`🎯 Displaying ${tasks.length} tasks for ${status} category`);
    
    tasks.forEach((task, index) => {
        const taskElement = createTaskCardWithImage(task, status, index);
        container.appendChild(taskElement);
    });
}

        // Обновленная функция загрузки заданий пользователя
        async function loadUserTasks() {
            if (!currentUser) return;
            
            try {
                // Загружаем активные задания (на подтверждение)
                const activeResult = await makeRequest(`/user/${currentUser.id}/tasks?status=active`);
                if (activeResult.success) {
                    displayUserTasksForCategory(activeResult.tasks, 'active');
                }
                
                // Загружаем выполненные задания
                const completedResult = await makeRequest(`/user/${currentUser.id}/tasks?status=completed`);
                if (completedResult.success) {
                    displayUserTasksForCategory(completedResult.tasks, 'completed');
                }
                
                // Загружаем отклоненные задания
                const rejectedResult = await makeRequest(`/user/${currentUser.id}/tasks?status=rejected`);
                if (rejectedResult.success) {
                    displayUserTasksForCategory(rejectedResult.tasks, 'rejected');
                }
                
            } catch (error) {
                console.error('Error loading user tasks:', error);
            }
        }

   // В index.html - обновите функцию инициализации поиска
function initializeSearch() {
    const searchInput = document.getElementById('task-search');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            const searchText = e.target.value.trim();
            
            searchTimeout = setTimeout(() => {
                if (searchText.length >= 2 || searchText.length === 0) {
                    // Передаем userId при поиске
                    loadTasks(searchText, getActiveFilter());
                }
            }, 300);
        });
    }
    
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            // Передаем userId при фильтрации
            loadTasks('', filter);
            
            filterButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

// В index.html - добавьте вспомогательную функцию
function getActiveFilter() {
    const activeFilter = document.querySelector('.filter-btn.active');
    return activeFilter ? activeFilter.getAttribute('data-filter') : 'all';
}

function getTabIndex(category) {
    switch(category) {
        case 'new': return 1;
        case 'confirmation': return 2;
        case 'completed': return 3;
        case 'rejected': return 4;
        default: return 1;
    }
}




function openTaskModal(taskId) {
    console.log('📖 Opening task modal for task:', taskId);
    
    selectedTaskId = taskId;
    
    const task = allTasks.find(t => t.id === taskId);
    if (task) {
        console.log('✅ Task found:', task);
        
        document.getElementById('task-modal-title').textContent = task.title;
        document.getElementById('task-modal-category').textContent = task.category || 'Общее';
        document.getElementById('task-modal-price').textContent = `${task.price} ⭐`;
        document.getElementById('task-modal-description').textContent = task.description;
        
        // 🔧 ИСПРАВЛЕНИЕ: Правильное отображение изображения в модальном окне
        const modalImageContainer = document.getElementById('task-modal-image-container');
        if (modalImageContainer) {
            if (task.image_url) {
                modalImageContainer.innerHTML = `
                    <div class="task-image-placeholder">
    <div style="text-align: center;">
        <div style="font-size: 32px; margin-bottom: 8px;">📋</div>
        <div style="font-size: 12px;">Описание задания</div>
    </div>
</div>
                `;
            } else {
                modalImageContainer.innerHTML = `
                    <div class="task-image-placeholder" style="aspect-ratio: 16/9;">
                        <div style="text-align: center; padding: 40px;">
                            <div style="font-size: 32px; margin-bottom: 8px;">📋</div>
                            <div>Описание задания</div>
                        </div>
                    </div>
                `;
            }
        }
        
        // Остальные данные...
        document.getElementById('task-modal-time').textContent = task.time_to_complete || '5 минут';
        document.getElementById('task-modal-difficulty').textContent = task.difficulty || 'Легкая';
        
        const peopleRequired = task.people_required || 1;
        const completedCount = task.completed_count || 0;
        const availableTasks = Math.max(0, peopleRequired - completedCount);
        document.getElementById('task-modal-available').textContent = `${availableTasks} заданий`;
        
        document.getElementById('task-modal').classList.add('active');
        console.log('✅ Task modal opened successfully');
    } else {
        console.error('❌ Task not found in allTasks array');
        showNotification('Ошибка: задание не найдено', 'error');
    }
}
// Функция для исправления URL изображений в существующих заданиях
async function fixExistingTaskImages() {
    try {
        console.log('🔧 Fixing existing task images...');
        
        // Получаем все задания с изображениями
        const tasks = await pool.query(`
            SELECT id, image_url FROM tasks 
            WHERE image_url IS NOT NULL AND image_url != ''
        `);
        
        let fixedCount = 0;
        
        for (const task of tasks.rows) {
            if (task.image_url && !task.image_url.startsWith('http')) {
                // Исправляем URL
                const correctedUrl = `${APP_URL}${task.image_url}`;
                await pool.query(
                    'UPDATE tasks SET image_url = $1 WHERE id = $2',
                    [correctedUrl, task.id]
                );
                fixedCount++;
                console.log(`✅ Fixed image URL for task ${task.id}: ${correctedUrl}`);
            }
        }
        
        console.log(`✅ Fixed ${fixedCount} task images`);
    } catch (error) {
        console.error('❌ Error fixing task images:', error);
    }
}

// Вызовите эту функцию при запуске сервера
fixExistingTaskImages();

function showTaskConfirmation(userTaskId, taskName) {
    console.log('🔍 Confirming task:', { userTaskId, taskName });
    
    if (!userTaskId) {
        showNotification('Ошибка: ID задания не найден', 'error');
        return;
    }
    
    // Проверяем, что userTaskId - число
    const numericTaskId = parseInt(userTaskId);
    if (isNaN(numericTaskId)) {
        showNotification('Ошибка: неверный ID задания', 'error');
        return;
    }
    
    currentUserTaskId = numericTaskId;
    
    // Обновляем модальное окно
    const taskNameElement = document.getElementById('confirmation-task-name');
    const taskTextElement = document.getElementById('confirmation-task-text');
    
    if (taskNameElement) {
        taskNameElement.textContent = taskName;
    }
    
    if (taskTextElement) {
        taskTextElement.textContent = `Вы выполнили задание "${taskName}"?`;
    }
    
    // Показываем модальное окно
    const confirmationModal = document.getElementById('confirmation-modal');
    if (confirmationModal) {
        confirmationModal.classList.add('active');
        console.log('✅ Confirmation modal opened for task:', taskName);
    } else {
        console.error('❌ Confirmation modal not found');
        showNotification('Ошибка: модальное окно не найдено', 'error');
    }
}
        // Функции для системы проверки заданий
        function showScreenshotUpload() {
            closeModal('confirmation-modal');
            closeModal('cancel-confirmation-modal');
            
            // Сброс формы
            document.getElementById('screenshot-file').value = '';
            document.getElementById('screenshot-preview').style.display = 'none';
            document.getElementById('file-name').textContent = '';
            document.getElementById('submit-screenshot-btn').disabled = true;
            
            // Настройка обработчика файла
            document.getElementById('screenshot-file').onchange = function(e) {
                const file = e.target.files[0];
                if (file) {
                    document.getElementById('file-name').textContent = file.name;
                    document.getElementById('submit-screenshot-btn').disabled = false;
                    
                    // Показать превью
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const preview = document.getElementById('screenshot-preview');
                        preview.src = e.target.result;
                        preview.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                }
            };
            
            document.getElementById('screenshot-modal').classList.add('active');
        }

        function showCancelConfirmation() {
            closeModal('confirmation-modal');
            document.getElementById('cancel-confirmation-modal').classList.add('active');
        }

        async function submitScreenshot() {
    const fileInput = document.getElementById('screenshot-file');
    if (!fileInput.files[0]) {
        showNotification('Выберите файл скриншота', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('screenshot', fileInput.files[0]);
    formData.append('userId', currentUser.id);

    try {
        const response = await fetch(`${API_BASE_URL}/api/user/tasks/${currentUserTaskId}/submit`, {
            method: 'POST',
            body: formData
            // Не устанавливаем Content-Type, браузер сам установит с boundary
        });

        const result = await response.json();

        if (result.success) {
            showNotification('Скриншот отправлен на проверку!', 'success');
            closeModal('screenshot-modal');
            loadUserTasks();
        } else {
            showNotification('Ошибка: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error submitting screenshot:', error);
        showNotification('Ошибка отправки скриншота', 'error');
    }
}

// Обновите функцию отмены задания
async function cancelTask() {
    if (!currentUserTaskId) return;

    try {
        const result = await makeRequest(`/user/tasks/${currentUserTaskId}/cancel`, {
            method: 'POST',
            body: JSON.stringify({
                userId: currentUser.id
            })
        });

        if (result.success) {
            showNotification('Задание отменено', 'success');
            closeModal('cancel-confirmation-modal');
            
            // НЕМЕДЛЕННО обновляем списки
            setTimeout(() => {
                loadTasks(); // Возвращаем задание в новые
                loadUserTasks(); // Убираем из активных
            }, 500);
            
        } else {
            showNotification('Ошибка: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error cancelling task:', error);
        showNotification('Ошибка отмены задания', 'error');
    }
}

        // Загрузка заданий на проверку для админа
async function loadTaskVerifications() {
    if (!currentUser) return;

    try {
        const result = await makeRequest(`/admin/task-verifications?adminId=${currentUser.id}`);
        if (result.success) {
            displayTaskVerifications(result.verifications);
        }
    } catch (error) {
        console.error('Error loading task verifications:', error);
    }
}

        // Отображение заданий на проверку
        function displayTaskVerifications(verifications) {
            const container = document.getElementById('admin-verification-list');
            if (!container) return;

            container.innerHTML = '';

            if (!verifications || verifications.length === 0) {
                container.innerHTML = `
                    <div class="no-tasks" style="text-align: center; padding: 40px 20px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
                        <div>Нет заданий на проверке</div>
                        <div style="font-size: 14px; color: var(--text-secondary); margin-top: 8px;">
                            Все задания проверены
                        </div>
                    </div>
                `;
                return;
            }

            verifications.forEach(verification => {
                const verificationElement = document.createElement('div');
                verificationElement.className = 'verification-item';
                verificationElement.onclick = () => openVerificationModal(verification);

                const userAvatar = verification.user_name ? verification.user_name.charAt(0).toUpperCase() : 'U';
                const submissionTime = formatPostDate(verification.submitted_at);

                verificationElement.innerHTML = `
                    <div class="verification-header">
                        <div class="verification-avatar">
                            ${userAvatar}
                        </div>
                        <div class="verification-user-info">
                            <div class="verification-user-name">
                                ${verification.user_name}
                                ${verification.username ? `(@${verification.username})` : ''}
                            </div>
                            <div class="verification-task-title">${verification.task_title}</div>
                        </div>
                        <div class="verification-price">${verification.task_price} ⭐</div>
                    </div>
                    <div class="verification-time">Отправлено: ${submissionTime}</div>
                `;

                container.appendChild(verificationElement);
            });
        }

        // Открыть модальное окно проверки задания
        function openVerificationModal(verification) {
            currentVerificationId = verification.id;

            document.getElementById('verification-user-avatar').textContent = 
                verification.user_name ? verification.user_name.charAt(0).toUpperCase() : 'U';
            document.getElementById('verification-user-name').textContent = verification.user_name;
            document.getElementById('verification-task-title').textContent = verification.task_title;
            document.getElementById('verification-task-price').textContent = verification.task_price + ' ⭐';
            
            // Загрузка скриншота
            const screenshotImg = document.getElementById('verification-screenshot');
            screenshotImg.src = verification.screenshot_url;
            screenshotImg.onerror = function() {
                this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjMWExYTNhIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM4YjlkZGEiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K';
            };

            document.getElementById('verification-modal').classList.add('active');
        }

        // Одобрить задание
async function approveVerification() {
    if (!currentVerificationId) return;

    try {
        console.log(`🔄 Одобряем верификацию: ${currentVerificationId}`);
        
        const result = await makeRequest(`/admin/task-verifications/${currentVerificationId}/approve`, {
            method: 'POST',
            body: JSON.stringify({
                adminId: currentUser.id
            })
        });

        if (result.success) {
            console.log('✅ Одобрение успешно');
            showNotification(`✅ Задание одобрено! Пользователь получил ${result.amountAdded}⭐`, 'success');
            closeModal('verification-modal');
            
            // ОБНОВЛЯЕМ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ
            await updateUserData();
            
            // Обновляем списки
            loadTaskVerifications();
            loadUserTasks();
            
        } else {
            console.error('❌ Ошибка одобрения:', result.error);
            showNotification('Ошибка одобрения: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('❌ Сетевая ошибка при одобрении:', error);
        showNotification('Сетевая ошибка при одобрении задания', 'error');
    }
}
// В навигацию добавьте временно кнопку для теста
function addDebugButton() {
    const debugBtn = document.createElement('button');
    
    debugBtn.style.position = 'fixed';
    debugBtn.style.top = '10px';
    debugBtn.style.right = '10px';
    debugBtn.style.zIndex = '10000';
    debugBtn.style.padding = '10px';
    debugBtn.style.background = 'red';
    debugBtn.style.color = 'white';
    debugBtn.style.border = 'none';
    debugBtn.style.borderRadius = '5px';
    debugBtn.onclick = debugTasksLoading;
    document.body.appendChild(debugBtn);
}

// Вызовите в initializeApp()
addDebugButton();
        // Отклонить задание
        async function rejectVerification() {
            if (!currentVerificationId) return;

            try {
                const result = await makeRequest(`/admin/task-verifications/${currentVerificationId}/reject`, {
                    method: 'POST',
                    body: JSON.stringify({
                        adminId: currentUser.id
                    })
                });

                if (result.success) {
                    showNotification('Задание отклонено', 'success');
                    closeModal('verification-modal');
                    loadTaskVerifications();
                } else {
                    showNotification('Ошибка: ' + result.error, 'error');
                }
            } catch (error) {
                console.error('Error rejecting verification:', error);
                showNotification('Ошибка отклонения задания', 'error');
            }
        }

        // 🔧 АДМИН-ФУНКЦИИ
        async function addNewPost() {
            const title = document.getElementById('admin-post-title').value;
            const content = document.getElementById('admin-post-content').value;
            
            if (!title || !content) {
                showNotification('Заполните заголовок и содержание поста!', 'error');
                return;
            }
            
            if (!currentUser.isAdmin || parseInt(currentUser.id) !== ADMIN_ID) {
                showNotification('Только администратор может публиковать посты!', 'error');
                return;
            }
            
            try {
                const result = await makeRequest('/posts', {
                    method: 'POST',
                    body: JSON.stringify({
                        title: title,
                        content: content,
                        author: currentUser.firstName,
                        authorId: currentUser.id
                    })
                });

                if (result.success) {
                    showNotification('Пост успешно опубликован!', 'success');
                    document.getElementById('admin-post-title').value = '';
                    document.getElementById('admin-post-content').value = '';
                    loadMainPagePosts();
                } else {
                    showNotification('Ошибка: ' + result.error, 'error');
                }
                
            } catch (error) {
                console.error('Error adding post:', error);
                showNotification('Ошибка соединения: ' + error.message, 'error');
            }
        }

async function addTask() {
    console.log('🎯 Starting add task function...');
    
    try {
        // Получаем значения из формы
        const taskData = {
            title: document.getElementById('admin-task-title').value.trim(),
            description: document.getElementById('admin-task-description').value.trim(),
            price: document.getElementById('admin-task-price').value,
            category: document.getElementById('admin-task-category').value,
            time_to_complete: document.getElementById('admin-task-time').value || '5-10 минут',
            difficulty: document.getElementById('admin-task-difficulty').value,
            people_required: document.getElementById('admin-task-people').value || 1,
            task_url: document.getElementById('admin-task-url').value || '',
            created_by: currentUser.id
        };

        console.log('📋 Form data collected:', taskData);

        // Валидация
        if (!taskData.title.trim()) {
            showNotification('Введите название задания!', 'error');
            return;
        }
        if (!taskData.description.trim()) {
            showNotification('Введите описание задания!', 'error');
            return;
        }
        if (!taskData.price) {
            showNotification('Введите цену задания!', 'error');
            return;
        }

        const price = parseFloat(taskData.price);
        if (isNaN(price) || price <= 0) {
            showNotification('Цена должна быть положительным числом!', 'error');
            return;
        }

        // Подготавливаем данные для отправки
        const requestData = {
            title: taskData.title.trim(),
            description: taskData.description.trim(),
            price: price,
            category: taskData.category || 'general',
            time_to_complete: taskData.time_to_complete || '5-10 минут',
            difficulty: taskData.difficulty || 'Легкая',
            people_required: parseInt(taskData.people_required) || 1,
            task_url: taskData.task_url || '',
            created_by: currentUser.id
        };

        console.log('📤 Sending request to server:', requestData);

        const result = await makeRequest('/api/tasks', {
            method: 'POST',
            body: JSON.stringify(requestData)
        });

        console.log('📨 Server response:', result);

        if (result.success) {
            showNotification('✅ Задание успешно создано!', 'success');
            
            // Очищаем форму
            clearTaskForm();
            
            // Обновляем списки заданий
            setTimeout(() => {
                loadAdminTasks();
                loadTasks();
            }, 1000);
            
        } else {
            throw new Error(result.error || 'Unknown server error');
        }

    } catch (error) {
        console.error('💥 Error in addTask:', error);
        showNotification(`❌ Ошибка создания задания: ${error.message}`, 'error');
    }
}
// Добавьте эту функцию для отладки
function debugTaskCreation() {
    
    console.log('- currentUser:', currentUser);
    console.log('- isAdmin:', currentUser?.is_admin);
    console.log('- API_BASE_URL:', API_BASE_URL);
    
    // Проверьте значения формы
    const formData = {
        title: document.getElementById('admin-task-title').value,
        description: document.getElementById('admin-task-description').value,
        price: document.getElementById('admin-task-price').value,
        created_by: currentUser?.id
    };
    console.log('- Form data:', formData);
}

// Вызовите при создании задания
debugTaskCreation();

// Временно добавьте эту кнопку в админ-панель - УДАЛИТЬ ИЗ SERVER.JS
function addTestButton() {
    const testBtn = document.createElement('button');
    testBtn.textContent = '🧪 Test Task Creation';
    testBtn.className = 'btn btn-warning';
    testBtn.style.margin = '10px';
    testBtn.onclick = testTaskCreation;
    
    const tasksSection = document.getElementById('admin-tasks-section');
    if (tasksSection) {
        tasksSection.appendChild(testBtn);
    }
}

async function testTaskCreation() {
    console.log('🧪 Testing task creation...');
    
    // Заполняем форму тестовыми данными
    document.getElementById('admin-task-title').value = 'Тестовое задание';
    document.getElementById('admin-task-description').value = 'Это тестовое описание задания';
    document.getElementById('admin-task-price').value = '50';
    document.getElementById('admin-task-category').value = 'subscribe';
    document.getElementById('admin-task-time').value = '10 минут';
    document.getElementById('admin-task-difficulty').value = 'Легкая';
    document.getElementById('admin-task-people').value = '5';
    document.getElementById('admin-task-url').value = 'https://example.com';
    
    console.log('✅ Form filled with test data');
    debugTaskCreation();
    
    // Пробуем создать задание
    await addTask();
}



// Вызовите для тестирования
setTimeout(debugAdminForm, 2000);
// 🔧 ФУНКЦИЯ ДЛЯ ЗАГРУЗКИ ЗАДАНИЙ ПРИ ОТКРЫТИИ СЕКЦИИ
function loadAdminTasksSection() {
    console.log('🔄 Loading admin tasks section...');
    
    // Показываем секцию
    const section = document.getElementById('admin-tasks-section');
    if (section) {
        section.style.display = 'block';
        console.log('✅ Admin tasks section shown');
    }
    
    // Загружаем задания
    loadAdminTasks();
}

// 🔧 ОБНОВЛЕННАЯ ФУНКЦИЯ ЗАГРУЗКИ АДМИН-ЗАДАНИЙ
async function loadAdminTasks() {
    console.log('🔄 Loading admin tasks...');
    
    if (!currentUser) {
        console.log('❌ User not authenticated');
        return;
    }
    
    try {
        const result = await makeRequest(`/admin/tasks?adminId=${currentUser.id}`);
        console.log('📨 Admin tasks response:', result);
        
        if (result.success) {
            displayAdminTasks(result.tasks);
        } else {
            console.error('❌ Failed to load admin tasks:', result.error);
            showNotification('Ошибка загрузки заданий: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('❌ Error loading admin tasks:', error);
        showNotification('Ошибка загрузки заданий', 'error');
    }
}


// 🔧 ФУНКЦИЯ ОТОБРАЖЕНИЯ АДМИН-ЗАДАНИЙ

   function displayAdminTasks(tasks) {
    const container = document.getElementById('admin-tasks-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!tasks || tasks.length === 0) {
        // Просто оставляем пустой контейнер без сообщения
        return;
    }
    
    
    tasks.forEach(task => {
        const taskElement = document.createElement('div');
        taskElement.className = 'admin-task-item';
        taskElement.style.cssText = `
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
        `;
        
        taskElement.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">${task.title}</div>
                    <div style="color: var(--text-secondary); font-size: 14px;">${task.description}</div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="admin-task-delete" onclick="deleteTask(${task.id})" style="background: var(--error); color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
                        🗑️ Удалить
                    </button>
                </div>
            </div>
            <div style="display: flex; gap: 12px; font-size: 12px; color: var(--text-secondary);">
                <span>💰 ${task.price} ⭐</span>
                <span>📁 ${task.category || 'general'}</span>
                <span>👥 ${task.people_required || 1} чел.</span>
                <span>⚡ ${task.difficulty || 'Легкая'}</span>
            </div>
            ${task.image_url ? `
                <div style="margin-top: 10px;">
                    <img src="${task.image_url}" alt="Изображение задания" style="max-width: 200px; border-radius: 8px; border: 1px solid var(--border);">
                </div>
            ` : ''}
        `;
        
        container.appendChild(taskElement);
    });
}
// 🔧 ПРИНУДИТЕЛЬНАЯ ИНИЦИАЛИЗАЦИЯ АДМИН-ПАНЕЛИ
function initializeAdminPanel() {
    console.log('🎯 Initializing admin panel...');
    
    // Создаем необходимые элементы если их нет
    const adminTab = document.getElementById('admin-tab');
    if (!adminTab) {
        console.error('❌ Admin tab not found!');
        return;
    }
    
    // Гарантируем что все секции созданы
    const sections = ['posts', 'tasks', 'verification', 'support', 'payments', 'admins'];
    sections.forEach(section => {
        const sectionId = `admin-${section}-section`;
        let sectionElement = document.getElementById(sectionId);
        
        if (!sectionElement) {
            console.log(`⚠️ Creating missing section: ${sectionId}`);
            sectionElement = document.createElement('div');
            sectionElement.id = sectionId;
            sectionElement.className = 'admin-section';
            sectionElement.style.display = 'none';
            sectionElement.innerHTML = `<div>Section ${section} will be loaded here</div>`;
            adminTab.appendChild(sectionElement);
        }
    });
    
    console.log('✅ Admin panel initialized');
}

// Вызовите при загрузке
setTimeout(initializeAdminPanel, 500);

        async function deletePost(postId) {
            if (!confirm('Удалить этот пост?')) return;
            
            if (!currentUser.isAdmin || parseInt(currentUser.id) !== ADMIN_ID) {
                showNotification('Только администратор может удалять посты!', 'error');
                return;
            }
            
            try {
                const result = await makeRequest(`/posts/${postId}`, {
                    method: 'DELETE',
                    body: JSON.stringify({ authorId: currentUser.id })
                });

                if (result.success) {
                    showNotification('Пост успешно удален!', 'success');
                    loadMainPagePosts();
                } else {
                    showNotification('Ошибка: ' + result.error, 'error');
                }
            } catch (error) {
                console.error('Error deleting post:', error);
                showNotification('Ошибка соединения: ' + error.message, 'error');
            }
        }

        async function deleteTask(taskId) {
    if (!confirm('Удалить это задание?')) return;
    
    if (!currentUser || !currentUser.isAdmin || parseInt(currentUser.id) !== ADMIN_ID) {
        showNotification('Только администратор может удалять задания!', 'error');
        return;
    }
    
    try {
        const result = await makeRequest(`/tasks/${taskId}`, {
            method: 'DELETE',
            body: JSON.stringify({ adminId: currentUser.id })
        });

        if (result.success) {
            showNotification('Задание успешно удалено!', 'success');
            loadAdminTasks();
            loadTasks();
        } else {
            showNotification('Ошибка: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        showNotification('Ошибка удаления задания: ' + error.message, 'error');
    }
}
     async function openAdminChat() {
    if (!currentUser) {
        showNotification('Пользователь не авторизован', 'error');
        return;
    }
    
    try {
        console.log('👤 User opening support chat, ID:', currentUser.id);
        
        // Получаем или создаем чат для пользователя
        const chatResult = await makeRequest(`/support/user-chat/${currentUser.id}`);
        
        if (chatResult.success) {
            currentChatId = chatResult.chat.id;
            console.log('✅ Chat ID:', currentChatId);
            
            // Загружаем сообщения
            try {
                const messagesResult = await makeRequest(`/support/chats/${currentChatId}/messages`);
                if (messagesResult.success) {
                    displayChatMessages(messagesResult.messages);
                }
            } catch (messagesError) {
                console.log('No messages yet or error loading messages:', messagesError);
                // Показываем пустой чат с приветствием
                displayChatMessages([]);
            }
            
            // Показываем чат
            document.getElementById('admin-chat').classList.add('active');
            
        } else {
            throw new Error(chatResult.error || 'Failed to create chat');
        }
    } catch (error) {
        console.error('❌ Error opening user chat:', error);
        showNotification('Ошибка открытия чата: ' + error.message, 'error');
    }
}
        

// Обновите функцию отправки сообщения в чат
async function sendMessageToAdmin() {
    if (!currentUser || !currentChatId) {
        showNotification('Чат не открыт', 'error');
        return;
    }
    
    const input = document.getElementById('chat-input-field');
    const message = input.value.trim();
    
    if (!message) {
        showNotification('Введите сообщение', 'error');
        return;
    }
    
    try {
        console.log(`✉️ User sending message to chat ${currentChatId}:`, message);
        
        const userFullName = currentUser.lastName ? 
            `${currentUser.firstName} ${currentUser.lastName}` : 
            currentUser.firstName;
        
        const result = await makeRequest(`/support/chats/${currentChatId}/messages`, {
            method: 'POST',
            body: JSON.stringify({
                user_id: currentUser.id,
                user_name: userFullName,
                user_username: currentUser.username,
                message: message,
                is_admin: false
            })
        });
        
        if (result.success) {
            // Добавляем сообщение в интерфейс
            const messagesContainer = document.getElementById('chat-messages');
            const messageElement = document.createElement('div');
            messageElement.className = 'message message-user';
            messageElement.innerHTML = `
                <div class="message-text">${escapeHtml(message)}</div>
                <div class="message-time">${new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</div>
            `;
            messagesContainer.appendChild(messageElement);
            
            input.value = '';
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            showNotification('Сообщение отправлено! Администратор ответит в ближайшее время.', 'success');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('❌ Error sending message:', error);
        showNotification('Ошибка отправки: ' + error.message, 'error');
    }
}

// Обновите функцию отправки сообщения админом
async function sendAdminMessage() {
    if (!currentAdminChat || !currentUser) {
        console.error('No active chat or user');
        showNotification('Чат не выбран', 'error');
        return;
    }
    
    const input = document.getElementById('admin-chat-input');
    if (!input) {
        console.error('Admin chat input not found');
        return;
    }
    
    const message = input.value.trim();
    
    if (!message) {
        showNotification('Введите сообщение', 'error');
        return;
    }
    
    try {
        console.log(`✉️ Admin sending message to chat ${currentAdminChat.id}:`, message);
        
        const result = await makeRequest(`/support/chats/${currentAdminChat.id}/messages`, {
            method: 'POST',
            body: JSON.stringify({
                user_id: currentUser.id,
                user_name: 'Администратор',
                user_username: currentUser.username,
                message: message,
                is_admin: true
            })
        });
        
        if (result.success) {
            // Добавляем сообщение в интерфейс
            const messagesContainer = document.getElementById('admin-chat-messages');
            if (messagesContainer) {
                const messageElement = document.createElement('div');
                messageElement.className = 'message message-admin';
                messageElement.innerHTML = `
                    <div class="message-text">${escapeHtml(message)}</div>
                    <div class="message-time">${new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</div>
                `;
                messagesContainer.appendChild(messageElement);
                
                input.value = '';
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                
                // Обновляем список чатов
                loadAdminChats();
                
                console.log('✅ Admin message sent successfully');
                showNotification('Сообщение отправлено', 'success');
            }
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('❌ Error sending admin message:', error);
        showNotification('Ошибка отправки сообщения: ' + error.message, 'error');
    }
}

// 🔧 ФУНКЦИЯ ДЛЯ ПРИНУДИТЕЛЬНОГО ИСПРАВЛЕНИЯ РАЗМЕТКИ НА МОБИЛЬНЫХ
function fixMobileLayout() {
    console.log('🔧 Applying mobile layout fixes...');
    
    // Принудительно устанавливаем правильные размеры
    const tasksGrid = document.querySelector('.tasks-grid');
    if (tasksGrid) {
        tasksGrid.style.width = '100%';
        tasksGrid.style.margin = '0';
        tasksGrid.style.padding = '0';
        tasksGrid.style.overflow = 'hidden';
    }
    
    // Исправляем все карточки заданий
    const taskCards = document.querySelectorAll('.task-card');
    taskCards.forEach(card => {
        card.style.width = '100%';
        card.style.maxWidth = '100%';
        card.style.boxSizing = 'border-box';
        card.style.margin = '0 0 12px 0';
        card.style.overflow = 'hidden';
    });
    
    // Предотвращаем горизонтальную прокрутку
    document.body.style.overflowX = 'hidden';
    document.documentElement.style.overflowX = 'hidden';
    
    console.log('✅ Mobile layout fixes applied');
}

// Вызываем при загрузке и при изменении размера окна
document.addEventListener('DOMContentLoaded', fixMobileLayout);
window.addEventListener('resize', fixMobileLayout);
window.addEventListener('orientationchange', fixMobileLayout);

// Также вызываем при переключении вкладок
function showTasksTab() {
    console.log('🎯 ПЕРЕХОД НА ВКЛАДКУ ЗАДАНИЙ');
    
    // 1. Скрываем все вкладки
    hideAllTabs();
    
    // 2. Показываем вкладку заданий
    const tasksTab = document.getElementById('tasks-tab');
    if (tasksTab) {
        tasksTab.classList.add('active');
        console.log('✅ Вкладка заданий активирована');
    }
    
    // 3. Обновляем навигацию
    updateNavState('tasks');
    
    // 4. Применяем исправления для мобильных
    setTimeout(fixMobileLayout, 100);
    
    // 5. Активируем вкладку "Новые"
    setTimeout(() => {
        showTaskCategory('new');
    }, 150);
}

        function displayChatMessages(messages) {
            const messagesContainer = document.getElementById('chat-messages');
            if (!messagesContainer) return;
            
            messagesContainer.innerHTML = '';
            
            // Если нет сообщений, показываем приветствие
            if (!messages || messages.length === 0) {
                const welcomeMessage = document.createElement('div');
                welcomeMessage.className = 'message message-admin';
                welcomeMessage.innerHTML = `
                    <div class="message-text">Здравствуйте! Чем могу помочь?</div>
                    <div class="message-time">${new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</div>
                `;
                messagesContainer.appendChild(welcomeMessage);
                return;
            }
            
            // Показываем существующие сообщения
            messages.forEach(message => {
                const messageElement = document.createElement('div');
                messageElement.className = message.is_admin ? 'message message-admin' : 'message message-user';
                
                messageElement.innerHTML = `
                    <div class="message-text">${escapeHtml(message.message)}</div>
                    <div class="message-time">${formatPostDate(message.sent_at)}</div>
                `;
                messagesContainer.appendChild(messageElement);
            });
            
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        function closeChat() {
            document.getElementById('admin-chat').classList.remove('active');
            currentChatId = null;
        }

        // 🔧 ФУНКЦИИ НАВИГАЦИИ
        function showMainTab() {
            hideAllTabs();
            document.getElementById('main-tab').classList.add('active');
            updateNavState('main');
        }

        function showTasksTab() {
            hideAllTabs();
            document.getElementById('tasks-tab').classList.add('active');
            updateNavState('tasks');
        }

        function showProfileTab() {
            hideAllTabs();
            document.getElementById('profile-tab').classList.add('active');
            updateNavState('profile');
        }
// 🔧 ФУНКЦИЯ УДАЛЕНИЯ ЗАДАНИЯ
async function deleteTask(taskId) {
    if (!confirm('Удалить это задание?')) return;
    
    if (!currentUser) {
        showNotification('Пользователь не авторизован', 'error');
        return;
    }
    
    try {
        const result = await makeRequest(`/tasks/${taskId}`, {
            method: 'DELETE',
            body: JSON.stringify({ adminId: currentUser.id })
        });

        if (result.success) {
            showNotification('Задание успешно удалено!', 'success');
            // Перезагружаем список заданий
            loadAdminTasks();
        } else {
            showNotification('Ошибка: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        showNotification('Ошибка удаления задания: ' + error.message, 'error');
    }
}

// 🔧 ДИАГНОСТИКА АДМИН-ПАНЕЛИ С ЗАДАНИЯМИ
function debugAdminTasks() {
    console.log('🐛 DEBUG Admin Tasks Section:');
    
    const elements = {
        'admin-tasks-section': document.getElementById('admin-tasks-section'),
        'admin-tasks-list': document.getElementById('admin-tasks-list'),
        'admin-task-title': document.getElementById('admin-task-title'),
        'add-task-button': document.querySelector('#admin-tasks-section .admin-submit')
    };
    
    Object.keys(elements).forEach(key => {
        const element = elements[key];
        console.log(`- ${key}:`, element ? 'FOUND' : 'NOT FOUND');
        if (element) {
            console.log(`  - display: ${element.style.display}`);
            console.log(`  - visible: ${element.offsetParent !== null}`);
        }
    });
    
    // Проверяем текущего пользователя
    console.log('- currentUser:', currentUser);
    console.log('- isAdmin:', currentUser?.is_admin);
}

// Добавьте кнопку для тестирования
function addAdminDebugButton() {
    const debugBtn = document.createElement('button');
    
    debugBtn.style.position = 'fixed';
    debugBtn.style.top = '100px';
    debugBtn.style.right = '10px';
    debugBtn.style.zIndex = '10000';
    debugBtn.style.padding = '10px';
    debugBtn.style.background = 'orange';
    debugBtn.style.color = 'white';
    debugBtn.style.border = 'none';
    debugBtn.style.borderRadius = '5px';
    debugBtn.style.fontSize = '12px';
    debugBtn.onclick = function() {
        debugAdminTasks();
        loadAdminTasksSection();
    };
    document.body.appendChild(debugBtn);
}

// Вызовите при загрузке
setTimeout(addAdminDebugButton, 2000);
        // Функция показа вкладки админа - ИСПРАВЛЕННАЯ ВЕРСИЯ
function showAdminTab() {
    const isMainAdmin = parseInt(currentUser?.id) === ADMIN_ID;
    const isRegularAdmin = currentUser?.is_admin === true;
    
    if (!currentUser || (!isMainAdmin && !isRegularAdmin)) {
        showNotification('Доступ запрещен!', 'error');
        return;
    }
    
    hideAllTabs();
    document.getElementById('admin-tab').classList.add('active');
    updateNavState('admin');
}

        function showWithdrawPage() {
            hideAllTabs();
            document.getElementById('withdraw-page').classList.add('active');
            
            // Обновляем баланс на странице вывода
            updateWithdrawPage();
            loadWithdrawHistory();
        }

        function showHowItWorksPage() {
            hideAllTabs();
            document.getElementById('how-it-works-page').classList.add('active');
        }

        function showAboutPage() {
            hideAllTabs();
            document.getElementById('about-page').classList.add('active');
        }

        function goBackToProfile() {
            showProfileTab();
        }

        function hideAllTabs() {
            // Скрываем все вкладки и страницы
            const allElements = document.querySelectorAll('.tab-content, .page');
            allElements.forEach(element => {
                element.classList.remove('active');
            });
        }

        function updateNavState(activeTab) {
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            
            const navItems = document.querySelectorAll('.nav-item');
            switch(activeTab) {
                case 'main': 
                    if (navItems[0]) navItems[0].classList.add('active'); 
                    break;
                case 'tasks': 
                    if (navItems[1]) navItems[1].classList.add('active'); 
                    break;
                case 'profile': 
                    if (navItems[2]) navItems[2].classList.add('active'); 
                    break;
                case 'admin': 
                    if (navItems[3]) navItems[3].classList.add('active'); 
                    break;
            }
        }
// 🔧 ИСПРАВЛЕННАЯ ФУНКЦИЯ ПОКАЗА СЕКЦИЙ АДМИН-ПАНЕЛИ
function showAdminSection(section) {
    console.log('🔄 Switching to admin section:', section);
    
    // Скрываем ВСЕ админ секции
    const adminSections = document.querySelectorAll('.admin-section');
    adminSections.forEach(sec => {
        sec.style.display = 'none';
        console.log(`❌ Hiding: ${sec.id}`);
    });
    
    // Скрываем контейнер "Созданные задания" если он виден
    const createdTasksContainer = document.getElementById('admin-tasks-list');
    if (createdTasksContainer && createdTasksContainer.parentElement) {
        createdTasksContainer.parentElement.style.display = 'none';
    }
    
    // Показываем выбранную секцию
    const targetSection = document.getElementById('admin-' + section + '-section');
    if (targetSection) {
        targetSection.style.display = 'block';
        console.log(`✅ Showing: admin-${section}-section`);
        
        // Загружаем данные для определенных секций
        switch(section) {
            // В функции showAdminSection добавьте обработку секции payments
case 'payments':
    console.log('💳 Loading withdrawal requests...');
    loadWithdrawalRequests();
    break;
            case 'posts':
                console.log('📝 Loading posts management...');
                loadAdminPosts();
                break;
            case 'tasks':
                console.log('📋 Loading tasks management...');
                // Показываем контейнер "Созданные задания" только для секции tasks
                const tasksContainer = document.getElementById('admin-tasks-list');
                if (tasksContainer && tasksContainer.parentElement) {
                    tasksContainer.parentElement.style.display = 'block';
                }
                setTimeout(() => {
                    loadAdminTasks();
                }, 100);
                break;
            case 'payments':
                console.log('💳 Loading withdrawal requests...');
                loadWithdrawalRequests();
                break;
            case 'verification':
                console.log('✅ Loading task verifications...');
                loadTaskVerifications();
                break;
            case 'support':
                console.log('💬 Loading support chats...');
                loadAdminChats();
                break;
            case 'admins':
                console.log('👥 Loading admins list...');
                loadAdminsList();
                break;
        }
    } else {
        console.error(`❌ Target section not found: admin-${section}-section`);
    }
}
async function loadAdminPosts() {
    try {
        console.log('📝 Loading admin posts...');
        const result = await makeRequest('/posts');
        if (result.success) {
            displayAdminPosts(result.posts);
        }
    } catch (error) {
        console.error('Error loading admin posts:', error);
    }
}

function displayAdminPosts(posts) {
    const container = document.getElementById('admin-posts-list');
    if (!container) {
        console.error('❌ Admin posts container not found');
        return;
    }
    
    container.innerHTML = '';
    
    if (!posts || posts.length === 0) {
        container.innerHTML = `
            <div class="no-tasks" style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                <div>Нет постов</div>
                <div style="font-size: 14px; color: var(--text-secondary); margin-top: 8px;">
                    Создайте первый пост
                </div>
            </div>
        `;
        return;
    }
    
    posts.forEach(post => {
        const postElement = document.createElement('div');
        postElement.className = 'admin-task-item';
        postElement.innerHTML = `
            <div class="admin-task-header">
                <div class="admin-task-title">${post.title}</div>
                <div class="admin-task-actions">
                    <button class="admin-task-delete" onclick="deletePost(${post.id})">
                        🗑️ Удалить
                    </button>
                </div>
            </div>
            <div class="admin-task-description">${post.content}</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                Автор: ${post.author} • ${new Date(post.created_at).toLocaleDateString('ru-RU')}
            </div>
        `;
        container.appendChild(postElement);
    });
}

        // 🎨 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
        function escapeHtml(unsafe) {
            if (!unsafe) return '';
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        function formatPostDate(timestamp) {
            if (!timestamp) return '';
            
            const date = new Date(timestamp);
            
            // Московское время (UTC+3)
            const moscowTime = new Date(date.getTime() + (3 * 60 * 60 * 1000));
            
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const postDate = new Date(moscowTime.getFullYear(), moscowTime.getMonth(), moscowTime.getDate());
            
            const diffTime = now - date;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) {
                // Сегодня
                return `Сегодня, ${moscowTime.toLocaleTimeString('ru-RU', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    timeZone: 'Europe/Moscow'
                })} (МСК)`;
            } else if (diffDays === 1) {
                // Вчера
                return `Вчера, ${moscowTime.toLocaleTimeString('ru-RU', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    timeZone: 'Europe/Moscow'
                })} (МСК)`;
            } else {
                // Раньше
                return `${moscowTime.toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    timeZone: 'Europe/Moscow'
                })}, ${moscowTime.toLocaleTimeString('ru-RU', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    timeZone: 'Europe/Moscow'
                })} (МСК)`;
            }
        }

// Функция запроса вывода средств - ОБНОВЛЕННАЯ ВЕРСИЯ
async function requestWithdraw() {
    if (!currentUser) {
        showNotification('Пользователь не авторизован', 'error');
        return;
    }
    
    const currentBalance = currentUser.balance || 0;
    const MIN_WITHDRAWAL = 200; // Минимальная сумма вывода
    
    if (currentBalance < MIN_WITHDRAWAL) {
        showNotification(`Минимальная сумма для вывода: ${MIN_WITHDRAWAL} ⭐\n\nВаш баланс: ${currentBalance} ⭐`, 'error');
        return;
    }
    
    if (!confirm(`Вы уверены, что хотите вывести ${currentBalance} ⭐?\n\nПосле подтверждения баланс будет обнулен и заявка отправлена администраторам.`)) {
        return;
    }
    
    try {
        console.log('🔄 Отправка запроса на вывод...');
        
        const result = await makeRequest('/withdrawal/request', {
            method: 'POST',
            body: JSON.stringify({
                user_id: currentUser.id,
                amount: currentBalance,
                username: currentUser.username,
                first_name: currentUser.firstName
            })
        });
        
        console.log('📨 Ответ сервера:', result);
        
        if (result.success) {
            // Обновляем баланс пользователя
            currentUser.balance = 0;
            
            // Обновляем отображение
            displayUserProfile();
            updateWithdrawPage();
            
            showNotification(`✅ Заявка на вывод ${currentBalance} ⭐ отправлена! Ожидайте подтверждения администратора.`, 'success');
            
            // Обновляем историю операций
            setTimeout(() => {
                loadWithdrawHistory();
            }, 1000);
            
        } else {
            showNotification('❌ Ошибка: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('❌ Withdrawal error:', error);
        showNotification('❌ Ошибка при выводе средств: ' + error.message, 'error');
    }
}
// Функция загрузки истории выводов
async function loadWithdrawHistory() {
    if (!currentUser) return;
    
    try {
        const result = await makeRequest(`/withdraw/history/${currentUser.id}`);
        if (result.success) {
            displayWithdrawHistory(result.operations);
        }
    } catch (error) {
        console.error('Error loading withdrawal history:', error);
    }
}


// Функция отображения истории выводов
function displayWithdrawHistory(operations) {
    const container = document.getElementById('withdraw-history-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!operations || operations.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                <div style="font-size: 48px; margin-bottom: 16px;">💫</div>
                <div>Нет операций по выводу</div>
                <div style="font-size: 12px; margin-top: 8px;">
                    Минимальная сумма для вывода: 200 ⭐
                </div>
            </div>
        `;
        return;
    }
    
    // Сортируем по дате (новые сверху)
    operations.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    operations.forEach(operation => {
        const operationElement = document.createElement('div');
        operationElement.className = 'withdraw-operation';
        operationElement.style.cssText = `
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.3s ease;
        `;
        
        const statusText = operation.status === 'completed' ? 
            '✅ Выплачено' : 
            '🔄 В обработке';
            
        const statusColor = operation.status === 'completed' ? 
            'var(--success)' : 'var(--warning)';
        
        const date = new Date(operation.created_at).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
        
        operationElement.innerHTML = `
            <div style="flex: 1;">
                <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">
                    ${operation.amount} ⭐
                </div>
                <div style="font-size: 12px; color: var(--text-secondary);">
                    ${date}
                </div>
            </div>
            <div style="color: ${statusColor}; font-weight: 600; font-size: 13px; text-align: right;">
                ${statusText}
                ${operation.completed_at ? `
                    <div style="font-size: 11px; font-weight: normal; margin-top: 2px;">
                        Завершено: ${new Date(operation.completed_at).toLocaleDateString('ru-RU')}
                    </div>
                ` : ''}
            </div>
        `;
        
        container.appendChild(operationElement);
    });
}
// 🔧 ИСПРАВЛЕННАЯ функция загрузки заявок на вывод
async function loadWithdrawalRequests() {
    console.log('🔄 Loading withdrawal requests...');
    
    if (!currentUser) {
        console.log('❌ No current user');
        showNotification('Пользователь не авторизован', 'error');
        return;
    }
    
    try {
        // Сначала проверяем права
        const rightsResult = await makeRequest(`/admin/debug-rights?userId=${currentUser.id}`);
        console.log('🔍 Admin rights check:', rightsResult);
        
        if (!rightsResult.isAdmin) {
            showNotification('❌ У вас нет прав администратора!', 'error');
            return;
        }
        
        const result = await makeRequest(`/admin/withdrawal-requests?adminId=${currentUser.id}`);
        console.log('📨 Withdrawal requests response:', result);
        
        if (result.success) {
            displayWithdrawalRequests(result.requests);
        } else {
            console.error('❌ Failed to load requests:', result.error);
            showNotification('Ошибка загрузки заявок: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('❌ Load withdrawal requests error:', error);
        showNotification('Ошибка загрузки заявок: ' + error.message, 'error');
    }
}

// 🔧 ИСПРАВЛЕННАЯ функция отображения заявок
function displayWithdrawalRequests(requests) {
    const container = document.getElementById('withdrawal-requests-list');
    if (!container) {
        console.error('❌ Container not found');
        return;
    }
    
    container.innerHTML = '';
    
    // Обновляем статистику
    const activeCount = document.getElementById('active-withdrawals-count');
    const totalCount = document.getElementById('total-withdrawals-count');
    
    if (activeCount) activeCount.textContent = requests.length;
    if (totalCount) totalCount.textContent = requests.length;
    
    if (!requests || requests.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                <div style="font-size: 48px; margin-bottom: 16px;">💫</div>
                <div>Нет активных запросов на вывод</div>
                <div style="font-size: 12px; margin-top: 8px;">Новые запросы появятся здесь</div>
            </div>
        `;
        return;
    }
    
    console.log(`✅ Отображаем ${requests.length} заявок`);
    
    requests.forEach(request => {
        const requestElement = document.createElement('div');
        requestElement.className = 'admin-task-item';
        requestElement.style.marginBottom = '15px';
        
        const userName = request.first_name || request.username || `User_${request.user_id}`;
        const requestDate = new Date(request.created_at).toLocaleString('ru-RU');
        
        requestElement.innerHTML = `
            <div class="admin-task-header">
                <div class="admin-task-title">
                    ${userName}
                    ${request.username ? ` (@${request.username})` : ''}
                </div>
                <div class="admin-task-price" style="font-size: 20px; color: var(--gold);">
                    ${request.amount} ⭐
                </div>
            </div>
            <div class="admin-task-description">
                <div>ID пользователя: ${request.user_id}</div>
                <div>Запрос создан: ${requestDate}</div>
            </div>
            <div class="admin-task-actions" style="margin-top: 10px; display: flex; gap: 10px;">
                <button class="admin-task-approve" onclick="completeWithdrawal(${request.id})" 
                        style="background: var(--success); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; flex: 1;">
                    ✅ Перечислил средства
                </button>
            </div>
        `;
        
        container.appendChild(requestElement);
    });
}

// 🔧 ИСПРАВЛЕННАЯ функция подтверждения выплаты
async function completeWithdrawal(requestId) {
    console.log('🔧 completeWithdrawal called:', {
        requestId,
        currentUser: currentUser,
        currentUserId: currentUser?.id
    });
    
    if (!confirm('Вы уверены, что перечислили средства пользователю?')) {
        return;
    }
    
    try {
        console.log('📤 Sending complete request...');
        const result = await makeRequest(`/admin/withdrawal-requests/${requestId}/complete`, {
            method: 'POST',
            body: JSON.stringify({
                adminId: currentUser.id
            })
        });
        
        console.log('📨 Complete response:', result);
        
        if (result.success) {
            showNotification('✅ Выплата подтверждена!', 'success');
            loadWithdrawalRequests();
        } else {
            showNotification('❌ Ошибка: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('❌ Complete withdrawal error:', error);
        showNotification('❌ Ошибка подтверждения выплаты: ' + error.message, 'error');
    }
}

// Тестовая функция
async function createTestWithdrawal() {
    try {
        const result = await makeRequest('/test-withdrawal', {
            method: 'POST'
        });
        
        if (result.success) {
            showNotification('✅ Тестовая заявка создана!', 'success');
            loadWithdrawalRequests();
        }
    } catch (error) {
        console.error('Test withdrawal error:', error);
    }
}

// Обновите функцию показа секции
function showAdminPaymentsSection() {
    showAdminSection('payments');
    // Загружаем с небольшой задержкой чтобы интерфейс успел отобразиться
    setTimeout(() => {
        loadWithdrawalRequests();
    }, 100);
}

// Обновите функцию показа секции оплат
function showAdminPaymentsSection() {
    showAdminSection('payments');
    loadWithdrawalRequests();
}
       // Обновление страницы вывода
function updateWithdrawPage() {
    const balanceDisplay = document.getElementById('withdraw-balance-display');
    const withdrawBtn = document.getElementById('withdraw-btn');
    const MIN_WITHDRAWAL = 200;
    
    if (balanceDisplay && currentUser) {
        balanceDisplay.textContent = `${currentUser.balance || 0} ⭐`;
    }
    
    if (withdrawBtn && currentUser) {
        const currentBalance = currentUser.balance || 0;
        
        if (currentBalance < MIN_WITHDRAWAL) {
            withdrawBtn.disabled = true;
            withdrawBtn.style.opacity = '0.5';
            withdrawBtn.textContent = `Минимум ${MIN_WITHDRAWAL} ⭐`;
        } else {
            withdrawBtn.disabled = false;
            withdrawBtn.style.opacity = '1';
            withdrawBtn.textContent = `Вывести ${currentBalance} ⭐`;
        }
    }
}

        // Загрузка постов на главную
        async function loadMainPagePosts() {
            try {
                const result = await makeRequest('/posts');
                
                if (result.success && result.posts && result.posts.length > 0) {
                    displayMainPagePosts(result.posts);
                } else {
                    hidePostsSection();
                }
            } catch (error) {
                console.error('Error loading posts:', error);
                hidePostsSection();
            }
        }

        function displayMainPagePosts(posts) {
            const postsSection = document.getElementById('posts-section');
            const postsContainer = document.getElementById('posts-container');
            
            if (!postsContainer) return;
            
            if (postsSection) postsSection.style.display = 'block';
            
            postsContainer.innerHTML = '';
            
            if (!posts || posts.length === 0) {
                postsContainer.innerHTML = `
                    <div class="no-tasks" style="text-align: center; padding: 40px 20px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                        <div>Пока нет публикаций</div>
                        <div style="font-size: 14px; color: var(--text-secondary); margin-top: 8px;">
                            Следите за обновлениями
                        </div>
                    </div>
                `;
                return;
            }
            
            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.className = 'post-item fade-in';
                
                const postDate = formatPostDate(post.timestamp);
                const isAdmin = post.authorId === ADMIN_ID;
                
                postElement.innerHTML = `
                    <div class="post-header">
                        <div style="flex: 1;">
                            <div class="post-title">${escapeHtml(post.title)}</div>
                            <div class="post-author">
                                ${escapeHtml(post.author || 'Администратор')}
                            </div>
                        </div>
                        <div class="post-date">${postDate}</div>
                    </div>
                    
                    <div class="post-content">${escapeHtml(post.content)}</div>
                    
                    ${post.image_url ? `
                        <img src="${post.image_url}" alt="Изображение" class="post-image" onerror="this.style.display='none'">
                    ` : ''}
                    
                    <div class="post-footer">
                        <div class="post-actions">
                            <button class="like-btn" onclick="handleLike(${post.id}, this)">
                                <span class="like-icon">👍</span>
                                <span class="like-count">${post.likes || 0}</span>
                            </button>
                            <button class="dislike-btn" onclick="handleDislike(${post.id}, this)">
                                <span class="dislike-icon">👎</span>
                                <span class="dislike-count">${post.dislikes || 0}</span>
                            </button>
                        </div>
                    </div>
                    
                    ${currentUser && currentUser.isAdmin && parseInt(currentUser.id) === ADMIN_ID ? `
                        <div style="margin-top: 15px; text-align: right;">
                            <button class="admin-task-delete" onclick="deletePost(${post.id})" style="font-size: 12px; padding: 6px 12px;">
                                🗑️ Удалить пост
                            </button>
                        </div>
                    ` : ''}
                `;
                
                postsContainer.appendChild(postElement);
            });
        }

        function hidePostsSection() {
            const postsSection = document.getElementById('posts-section');
            if (postsSection) postsSection.style.display = 'none';
        }

        // Функции для лайков и дизлайков
        async function handleLike(postId, button) {
            try {
                const result = await makeRequest(`/posts/${postId}/like`, {
                    method: 'POST',
                    body: JSON.stringify({
                        userId: currentUser.id
                    })
                });

                if (result.success) {
                    const countElement = button.querySelector('.like-count');
                    countElement.textContent = result.likes;
                    
                    // Визуальная обратная связь
                    button.style.transform = 'scale(1.1)';
                    setTimeout(() => {
                        button.style.transform = 'scale(1)';
                    }, 200);
                }
            } catch (error) {
                console.error('Error liking post:', error);
                // Локальное обновление для демонстрации
                const countElement = button.querySelector('.like-count');
                countElement.textContent = parseInt(countElement.textContent) + 1;
                
                button.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    button.style.transform = 'scale(1)';
                }, 200);
            }
        }

        async function handleDislike(postId, button) {
            try {
                const result = await makeRequest(`/posts/${postId}/dislike`, {
                    method: 'POST',
                    body: JSON.stringify({
                        userId: currentUser.id
                    })
                });

                if (result.success) {
                    const countElement = button.querySelector('.dislike-count');
                    countElement.textContent = result.dislikes;
                    
                    // Визуальная обратная связь
                    button.style.transform = 'scale(1.1)';
                    setTimeout(() => {
                        button.style.transform = 'scale(1)';
                    }, 200);
                }
            } catch (error) {
                console.error('Error disliking post:', error);
                // Локальное обновление для демонстрации
                const countElement = button.querySelector('.dislike-count');
                countElement.textContent = parseInt(countElement.textContent) + 1;
                
                button.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    button.style.transform = 'scale(1)';
                }, 200);
            }
        }

        // Функция для отправки запроса на вывод
        async function submitWithdraw() {
            if (!currentUser) {
                showNotification('Пользователь не авторизован', 'error');
                return;
            }
            
            const amountInput = document.getElementById('withdraw-amount');
            const methodSelect = document.getElementById('withdraw-method');
            const detailsInput = document.getElementById('withdraw-details');
            
            const amount = parseFloat(amountInput?.value);
            const method = methodSelect?.value;
            const details = detailsInput?.value?.trim();
            
            // Валидация
            if (!amount || amount <= 0) {
                showNotification('Введите корректную сумму', 'error');
                return;
            }
            
            if (amount < 50) {
                showNotification('Минимальная сумма вывода: 150 ⭐', 'error');
                return;
            }
            
            if (amount > (currentUser.balance || 0)) {
                showNotification('Недостаточно средств на балансе', 'error');
                return;
            }
            
            if (!method) {
                showNotification('Выберите способ вывода', 'error');
                return;
            }
            
            if (!details) {
                showNotification('Введите реквизиты для вывода', 'error');
                return;
            }
            
            try {
                const result = await makeRequest('/withdrawal/request', {
                    method: 'POST',
                    body: JSON.stringify({
                        user_id: currentUser.id,
                        amount: amount,
                        method: method,
                        details: details
                    })
                });

                if (result.success) {
                    showNotification(`Запрос на вывод ${amount}⭐ отправлен! Ожидайте обработки в течение 24 часов.`, 'success');
                    
                    // Очищаем форму
                    if (amountInput) amountInput.value = '';
                    if (methodSelect) methodSelect.value = '';
                    if (detailsInput) detailsInput.value = '';
                    
                    // Обновляем баланс пользователя
                    if (currentUser.balance) {
                        currentUser.balance -= amount;
                    }
                    
                    // Обновляем отображение баланса
                    displayUserProfile();
                    
                    // Возвращаемся в профиль
                    setTimeout(() => {
                        showProfileTab();
                    }, 2000);
                    
                } else {
                    showNotification('Ошибка: ' + (result.error || 'Неизвестная ошибка'), 'error');
                }
            } catch (error) {
                console.error('Ошибка при выводе средств:', error);
                showNotification('Ошибка соединения при отправке запроса', 'error');
            }
        }

        function showNotification(message, type = 'info') {
            // Удаляем существующие уведомления
            document.querySelectorAll('.notification').forEach(notification => {
                notification.remove();
            });
            
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            notification.innerHTML = `
                <div class="notification-content">${message}</div>
                <button class="notification-close" onclick="this.parentElement.remove()">×</button>
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 5000);
        }

        function copyReferralLink() {
            const referralInput = document.getElementById('referral-link');
            if (!referralInput) return;
            
            referralInput.select();
            referralInput.setSelectionRange(0, 99999);
            
            navigator.clipboard.writeText(referralInput.value).then(() => {
                showNotification('Реферальная ссылка скопирована!', 'success');
            }).catch(() => {
                document.execCommand('copy');
                showNotification('Реферальная ссылка скопирована!', 'success');
            });
        }

        function showBalanceModal() {
            document.getElementById('balance-modal').classList.add('active');
        }

        function showPrices() {
            document.getElementById('prices-modal').classList.add('active');
        }

        function openAdminChatFromPrices() {
            document.getElementById('prices-modal').classList.remove('active');
            setTimeout(() => {
                document.getElementById('admin-chat').classList.add('active');
            }, 300);
        }

        function goToProfile() {
            closeModal('balance-modal');
            showProfileTab();
        }

        function closeModal(modalId) {
            document.getElementById(modalId).classList.remove('active');
        }

// В index.html - обновите функцию начала задания
async function startTask() {
    console.log('🎯 Starting task...', { selectedTaskId, currentUser });
    
    if (!currentUser || !selectedTaskId) {
        showNotification('Ошибка: пользователь не авторизован или задание не выбрано', 'error');
        return;
    }

    try {
        console.log('📤 Sending start task request...');
        
        const result = await makeRequest('/api/user/tasks/start', {
            method: 'POST',
            body: JSON.stringify({
                userId: currentUser.id,
                taskId: selectedTaskId
            })
        });

        console.log('📨 Start task response:', result);

        if (result.success) {
            closeModal('task-modal');
            showNotification('✅ Задание начато! Выполните его и вернитесь для подтверждения.', 'success');
            
            // НЕМЕДЛЕННО обновляем списки заданий
            setTimeout(() => {
                loadTasks(); // Обновляем новые задания (убираем начатое)
                loadUserTasksForCategory('active'); // Добавляем в активные
            }, 500);
            
        } else {
            showNotification('❌ Ошибка: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('💥 Error starting task:', error);
        showNotification('❌ Ошибка начала задания: ' + error.message, 'error');
    }
}

// 🔧 ФУНКЦИЯ ДЛЯ ДИАГНОСТИКИ НАЧАЛА ЗАДАНИЯ
function debugStartTask() {
    console.log('🐛 DEBUG Start Task:');
    console.log('- currentUser:', currentUser);
    console.log('- selectedTaskId:', selectedTaskId);
    console.log('- API_BASE_URL:', API_BASE_URL);
    
    // Проверяем существование задачи
    const task = allTasks.find(t => t.id === selectedTaskId);
    console.log('- task found:', !!task);
    console.log('- task details:', task);
    
    // Проверяем модальное окно
    console.log('- task modal visible:', document.getElementById('task-modal')?.classList.contains('active'));
}

// Временно добавьте кнопку для тестирования
function addStartTaskDebugButton() {
    const debugBtn = document.createElement('button');
    debugBtn.textContent = '🐛 Debug Start Task';
    debugBtn.style.position = 'fixed';
    debugBtn.style.top = '250px';
    debugBtn.style.right = '10px';
    debugBtn.style.zIndex = '10000';
    debugBtn.style.padding = '10px';
    debugBtn.style.background = 'purple';
    debugBtn.style.color = 'white';
    debugBtn.style.border = 'none';
    debugBtn.style.borderRadius = '5px';
    debugBtn.style.fontSize = '12px';
    debugBtn.onclick = debugStartTask;
    document.body.appendChild(debugBtn);
}

// Вызовите при загрузке
setTimeout(addStartTaskDebugButton, 3000);

        async function loadAdminChats() {
    if (!currentUser) return;
    
    try {
        console.log('📥 Loading admin chats...');
        const result = await makeRequest(`/support/chats`);
        
        if (result.success) {
            console.log(`✅ Loaded ${result.chats?.length || 0} active chats`);
            displayAdminChatsList(result.chats || []);
        } else {
            console.error('❌ Failed to load chats:', result.error);
        }
    } catch (error) {
        console.error('❌ Error loading admin chats:', error);
    }
}

        // Загрузка всех чатов (включая архивные)
        async function loadAllAdminChats() {
            if (!currentUser || !currentUser.isAdmin) return;
            
            try {
                const result = await makeRequest(`/support/all-chats?adminId=${ADMIN_ID}`);
                if (result.success) {
                    displayAllAdminChats(result.chats || []);
                }
            } catch (error) {
                console.error('Error loading all chats:', error);
            }
        }

        // Загрузка архивных чатов
        async function loadArchivedAdminChats() {
            if (!currentUser || !currentUser.isAdmin) return;
            
            try {
                const result = await makeRequest(`/support/archived-chats?adminId=${ADMIN_ID}`);
                if (result.success) {
                    displayArchivedAdminChats(result.chats || []);
                }
            } catch (error) {
                console.error('Error loading archived chats:', error);
            }
        }

        // Отображение списка активных чатов
        function displayAdminChatsList(chats) {
            const container = document.getElementById('active-chats-list');
            if (!container) return;
            
            container.innerHTML = '';
            
            if (!chats || chats.length === 0) {
                container.innerHTML = `
                    <div class="no-tasks" style="text-align: center; padding: 20px;">
                        <div style="font-size: 24px; margin-bottom: 10px;">💬</div>
                        <div>Нет активных чатов</div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                            Чаты появятся когда пользователи напишут в поддержку
                        </div>
                    </div>
                `;
                return;
            }
            
            // Обновляем статистику
            updateChatsStats(chats);
            
            chats.forEach(chat => {
                const chatElement = createChatElement(chat, 'active');
                container.appendChild(chatElement);
            });
        }

        // Отображение всех чатов
        function displayAllAdminChats(chats) {
            const container = document.getElementById('all-chats-list');
            if (!container) return;
            
            container.innerHTML = '';
            
            if (!chats || chats.length === 0) {
                container.innerHTML = `
                    <div class="no-tasks" style="text-align: center; padding: 20px;">
                        <div>Нет чатов</div>
                    </div>
                `;
                return;
            }
            
            chats.forEach(chat => {
                const chatElement = createChatElement(chat, 'all');
                container.appendChild(chatElement);
            });
        }

        // Отображение архивных чатов
        function displayArchivedAdminChats(chats) {
            const container = document.getElementById('archived-chats-list');
            if (!container) return;
            
            container.innerHTML = '';
            
            if (!chats || chats.length === 0) {
                container.innerHTML = `
                    <div class="no-tasks" style="text-align: center; padding: 20px;">
                        <div>Нет архивных чатов</div>
                    </div>
                `;
                return;
            }
            
            chats.forEach(chat => {
                const chatElement = createChatElement(chat, 'archived');
                container.appendChild(chatElement);
            });
        }

        // Создание элемента чата
        function createChatElement(chat, listType) {
            const chatElement = document.createElement('div');
            const isUnread = chat.unread_count > 0;
            const isArchived = !chat.is_active;
            
            chatElement.className = `chat-item ${isUnread ? 'unread' : ''} ${isArchived ? 'archived' : ''}`;
            chatElement.onclick = () => openAdminChatWindow(chat);
            
            const avatarText = chat.user_name ? chat.user_name.charAt(0).toUpperCase() : 'U';
            const displayName = chat.user_name || `User_${chat.user_id}`;
            const lastMessage = chat.last_message || 'Нет сообщений';
            
            chatElement.innerHTML = `
                <div class="chat-avatar-small">
                    ${avatarText}
                </div>
                <div class="chat-info-small">
                    <div class="chat-name-small">
                        ${displayName}
                        ${isArchived ? '<span class="archived-badge">архив</span>' : ''}
                    </div>
                    <div class="chat-last-message">${lastMessage}</div>
                </div>
                <div class="chat-meta">
                    <div class="chat-time">${chat.moscow_time || formatPostDate(chat.last_message_time)}</div>
                    ${isUnread ? `<div class="unread-badge">${chat.unread_count}</div>` : ''}
                </div>
                ${listType === 'all' || listType === 'archived' ? `
                    <div class="chat-actions">
                        ${isArchived ? `
                            <button class="chat-action-btn chat-restore-btn" onclick="event.stopPropagation(); restoreChat(${chat.id})" title="Восстановить">
                                ↻
                            </button>
                        ` : `
                            <button class="chat-action-btn chat-archive-btn" onclick="event.stopPropagation(); archiveChat(${chat.id})" title="В архив">
                                📁
                            </button>
                        `}
                        <button class="chat-action-btn chat-delete-btn" onclick="event.stopPropagation(); deleteAdminChat(${chat.id})" title="Удалить">
                            🗑️
                        </button>
                    </div>
                ` : ''}
            `;
            
            return chatElement;
        }

        // Обновление статистики чатов
        function updateChatsStats(chats) {
            const activeChats = chats.filter(chat => chat.is_active).length;
            const unreadChats = chats.filter(chat => chat.unread_count > 0).length;
            const totalChats = chats.length;
            
            const activeCount = document.getElementById('active-chats-count');
            const unreadCount = document.getElementById('unread-chats-count');
            const totalCount = document.getElementById('total-chats-count');
            
            if (activeCount) activeCount.textContent = activeChats;
            if (unreadCount) unreadCount.textContent = unreadChats;
            if (totalCount) totalCount.textContent = totalChats;
        }

        // Переключение между вкладками чатов
        function showChatTab(tab) {
            // Скрываем все списки чатов
            const activeList = document.getElementById('active-chats-list');
            const archivedList = document.getElementById('archived-chats-list');
            const allList = document.getElementById('all-chats-list');
            
            if (activeList) activeList.style.display = 'none';
            if (archivedList) archivedList.style.display = 'none';
            if (allList) allList.style.display = 'none';
            
            // Убираем активный класс со всех кнопок
            document.querySelectorAll('.chat-tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Показываем выбранный список и активируем кнопку
            const buttons = document.querySelectorAll('.chat-tab-btn');
            switch(tab) {
                case 'active':
                    if (activeList) activeList.style.display = 'block';
                    buttons[0]?.classList.add('active');
                    loadAdminChats();
                    break;
                case 'archived':
                    if (archivedList) archivedList.style.display = 'block';
                    buttons[1]?.classList.add('active');
                    loadArchivedAdminChats();
                    break;
                case 'all':
                    if (allList) allList.style.display = 'block';
                    buttons[2]?.classList.add('active');
                    loadAllAdminChats();
                    break;
            }
        }

        // Открытие окна чата админа с пользователем
        async function openAdminChatWindow(chat) {
            console.log('💬 Admin opening chat:', chat);
            currentAdminChat = chat;
            
            try {
                // Загружаем сообщения
                const messagesResult = await makeRequest(`/support/chats/${chat.id}/messages`);
                if (messagesResult.success) {
                    console.log(`📨 Loaded ${messagesResult.messages.length} messages for admin chat`);
                    
                    // Помечаем как прочитанное
                    try {
                        await makeRequest(`/support/chats/${chat.id}/read`, {
                            method: 'PUT'
                        });
                        // Обновляем список чатов (убираем уведомление)
                        loadAdminChats();
                    } catch (readError) {
                        console.log('Mark as read not available');
                    }
                    
                    // Показываем окно чата
                    showAdminChatWindow(chat, messagesResult.messages);
                } else {
                    throw new Error('Failed to load messages');
                }
            } catch (error) {
                console.error('❌ Error opening admin chat:', error);
                showNotification('Ошибка открытия чата: ' + error.message, 'error');
            }
        }

        // Показать окно чата админа
        function showAdminChatWindow(chat, messages) {
            // Создаем окно чата если не существует
            let chatWindow = document.getElementById('admin-chat-window');
            if (!chatWindow) {
                createAdminChatWindow();
                chatWindow = document.getElementById('admin-chat-window');
            }
            
            // Обновляем информацию о пользователе
            const chatUserName = document.getElementById('admin-chat-user-name');
            const chatUserAvatar = document.getElementById('admin-chat-avatar');
            
            if (chatUserName) {
                chatUserName.textContent = chat.user_name || `User_${chat.user_id}`;
            }
            
            if (chatUserAvatar) {
                chatUserAvatar.textContent = chat.user_name ? chat.user_name.charAt(0).toUpperCase() : 'U';
            }
            
            // Отображаем сообщения
            displayAdminChatMessages(messages);
            
            chatWindow.classList.add('active');
        }

        // Создание окна чата админа
        function createAdminChatWindow() {
            const chatWindowHTML = `
                <div class="admin-chat-window" id="admin-chat-window">
                    <div class="admin-chat-header">
                        <div class="admin-chat-user">
                            <div class="chat-avatar-small" id="admin-chat-avatar">U</div>
                            <div class="chat-info-small">
                                <div class="chat-name-small" id="admin-chat-user-name">User</div>
                                <div class="chat-status">Онлайн</div>
                            </div>
                        </div>
                        <button class="chat-close" onclick="closeAdminChat()">×</button>
                    </div>
                    <div class="admin-chat-messages" id="admin-chat-messages">
                        <!-- Сообщения будут загружены здесь -->
                    </div>
                    <div class="admin-chat-input-container">
                        <input type="text" id="admin-chat-input" placeholder="Введите сообщение..." onkeypress="if(event.key==='Enter') sendAdminMessage()">
                        <button class="admin-chat-send" onclick="sendAdminMessage()">➤</button>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', chatWindowHTML);
        }

        // Отображение сообщений в чате админа
        function displayAdminChatMessages(messages) {
            const container = document.getElementById('admin-chat-messages');
            if (!container) {
                console.error('Admin chat messages container not found!');
                return;
            }
            
            container.innerHTML = '';
            
            if (!messages || messages.length === 0) {
                const welcomeMessage = document.createElement('div');
                welcomeMessage.className = 'message message-admin';
                welcomeMessage.innerHTML = `
                    <div class="message-text">Начните диалог с пользователем</div>
                    <div class="message-time">${new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</div>
                `;
                container.appendChild(welcomeMessage);
                return;
            }
            
            messages.forEach(message => {
                const messageElement = document.createElement('div');
                messageElement.className = message.is_admin ? 'message message-admin' : 'message message-user';
                
                let messageContent = '';
                if (message.image_url) {
                    messageContent = `
                        <div class="message-image">
                            <img src="${message.image_url}" alt="Фото" style="max-width: 200px; border-radius: 10px;">
                        </div>
                    `;
                } else {
                    messageContent = `<div class="message-text">${escapeHtml(message.message)}</div>`;
                }
                
                messageElement.innerHTML = `
                    ${messageContent}
                    <div class="message-time">${message.moscow_time || formatPostDate(message.sent_at)}</div>
                `;
                container.appendChild(messageElement);
            });
            
            container.scrollTop = container.scrollHeight;
        }

        // Отправка сообщения админом
        async function sendAdminMessage() {
            if (!currentAdminChat || !currentUser) {
                console.error('No active chat or user');
                showNotification('Чат не выбран', 'error');
                return;
            }
            
            const input = document.getElementById('admin-chat-input');
            if (!input) {
                console.error('Admin chat input not found');
                return;
            }
            
            const message = input.value.trim();
            
            if (!message) {
                showNotification('Введите сообщение', 'error');
                return;
            }
            
            try {
                console.log(`✉️ Admin sending message to chat ${currentAdminChat.id}:`, message);
                
                const result = await makeRequest(`/support/chats/${currentAdminChat.id}/messages`, {
                    method: 'POST',
                    body: JSON.stringify({
                        user_id: currentUser.id,
                        user_name: 'Администратор',
                        message: message,
                        is_admin: true
                    })
                });
                
                if (result.success) {
                    // Добавляем сообщение в интерфейс
                    const messagesContainer = document.getElementById('admin-chat-messages');
                    if (messagesContainer) {
                        const messageElement = document.createElement('div');
                        messageElement.className = 'message message-admin';
                        messageElement.innerHTML = `
                            <div class="message-text">${escapeHtml(message)}</div>
                            <div class="message-time">${new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</div>
                        `;
                        messagesContainer.appendChild(messageElement);
                        
                        input.value = '';
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        
                        // Обновляем список чатов
                        loadAdminChats();
                        
                        console.log('✅ Admin message sent successfully');
                        showNotification('Сообщение отправлено', 'success');
                    }
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                console.error('❌ Error sending admin message:', error);
                showNotification('Ошибка отправки сообщения: ' + error.message, 'error');
            }
        }

        // Закрытие чата админа
        function closeAdminChat() {
            const chatWindow = document.getElementById('admin-chat-window');
            if (chatWindow) {
                chatWindow.classList.remove('active');
            }
            currentAdminChat = null;
        }
// 🔧 ПРОВЕРКА СТРУКТУРЫ БАЗЫ ДАННЫХ
async function checkDatabaseStructure() {
    try {
        console.log('🔍 Checking database structure...');
        const result = await makeRequest('/debug/database');
        console.log('📊 Database structure:', result);
        showNotification('✅ Структура БД проверена', 'success');
    } catch (error) {
        console.error('❌ Database check failed:', error);
        showNotification('❌ Ошибка проверки БД', 'error');
    }
}
        // Архивация чата
        async function archiveChat(chatId) {
            if (!confirm('Переместить чат в архив?')) return;

            try {
                const result = await makeRequest(`/support/chats/${chatId}/archive`, {
                    method: 'PUT',
                    body: JSON.stringify({ adminId: currentUser.id })
                });

                if (result.success) {
                    showNotification('Чат перемещен в архив', 'success');
                    loadAdminChats();
                    loadAllAdminChats();
                } else {
                    showNotification('Ошибка: ' + result.error, 'error');
                }
            } catch (error) {
                console.error('Error archiving chat:', error);
                showNotification('Ошибка архивации чата', 'error');
            }
        }



// Инициализируем тему при загрузке
initTheme();
        // Восстановление чата из архива
        async function restoreChat(chatId) {
            try {
                const result = await makeRequest(`/support/chats/${chatId}/restore`, {
                    method: 'PUT',
                    body: JSON.stringify({ adminId: currentUser.id })
                });

                if (result.success) {
                    showNotification('Чат восстановлен', 'success');
                    loadAdminChats();
                    loadAllAdminChats();
                    loadArchivedAdminChats();
                } else {
                    showNotification('Ошибка: ' + result.error, 'error');
                }
            } catch (error) {
                console.error('Error restoring chat:', error);
                showNotification('Ошибка восстановления чата', 'error');
            }
        }

        // Удаление чата
        async function deleteAdminChat(chatId) {
            if (!confirm('Удалить этот чат? Все сообщения будут удалены.')) return;

            try {
                const result = await makeRequest(`/support/chats/${chatId}`, {
                    method: 'DELETE',
                    body: JSON.stringify({ adminId: currentUser.id })
                });

                if (result.success) {
                    showNotification('Чат удален', 'success');
                    // Обновляем все списки чатов
                    loadAdminChats();
                    loadAllAdminChats();
                    loadArchivedAdminChats();
                    
                    // Если удаленный чат был открыт - закрываем его
                    if (currentAdminChat && currentAdminChat.id === chatId) {
                        closeAdminChat();
                    }
                } else {
                    showNotification('Ошибка: ' + result.error, 'error');
                }
            } catch (error) {
                console.error('Error deleting chat:', error);
                showNotification('Ошибка удаления чата', 'error');
            }
        }
// 🔧 ФУНКЦИЯ ДЛЯ ПОЛНОЙ ОЧИСТКИ АДМИН-ПАНЕЛИ
function resetAdminPanel() {
    console.log('🧹 Resetting admin panel display...');
    
    // Скрываем все секции
    const allSections = document.querySelectorAll('.admin-section');
    allSections.forEach(section => {
        section.style.display = 'none';
    });
    
    // Скрываем контейнер созданных заданий
    const tasksContainer = document.getElementById('admin-tasks-list-container');
    if (tasksContainer) {
        tasksContainer.style.display = 'none';
    }
    
    console.log('✅ Admin panel reset complete');
}

// Вызывайте эту функцию при переключении между основными вкладками
function showAdminTab() {
    const isMainAdmin = parseInt(currentUser?.id) === ADMIN_ID;
    const isRegularAdmin = currentUser?.is_admin === true;
    
    if (!currentUser || (!isMainAdmin && !isRegularAdmin)) {
        showNotification('Доступ запрещен!', 'error');
        return;
    }
    
    hideAllTabs();
    document.getElementById('admin-tab').classList.add('active');
    updateNavState('admin');
    
    // Сбрасываем панель при каждом открытии
    resetAdminPanel();
}
        // Функция для воспроизведения звука при начислении средств
        function playMoneySound() {
            try {
                // Создаем простой звук средствами браузера
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.value = 800;
                oscillator.type = 'sine';
                
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
            } catch (error) {
                console.log('Audio not supported');
            }
        }
// Обработчик Enter для поля ввода имени администратора
function initAdminInputHandlers() {
    const usernameInput = document.getElementById('new-admin-username');
    if (usernameInput) {
        usernameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addNewAdmin();
            }
        });
    }
}

// Инициализация после загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminInputHandlers);
} else {
    initAdminInputHandlers();
}
        // 🔧 ЭКСПОРТ ФУНКЦИЙ
        window.showTaskCategory = showTaskCategory;
        window.loadUserTasksForCategory = loadUserTasksForCategory;
        window.displayUserTasksForCategory = displayUserTasksForCategory;
        window.openAdminChat = openAdminChat;
        window.closeChat = closeChat;
        window.sendMessageToAdmin = sendMessageToAdmin;
        window.openTaskModal = openTaskModal;
        window.startTask = startTask;
        window.closeModal = closeModal;
        window.showBalanceModal = showBalanceModal;
        window.showPrices = showPrices;
        window.openAdminChatFromPrices = openAdminChatFromPrices;
        window.goToProfile = goToProfile;
        window.copyReferralLink = copyReferralLink;
        window.submitWithdraw = submitWithdraw;
        window.showMainTab = showMainTab;
        window.showTasksTab = showTasksTab;
        window.showProfileTab = showProfileTab;
        window.showAdminTab = showAdminTab;
        window.showHowItWorksPage = showHowItWorksPage;
        window.showAboutPage = showAboutPage;
        window.showWithdrawPage = showWithdrawPage;
        window.showAdminSection = showAdminSection;
        window.addNewPost = addNewPost;
        window.addTask = addTask;
        window.deletePost = deletePost;
        window.deleteTask = deleteTask;
        window.sendAdminMessage = sendAdminMessage;
        window.closeAdminChat = closeAdminChat;
        window.submitTaskCompletion = submitScreenshot;
        window.deleteAdminChat = deleteAdminChat;
        window.archiveChat = archiveChat;
        window.restoreChat = restoreChat;
        window.showChatTab = showChatTab;
        window.handleLike = handleLike;
        window.handleDislike = handleDislike;
        window.showTaskConfirmation = showTaskConfirmation;
        window.showScreenshotUpload = showScreenshotUpload;
        window.showCancelConfirmation = showCancelConfirmation;
        window.submitScreenshot = submitScreenshot;
        window.cancelTask = cancelTask;
        window.loadTaskVerifications = loadTaskVerifications;
        window.openVerificationModal = openVerificationModal;
        window.approveVerification = approveVerification;
        window.rejectVerification = rejectVerification;
        window.goBackToProfile = goBackToProfile;
        window.loadAdminChats = loadAdminChats;
        window.loadAllAdminChats = loadAllAdminChats;
        window.loadArchivedAdminChats = loadArchivedAdminChats;
        window.openAdminChatWindow = openAdminChatWindow;
        window.requestWithdraw = requestWithdraw;
        // 🔧 ЭКСПОРТ ФУНКЦИЙ
window.showAdminAdminsSection = showAdminAdminsSection;
window.loadAdminsList = loadAdminsList;
window.addNewAdmin = addNewAdmin;
window.removeAdmin = removeAdmin;
// 🔧 ЭКСПОРТ ФУНКЦИЙ ДЛЯ УПРАВЛЕНИЯ АДМИНАМИ
window.showAdminAdminsSection = showAdminAdminsSection;
window.loadAdminsList = loadAdminsList;
window.addNewAdmin = addNewAdmin;
window.removeAdmin = removeAdmin;
window.showAdminSection = showAdminSection;
// 🔧 ЭКСПОРТ ФУНКЦИЙ ДЛЯ УПРАВЛЕНИЯ АДМИНАМИ
window.showAdminAdminsSection = showAdminAdminsSection;
window.loadAdminsList = loadAdminsList;
window.addNewAdmin = addNewAdmin;
window.removeAdmin = removeAdmin;
window.showAdminSection = showAdminSection;
window.refreshUserData = refreshUserData;
window.showAdminAdminsSection = showAdminAdminsSection;
window.loadAdminsList = loadAdminsList;
window.addNewAdmin = addNewAdmin;
window.removeAdmin = removeAdmin;
window.showAdminSection = showAdminSection;
window.refreshUserData = refreshUserData;
window.checkAdminRights = checkAdminRights;
// 🔧 ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ АДМИНАМИ
// 🔧 ЭКСПОРТ ФУНКЦИЙ ДЛЯ УПРАВЛЕНИЯ АДМИНАМИ
window.showAdminAdminsSection = showAdminAdminsSection;
window.loadAdminsList = loadAdminsList;
window.addNewAdmin = addNewAdmin;
window.removeAdmin = removeAdmin;
window.showAdminSection = showAdminSection;

// 🔧 ЭКСПОРТ НОВЫХ ФУНКЦИЙ
window.refreshAdminRights = refreshAdminRights;
window.debugAdminRights = debugAdminRights;


// Показать секцию управления админами
function showAdminAdminsSection() {
    showAdminSection('admins');
    loadAdminsList();
}

// Загрузка списка админов
async function loadAdminsList() {
    console.log('🔄 Loading admins list...');
    
    if (!currentUser || parseInt(currentUser.id) !== ADMIN_ID) {
        console.log('❌ User is not main admin');
        return;
    }
    
    try {
        const result = await makeRequest(`/admin/admins-list?adminId=${currentUser.id}`);
        
        if (result.success) {
            displayAdminsList(result.admins);
        } else {
            showNotification('Ошибка загрузки списка админов: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('❌ Error loading admins list:', error);
        showNotification('Ошибка загрузки списка админов', 'error');
    }
}

// Отображение списка админов
function displayAdminsList(admins) {
    const container = document.getElementById('admins-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!admins || admins.length === 0) {
        container.innerHTML = `
            <div class="no-tasks" style="text-align: center; padding: 30px;">
                <div style="font-size: 48px; margin-bottom: 16px;">👥</div>
                <div>Нет администраторов</div>
                <div style="font-size: 14px; color: var(--text-secondary); margin-top: 8px;">
                    Добавьте первого администратора
                </div>
            </div>
        `;
        return;
    }
    
    admins.forEach(admin => {
        const adminElement = document.createElement('div');
        adminElement.className = 'admin-task-item';
        
        const isMainAdmin = parseInt(admin.user_id) === ADMIN_ID;
        const joinDate = new Date(admin.created_at).toLocaleDateString('ru-RU');
        const fullName = `${admin.first_name} ${admin.last_name || ''}`.trim();
        const displayName = fullName || `Пользователь ${admin.user_id}`;
        
        adminElement.innerHTML = `
            <div class="admin-task-header">
                <div class="admin-task-title">
                    ${displayName}
                    ${isMainAdmin ? ' <span style="color: var(--gold);">(Главный админ)</span>' : ''}
                </div>
                ${!isMainAdmin ? `
                    <div class="admin-task-actions">
                        <button class="admin-task-delete" onclick="removeAdmin(${admin.user_id})">
                            🗑️ Удалить
                        </button>
                    </div>
                ` : ''}
            </div>
            <div class="admin-task-description">
                @${admin.username} • ID: ${admin.user_id} • Добавлен: ${joinDate}
            </div>
            <div style="margin-top: 8px; font-size: 12px; color: ${admin.is_admin ? 'var(--success)' : 'var(--error)'};">
                ${admin.is_admin ? '✅ Права администратора активны' : '❌ Права администратора не активны'}
            </div>
            
            <!-- Статистика нанятого админа -->
            ${!isMainAdmin ? `
                <div style="margin-top: 12px; padding: 10px; background: var(--bg-secondary); border-radius: 8px;">
                    <h5 style="margin-bottom: 8px;">📊 Статистика админа:</h5>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
                        <div>📝 Посты: <strong>${admin.posts_count || 0}</strong></div>
                        <div>📋 Задания: <strong>${admin.tasks_count || 0}</strong></div>
                        <div>✅ Проверки: <strong>${admin.verifications_count || 0}</strong></div>
                        <div>💬 Ответов: <strong>${admin.support_count || 0}</strong></div>
                        <div>💳 Выплат: <strong>${admin.payments_count || 0}</strong></div>
                    </div>
                </div>
                
                <!-- Управление правами -->
                <div style="margin-top: 10px;">
                    <h6 style="margin-bottom: 6px;">🔧 Права доступа:</h6>
                    <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                        <label style="font-size: 12px;">
                            <input type="checkbox" ${admin.can_posts ? 'checked' : ''} onchange="updateAdminPermissions(${admin.user_id}, 'posts', this.checked)"> 📝 Посты
                        </label>
                        <label style="font-size: 12px;">
                            <input type="checkbox" ${admin.can_tasks ? 'checked' : ''} onchange="updateAdminPermissions(${admin.user_id}, 'tasks', this.checked)"> 📋 Задания
                        </label>
                        <label style="font-size: 12px;">
                            <input type="checkbox" ${admin.can_verification ? 'checked' : ''} onchange="updateAdminPermissions(${admin.user_id}, 'verification', this.checked)"> ✅ Проверка
                        </label>
                        <label style="font-size: 12px;">
                            <input type="checkbox" ${admin.can_support ? 'checked' : ''} onchange="updateAdminPermissions(${admin.user_id}, 'support', this.checked)"> 💬 Поддержка
                        </label>
                        <label style="font-size: 12px;">
                            <input type="checkbox" ${admin.can_payments ? 'checked' : ''} onchange="updateAdminPermissions(${admin.user_id}, 'payments', this.checked)"> 💳 Оплаты
                        </label>
                    </div>
                </div>
            ` : ''}
        `;
        
        container.appendChild(adminElement);
    });
}

// Добавление нового админа
async function addNewAdmin() {
    const usernameInput = document.getElementById('new-admin-username');
    const messageDiv = document.getElementById('admin-form-message');
    const submitBtn = document.getElementById('add-admin-btn');
    
    if (!usernameInput || !messageDiv) {
        showNotification('Ошибка: элементы формы не найдены', 'error');
        return;
    }
    
    const username = usernameInput.value.trim();
    
    if (!username) {
        messageDiv.innerHTML = '<span style="color: var(--error);">Введите юзернейм пользователя</span>';
        return;
    }
    
    if (!currentUser || parseInt(currentUser.id) !== ADMIN_ID) {
        messageDiv.innerHTML = '<span style="color: var(--error);">Только главный администратор может добавлять админов!</span>';
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Добавляем...';
    messageDiv.innerHTML = '<span style="color: var(--warning);">Добавляем администратора...</span>';
    
    try {
        const result = await makeRequest('/admin/add-admin', {
            method: 'POST',
            body: JSON.stringify({
                adminId: currentUser.id,
                username: username
            })
        });
        
        if (result.success) {
            messageDiv.innerHTML = `<span style="color: var(--success);">${result.message}</span>`;
            usernameInput.value = '';
            
            setTimeout(() => {
                loadAdminsList();
            }, 1000);
            
            showNotification(result.message, 'success');
        } else {
            messageDiv.innerHTML = `<span style="color: var(--error);">Ошибка: ${result.error}</span>`;
            showNotification('Ошибка: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('❌ Error adding admin:', error);
        messageDiv.innerHTML = `<span style="color: var(--error);">Ошибка сети: ${error.message}</span>`;
        showNotification('Ошибка сети при добавлении админа', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '➕ Добавить администратора';
    }
}

// Удаление админа
async function removeAdmin(targetAdminId) {
    if (!currentUser || parseInt(currentUser.id) !== ADMIN_ID) {
        showNotification('Только главный администратор может удалять админов!', 'error');
        return;
    }
    
    if (!confirm('Вы уверены, что хотите удалить этого администратора?')) {
        return;
    }
    
    try {
        const result = await makeRequest('/admin/remove-admin', {
            method: 'POST',
            body: JSON.stringify({
                adminId: currentUser.id,
                targetAdminId: targetAdminId
            })
        });
        
        if (result.success) {
            showNotification(result.message, 'success');
            loadAdminsList();
        } else {
            showNotification('Ошибка: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('❌ Error removing admin:', error);
        showNotification('Ошибка удаления админа: ' + error.message, 'error');
    }
}

// Обновление прав доступа админа
async function updateAdminPermissions(adminId, permission, enabled) {
    try {
        const result = await makeRequest('/admin/update-permissions', {
            method: 'POST',
            body: JSON.stringify({
                adminId: currentUser.id,
                targetAdminId: adminId,
                permission: permission,
                enabled: enabled
            })
        });
        
        if (result.success) {
            showNotification('Права доступа обновлены', 'success');
        } else {
            showNotification('Ошибка обновления прав: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Update permissions error:', error);
        showNotification('Ошибка обновления прав доступа', 'error');
    }
}
function setupAdminPanel() {
    if (!currentUser) return;
    
    const isMainAdmin = parseInt(currentUser.id) === ADMIN_ID;
    const adminsBtn = document.getElementById('admins-btn');
    
    if (adminsBtn) {
        adminsBtn.style.display = isMainAdmin ? 'block' : 'none';
    }
    
    console.log('✅ Admin panel setup complete');
}
// Добавление нового админа - ИСПРАВЛЕННАЯ ВЕРСИЯ
// Добавление нового админа - ОБНОВЛЕННАЯ ВЕРСИЯ
async function addNewAdmin() {
    console.log('🎯 Starting addNewAdmin function...');
    
    const usernameInput = document.getElementById('new-admin-username');
    const messageDiv = document.getElementById('admin-form-message');
    const submitBtn = document.getElementById('add-admin-btn');
    
    if (!usernameInput || !messageDiv) {
        console.error('❌ Required elements not found');
        showNotification('Ошибка: элементы формы не найдены', 'error');
        return;
    }
    
    const username = usernameInput.value.trim();
    
    // Валидация
    if (!username) {
        messageDiv.innerHTML = '<span style="color: var(--error);">Введите юзернейм пользователя</span>';
        return;
    }
    
    // Проверяем права доступа
    if (!currentUser || parseInt(currentUser.id) !== ADMIN_ID) {
        messageDiv.innerHTML = '<span style="color: var(--error);">Только главный администратор может добавлять админов!</span>';
        return;
    }
    
    console.log('👤 Attempting to add admin with username:', username);
    
    // Показываем загрузку
    submitBtn.disabled = true;
    submitBtn.textContent = 'Добавляем...';
    messageDiv.innerHTML = '<span style="color: var(--warning);">Добавляем администратора...</span>';
    
    try {
        const result = await makeRequest('/admin/add-admin', {
            method: 'POST',
            body: JSON.stringify({
                adminId: currentUser.id,
                username: username
            })
        });
        
        console.log('📨 Server response:', result);
        
        if (result.success) {
            messageDiv.innerHTML = `<span style="color: var(--success);">${result.message}</span>`;
            usernameInput.value = ''; // Очищаем поле ввода
            
            // Обновляем список админов
            setTimeout(() => {
                loadAdminsList();
            }, 1000);
            
            showNotification(result.message, 'success');
            
            // Если добавленный админ - это текущий пользователь, обновляем его права
            if (result.targetUserId && parseInt(result.targetUserId) === parseInt(currentUser.id)) {
                console.log('🔄 Added admin is current user, refreshing rights...');
                setTimeout(() => {
                    refreshUserData();
                }, 1500);
            }
            
        } else {
            messageDiv.innerHTML = `<span style="color: var(--error);">Ошибка: ${result.error}</span>`;
            showNotification('Ошибка: ' + result.error, 'error');
        }
        
    } catch (error) {
        console.error('❌ Error adding admin:', error);
        messageDiv.innerHTML = `<span style="color: var(--error);">Ошибка сети: ${error.message}</span>`;
        showNotification('Ошибка сети при добавлении админа', 'error');
    } finally {
        // Восстанавливаем кнопку
        submitBtn.disabled = false;
        submitBtn.textContent = '➕ Добавить администратора';
    }
}

// Принудительное обновление данных пользователя
async function refreshUserData() {
    if (!currentUser) return;
    
    try {
        console.log('🔄 Refreshing user data...');
        
        const result = await makeRequest('/admin/refresh-rights', {
            method: 'POST',
            body: JSON.stringify({
                userId: currentUser.id
            })
        });
        
        if (result.success) {
            // Обновляем текущего пользователя
            Object.assign(currentUser, result.user);
            
            // Обновляем отображение
            displayUserProfile();
            updateAdminPanel(); // Обновляем админ-панель
            
            console.log('✅ User data refreshed:', currentUser);
            showNotification('Права администратора обновлены!', 'success');
        }
    } catch (error) {
        console.error('❌ Error refreshing user data:', error);
    }
}

// Удаление админа
// Удаление админа - ИСПРАВЛЕННАЯ ВЕРСИЯ
async function removeAdmin(targetAdminId) {
    console.log('🗑️ Removing admin:', targetAdminId);
    
    if (!currentUser || parseInt(currentUser.id) !== ADMIN_ID) {
        showNotification('Только главный администратор может удалять админов!', 'error');
        return;
    }
    
    if (!confirm('Вы уверены, что хотите удалить этого администратора?')) {
        return;
    }
    
    try {
        const result = await makeRequest('/admin/remove-admin', {
            method: 'POST',
            body: JSON.stringify({
                adminId: currentUser.id,
                targetAdminId: targetAdminId
            })
        });
        
        if (result.success) {
            showNotification(result.message, 'success');
            loadAdminsList(); // Обновляем список админов
        } else {
            showNotification('Ошибка: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('❌ Error removing admin:', error);
        showNotification('Ошибка удаления админа: ' + error.message, 'error');
    }
}
// Обновите функцию showAdminSection чтобы включить новую секцию

// Обработчик Enter для поля ввода имени администратора
function initAdminInputHandlers() {
    const usernameInput = document.getElementById('new-admin-username');
    if (usernameInput) {
        usernameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addNewAdmin();
            }
        });
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    initAdminInputHandlers();
});
// Принудительное обновление прав администратора
// Принудительное обновление прав администратора
// 🔧 Функция для принудительного обновления прав администратора
async function refreshAdminRights() {
    if (!currentUser) return;
    
    try {
        console.log('🔄 Refreshing admin rights for user:', currentUser.id);
        
        const result = await makeRequest('/admin/refresh-rights', {
            method: 'POST',
            body: JSON.stringify({
                userId: currentUser.id
            })
        });
        
        if (result.success) {
            // Обновляем текущего пользователя
            Object.assign(currentUser, result.user);
            
            console.log('✅ Admin rights refreshed:', {
                id: currentUser.id,
                is_admin: currentUser.is_admin,
                isMainAdmin: parseInt(currentUser.id) === ADMIN_ID
            });
            
            // Перепроверяем права администратора
            checkAdminRights();
            
        } else {
            // Если новый endpoint не работает, используем старый
            const fallbackResult = await makeRequest(`/user/${currentUser.id}`);
            if (fallbackResult.success) {
                Object.assign(currentUser, fallbackResult.profile);
                checkAdminRights();
            }
        }
    } catch (error) {
        console.error('Ошибка обновления прав администратора:', error);
        // Пробуем старый метод как запасной вариант
        try {
            const fallbackResult = await makeRequest(`/user/${currentUser.id}`);
            if (fallbackResult.success) {
                Object.assign(currentUser, fallbackResult.profile);
                checkAdminRights();
            }
        } catch (fallbackError) {
            console.error('Fallback method also failed:', fallbackError);
        }
    }
}
// Функция для отладки прав администратора
function debugAdminRights() {
    console.log('🐛 DEBUG Admin Rights:');
    console.log('- Current User:', currentUser);
    console.log('- ADMIN_ID:', ADMIN_ID);
    console.log('- is_admin:', currentUser?.is_admin);
    console.log('- isMainAdmin:', parseInt(currentUser?.id) === ADMIN_ID);
    console.log('- Admin Nav Visible:', document.getElementById('admin-nav-item')?.style.display);
}

// Вызов для отладки
setTimeout(debugAdminRights, 2000);
// Функция для тестирования прав администратора (только клиентская)
async function testAdminRights() {
    if (!currentUser) {
        console.log('❌ No current user for rights test');
        return;
    }
    
    try {
        const result = await makeRequest(`/admin/debug-rights?userId=${currentUser.id}`);
        console.log('🔍 Admin rights debug:', result);
    } catch (error) {
        console.error('Error testing admin rights:', error);
    }
}

// Вызов для отладки (только на клиенте)
setTimeout(() => {
    if (typeof currentUser !== 'undefined') {
        testAdminRights();
    }
}, 3000);

// 🔧 СИСТЕМА УРОВНЕЙ ПРОГРЕССА
const LEVEL_SYSTEM = {
    1: { tasksRequired: 10, bonus: 0, name: "Новичок" },
    2: { tasksRequired: 20, bonus: 50, name: "Ученик" },
    3: { tasksRequired: 30, bonus: 100, name: "Опытный" },
    4: { tasksRequired: 40, bonus: 150, name: "Профессионал" },
    5: { tasksRequired: 50, bonus: 200, name: "Эксперт" },
    6: { tasksRequired: 60, bonus: 250, name: "Мастер" },
    7: { tasksRequired: 70, bonus: 300, name: "Гуру" },
    8: { tasksRequired: 80, bonus: 350, name: "Легенда" },
    9: { tasksRequired: 90, bonus: 400, name: "Император" },
    10: { tasksRequired: 100, bonus: 500, name: "Бог заданий" }
};

// 🔧 ФУНКЦИИ ДЛЯ РАБОТЫ С УРОВНЯМИ

// Расчет текущего уровня и прогресса
function calculateUserLevel(completedTasks) {
    let currentLevel = 1;
    let tasksForNextLevel = LEVEL_SYSTEM[1].tasksRequired;
    let progressPercentage = 0;
    
    // Находим текущий уровень
    for (let level = 1; level <= Object.keys(LEVEL_SYSTEM).length; level++) {
        if (completedTasks >= LEVEL_SYSTEM[level].tasksRequired) {
            currentLevel = level;
        } else {
            break;
        }
    }
    
    // Расчет прогресса до следующего уровня
    if (currentLevel < Object.keys(LEVEL_SYSTEM).length) {
        const currentLevelTasks = LEVEL_SYSTEM[currentLevel].tasksRequired;
        const nextLevelTasks = LEVEL_SYSTEM[currentLevel + 1].tasksRequired;
        const tasksInCurrentLevel = completedTasks - currentLevelTasks;
        const totalTasksForNextLevel = nextLevelTasks - currentLevelTasks;
        
        progressPercentage = Math.min(100, Math.round((tasksInCurrentLevel / totalTasksForNextLevel) * 100));
        tasksForNextLevel = nextLevelTasks;
    } else {
        // Максимальный уровень достигнут
        progressPercentage = 100;
        tasksForNextLevel = LEVEL_SYSTEM[currentLevel].tasksRequired;
    }
    
    return {
        level: currentLevel,
        levelName: LEVEL_SYSTEM[currentLevel].name,
        completedTasks: completedTasks,
        tasksForNextLevel: tasksForNextLevel,
        progressPercentage: progressPercentage,
        nextLevelBonus: LEVEL_SYSTEM[currentLevel + 1] ? LEVEL_SYSTEM[currentLevel + 1].bonus : 0,
        isMaxLevel: currentLevel === Object.keys(LEVEL_SYSTEM).length
    };
}

// Обновление отображения прогресса уровня
function updateLevelProgress() {
    if (!currentUser) return;
    
    const completedTasks = currentUser.tasks_completed || 0;
    const levelInfo = calculateUserLevel(completedTasks);
    
    // Обновляем элементы интерфейса
    const levelElement = document.getElementById('user-level');
    const progressBar = document.getElementById('level-progress-bar');
    const levelCount = document.querySelector('.level-count');
    const levelInfoText = document.querySelector('.level-info');
    
    if (levelElement) {
        levelElement.textContent = levelInfo.level;
    }
    
    if (progressBar) {
        progressBar.style.width = `${levelInfo.progressPercentage}%`;
    }
    
    if (levelCount) {
        if (levelInfo.isMaxLevel) {
            levelCount.textContent = "Макс. уровень!";
        } else {
            levelCount.textContent = `${completedTasks}/${levelInfo.tasksForNextLevel} заданий`;
        }
    }
    
    if (levelInfoText) {
        if (levelInfo.isMaxLevel) {
            levelInfoText.innerHTML = `🎉 Поздравляем! Вы достигли максимального уровня!`;
        } else {
            levelInfoText.innerHTML = 
                `Уровень <strong>${levelInfo.levelName}</strong> • ` +
                `До следующего уровня: <strong>${levelInfo.tasksForNextLevel - completedTasks}</strong> заданий • ` +
                `Бонус за уровень: <strong style="color: var(--gold);">+${levelInfo.nextLevelBonus}⭐</strong>`;
        }
    }
    
    // Обновляем информацию в профиле
    updateProfileLevelInfo(levelInfo);
}

// Обновление информации об уровне в профиле
function updateProfileLevelInfo(levelInfo) {
    const levelStats = document.querySelectorAll('.profile-stat');
    if (levelStats.length >= 4) {
        // Обновляем статистику выполненных заданий
        levelStats[1].querySelector('.stat-value').textContent = levelInfo.completedTasks;
        
        // Добавляем отображение уровня если есть место
        const levelDisplay = document.getElementById('profile-level-display');
        if (!levelDisplay) {
            const levelHtml = `
                <div class="profile-stat" id="profile-level-display">
                    <div class="stat-value">${levelInfo.level}</div>
                    <div class="stat-label">Уровень</div>
                </div>
            `;
            // Вставляем перед статистикой качества
            if (levelStats[3] && levelStats[3].parentNode) {
                levelStats[3].insertAdjacentHTML('beforebegin', levelHtml);
            }
        } else {
            levelDisplay.querySelector('.stat-value').textContent = levelInfo.level;
        }
    }
}

// Проверка и начисление бонуса за уровень
async function checkLevelUpBonus(userId, oldCompletedTasks, newCompletedTasks) {
    const oldLevelInfo = calculateUserLevel(oldCompletedTasks);
    const newLevelInfo = calculateUserLevel(newCompletedTasks);
    
    // Если уровень повысился
    if (newLevelInfo.level > oldLevelInfo.level) {
        const bonusAmount = LEVEL_SYSTEM[newLevelInfo.level].bonus;
        
        if (bonusAmount > 0) {
            try {
                // Начисляем бонус
                await pool.query(`
                    UPDATE user_profiles 
                    SET balance = COALESCE(balance, 0) + $1
                    WHERE user_id = $2
                `, [bonusAmount, userId]);
                
                // Показываем уведомление о повышении уровня
                showLevelUpNotification(newLevelInfo.level, newLevelInfo.levelName, bonusAmount);
                
                console.log(`🎉 Level up bonus: User ${userId} reached level ${newLevelInfo.level} and received ${bonusAmount}⭐`);
                
                return true;
            } catch (error) {
                console.error('Level up bonus error:', error);
            }
        }
    }
    
    return false;
}

// Уведомление о повышении уровня
function showLevelUpNotification(level, levelName, bonus) {
    const notificationHTML = `
        <div class="level-up-notification" style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--gold-gradient);
            color: #000;
            padding: 30px;
            border-radius: 20px;
            text-align: center;
            z-index: 10000;
            box-shadow: 0 10px 30px rgba(255, 215, 0, 0.5);
            border: 3px solid rgba(255, 255, 255, 0.3);
            animation: levelUpPop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
            max-width: 300px;
            width: 90%;
        ">
            <div style="font-size: 48px; margin-bottom: 15px;">🎉</div>
            <div style="font-size: 24px; font-weight: 800; margin-bottom: 10px;">
                Новый уровень!
            </div>
            <div style="font-size: 20px; font-weight: 700; margin-bottom: 15px;">
                ${levelName}
            </div>
            <div style="font-size: 16px; margin-bottom: 20px;">
                Уровень <strong>${level}</strong> достигнут!
            </div>
            <div style="
                background: rgba(255, 255, 255, 0.3);
                padding: 10px;
                border-radius: 10px;
                font-weight: 700;
                margin-bottom: 15px;
            ">
                🎁 Бонус: +${bonus}⭐
            </div>
            <button onclick="this.parentElement.remove()" style="
                background: #000;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 10px;
                font-weight: 600;
                cursor: pointer;
            ">
                Отлично!
            </button>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', notificationHTML);
    
    // Автоматическое скрытие через 5 секунд
    setTimeout(() => {
        const notification = document.querySelector('.level-up-notification');
        if (notification) {
            notification.remove();
        }
    }, 5000);
}

// CSS анимация для уведомления
const levelUpStyles = `
    <style>
        @keyframes levelUpPop {
            0% {
                transform: translate(-50%, -50%) scale(0.5);
                opacity: 0;
            }
            50% {
                transform: translate(-50%, -50%) scale(1.1);
            }
            100% {
                transform: translate(-50%, -50%) scale(1);
                opacity: 1;
            }
        }
        
        .level-progress {
            background: var(--card-bg);
            border-radius: 14px;
            padding: 16px;
            margin: 16px 0;
            border: 1px solid var(--border);
            position: relative;
            overflow: hidden;
        }
        
        .level-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        
        .level-title {
            font-weight: 600;
            font-size: 16px;
        }
        
        .level-badge {
            background: var(--purple-gradient);
            color: white;
            padding: 4px 10px;
            border-radius: 10px;
            font-size: 12px;
            font-weight: 600;
        }
        
        .progress-container {
            margin-bottom: 8px;
        }
        
        .progress-stats {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: var(--text-secondary);
        }
        
        .level-rewards {
            margin-top: 12px;
            padding: 10px;
            background: var(--bg-secondary);
            border-radius: 8px;
            border-left: 3px solid var(--gold);
        }
        
        .reward-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            margin-bottom: 4px;
        }
        
        .reward-item:last-child {
            margin-bottom: 0;
        }
    </style>
`;

// Добавляем стили в документ
document.head.insertAdjacentHTML('beforeend', levelUpStyles);

// 🔧 ОБНОВЛЕННЫЙ HTML ДЛЯ ОТОБРАЖЕНИЯ ПРОГРЕССА УРОВНЯ

function createLevelProgressHTML() {
    const completedTasks = currentUser?.tasks_completed || 0;
    const levelInfo = calculateUserLevel(completedTasks);
    
    return `
        <div class="level-progress">
            <div class="level-header">
                <div class="level-title">Система уровней</div>
                <div class="level-badge">Уровень ${levelInfo.level}</div>
            </div>
            
            <div class="progress-container">
                <div class="progress-bar">
                    <div class="progress-fill" id="level-progress-bar" style="width: ${levelInfo.progressPercentage}%"></div>
                </div>
                <div class="progress-stats">
                    <span>${levelInfo.completedTasks} выполнено</span>
                    <span>${levelInfo.progressPercentage}%</span>
                    <span>${levelInfo.tasksForNextLevel} до след. уровня</span>
                </div>
            </div>
            
            <div class="level-info">
                ${levelInfo.isMaxLevel ? 
                    '🎉 Поздравляем! Вы достигли максимального уровня!' : 
                    `Текущий уровень: <strong>${levelInfo.levelName}</strong> • ` +
                    `До уровня ${levelInfo.level + 1}: <strong>${levelInfo.tasksForNextLevel - completedTasks}</strong> заданий`
                }
            </div>
            
            ${!levelInfo.isMaxLevel ? `
                <div class="level-rewards">
                    <div class="reward-item">
                        <span>🎁</span>
                        <span>Бонус за следующий уровень: <strong>+${levelInfo.nextLevelBonus}⭐</strong></span>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// 🔧 ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ УРОВНЕЙ

// Обновляем отображение уровня при загрузке профиля
function initializeLevelSystem() {
    updateLevelProgress();
    
    // Обновляем прогресс каждые 30 секунд
    setInterval(updateLevelProgress, 30000);
}


// Обновляем функцию при завершении задания
async function onTaskCompleted(userId, taskPrice) {
    try {
        // Получаем текущее количество выполненных заданий
        const userResult = await pool.query(
            'SELECT tasks_completed FROM user_profiles WHERE user_id = $1',
            [userId]
        );
        
        if (userResult.rows.length > 0) {
            const oldCompletedTasks = userResult.rows[0].tasks_completed || 0;
            const newCompletedTasks = oldCompletedTasks + 1;
            
            // Проверяем повышение уровня
            await checkLevelUpBonus(userId, oldCompletedTasks, newCompletedTasks);
            
            // Обновляем счетчик заданий
            await pool.query(
                'UPDATE user_profiles SET tasks_completed = $1 WHERE user_id = $2',
                [newCompletedTasks, userId]
            );
        }
    } catch (error) {
        console.error('Task completion level check error:', error);
    }
}

// 🔧 ЭКСПОРТ ФУНКЦИЙ
window.updateLevelProgress = updateLevelProgress;
window.calculateUserLevel = calculateUserLevel;
window.initializeLevelSystem = initializeLevelSystem;
function clearTaskImage() {
    const input = document.getElementById('task-image-input');
    const preview = document.getElementById('task-image-preview');
    const placeholder = document.querySelector('.upload-placeholder');
    
    if (input) input.value = '';
    if (preview) {
        preview.src = '';
        preview.style.display = 'none';
    }
    if (placeholder) {
        placeholder.style.display = 'block';
    }
    
    currentTaskImage = null;
    
    // Сбрасываем стили области загрузки
    const area = document.getElementById('image-upload-area');
    if (area) {
        area.style.borderColor = '';
        area.style.background = '';
    }
}
// Функция загрузки заданий админа
async function loadAdminTasks() {
    if (!currentUser) return;
    
    try {
        const result = await makeRequest(`/admin/tasks?adminId=${currentUser.id}`);
        if (result.success) {
            displayAdminTasks(result.tasks);
        }
    } catch (error) {
        console.error('Error loading admin tasks:', error);
    }
}
// Инициализация drag and drop
initImageUploadDragDrop();
function initImageUploadDragDrop() {
    const area = document.getElementById('image-upload-area');
    if (!area) return;
    
    area.addEventListener('dragover', function(e) {
        e.preventDefault();
        area.classList.add('dragover');
        area.style.borderColor = 'var(--accent)';
        area.style.background = 'rgba(99, 102, 241, 0.05)';
    });
    
    area.addEventListener('dragleave', function(e) {
        e.preventDefault();
        area.classList.remove('dragover');
        area.style.borderColor = '';
        area.style.background = '';
    });
    
    area.addEventListener('drop', function(e) {
        e.preventDefault();
        area.classList.remove('dragover');
        area.style.borderColor = '';
        area.style.background = '';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const fileInput = document.getElementById('task-image-input');
            if (fileInput) {
                // Создаем новый DataTransfer для установки файла
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(files[0]);
                fileInput.files = dataTransfer.files;
                
                // Запускаем превью
                previewTaskImage(fileInput);
            }
        }
    });
    
    // Обработчик клика на область загрузки
    area.addEventListener('click', function() {
        const fileInput = document.getElementById('task-image-input');
        if (fileInput) {
            fileInput.click();
        }
    });
}
    
    // Обработчик клика на область загрузки
    area.addEventListener('click', function() {
        const fileInput = document.getElementById('task-image-input');
        if (fileInput) {
            fileInput.click();
        }
    });

async function addTaskWithImage() {
    console.log('🎯 Starting add task with image...');
    
    try {
        // Получаем значения из формы
        const taskData = {
            title: document.getElementById('admin-task-title').value.trim(),
            description: document.getElementById('admin-task-description').value.trim(),
            price: document.getElementById('admin-task-price').value,
            category: document.getElementById('admin-task-category').value,
            time_to_complete: document.getElementById('admin-task-time').value || '5-10 минут',
            difficulty: document.getElementById('admin-task-difficulty').value,
            people_required: document.getElementById('admin-task-people').value || 1,
            task_url: document.getElementById('admin-task-url').value || '',
            created_by: currentUser.id
        };

        console.log('📋 Form data collected:', taskData);

        // Валидация
        if (!taskData.title.trim()) {
            showNotification('Введите название задания!', 'error');
            return;
        }
        if (!taskData.description.trim()) {
            showNotification('Введите описание задания!', 'error');
            return;
        }
        if (!taskData.price) {
            showNotification('Введите цену задания!', 'error');
            return;
        }

        const price = parseFloat(taskData.price);
        if (isNaN(price) || price <= 0) {
            showNotification('Цена должна быть положительным числом!', 'error');
            return;
        }

        // Создаем FormData для отправки с файлом
        const formData = new FormData();
        
        // Добавляем текстовые данные
        Object.keys(taskData).forEach(key => {
            formData.append(key, taskData[key]);
        });
        
        // Добавляем изображение если есть
        if (currentTaskImage) {
            formData.append('image', currentTaskImage);
            console.log('📸 Adding image to form data:', currentTaskImage.name);
        } else {
            console.log('ℹ️ No image selected');
        }

        console.log('📤 Sending task with image...');

        // Отправляем запрос
        const response = await fetch('/api/tasks-with-image', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        console.log('📨 Server response:', result);

        if (result.success) {
            showNotification('✅ Задание с фото успешно создано!', 'success');
            
            // Очищаем форму
            clearTaskForm();
            clearTaskImage();
            
            // Обновляем списки
            setTimeout(() => {
                loadAdminTasks();
                loadTasks();
            }, 1000);
            
        } else {
            throw new Error(result.error || 'Unknown server error');
        }

    } catch (error) {
        console.error('💥 Error in addTaskWithImage:', error);
        showNotification(`❌ Ошибка создания задания: ${error.message}`, 'error');
    }
}
function clearTaskForm() {
    const formFields = [
        'admin-task-title', 
        'admin-task-description', 
        'admin-task-price', 
        'admin-task-time', 
        'admin-task-people', 
        'admin-task-url'
    ];
    
    formFields.forEach(fieldId => {
        const element = document.getElementById(fieldId);
        if (element) element.value = '';
    });
    
    // Сбрасываем выпадающие списки
    document.getElementById('admin-task-category').value = 'subscribe';
    document.getElementById('admin-task-difficulty').value = 'Легкая';
    
    // Очищаем изображение
    clearTaskImage();
}
function createTaskCard(task, category, index) {
    const taskElement = document.createElement('div');
    taskElement.className = 'task-card';
    taskElement.style.animationDelay = `${index * 0.1}s`;
    
    const peopleRequired = task.people_required || 1;
    const completedCount = task.completed_count || 0;
    const availableTasks = Math.max(0, peopleRequired - completedCount);
    
    // Определяем текст кнопки в зависимости от категории
    let buttonHtml = '';
    switch(category) {
        case 'new':
            buttonHtml = `<button class="task-btn" onclick="event.stopPropagation(); openTaskModal(${task.id})">
                Начать задание
            </button>`;
            break;
        case 'confirmation':
            buttonHtml = `<button class="task-btn" onclick="event.stopPropagation(); showTaskConfirmation(${task.id}, '${escapeHtml(task.title)}')">
                Отправить на проверку
            </button>`;
            break;
        case 'completed':
            buttonHtml = `<div class="task-status completed">✅ Выполнено</div>`;
            break;
        case 'rejected':
            buttonHtml = `<div class="task-status rejected">❌ Отклонено</div>`;
            break;
    }
    
    taskElement.innerHTML = `
        ${availableTasks > 0 && category === 'new' ? `<div class="task-availability">${availableTasks} осталось</div>` : ''}
        
        <div class="task-header">
            <div class="task-title">${escapeHtml(task.title)}</div>
            <div class="task-price">${task.price} ⭐</div>
        </div>
        
        <div class="task-meta">
            <div class="task-category">${formatCategory(task.category)}</div>
            ${task.difficulty ? `<div class="task-difficulty ${task.difficulty.toLowerCase()}">${task.difficulty}</div>` : ''}
        </div>
        
        <div class="task-description">
            ${escapeHtml(task.description.length > 100 ? task.description.substring(0, 100) + '...' : task.description)}
        </div>
        
        ${peopleRequired > 1 && category === 'new' ? `
            <div class="task-progress">
                <div class="task-progress-bar" style="width: ${Math.min(100, (completedCount / peopleRequired) * 100)}%"></div>
            </div>
            <div class="task-progress-text">
                Выполнено: ${completedCount}/${peopleRequired}
            </div>
        ` : ''}
        
        <div class="task-footer">
            <div class="task-time">
                ${category === 'confirmation' ? 'Ожидает подтверждения' : 
                  category === 'completed' ? 'Выполнено' :
                  category === 'rejected' ? 'Отклонено' : 
                  task.time_to_complete || '5-10 минут'}
            </div>
            ${buttonHtml}
        </div>
    `;
    
    // Добавляем обработчик клика только для новых заданий
    if (category === 'new') {
        taskElement.addEventListener('click', function(e) {
            if (!e.target.classList.contains('task-btn')) {
                openTaskModal(task.id);
            }
        });
    }
    
    return taskElement;
}
// Функция для отображения заданий с изображениями
function displayTasksWithImages(tasks, category) {
    const container = document.getElementById(category + '-tasks');
    if (!container) return;

    container.innerHTML = '';

    if (!tasks || tasks.length === 0) {
        container.innerHTML = `
            <div class="no-tasks" style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                <div>Заданий пока нет</div>
                <div style="font-size: 14px; color: var(--text-secondary); margin-top: 8px;">
                    Новые задания появятся позже
                </div>
            </div>
        `;
        return;
    }

    tasks.forEach((task, index) => {
        const taskElement = createTaskCardWithImage(task, category, index);
        container.appendChild(taskElement);
    });
}
// В index.html - обновим функцию создания карточки задания для отклоненных
function createTaskCardWithImage(task, category, index) {
    const taskElement = document.createElement('div');
    taskElement.className = 'task-card task-card-with-image';
    if (category === 'rejected') {
        taskElement.classList.add('rejected');
    }
    taskElement.style.animationDelay = `${index * 0.1}s`;
    
    const hasImage = task.image_url && task.image_url !== '';
    const peopleRequired = task.people_required || 1;
    const completedCount = task.completed_count || 0;
    const availableTasks = Math.max(0, peopleRequired - completedCount);
    
    let imageHtml = '';
    if (hasImage) {
        imageHtml = `
            <div class="task-image-container">
                <img src="${task.image_url}" alt="${escapeHtml(task.title)}" 
                     class="task-image"
                     onerror="this.onerror=null; this.style.display='none';">
                ${availableTasks > 0 && category === 'new' ? `<div class="task-badge">${availableTasks} осталось</div>` : ''}
            </div>
        `;
    } else {
        imageHtml = `
            ${availableTasks > 0 && category === 'new' ? `<div class="task-availability">${availableTasks} осталось</div>` : ''}
        `;
    }
    
    let buttonHtml = '';
    switch(category) {
        case 'new':
            buttonHtml = `<button class="task-btn" onclick="event.stopPropagation(); openTaskModal(${task.id})">
                Начать задание
            </button>`;
            break;
        case 'confirmation':
            buttonHtml = `<button class="task-btn" onclick="event.stopPropagation(); showTaskConfirmation(${task.id}, '${escapeHtml(task.title)}')">
                Отправить на проверку
            </button>`;
            break;
        case 'completed':
            buttonHtml = `<div class="task-status completed">✅ Выполнено</div>`;
            break;
        case 'rejected':
            buttonHtml = `<div class="task-status rejected">❌ Отклонено</div>`;
            break;
    }
    
    taskElement.innerHTML = `
        ${imageHtml}
        
        <div class="task-header">
            <div class="task-title">${escapeHtml(task.title)}</div>
            <div class="task-price">${task.price} ⭐</div>
        </div>
        
        <div class="task-meta">
            <div class="task-category">${formatCategory(task.category)}</div>
            ${task.difficulty ? `<div class="task-difficulty ${task.difficulty.toLowerCase()}">${task.difficulty}</div>` : ''}
        </div>
        
        <div class="task-description">
            ${escapeHtml(task.description.length > 100 ? task.description.substring(0, 100) + '...' : task.description)}
        </div>
        
        ${peopleRequired > 1 && category === 'new' ? `
            <div class="task-progress">
                <div class="task-progress-bar" style="width: ${Math.min(100, (completedCount / peopleRequired) * 100)}%"></div>
            </div>
            <div class="task-progress-text">
                Выполнено: ${completedCount}/${peopleRequired}
            </div>
        ` : ''}
        
        <div class="task-footer">
            <div class="task-time">
                ${category === 'confirmation' ? 'Ожидает подтверждения' : 
                  category === 'completed' ? 'Выполнено' :
                  category === 'rejected' ? 'Отклонено' : 
                  task.time_to_complete || '5-10 минут'}
            </div>
            ${buttonHtml}
        </div>
    `;
    
    if (category === 'new') {
        taskElement.addEventListener('click', function(e) {
            if (!e.target.classList.contains('task-btn')) {
                openTaskModal(task.id);
            }
        });
    }
       if (category === 'rejected') {
        taskElement.innerHTML = createRejectedTaskHTML(task);
    } else {
        // ... стандартный код для других категорий ...
    }
    
    return taskElement;
}
// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    initImageUploadDragDrop();
});

// 🔧 ФУНКЦИЯ ОТОБРАЖЕНИЯ АДМИН-ЗАДАНИЙ
function displayAdminTasks(tasks) {
    const container = document.getElementById('admin-tasks-list');
    if (!container) {
        console.error('❌ Admin tasks container not found!');
        return;
    }
    
    console.log(`🎯 Displaying ${tasks ? tasks.length : 0} admin tasks`);
    
    container.innerHTML = '';
    
    if (!tasks || tasks.length === 0) {
        container.innerHTML = `
            <div class="no-tasks" style="text-align: center; padding: 40px 20px; background: var(--card-bg); border-radius: 12px; border: 1px solid var(--border);">
                <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                <div style="font-size: 18px; margin-bottom: 8px;">Нет созданных заданий</div>
                <div style="font-size: 14px; color: var(--text-secondary);">
                    Создайте первое задание используя форму выше
                </div>
            </div>
        `;
        return;
    }
    
    tasks.forEach(task => {
        const taskElement = document.createElement('div');
        taskElement.className = 'admin-task-item';
        taskElement.style.cssText = `
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
        `;
        
        taskElement.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">${task.title}</div>
                    <div style="color: var(--text-secondary); font-size: 14px;">${task.description}</div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="admin-task-delete" onclick="deleteTask(${task.id})" style="background: var(--error); color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
                        🗑️ Удалить
                    </button>
                </div>
            </div>
            <div style="display: flex; gap: 12px; font-size: 12px; color: var(--text-secondary);">
                <span>💰 ${task.price} ⭐</span>
                <span>📁 ${task.category || 'general'}</span>
                <span>👥 ${task.people_required || 1} чел.</span>
                <span>⚡ ${task.difficulty || 'Легкая'}</span>
            </div>
            ${task.image_url ? `
                <div style="margin-top: 10px;">
                    <img src="${task.image_url}" alt="Изображение задания" style="max-width: 200px; border-radius: 8px; border: 1px solid var(--border);">
                </div>
            ` : ''}
        `;
        
        container.appendChild(taskElement);
    });
}
// 🔧 ЭКСПОРТ НОВЫХ ФУНКЦИЙ
window.addNewPostAsAdmin = addNewPostAsAdmin;
window.deletePostAsAdmin = deletePostAsAdmin;
window.addTaskAsAdmin = addTaskAsAdmin;
window.deleteTaskAsAdmin = deleteTaskAsAdmin;
window.loadTaskVerificationsForAdmin = loadTaskVerificationsForAdmin;
window.openAdminSupportChat = openAdminSupportChat;
window.approveVerification = approveVerification;
window.rejectVerification = rejectVerification;
window.closeModal = closeModal;
// 🔧 ЭКСПОРТ НОВЫХ ФУНКЦИЙ
window.requestWithdraw = requestWithdraw;
window.loadWithdrawHistory = loadWithdrawHistory;
window.loadWithdrawalRequests = loadWithdrawalRequests;
window.completeWithdrawal = completeWithdrawal;
window.showAdminSection = showAdminSection;
// 🔧 ЭКСПОРТ НОВЫХ ФУНКЦИЙ
window.fixTasksLayout = fixTasksLayout;
window.addTask = addTask;
window.showAdminSection = showAdminSection;
window.loadAdminTasks = loadAdminTasks;
// 🔧 ЭКСПОРТ ФУНКЦИЙ
window.addTask = addTask;
// 🔧 ЭКСПОРТ ФУНКЦИЙ ДЛЯ УПРАВЛЕНИЯ АДМИНАМИ
window.showAdminAdminsSection = showAdminAdminsSection;
window.loadAdminsList = loadAdminsList;
window.addNewAdmin = addNewAdmin;
window.removeAdmin = removeAdmin;
window.updateAdminPermissions = updateAdminPermissions;
// Добавьте в конец файла
window.loadWithdrawalRequests = loadWithdrawalRequests;
window.completeWithdrawal = completeWithdrawal;
window.showAdminPaymentsSection = showAdminPaymentsSection;