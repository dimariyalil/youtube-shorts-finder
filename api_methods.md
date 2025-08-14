# 📚 YouTube API v3 - Методы для анализа канала

## 🎯 Концепция Этапа 1: Анализ канала для поиска контента под нарезки

### Цель
Детальный анализ выбранного YouTube канала для:
1. Получения всех видео с метриками
2. Разделения на типы (Shorts, обычные, длинные)
3. Выявления самых популярных и вовлекающих видео
4. Экспорта данных для дальнейшего анализа

### Входные данные
- URL канала или Channel ID
- Фильтры: период, количество видео, тип контента

### Выходные данные
- Полная статистика канала
- Список всех видео с метриками
- Разделение на Shorts и обычные видео
- Топ видео по различным критериям
- JSON экспорт всех данных

---

## 📋 Используемые методы YouTube API v3

### 1. **channels.list**
Получение информации о канале

**Endpoint:** `GET https://www.googleapis.com/youtube/v3/channels`

**Параметры:**
```javascript
{
  key: API_KEY,
  part: 'snippet,statistics,contentDetails,brandingSettings',
  id: CHANNEL_ID           // или
  forUsername: USERNAME    // для поиска по username
}
```

**Что получаем:**
- **snippet**: название, описание, аватар, страна
- **statistics**: подписчики, общие просмотры, количество видео
- **contentDetails**: ID плейлистов (важно: uploads playlist)
- **brandingSettings**: настройки канала, ключевые слова

**Квота:** 1 единица

---

### 2. **playlistItems.list**
Получение всех видео канала через uploads playlist

**Endpoint:** `GET https://www.googleapis.com/youtube/v3/playlistItems`

**Параметры:**
```javascript
{
  key: API_KEY,
  playlistId: 'UU' + CHANNEL_ID.substring(2), // uploads playlist
  part: 'snippet,contentDetails',
  maxResults: 50,          // максимум 50 за запрос
  pageToken: NEXT_PAGE     // для пагинации
}
```

**Что получаем:**
- ID всех видео канала
- Базовая информация (название, превью)
- Дата публикации
- Позиция в плейлисте

**Важно:** Нужна пагинация для получения всех видео

**Квота:** 1 единица за запрос

---

### 3. **videos.list**
Детальная информация о видео (batch до 50)

**Endpoint:** `GET https://www.googleapis.com/youtube/v3/videos`

**Параметры:**
```javascript
{
  key: API_KEY,
  id: 'VIDEO_ID_1,VIDEO_ID_2,...,VIDEO_ID_50',  // до 50 ID
  part: 'snippet,statistics,contentDetails,status'
}
```

**Что получаем:**
- **snippet**: название, описание, теги, категория, превью
- **statistics**: просмотры, лайки, дизлайки, комментарии
- **contentDetails**: длительность, качество, наличие субтитров
- **status**: приватность, лицензия, встраивание

**Квота:** 1 единица (даже для 50 видео!)

---

### 4. **playlists.list**
Получение плейлистов канала

**Endpoint:** `GET https://www.googleapis.com/youtube/v3/playlists`

**Параметры:**
```javascript
{
  key: API_KEY,
  channelId: CHANNEL_ID,
  part: 'snippet,contentDetails',
  maxResults: 50
}
```

**Что получаем:**
- Список всех публичных плейлистов
- Название, описание, превью
- Количество видео в плейлисте

**Квота:** 1 единица

---

### 5. **search.list** (опционально)
Поиск видео на канале с фильтрами

**Endpoint:** `GET https://www.googleapis.com/youtube/v3/search`

**Параметры:**
```javascript
{
  key: API_KEY,
  channelId: CHANNEL_ID,
  part: 'snippet',
  type: 'video',
  order: 'viewCount',      // или date, rating
  maxResults: 50,
  publishedAfter: ISO_DATE, // фильтр по дате
  publishedBefore: ISO_DATE,
  videoDuration: 'short'    // short (<4м), medium (4-20м), long (>20м)
}
```

**Что получаем:**
- Отфильтрованный список видео
- Возможность поиска по ключевым словам на канале

**Квота:** 100 единиц (дорого!)

---

