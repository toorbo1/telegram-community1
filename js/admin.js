// admin.js - Функционал админ-панели

class AdminManager {
    constructor() {
        this.API_BASE_URL = window.location.origin;
        this.ADMIN_ID = 8036875641;
    }

    // Инициализация админ-панели
    init() {
        this.setupAdminEventListeners();
        this.checkAdminRights();
        console.log('⚙️ Admin manager initialized');
    }

    // Проверка прав администратора
    checkAdminRights() {
        const adminNavItem = document.getElementById('admin-nav-item');
        
        const isMainAdmin = parseInt(window.currentUser?.id) === this.ADMIN_ID;
        const isRegularAdmin = window.currentUser?.is_admin === true;
        
        if (window.currentUser && (isMainAdmin || isRegularAdmin)) {
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

    // Настройка обработчиков событий админ-панели
    setupAdminEventListeners() {
        // Обработчики для кнопок админ-панели
        this.setupAdminSectionHandlers();
        
        // Обработчики для форм
        this.setupAdminFormHandlers();
    }

    // Настройка обработчиков переключения секций
    setupAdminSectionHandlers() {
        const adminButtons = document.querySelectorAll('.admin-btn');
        adminButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.getAttribute('onclick')?.match(/showAdminSection\('([^']+)'\)/)?.[1];
                if (section) {
                    this.showAdminSection(section);
                }
            });
        });
    }

    // Настройка обработчиков форм
    setupAdminFormHandlers() {
        // Обработчик формы добавления поста
        const postForm = document.getElementById('admin-post-content');
        if (postForm) {
            postForm.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    window.addNewPost();
                }
            });
        }

        // Обработчик формы добавления задания
        const taskTitle = document.getElementById('admin-task-title');
        if (taskTitle) {
            taskTitle.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('admin-task-description').focus();
                }
            });
        }
    }

    // Показать секцию админ-панели
    showAdminSection(section) {
        console.log('🔄 Switching to admin section:', section);
        
        // Скрываем ВСЕ админ секции
        const adminSections = document.querySelectorAll('.admin-section');
        adminSections.forEach(sec => {
            sec.style.display = 'none';
            console.log(`❌ Hiding: ${sec.id}`);
        });
        
        // Показываем выбранную секцию
        const targetSection = document.getElementById('admin-' + section + '-section');
        if (targetSection) {
            targetSection.style.display = 'block';
            console.log(`✅ Showing: admin-${section}-section`);
            
            // Загружаем данные для определенных секций
            this.loadSectionData(section);
        } else {
            console.error(`❌ Target section not found: admin-${section}-section`);
        }
    }

    // Загрузка данных для секции
    async loadSectionData(section) {
        switch(section) {
            case 'posts':
                console.log('📝 Loading posts management...');
                await this.loadAdminPosts();
                break;
            case 'tasks':
                console.log('📋 Loading tasks management...');
                await this.loadAdminTasks();
                break;
            case 'payments':
                console.log('💳 Loading withdrawal requests...');
                await this.loadWithdrawalRequests();
                break;
            case 'verification':
                console.log('✅ Loading task verifications...');
                await this.loadTaskVerifications();
                break;
            case 'support':
                console.log('💬 Loading support chats...');
                await this.loadAdminChats();
                break;
            case 'admins':
                console.log('👥 Loading admins list...');
                await this.loadAdminsList();
                break;
        }
    }

    // Загрузка постов для админ-панели
    async loadAdminPosts() {
        try {
            console.log('📝 Loading admin posts...');
            const result = await this.makeRequest('/posts');
            if (result.success) {
                this.displayAdminPosts(result.posts);
            }
        } catch (error) {
            console.error('Error loading admin posts:', error);
        }
    }

    // Отображение постов в админ-панели
    displayAdminPosts(posts) {
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
                    <div class="admin-task-title">${this.escapeHtml(post.title)}</div>
                    <div class="admin-task-actions">
                        <button class="admin-task-delete" onclick="deletePost(${post.id})">
                            🗑️ Удалить
                        </button>
                    </div>
                </div>
                <div class="admin-task-description">${this.escapeHtml(post.content)}</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                    Автор: ${post.author} • ${new Date(post.created_at).toLocaleDateString('ru-RU')}
                </div>
            `;
            container.appendChild(postElement);
        });
    }

    // Загрузка заданий для админ-панели
    async loadAdminTasks() {
        if (!window.currentUser) return;
        
        try {
            const result = await this.makeRequest(`/admin/tasks?adminId=${window.currentUser.id}`);
            if (result.success) {
                this.displayAdminTasks(result.tasks);
            }
        } catch (error) {
            console.error('Error loading admin tasks:', error);
        }
    }

    // Отображение заданий в админ-панели
    displayAdminTasks(tasks) {
        const container = document.getElementById('admin-tasks-list');
        if (!container) return;
        
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
                        <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">${this.escapeHtml(task.title)}</div>
                        <div style="color: var(--text-secondary); font-size: 14px;">${this.escapeHtml(task.description)}</div>
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

    // Загрузка заявок на вывод средств
    async loadWithdrawalRequests() {
        console.log('🔄 Loading withdrawal requests...');
        
        if (!window.currentUser) {
            console.log('❌ No current user');
            window.showNotification('Пользователь не авторизован', 'error');
            return;
        }
        
        try {
            const result = await this.makeRequest(`/admin/withdrawal-requests?adminId=${window.currentUser.id}`);
            console.log('📨 Withdrawal requests response:', result);
            
            if (result.success) {
                this.displayWithdrawalRequests(result.requests);
            } else {
                console.error('❌ Failed to load requests:', result.error);
                window.showNotification('Ошибка загрузки заявок: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('❌ Load withdrawal requests error:', error);
            window.showNotification('Ошибка загрузки заявок: ' + error.message, 'error');
        }
    }

    // Отображение заявок на вывод
    displayWithdrawalRequests(requests) {
        const container = document.getElementById('withdrawal-requests-list');
        if (!container) {
            console.error('❌ Container not found');
            return;
        }
        
        container.innerHTML = '';
        
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

    // Загрузка заданий на проверку
    async loadTaskVerifications() {
        if (!window.currentUser) return;

        try {
            const result = await this.makeRequest(`/admin/task-verifications?adminId=${window.currentUser.id}`);
            if (result.success) {
                this.displayTaskVerifications(result.verifications);
            }
        } catch (error) {
            console.error('Error loading task verifications:', error);
        }
    }

    // Отображение заданий на проверку
    displayTaskVerifications(verifications) {
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
            verificationElement.onclick = () => this.openVerificationModal(verification);

            const userAvatar = verification.user_name ? verification.user_name.charAt(0).toUpperCase() : 'U';
            const submissionTime = window.formatPostDate(verification.submitted_at);

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

    // Загрузка чатов поддержки
    async loadAdminChats() {
        if (!window.currentUser) return;
        
        try {
            console.log('📥 Loading admin chats...');
            const result = await this.makeRequest(`/support/chats`);
            
            if (result.success) {
                console.log(`✅ Loaded ${result.chats?.length || 0} active chats`);
                this.displayAdminChatsList(result.chats || []);
            } else {
                console.error('❌ Failed to load chats:', result.error);
            }
        } catch (error) {
            console.error('❌ Error loading admin chats:', error);
        }
    }

    // Отображение списка чатов
    displayAdminChatsList(chats) {
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
        
        chats.forEach(chat => {
            const chatElement = this.createChatElement(chat, 'active');
            container.appendChild(chatElement);
        });
    }

    // Создание элемента чата
    createChatElement(chat, listType) {
        const chatElement = document.createElement('div');
        const isUnread = chat.unread_count > 0;
        const isArchived = !chat.is_active;
        
        chatElement.className = `chat-item ${isUnread ? 'unread' : ''} ${isArchived ? 'archived' : ''}`;
        chatElement.onclick = () => this.openAdminChatWindow(chat);
        
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
                <div class="chat-last-message">${this.escapeHtml(lastMessage)}</div>
            </div>
            <div class="chat-meta">
                <div class="chat-time">${chat.moscow_time || window.formatPostDate(chat.last_message_time)}</div>
                ${isUnread ? `<div class="unread-badge">${chat.unread_count}</div>` : ''}
            </div>
        `;
        
        return chatElement;
    }

    // Загрузка списка админов
    async loadAdminsList() {
        console.log('🔄 Loading admins list...');
        
        if (!window.currentUser || parseInt(window.currentUser.id) !== this.ADMIN_ID) {
            console.log('❌ User is not main admin');
            return;
        }
        
        try {
            const result = await this.makeRequest(`/admin/admins-list?adminId=${window.currentUser.id}`);
            
            if (result.success) {
                this.displayAdminsList(result.admins);
            } else {
                window.showNotification('Ошибка загрузки списка админов: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('❌ Error loading admins list:', error);
            window.showNotification('Ошибка загрузки списка админов', 'error');
        }
    }

    // Отображение списка админов
    displayAdminsList(admins) {
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
            
            const isMainAdmin = parseInt(admin.user_id) === this.ADMIN_ID;
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
            `;
            
            container.appendChild(adminElement);
        });
    }

    // Утилитарные методы
    async makeRequest(endpoint, options = {}) {
        try {
            const url = endpoint.startsWith('http') ? endpoint : `${this.API_BASE_URL}${endpoint}`;
            
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
            
        } catch (error) {
            console.error('💥 Request failed:', error);
            throw error;
        }
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Инициализация менеджера админ-панели
const adminManager = new AdminManager();

// Экспорт функций для глобального использования
window.showAdminSection = (section) => adminManager.showAdminSection(section);
window.loadAdminTasks = () => adminManager.loadAdminTasks();
window.loadWithdrawalRequests = () => adminManager.loadWithdrawalRequests();
window.loadTaskVerifications = () => adminManager.loadTaskVerifications();
window.loadAdminChats = () => adminManager.loadAdminChats();
window.loadAdminsList = () => adminManager.loadAdminsList();
window.checkAdminRights = () => adminManager.checkAdminRights();

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    adminManager.init();
});