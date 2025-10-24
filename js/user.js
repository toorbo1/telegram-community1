// 🔧 ФУНКЦИИ ДЛЯ РАБОТЫ С ПОЛЬЗОВАТЕЛЕМ

// 🔧 ОБНОВЛЕНИЕ ДАННЫХ ПОЛЬЗОВАТЕЛЯ
async function updateUserData() {
    if (!currentUser) return;
    
    try {
        const result = await makeRequest(`/user/${currentUser.id}`);
        if (result.success) {
            currentUser = { ...currentUser, ...result.profile };
            displayUserProfile();
            console.log('✅ Данные пользователя обновлены:', currentUser.balance);
        }
    } catch (error) {
        console.error('Ошибка обновления данных пользователя:', error);
    }
}

// 🔧 ОТОБРАЖЕНИЕ ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ
function displayUserProfile() {
    if (!currentUser) return;

    // Основная информация
    const firstNameElement = document.getElementById('user-first-name');
    const usernameElement = document.getElementById('user-username');
    const levelElement = document.getElementById('user-level');
    const balanceElement = document.getElementById('user-balance-main');
    
    if (firstNameElement) {
        const fullName = currentUser.lastName ? 
            `${currentUser.firstName} ${currentUser.lastName}` : 
            currentUser.firstName;
        firstNameElement.textContent = fullName;
    }
    
    if (usernameElement) usernameElement.textContent = currentUser.username || 'username';
    if (levelElement) levelElement.textContent = currentUser.level || 1;
    
    // Баланс
    const userBalance = currentUser.balance || 0;
    if (balanceElement) balanceElement.textContent = `${userBalance} ⭐`;
    
    // Аватар
    const userPhotoElement = document.getElementById('user-photo');
    if (userPhotoElement && currentUser.photoUrl) {
        userPhotoElement.src = currentUser.photoUrl;
        userPhotoElement.alt = 'Фото профиля';
        userPhotoElement.style.display = 'block';
    } else if (userPhotoElement) {
        userPhotoElement.style.display = 'flex';
        userPhotoElement.style.alignItems = 'center';
        userPhotoElement.style.justifyContent = 'center';
        userPhotoElement.style.backgroundColor = '#6366f1';
        userPhotoElement.style.color = 'white';
        userPhotoElement.style.fontWeight = 'bold';
        userPhotoElement.style.borderRadius = '50%';
        userPhotoElement.textContent = currentUser.firstName ? currentUser.firstName.charAt(0).toUpperCase() : 'U';
    }
    
    // Статистика и прогресс
    updateProfileStats();
    updateReferralSystem();
    updateLevelProgress();
}

// 🔧 ОБНОВЛЕНИЕ СТАТИСТИКИ ПРОФИЛЯ
function updateProfileStats() {
    if (!currentUser) return;
    
    const stats = document.querySelectorAll('.profile-stat .stat-value');
    if (stats.length >= 4) {
        stats[0].textContent = `${currentUser.balance || 0} ⭐`;
        stats[1].textContent = currentUser.tasks_completed || 0;
        stats[2].textContent = currentUser.active_tasks || 0;
        stats[3].textContent = `${currentUser.quality_rate || 0}%`;
    }
}

// 🔧 ОБНОВЛЕНИЕ РЕФЕРАЛЬНОЙ СИСТЕМЫ
function updateReferralSystem() {
    if (!currentUser) return;
    
    const referralCode = currentUser.referral_code || `ref_${currentUser.id}`;
    const referralLink = `https://t.me/LinkGoldMoney_bot?start=${referralCode}`;
    
    const referralInput = document.getElementById('referral-link');
    if (referralInput) referralInput.value = referralLink;
    
    const refInvited = document.getElementById('ref-invited');
    const refEarned = document.getElementById('ref-earned');
    
    if (refInvited) refInvited.textContent = currentUser.referral_count || 0;
    if (refEarned) refEarned.textContent = `${currentUser.referral_earned || 0} ⭐`;
    
    const referralInfo = document.querySelector('.referral-info');
    if (referralInfo) {
        referralInfo.innerHTML = `
            🎁 Вы получаете: <strong>20⭐</strong> за друга<br>
            🎁 Друг получает: <strong>10⭐</strong> при регистрации<br><br>
            🔗 Просто отправьте другу эту ссылку в Telegram
        `;
    }
}

