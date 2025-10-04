const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Конфигурация
const BOT_TOKEN = process.env.BOT_TOKEN || '8206130580:AAG91R9Bnp2pYG0z9v1eRJmH8oZvThsN9eA';
const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME || '@LinkGoldChannel';
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://telegram-community1-production.up.railway.app/';

// Создаем экземпляр бота
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Тексты сообщений
const WELCOME_MESSAGE = `
<b>🌟 Добро пожаловать на <span class="tg-spoiler">LinkGold</span> — твою надежную биржу заданий! 🌟</b>

Приветствуем тебя, будущий звездный магнат! Ты только что нашел уникальное место, где твоя активность в Telegram превращается в реальную ценность.

<u><b>Что такое LinkGold?</b></u>

🤝 <b>LinkGold</b> — это современная платформа, которая связывает рекламодателей и активных пользователей. Бренды хотят, чтобы о них узнали, а ты можешь им в этом помочь — и получить щедрую награду!

<u><b>Как это работает?</b></u>

Всё просто, как раз-два-три:

1.  <b>ВЫБИРАЙ</b> 🎯 — Заходи в каталог заданий. От тебя требуется лишь подписаться на каналы, поставить лайки, оставить комментарии или сделать репосты.
2.  <b>ВЫПОЛНЯЙ</b> ✍️ — Четко следуй простым инструкциям к каждому заданию. Обычно это дело пары минут!
3.  <b>ПОЛУЧАЙ</b> 💫 — Мгновенно после проверки твой кошелек пополняется <b>Telegram Stars</b> — внутренней виртуальной валютой, которую можно выводить или тратить!

<u><b>Почему именно мы?</b></u>

✅ <b>Мгновенные выплаты:</b> Заработанные Stars зачисляются на твой счет сразу после одобрения задания.
✅ <b>Гарантия выполнения:</b> Мы работаем только с проверенными рекламодателями.
✅ <b>Прозрачность:</b> Все условия заданий четко прописаны, никаких скрыных условий.
✅ <b>Простота:</b> Интуитивно понятный интерфейс, с которым разберется каждый.
✅ <b>Поддержка 24/7:</b> Наша команда всегда готова помочь с любым вопросом.

🚀 <b>Готов начать зарабатывать?</b>

Чтобы получить доступ к платформе с заданиями, тебе необходимо быть подписчиком нашего новостного канала. Там мы публикуем самые свежие задания, объявления и важные обновления системы.

Нажми на кнопку ниже, чтобы проверить подписку и открыть для себя мир безграничных возможностей с <b>LinkGold</b>!

<b>Твои звёзды ждут тебя! 💫</b>
`;

const SUCCESS_MESSAGE = `
🔍 <b>Проверяем подписку на канал...</b>

Отлично! Проверка завершена. Спасибо, что с нами! 👍

Тебе открыт полный доступ к нашей платформе. Теперь ты можешь начать зарабатывать Telegram Stars, выполняя простые и интересные задания.

➡️ <b>Переходи на нашу основную платформу по ссылке ниже и приступай к первому заданию прямо сейчас!</b>

<a href="${WEBSITE_URL}">🌟 НАЧАТЬ ЗАРАБАТЫВАТЬ ЗВЕЗДЫ 🌟</a>

<b>Удачи и больших заработков! Пусть каждая твоя звезда станет частью большого успеха! 🚀</b>

<em>P.S. Не забывай заглядывать в наш канал — там появляются самые выгодные и горячие задания!</em>
`;

const NOT_SUBSCRIBED_MESSAGE = `
❌ <b>Проверка не пройдена</b>

Кажется, вы еще не подписаны на наш канал ${CHANNEL_USERNAME}.

Пожалуйста, подпишитесь на канал и нажмите кнопку «Проверить подписку» снова, чтобы получить доступ к платформе с заданиями.
`;

// Обработчик команды /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Проверить подписку', callback_data: 'check_subscription' }]
      ]
    }
  };

  await bot.sendMessage(chatId, WELCOME_MESSAGE, {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...keyboard
  });
});

// Обработчик callback кнопок
bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const chatId = message.chat.id;
  const userId = callbackQuery.from.id;

  if (callbackQuery.data === 'check_subscription') {
    try {
      // Проверяем подписку пользователя
      const chatMember = await bot.getChatMember(CHANNEL_USERNAME, userId);
      
      if (['member', 'administrator', 'creator'].includes(chatMember.status)) {
        // Пользователь подписан
        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🌟 Начать зарабатывать', url: WEBSITE_URL }],
              [{ text: '✅ Проверить снова', callback_data: 'check_subscription' }]
            ]
          }
        };

        await bot.editMessageText(SUCCESS_MESSAGE, {
          chat_id: chatId,
          message_id: message.message_id,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          ...keyboard
        });
      } else {
        // Пользователь не подписан
        throw new Error('Not subscribed');
      }
    } catch (error) {
      // Ошибка или пользователь не подписан
      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📢 Подписаться на канал', url: `https://t.me/${CHANNEL_USERNAME.replace('@', '')}` }],
            [{ text: '✅ Проверить подписку', callback_data: 'check_subscription' }]
          ]
        }
      };

      await bot.editMessageText(NOT_SUBSCRIBED_MESSAGE, {
        chat_id: chatId,
        message_id: message.message_id,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...keyboard
      });
    }
    
    await bot.answerCallbackQuery(callbackQuery.id);
  }
});

// Обработчик обычных сообщений
bot.on('message', (msg) => {
  if (msg.text && !msg.text.startsWith('/')) {
    // Повторно отправляем приветственное сообщение
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Проверить подписку', callback_data: 'check_subscription' }]
        ]
      }
    };

    bot.sendMessage(msg.chat.id, WELCOME_MESSAGE, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...keyboard
    });
  }
});

// Запуск бота
console.log('🤖 Telegram бот LinkGold запущен...');
console.log('📢 Канал для проверки:', CHANNEL_USERNAME);
console.log('🌐 Сайт платформы:', WEBSITE_URL);

// Обработка ошибок
bot.on('error', (error) => {
  console.error('❌ Ошибка бота:', error);
});

bot.on('polling_error', (error) => {
  console.error('❌ Ошибка polling:', error);
});