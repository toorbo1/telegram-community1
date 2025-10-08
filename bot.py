import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# Токен бота
BOT_TOKEN = "8206130580:AAG91R9Bnp2pYG0z9v1eRJmH8oZvThsN9eA"

# Команда /start
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Создаем инлайн-кнопки
    keyboard = [
        [InlineKeyboardButton("🌐 Открыть сайт в Telegram", web_app={"url": "https://telegram-community1-production.up.railway.app/"})],
        [InlineKeyboardButton("📢 Подписаться на канал", url="https://t.me/LinkGoldChannel")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    text = """
🚀 **LinkGold - Биржа заданий и заработок для Telegram звезд!** 🌟

**О КОМПАНИИ:**
LinkGold - это современная платформа, которая объединяет бренды и популярных создателей контента в Telegram. Мы создаем мост между бизнесом и талантливыми авторами!

**ЧТО МЫ ПРЕДЛАГАЕМ:**

📊 **Для создателей контента:**
• Выполняйте задания от брендов
• Зарабатывайте на своем Telegram-канале
• Получайте стабильный доход
• Работайте с известными компаниями

🏢 **Для брендов:**
• Найдите подходящих авторов для рекламы
• Размещайте задания напрямую
• Анализируйте результаты кампаний
• Увеличивайте охват аудитории

**ПРЕИМУЩЕСТВА LINKGOLD:**
✅ Прозрачная система расчетов
✅ Быстрый вывод средств
✅ Поддержка 24/7
✅ Гарантия качества выполнения заданий
✅ Безопасные сделки

Присоединяйтесь к сообществу LinkGold и начните зарабатывать уже сегодня! 🎯
    """
    
    await update.message.reply_text(
        text=text,
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )

# Обработка web app данных (если нужно)
async def web_app_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Обработка данных из web app
    pass

# Обработка callback запросов
async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

# Основная функция
def main():
    # Создаем приложение
    application = Application.builder().token(BOT_TOKEN).build()
    
    # Добавляем обработчики
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CallbackQueryHandler(button_handler))
    
    # Запускаем бота
    print("Бот запущен...")
    application.run_polling()

if __name__ == "__main__":
    main()