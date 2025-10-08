import os
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Токен бота из переменных окружения
BOT_TOKEN = os.getenv('BOT_TOKEN', '8206130580:AAG91R9Bnp2pYG0z9v1eRJmH8oZvThsN9eA')

# URL вашего сайта
SITE_URL = os.getenv('SITE_URL', 'https://telegram-community1-production.up.railway.app/')

# Команда /start
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        # Создаем инлайн-кнопки
        keyboard = [
            [InlineKeyboardButton("🌐 Открыть LinkGold", web_app={"url": SITE_URL})],
            [InlineKeyboardButton("📢 Наш канал", url="https://t.me/LinkGoldChannel")],
            [InlineKeyboardButton("💬 Поддержка", url="https://t.me/LinkGoldSupport")]
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

Нажмите кнопку ниже, чтобы открыть платформу и начать зарабатывать! 🎯
        """
        
        await update.message.reply_text(
            text=text,
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )
        logger.info(f"User {update.effective_user.id} started the bot")
        
    except Exception as e:
        logger.error(f"Error in start command: {e}")

# Команда /help
async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    help_text = """
🤖 **Доступные команды:**

/start - Запустить бота и получить основную информацию
/help - Получить справку по командам
/site - Открыть платформу LinkGold

💡 **Как начать работать:**
1. Нажмите кнопку "🌐 Открыть LinkGold"
2. Зарегистрируйтесь на платформе
3. Выбирайте задания и начинайте зарабатывать!

📞 **Поддержка:**
По всем вопросам обращайтесь @LinkGoldSupport
    """
    
    keyboard = [
        [InlineKeyboardButton("🌐 Открыть платформу", web_app={"url": SITE_URL})]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        text=help_text,
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )

# Команда /site
async def site_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [InlineKeyboardButton("🚀 Перейти к заработку", web_app={"url": SITE_URL})]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        text="Нажмите кнопку ниже, чтобы открыть платформу LinkGold и начать зарабатывать! 💰",
        reply_markup=reply_markup
    )

# Обработка callback запросов
async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    logger.info(f"Button pressed by user {query.from_user.id}")

# Обработка ошибок
async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    logger.error(f"Exception while handling an update: {context.error}")

# Основная функция
def main():
    try:
        # Создаем приложение
        application = Application.builder().token(BOT_TOKEN).build()
        
        # Добавляем обработчики
        application.add_handler(CommandHandler("start", start))
        application.add_handler(CommandHandler("help", help_command))
        application.add_handler(CommandHandler("site", site_command))
        application.add_handler(CallbackQueryHandler(button_handler))
        
        # Обработчик ошибок
        application.add_error_handler(error_handler)
        
        # Запускаем бота
        logger.info("Бот запущен...")
        print("🤖 LinkGold Bot is running...")
        application.run_polling()
        
    except Exception as e:
        logger.error(f"Failed to start bot: {e}")
        print(f"❌ Error starting bot: {e}")

if __name__ == "__main__":
    main()