// 🔧 СИСТЕМА УРОВНЕЙ
const LEVEL_SYSTEM = {
    1: { tasksRequired: 10, name: "Новичок" },
    2: { tasksRequired: 20, name: "Ученик" },
    3: { tasksRequired: 30, name: "Опытный" },
    4: { tasksRequired: 40, name: "Профессионал" },
    5: { tasksRequired: 50, name: "Эксперт" },
    6: { tasksRequired: 60, name: "Мастер" },
    7: { tasksRequired: 70, name: "Гуру" },
    8: { tasksRequired: 80, name: "Легенда" },
    9: { tasksRequired: 90, name: "Император" },
    10: { tasksRequired: 100, name: "Бог заданий" }
};

function calculateUserLevel(completedTasks) {
    let currentLevel = 1;
    let tasksForCurrentLevel = 0;
    let tasksForNextLevel = LEVEL_SYSTEM[1].tasksRequired;
    let progressPercentage = 0;
    
    for (let level = 1; level <= Object.keys(LEVEL_SYSTEM).length; level++) {
        if (completedTasks >= LEVEL_SYSTEM[level].tasksRequired) {
            currentLevel = level;
        } else {
            break;
        }
    }
    
    const currentLevelRequirement = LEVEL_SYSTEM[currentLevel].tasksRequired;
    
    if (currentLevel < Object.keys(LEVEL_SYSTEM).length) {
        const nextLevelRequirement = LEVEL_SYSTEM[currentLevel + 1].tasksRequired;
        tasksForCurrentLevel = completedTasks - currentLevelRequirement;
        const totalTasksForNextLevel = nextLevelRequirement - currentLevelRequirement;
        
        progressPercentage = Math.min(100, Math.round((tasksForCurrentLevel / totalTasksForNextLevel) * 100));
        tasksForNextLevel = nextLevelRequirement;
    } else {
        progressPercentage = 100;
        tasksForNextLevel = LEVEL_SYSTEM[currentLevel].tasksRequired;
        tasksForCurrentLevel = completedTasks - currentLevelRequirement;
    }
    
    return {
        level: currentLevel,
        levelName: LEVEL_SYSTEM[currentLevel].name,
        completedTasks: completedTasks,
        currentLevelTasks: tasksForCurrentLevel,
        tasksForNextLevel: tasksForNextLevel,
        progressPercentage: progressPercentage,
        isMaxLevel: currentLevel === Object.keys(LEVEL_SYSTEM).length
    };
}

function updateLevelProgress() {
    if (!currentUser) return;
    
    const completedTasks = currentUser.tasks_completed || 0;
    const levelInfo = calculateUserLevel(completedTasks);
    
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
            const tasksNeeded = levelInfo.tasksForNextLevel - completedTasks;
            const tasksForThisLevel = levelInfo.tasksForNextLevel - LEVEL_SYSTEM[levelInfo.level].tasksRequired;
            levelCount.textContent = `${levelInfo.currentLevelTasks}/${tasksForThisLevel} заданий`;
        }
    }
    
    if (levelInfoText) {
        if (levelInfo.isMaxLevel) {
            levelInfoText.innerHTML = `🎉 Поздравляем! Вы достигли максимального уровня!`;
        } else {
            const tasksNeeded = levelInfo.tasksForNextLevel - completedTasks;
            levelInfoText.innerHTML = 
                `Уровень <strong>${levelInfo.levelName}</strong> • ` +
                `До следующего уровня: <strong>${tasksNeeded}</strong> заданий`;
        }
    }
}

// 🔧 СИНХРОНИЗАЦИЯ С TELEGRAM
async function syncUserProfile() {
    if (!currentUser || !window.Telegram?.WebApp) return;
    
    try {
        const tg = window.Telegram.WebApp;
        const tgUser = tg.initDataUnsafe?.user;
        
        if (tgUser) {
            const updatedUser = {
                ...currentUser,
                firstName: tgUser.first_name || currentUser.firstName,
                lastName: tgUser.last_name || currentUser.lastName,
                username: tgUser.username || currentUser.username,
                photoUrl: tgUser.photo_url || currentUser.photoUrl
            };
            
            currentUser = updatedUser;
            displayUserProfile();
            
            console.log('✅ Профиль синхронизирован с Telegram');
        }
    } catch (error) {
        console.error('❌ Ошибка синхронизации профиля:', error);
    }
}

// 🔧 КОПИРОВАНИЕ РЕФЕРАЛЬНОЙ ССЫЛКИ
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

// 🔧 ПРОВЕРКА ПРАВ АДМИНИСТРАТОРА
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

// Экспорт функций
window.updateUserData = updateUserData;
window.displayUserProfile = displayUserProfile;
window.copyReferralLink = copyReferralLink;
window.checkAdminRights = checkAdminRights;
window.syncUserProfile = syncUserProfile;