// const { Telegraf } = require('telegraf');
// const { Pool } = require('pg');

// const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
// const pool = new Pool({
//     connectionString: process.env.DATABASE_URL,
//     ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
// });

// // Обработчик команды для подтверждения выплаты
// bot.action(/withdraw_approve_(\d+)/, async (ctx) => {
//     try {
//         const requestId = ctx.match[1];
        
//         // Обновляем статус в базе данных
//         await pool.query(`
//             UPDATE withdrawal_requests 
//             SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
//             WHERE id = $1
//         `, [requestId]);
        
//         // Редактируем сообщение
//         await ctx.editMessageText(
//             `✅ Выплата подтверждена\n🆔 ID: ${requestId}\n⏰ Время: ${new Date().toLocaleString('ru-RU')}`,
//             { reply_markup: { inline_keyboard: [] } }
//         );
        
//         await ctx.answerCbQuery('✅ Выплата подтверждена');
//     } catch (error) {
//         console.error('Error approving withdrawal:', error);
//         await ctx.answerCbQuery('❌ Ошибка подтверждения');
//     }
// });

// // Функция для отправки уведомления о выводе
// async function sendWithdrawalNotification(username, amount, requestId) {
//     try {
//         const message = `💸 Новый запрос на вывод:
// 👤 Пользователь: @${username}
// 💰 Сумма: ${amount} ⭐
// 🆔 ID: ${requestId}
// ⏰ Время: ${new Date().toLocaleString('ru-RU')}`;

//         await bot.telegram.sendMessage(
//             process.env.CHANNEL_ID,
//             message,
//             {
//                 reply_markup: {
//                     inline_keyboard: [
//                         [
//                             {
//                                 text: '✅ Перечислил',
//                                 callback_data: `withdraw_approve_${requestId}`
//                             }
//                         ]
//                     ]
//                 }
//             }
//         );
//     } catch (error) {
//         console.error('Error sending Telegram notification:', error);
//     }
// }

// module.exports = { bot, sendWithdrawalNotification };