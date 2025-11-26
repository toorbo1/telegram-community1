import uvicorn
from fastapi import FastAPI, Request
import logging

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ANSWER = {'status': True}

app = FastAPI()

@app.get('/')
async def root():
    return {"status": "Flyer webhook server is running"}

@app.get('/test')
async def test_endpoint():
    logger.info("Test endpoint called")
    return {"status": True, "message": "Webhook endpoint is working!", "timestamp": "2025-11-26T12:19:47.452Z"}

@app.post('/flyer_webhook')
async def webhook_handler(request: Request):
    try:
        data = await request.json()
        logger.info(f"Received Flyer webhook: {data}")

        # для проверки работы вебхука
        if data['type'] == 'test':
            logger.info("Test webhook received")
            return ANSWER

        # обязательная подписка пройдена
        elif data['type'] == 'sub_completed':
            user_id = data['data']['user_id']
            logger.info(f"User {user_id} completed subscription")
            # TODO: Добавьте логику обработки завершенной подписки
            return ANSWER

        # новый статус задания: отписка от канала
        elif data['type'] == 'new_status' and data['data']['status'] == 'abort':
            user_id = data['data']['user_id']
            signature = data['data']['signature']
            logger.info(f"User {user_id} unsubscribed from task {signature}")
            # TODO: Добавьте логику обработки отписки
            return ANSWER

        logger.warning(f"Unknown webhook type: {data['type']}")
        return ANSWER

    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
        return ANSWER

if __name__ == '__main__':
    logger.info("Starting Flyer webhook server on port 50000")
    uvicorn.run(app, host='0.0.0.0', port=50000, log_level="info")