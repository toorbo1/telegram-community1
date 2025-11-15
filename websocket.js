// WebSocket управление
class WebSocketManager {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 3000;
        this.pingInterval = null;
    }

    connect(userId) {
        if (!userId) {
            console.log('❌ No user ID for WebSocket connection');
            return;
        }

        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}?userId=${userId}`;
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket connected');
                this.reconnectAttempts = 0;
                
                // Запускаем ping для поддержания соединения
                this.startPing();
                
                // Показываем уведомление о подключении (опционально)
                this.showConnectionStatus('connected');
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('❌ WebSocket message parse error:', error);
                }
            };
            
            this.ws.onclose = (event) => {
                console.log('❌ WebSocket disconnected:', event.code, event.reason);
                this.stopPing();
                this.showConnectionStatus('disconnected');
                
                // Пытаемся переподключиться
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    setTimeout(() => {
                        this.reconnectAttempts++;
                        console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                        this.connect(userId);
                    }, this.reconnectInterval);
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                this.showConnectionStatus('error');
            };
            
        } catch (error) {
            console.error('❌ WebSocket connection error:', error);
        }
    }

    handleMessage(data) {
        console.log('📨 WebSocket message received:', data);
        
        switch (data.type) {
            case 'connected':
                console.log('🔗 WebSocket connection confirmed');
                break;
                
            case 'TASK_HIDDEN':
                this.handleTaskHidden(data);
                break;
                
            case 'pong':
                // Ответ на ping, ничего не делаем
                break;
                
            default:
                console.log('📨 Unknown message type:', data.type);
        }
    }

    handleTaskHidden(data) {
        const { taskId, taskTitle, message } = data;
        
        console.log(`🎯 Task ${taskId} hidden via WebSocket`);
        
        // Удаляем задание из интерфейса
        this.removeTaskFromUI(taskId);
        
        // Показываем уведомление
        this.showTaskHiddenNotification(taskTitle, message);
        
        // Обновляем счетчик заданий если есть
        this.updateTasksCounter();
    }

    removeTaskFromUI(taskId) {
        // Ищем элемент задания по data-атрибуту
        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskElement) {
            taskElement.style.opacity = '0.7';
            taskElement.style.transition = 'all 0.3s ease';
            
            setTimeout(() => {
                taskElement.remove();
                console.log(`✅ Task ${taskId} removed from UI`);
            }, 500);
        } else {
            // Если не нашли по data-атрибуту, ищем другими способами
            const allTaskElements = document.querySelectorAll('.task-card, .task-item, [id*="task"]');
            allTaskElements.forEach(element => {
                if (element.textContent.includes(taskId) || element.innerHTML.includes(taskId.toString())) {
                    element.remove();
                    console.log(`✅ Task ${taskId} removed from UI (fallback)`);
                }
            });
        }
    }

    showTaskHiddenNotification(taskTitle, message) {
        // Используем вашу существующую функцию showNotification или создаем новую
        if (typeof showNotification === 'function') {
            showNotification(`🚫 ${message}`, 'warning');
        } else {
            // Fallback уведомление
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #ff6b6b;
                color: white;
                padding: 15px;
                border-radius: 8px;
                z-index: 10000;
                max-width: 300px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;
            notification.innerHTML = `
                <strong>🚫 Задание недоступно</strong>
                <div style="font-size: 12px; margin-top: 5px;">${taskTitle}</div>
            `;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 5000);
        }
    }

    updateTasksCounter() {
        // Обновляем счетчик заданий если он есть на странице
        const counter = document.querySelector('#tasks-count, .tasks-counter, [class*="counter"]');
        if (counter) {
            const currentCount = parseInt(counter.textContent) || 0;
            if (currentCount > 0) {
                counter.textContent = currentCount - 1;
            }
        }
    }

    startPing() {
        // Отправляем ping каждые 30 секунд для поддержания соединения
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
            }
        }, 30000);
    }

    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    showConnectionStatus(status) {
        // Опционально: показываем статус соединения в интерфейсе
        const statusElement = document.getElementById('websocket-status');
        if (statusElement) {
            statusElement.textContent = status === 'connected' ? '🟢' : '🔴';
            statusElement.title = status === 'connected' ? 'Соединение активно' : 'Соединение прервано';
        }
    }

    disconnect() {
        this.stopPing();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// Глобальный экземпляр WebSocket менеджера
const websocketManager = new WebSocketManager();

// Инициализация WebSocket при загрузке страницы
function initializeWebSocket() {
    if (currentUser && currentUser.id) {
        console.log('🔗 Initializing WebSocket for user:', currentUser.id);
        websocketManager.connect(currentUser.id);
    } else {
        console.log('⏳ Waiting for user authentication...');
        // Повторяем попытку через 2 секунды если пользователь еще не загружен
        setTimeout(initializeWebSocket, 2000);
    }
}

// Запускаем при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initializeWebSocket, 1000);
});

// Также переподключаемся при смене пользователя
if (typeof onUserAuth === 'function') {
    const originalOnUserAuth = onUserAuth;
    onUserAuth = function(user) {
        originalOnUserAuth(user);
        setTimeout(initializeWebSocket, 500);
    };
}