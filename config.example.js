// config.js - Конфигурация YouTube API

const CONFIG = {
    // YouTube API ключ
    API_KEY: 'YOUR_API_KEY_HERE',
    
    // Базовый URL API
    API_BASE_URL: 'https://www.googleapis.com/youtube/v3',
    
    // Лимиты квоты
    QUOTA: {
        DAILY_LIMIT: 10000,
        SEARCH_COST: 100,
        VIDEO_LIST_COST: 1,
        COMMENT_LIST_COST: 1,
        CHANNEL_LIST_COST: 1
    },
    
    // Настройки поиска по умолчанию
    SEARCH_DEFAULTS: {
        type: 'video',
        videoDuration: 'short', // < 4 минуты для Shorts
        regionCode: 'RU',
        relevanceLanguage: 'ru',
        order: 'viewCount',
        part: 'snippet',
        maxResults: 25
    },
    
    // Категории для мужской аудитории
    MALE_CATEGORIES: {
        17: 'Спорт',
        20: 'Игры', 
        2: 'Авто и транспорт',
        28: 'Наука и технологии',
        24: 'Развлечения'
    },
    
    // Ключевые слова для фильтрации мужского контента
    MALE_KEYWORDS: [
        'ufc', 'бокс', 'футбол', 'хоккей', 'экстрим',
        'cs', 'dota', 'pubg', 'warzone', 'fifa',
        'авто', 'мото', 'тюнинг', 'дрифт',
        'фейлы', 'приколы', 'пранки',
        'топ', 'эпик', 'жесть', 'нокаут'
    ],
    
    // Исключающие ключевые слова (женский/детский контент)
    EXCLUDE_KEYWORDS: [
        'макияж', 'мода', 'готовка', 'рецепт',
        'отношения', 'свадьба', 'декор',
        'для детей', 'мультики', 'сказки'
    ],
    
    // Минимальные метрики для отбора
    MIN_METRICS: {
        views: 100000,
        engagement: 0.05, // 5% (likes / views)
        viral_score: 50
    },
    
    // Сохранение данных
    STORAGE_KEY: 'youtube_shorts_finder_data'
};