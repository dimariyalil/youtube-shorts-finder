// КОПИРУЙТЕ ЭТОТ ФАЙЛ В config.js И ВСТАВЬТЕ СВОЙ API КЛЮЧ
const CONFIG = {
    // ВСТАВЬТЕ ВАШ API КЛЮЧ ЗДЕСЬ
    API_KEY: 'YOUR_YOUTUBE_API_KEY_HERE',
    
    API_BASE_URL: 'https://www.googleapis.com/youtube/v3',
    QUOTA: {
        DAILY_LIMIT: 10000,
        SEARCH_COST: 100,
        VIDEO_LIST_COST: 1,
        COMMENT_LIST_COST: 1,
        CHANNEL_LIST_COST: 1
    },
    SEARCH_DEFAULTS: {
        type: 'video',
        videoDuration: 'short',
        regionCode: 'RU',
        relevanceLanguage: 'ru',
        order: 'viewCount',
        part: 'snippet',
        maxResults: 25
    },
    MALE_CATEGORIES: {
        17: 'Спорт',
        20: 'Игры',
        2: 'Авто и транспорт',
        28: 'Наука и технологии',
        24: 'Развлечения'
    },
    MALE_KEYWORDS: [
        'ufc', 'бокс', 'футбол', 'хоккей', 'экстрим',
        'cs', 'dota', 'pubg', 'warzone', 'fifa',
        'авто', 'мото', 'тюнинг', 'дрифт',
        'фейлы', 'приколы', 'пранки',
        'топ', 'эпик', 'жесть', 'нокаут'
    ],
    EXCLUDE_KEYWORDS: [
        'макияж', 'мода', 'готовка', 'рецепт',
        'отношения', 'свадьба', 'декор',
        'для детей', 'мультики', 'сказки'
    ],
    MIN_METRICS: {
        views: 100000,
        engagement: 0.05,
        viral_score: 50
    },
    STORAGE_KEY: 'youtube_shorts_finder_data'
};
