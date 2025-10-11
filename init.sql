-- Создание таблицы tasks с правильными столбцами
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    price REAL NOT NULL,
    time_to_complete TEXT,
    difficulty TEXT,
    people_required INTEGER DEFAULT 1,
    repost_time TEXT,
    task_url TEXT, -- Добавляем отсутствующий столбец
    image_url TEXT,
    created_by INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);