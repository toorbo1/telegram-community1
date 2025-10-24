// 🔧 ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎮 Initializing LinkGold app...');
    
    // Инициализация оптимизаций
    initializeRippleEffects();
    optimizeAnimations();
    lazyLoadImages();
    preloadResources();
    
    // Инициализация Telegram
    if (typeof tg !== 'undefined') {
        tg.expand();
        tg.ready();
        initializeTelegramUser();
    } else {
        console.log('Telegram Web App context not available');
        initializeTestUser();
    }
    
    // Применяем исправления layout
    fixLayoutIssues();
    
    // Инициализация обработчиков событий
    initializeEventHandlers();
});

// 🔧 ИНИЦИАЛИЗАЦИЯ ПОЛЬЗОВАТЕЛЯ
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
            
            // Аутентификация
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

function initializeTestUser() {
    currentUser = {
        id: 123456789,
        firstName: 'Тестовый',
        lastName: 'Пользователь',
        username: 'test_user',
        photoUrl: '',
        isAdmin: false,
        balance: 150,
        tasks_completed: 5,
        active_tasks: 2,
        quality_rate: 95,
        level: 1
    };
    
    initializeApp();
}

// 🔧 ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
async function initializeApp() {
    console.log('🎮 Initializing LinkGold app...');

    // Применяем исправления layout
    fixLayoutIssues();

    // Загружаем задания при старте
    console.log('🚀 FORCE loading tasks on app start...');
    setTimeout(() => {
        if (currentUser) {
            console.log('👤 User authenticated, loading tasks...');
            loadTasksForCategory('new');
        } else {
            console.log('❌ No user for task loading');
        }
    }, 1000);

    // Инициализация компонентов
    showNotification('🔄 Подключаемся к серверу...', 'info');
    
    // Проверяем соединение с API
    try {
        console.log('🔍 Testing API connection...');
        const health = await makeRequest('/api/health');
        console.log('✅ API connection successful:', health);
        showNotification('✅ Соединение с сервером установлено!', 'success');
        
    } catch (error) {
        console.error('❌ API connection failed:', error);
        showNotification('❌ Не удалось подключиться к серверу', 'error');
        showRetryButton();
        return;
    }
    
    // Настройка приложения
    displayUserProfile();
    checkAdminRights();
    loadMainPagePosts();
    initializeSearch();
    loadUserTasks();
    
    // Запускаем автообновление данных
    startUserDataAutoUpdate();
    
    console.log('🎉 App initialized successfully');
}

// 🔧 ФУНКЦИИ ДЛЯ ИСПРАВЛЕНИЯ LAYOUT
function fixLayoutIssues() {
    console.log('🔧 Applying layout fixes...');
    
    const elements = document.querySelectorAll('*');
    elements.forEach(el => {
        el.style.maxWidth = '100%';
        el.style.boxSizing = 'border-box';
    });
    
    const tasksGrid = document.querySelector('.tasks-grid');
    if (tasksGrid) {
        tasksGrid.style.width = '100%';
        tasksGrid.style.margin = '0';
        tasksGrid.style.padding = '0';
        tasksGrid.style.overflow = 'hidden';
    }
    
    const taskCards = document.querySelectorAll('.task-card');
    taskCards.forEach(card => {
        card.style.width = '100%';
        card.style.maxWidth = '100%';
        card.style.boxSizing = 'border-box';
        card.style.margin = '0 0 12px 0';
        card.style.overflow = 'hidden';
    });
    
    document.body.style.overflowX = 'hidden';
    document.documentElement.style.overflowX = 'hidden';
    
    console.log('✅ Layout fixes applied');
}

function updateLayoutOnResize() {
    fixLayoutIssues();
}

// 🔧 ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ СОБЫТИЙ
function initializeEventHandlers() {
    // Обработчики изменения размера
    window.addEventListener('resize', updateLayoutOnResize);
    window.addEventListener('orientationchange', updateLayoutOnResize);
    
    // Обработчики для iOS
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        document.body.style['-webkit-overflow-scrolling'] = 'touch';
    }
}

// 🔧 ФУНКЦИИ НАВИГАЦИИ
function hideAllTabs() {
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

function showMainTab() {
    hideAllTabs();
    document.getElementById('main-tab').classList.add('active');
    updateNavState('main');
}

function showTasksTab() {
    console.log('🎯 ПЕРЕХОД НА ВКЛАДКУ ЗАДАНИЙ');
    
    hideAllTabs();
    const tasksTab = document.getElementById('tasks-tab');
    if (tasksTab) {
        tasksTab.classList.add('active');
    }
    
    updateNavState('tasks');
    
    // Применяем исправления для мобильных
    setTimeout(fixLayoutIssues, 100);
    
    // Активируем вкладку "Новые"
    setTimeout(() => {
        showTaskCategory('new');
    }, 150);
}

function showProfileTab() {
    hideAllTabs();
    document.getElementById('profile-tab').classList.add('active');
    updateNavState('profile');
    
    // Синхронизируем данные при каждом открытии профиля
    setTimeout(() => {
        updateUserData();
        syncUserProfile();
    }, 100);
}

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

// 🔧 АВТООБНОВЛЕНИЕ ДАННЫХ
function startUserDataAutoUpdate() {
    setInterval(async () => {
        if (currentUser) {
            try {
                const result = await makeRequest(`/user/${currentUser.id}`);
                if (result.success) {
                    const oldLevel = currentUser.level;
                    const oldTasksCompleted = currentUser.tasks_completed;
                    
                    currentUser = { ...currentUser, ...result.profile };
                    
                    if (currentUser.level !== oldLevel) {
                        console.log(`🎉 Уровень повышен: ${oldLevel} → ${currentUser.level}`);
                    }
                    
                    if (currentUser.tasks_completed !== oldTasksCompleted) {
                        console.log(`📊 Выполнено заданий: ${oldTasksCompleted} → ${currentUser.tasks_completed}`);
                    }
                    
                    displayUserProfile();
                    console.log('✅ Данные пользователя автообновлены');
                }
            } catch (error) {
                console.error('Ошибка автообновления данных пользователя:', error);
            }
        }
    }, 30000);
}

// 🔧 ФУНКЦИЯ ДЛЯ ПОВТОРНОЙ ПОПЫТКИ
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

// Экспорт функций
window.showMainTab = showMainTab;
window.showTasksTab = showTasksTab;
window.showProfileTab = showProfileTab;
window.showAdminTab = showAdminTab;
window.showWithdrawPage = showWithdrawPage;
window.showHowItWorksPage = showHowItWorksPage;
window.showAboutPage = showAboutPage;
window.goBackToProfile = goBackToProfile;
window.closeModal = closeModal;