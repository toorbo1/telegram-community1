// chat.js - Функционал чата поддержки

class ChatManager {
    constructor() {
        this.currentChatId = null;
        this.currentAdminChat = null;
        this.chatUpdateInterval = null;
        this.API_BASE_URL = window.location.origin;
    }

    // Инициализация чата
    init() {
        this.setupEventListeners();
        console.log('💬 Chat manager initialized');
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Обработчик отправки сообщения по Enter
        const chatInput = document.getElementById('chat-input-field');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessageToAdmin();
                }
            });
        }

        // Обработчик отправки сообщения админом
        const adminChatInput = document.getElementById('admin-chat-input');
        if (adminChatInput) {
            adminChatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendAdminMessage();
                }
            });
        }
    }

    // Открытие чата поддержки для пользователя
    async openAdminChat() {
        if (!window.currentUser) {
            window.showNotification('Пользователь не авторизован', 'error');
            return;
        }
        
        try {
            console.log('👤 User opening support chat, ID:', window.currentUser.id);
            
            // Получаем или создаем чат для пользователя
            const chatResult = await this.makeRequest(`/support/user-chat/${window.currentUser.id}`);
            
            if (chatResult.success) {
                this.currentChatId = chatResult.chat.id;
                console.log('✅ Chat ID:', this.currentChatId);
                
                // Загружаем сообщения
                try {
                    const messagesResult = await this.makeRequest(`/support/chats/${this.currentChatId}/messages`);
                    if (messagesResult.success) {
                        this.displayChatMessages(messagesResult.messages);
                    }
                } catch (messagesError) {
                    console.log('No messages yet or error loading messages:', messagesError);
                    // Показываем пустой чат с приветствием
                    this.displayChatMessages([]);
                }
                
                // Показываем чат
                document.getElementById('admin-chat').classList.add('active');
                
                // Запускаем автообновление сообщений
                this.startChatAutoUpdate();
                
            } else {
                throw new Error(chatResult.error || 'Failed to create chat');
            }
        } catch (error) {
            console.error('❌ Error opening user chat:', error);
            window.showNotification('Ошибка открытия чата: ' + error.message, 'error');
        }
    }

    // Отправка сообщения пользователем
    async sendMessageToAdmin() {
        if (!window.currentUser || !this.currentChatId) {
            window.showNotification('Чат не открыт', 'error');
            return;
        }
        
        const input = document.getElementById('chat-input-field');
        const message = input.value.trim();
        
        if (!message) {
            window.showNotification('Введите сообщение', 'error');
            return;
        }
        
        try {
            console.log(`✉️ User sending message to chat ${this.currentChatId}:`, message);
            
            const userFullName = window.currentUser.lastName ? 
                `${window.currentUser.firstName} ${window.currentUser.lastName}` : 
                window.currentUser.firstName;
            
            const result = await this.makeRequest(`/support/chats/${this.currentChatId}/messages`, {
                method: 'POST',
                body: JSON.stringify({
                    user_id: window.currentUser.id,
                    user_name: userFullName,
                    user_username: window.currentUser.username,
                    message: message,
                    is_admin: false
                })
            });
            
            if (result.success) {
                // Добавляем сообщение в интерфейс
                this.addMessageToChat(message, false);
                input.value = '';
                
                window.showNotification('Сообщение отправлено! Администратор ответит в ближайшее время.', 'success');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('❌ Error sending message:', error);
            window.showNotification('Ошибка отправки: ' + error.message, 'error');
        }
    }

    // Отправка сообщения админом
    async sendAdminMessage() {
        if (!this.currentAdminChat || !window.currentUser) {
            console.error('No active chat or user');
            window.showNotification('Чат не выбран', 'error');
            return;
        }
        
        const input = document.getElementById('admin-chat-input');
        if (!input) {
            console.error('Admin chat input not found');
            return;
        }
        
        const message = input.value.trim();
        
        if (!message) {
            window.showNotification('Введите сообщение', 'error');
            return;
        }
        
        try {
            console.log(`✉️ Admin sending message to chat ${this.currentAdminChat.id}:`, message);
            
            const result = await this.makeRequest(`/support/chats/${this.currentAdminChat.id}/messages`, {
                method: 'POST',
                body: JSON.stringify({
                    user_id: window.currentUser.id,
                    user_name: 'Администратор',
                    user_username: window.currentUser.username,
                    message: message,
                    is_admin: true
                })
            });
            
            if (result.success) {
                // Добавляем сообщение в интерфейс админа
                this.addMessageToAdminChat(message, true);
                input.value = '';
                
                // Обновляем список чатов
                if (window.loadAdminChats) {
                    window.loadAdminChats();
                }
                
                console.log('✅ Admin message sent successfully');
                window.showNotification('Сообщение отправлено', 'success');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('❌ Error sending admin message:', error);
            window.showNotification('Ошибка отправки сообщения: ' + error.message, 'error');
        }
    }

    // Отображение сообщений в чате
    displayChatMessages(messages) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        
        messagesContainer.innerHTML = '';
        
        // Если нет сообщений, показываем приветствие
        if (!messages || messages.length === 0) {
            this.addWelcomeMessage();
            return;
        }
        
        // Показываем существующие сообщения
        messages.forEach(message => {
            this.addMessageToChat(message.message, message.is_admin, message.sent_at);
        });
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Добавление приветственного сообщения
    addWelcomeMessage() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        
        const welcomeMessage = document.createElement('div');
        welcomeMessage.className = 'message message-admin';
        welcomeMessage.innerHTML = `
            <div class="message-text">Здравствуйте! Чем могу помочь?</div>
            <div class="message-time">${new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</div>
        `;
        messagesContainer.appendChild(welcomeMessage);
    }

    // Добавление сообщения в чат
    addMessageToChat(message, isAdmin, timestamp = null) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = isAdmin ? 'message message-admin' : 'message message-user';
        
        const messageTime = timestamp ? 
            window.formatPostDate(timestamp) : 
            new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'});
        
        messageElement.innerHTML = `
            <div class="message-text">${this.escapeHtml(message)}</div>
            <div class="message-time">${messageTime}</div>
        `;
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Добавление сообщения в чат админа
    addMessageToAdminChat(message, isAdmin, timestamp = null) {
        const messagesContainer = document.getElementById('admin-chat-messages');
        if (!messagesContainer) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = isAdmin ? 'message message-admin' : 'message message-user';
        
        const messageTime = timestamp ? 
            window.formatPostDate(timestamp) : 
            new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'});
        
        messageElement.innerHTML = `
            <div class="message-text">${this.escapeHtml(message)}</div>
            <div class="message-time">${messageTime}</div>
        `;
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Запуск автообновления чата
    startChatAutoUpdate() {
        // Останавливаем предыдущий интервал если есть
        if (this.chatUpdateInterval) {
            clearInterval(this.chatUpdateInterval);
        }
        
        // Обновляем сообщения каждые 5 секунд
        this.chatUpdateInterval = setInterval(async () => {
            if (this.currentChatId) {
                try {
                    const messagesResult = await this.makeRequest(`/support/chats/${this.currentChatId}/messages`);
                    if (messagesResult.success) {
                        this.displayChatMessages(messagesResult.messages);
                    }
                } catch (error) {
                    console.log('Chat auto-update error:', error);
                }
            }
        }, 5000);
    }

    // Закрытие чата
    closeChat() {
        document.getElementById('admin-chat').classList.remove('active');
        this.currentChatId = null;
        
        // Останавливаем автообновление
        if (this.chatUpdateInterval) {
            clearInterval(this.chatUpdateInterval);
            this.chatUpdateInterval = null;
        }
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

// Инициализация менеджера чата
const chatManager = new ChatManager();

// Экспорт функций для глобального использования
window.openAdminChat = () => chatManager.openAdminChat();
window.sendMessageToAdmin = () => chatManager.sendMessageToAdmin();
window.closeChat = () => chatManager.closeChat();
window.sendAdminMessage = () => chatManager.sendAdminMessage();

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    chatManager.init();
});