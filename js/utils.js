// 🔧 КОНФИГУРАЦИЯ И ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
const API_BASE_URL = window.location.origin;
const ADMIN_ID = 8036875641;

console.log('🌐 Current URL:', window.location.href);
console.log('🔗 API Base URL:', API_BASE_URL);

const tg = window.Telegram.WebApp;

// 🔧 ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
let currentUser = null;
let currentChatId = null;
let currentAdminChat = null;
let selectedTaskId = null;
let allTasks = [];
let chatUpdateInterval = null;
let currentUserTaskId = null;
let currentVerificationId = null;
let currentTaskImage = null;

// 🔧 УЛУЧШЕННАЯ ФУНКЦИЯ ДЛЯ ЗАПРОСОВ
async function makeRequest(endpoint, options = {}) {
    try {
        let url;
        if (endpoint.startsWith('http')) {
            url = endpoint;
        } else if (endpoint.startsWith('/api')) {
            url = API_BASE_URL + endpoint;
        } else {
            url = API_BASE_URL + '/api' + (endpoint.startsWith('/') ? endpoint : '/' + endpoint);
        }
        
        console.log(`🚀 Making ${options.method || 'GET'} request to: ${url}`);
        
        const timeout = 10000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            signal: controller.signal,
            ...options
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ HTTP error! status: ${response.status}, response: ${errorText}`);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('📨 Response received:', data);
        return data;
        
    } catch (error) {
        console.error('💥 Request failed:', error);
        
        if (error.name === 'AbortError') {
            throw new Error('Таймаут запроса. Сервер не отвечает.');
        } else if (error.name === 'TypeError') {
            throw new Error('Проблема с сетью. Проверьте подключение к интернету.');
        } else {
            throw error;
        }
    }
}

// 🔧 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
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
    const moscowTime = new Date(date.getTime() + (3 * 60 * 60 * 1000));
    
    const now = new Date();
    const diffTime = now - date;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return `Сегодня, ${moscowTime.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'Europe/Moscow'
        })} (МСК)`;
    } else if (diffDays === 1) {
        return `Вчера, ${moscowTime.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'Europe/Moscow'
        })} (МСК)`;
    } else {
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

function showNotification(message, type = 'info') {
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

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// 🔧 ФУНКЦИИ ДЛЯ ОПТИМИЗАЦИИ
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

// 🔧 RIPPLE ЭФФЕКТ
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

function initializeRippleEffects() {
    const buttons = document.querySelectorAll('.btn, .task-btn, .nav-item');
    buttons.forEach(button => {
        button.addEventListener('click', createRipple);
    });
}

// 🔧 ЛЕНИВАЯ ЗАГРУЗКА ИЗОБРАЖЕНИЙ
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

// 🔧 ОПТИМИЗАЦИЯ АНИМАЦИЙ
function optimizeAnimations() {
    const animatedElements = document.querySelectorAll('.task-card, .card, .modal-content');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.willChange = 'transform, opacity';
            } else {
                setTimeout(() => {
                    entry.target.style.willChange = 'auto';
                }, 300);
            }
        });
    });
    
    animatedElements.forEach(el => observer.observe(el));
}

// 🔧 ПРЕДЗАГРУЗКА РЕСУРСОВ
function preloadResources() {
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

// Экспорт функций
window.makeRequest = makeRequest;
window.escapeHtml = escapeHtml;
window.formatPostDate = formatPostDate;
window.formatCategory = formatCategory;
window.showNotification = showNotification;
window.closeModal = closeModal;
window.debounce = debounce;
window.throttle = throttle;