## 🔄 Алгоритм работы приложения

### Шаг 1: Получение информации о канале
```javascript
// 1. Парсим введенный URL/ID
const channelIdentifier = extractChannelId(input);

// 2. Запрос channels.list
const channelInfo = await fetch(`/channels?id=${channelId}&part=snippet,statistics,contentDetails`);

// 3. Извлекаем uploads playlist ID
const uploadsPlaylistId = channelInfo.contentDetails.relatedPlaylists.uploads;
```

### Шаг 2: Получение всех видео
```javascript
// 1. Запросы к playlistItems.list с пагинацией
let videos = [];
let nextPageToken = null;

do {
  const response = await fetch(`/playlistItems?playlistId=${uploadsPlaylistId}&pageToken=${nextPageToken}`);
  videos.push(...response.items);
  nextPageToken = response.nextPageToken;
} while (nextPageToken && videos.length < maxVideos);

// 2. Извлекаем ID видео
const videoIds = videos.map(v => v.contentDetails.videoId);
```

### Шаг 3: Получение деталей видео
```javascript
// Batch запросы по 50 видео
const chunks = chunkArray(videoIds, 50);

for (const chunk of chunks) {
  const details = await fetch(`/videos?id=${chunk.join(',')}&part=snippet,statistics,contentDetails`);
  processVideos(details.items);
}
```

### Шаг 4: Обработка и категоризация
```javascript
// Определяем тип видео
videos.forEach(video => {
  const duration = parseDuration(video.contentDetails.duration);
  
  if (duration < 60) {
    video.type = 'shorts';
  } else if (duration < 600) {
    video.type = 'regular';
  } else {
    video.type = 'long';
  }
  
  // Расчет метрик
  video.engagement = (video.statistics.likeCount + video.statistics.commentCount) / video.statistics.viewCount;
  video.viralScore = video.statistics.viewCount / ageInDays;
});
```

---

## 📊 Оптимизация квоты

### Стоимость операций
| Операция | Метод | Квота | Результат |
|----------|-------|-------|-----------|
| Инфо о канале | channels.list | 1 | Базовая информация |
| Список видео | playlistItems.list | 1 | 50 видео |
| Детали видео | videos.list | 1 | До 50 видео |
| Плейлисты | playlists.list | 1 | Все плейлисты |
| Поиск | search.list | 100 | 50 результатов |

### Пример расхода квоты
Для анализа канала с 500 видео:
1. channels.list: 1 единица
2. playlistItems.list: 10 запросов × 1 = 10 единиц
3. videos.list: 10 запросов × 1 = 10 единиц
4. playlists.list: 1 единица

**Итого: 22 единицы квоты** для полного анализа канала с 500 видео!

---

## 🚫 Ограничения API

### Что НЕЛЬЗЯ получить:
- Демографию аудитории (возраст, пол)
- Источники трафика
- Удержание аудитории (retention)
- Доходы канала
- Точное время просмотра
- Историю изменения метрик

### Технические ограничения:
- Максимум 50 результатов за запрос
- Дневной лимит квоты: 10,000 единиц
- Rate limit: ~3,000 запросов в секунду
- Некоторые данные могут быть скрыты владельцем канала

---

## 💡 Рекомендации по использованию

### Для экономии квоты:
1. Используйте batch-запросы videos.list (50 видео = 1 квота)
2. Избегайте search.list (100 квот за запрос)
3. Кэшируйте результаты в localStorage
4. Запрашивайте только нужные parts

### Для точности анализа:
1. Фильтруйте трансляции (liveBroadcastContent)
2. Исключайте приватные видео
3. Учитывайте возраст видео при расчете метрик
4. Проверяйте наличие всех полей (могут быть null)

---

## 🎯 Итоговый результат

После выполнения анализа вы получите:
- Полную статистику канала
- Список всех видео с метриками
- Разделение на Shorts/обычные/длинные
- Топ видео по просмотрам и engagement
- JSON файл со всеми данными для дальнейшего анализа

Эта информация позволит определить:
- Какие видео подходят для нарезок
- Паттерны успешного контента
- Оптимальную длительность видео
- Темы с максимальной вовлеченностью