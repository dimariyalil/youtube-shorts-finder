// channel-analyzer.js - Модуль анализа YouTube канала

class ChannelAnalyzer {
    constructor() {
        this.apiKey = CONFIG.API_KEY;
        this.baseUrl = CONFIG.API_BASE_URL;
        this.quotaUsed = this.loadQuotaUsage();
        
        // Данные канала
        this.channelId = null;
        this.channelData = null;
        this.videos = [];
        this.shorts = [];
        this.playlists = [];
        this.uploadsPlaylistId = null;
    }
    
    // Загрузка использованной квоты
    loadQuotaUsage() {
        const today = new Date().toDateString();
        const saved = localStorage.getItem('quota_usage');
        if (saved) {
            const data = JSON.parse(saved);
            if (data.date === today) {
                return data.used;
            }
        }
        return 0;
    }
    
    // Сохранение квоты
    saveQuotaUsage() {
        const today = new Date().toDateString();
        localStorage.setItem('quota_usage', JSON.stringify({
            date: today,
            used: this.quotaUsed
        }));
    }
    
    // Обновление квоты
    updateQuota(cost) {
        this.quotaUsed += cost;
        this.saveQuotaUsage();
        this.updateQuotaUI();
    }
    
    // Обновление UI квоты
    updateQuotaUI() {
        document.getElementById('quotaUsed').textContent = this.quotaUsed.toLocaleString();
        const percentage = (this.quotaUsed / CONFIG.QUOTA.DAILY_LIMIT) * 100;
        document.getElementById('quotaBar').style.width = percentage + '%';
    }
    
    // Извлечение Channel ID из URL
    extractChannelId(input) {
        // Прямой channel ID
        if (input.startsWith('UC') && input.length === 24) {
            return { type: 'id', value: input };
        }
        
        // URL с channel ID
        const channelIdMatch = input.match(/channel\/(UC[\w-]{22})/);
        if (channelIdMatch) {
            return { type: 'id', value: channelIdMatch[1] };
        }
        
        // URL с username (@username)
        const usernameMatch = input.match(/@([\w-]+)/);
        if (usernameMatch) {
            return { type: 'username', value: usernameMatch[1] };
        }
        
        // URL с custom URL (/c/username)
        const customMatch = input.match(/\/c\/([\w-]+)/);
        if (customMatch) {
            return { type: 'custom', value: customMatch[1] };
        }
        
        // Старый формат /user/username
        const userMatch = input.match(/\/user\/([\w-]+)/);
        if (userMatch) {
            return { type: 'user', value: userMatch[1] };
        }
        
        // Если ничего не найдено, считаем что это username
        return { type: 'username', value: input };
    }
    
    // Получение информации о канале
    async getChannelInfo(input) {
        const extracted = this.extractChannelId(input);
        let params = {
            key: this.apiKey,
            part: 'snippet,statistics,contentDetails,brandingSettings'
        };
        
        // В зависимости от типа входных данных
        if (extracted.type === 'id') {
            params.id = extracted.value;
        } else if (extracted.type === 'username' || extracted.type === 'custom') {
            params.forUsername = extracted.value;
        } else if (extracted.type === 'user') {
            params.forUsername = extracted.value;
        }
        
        const url = `${this.baseUrl}/channels?${this.buildQueryString(params)}`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (!response.ok || !data.items || data.items.length === 0) {
                throw new Error('Канал не найден');
            }
            
            this.updateQuota(CONFIG.QUOTA.CHANNEL_LIST_COST);
            
            const channel = data.items[0];
            this.channelId = channel.id;
            this.channelData = channel;
            
            // Получаем ID плейлиста uploads
            if (channel.contentDetails?.relatedPlaylists?.uploads) {
                this.uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;
            }
            
            return channel;
            
        } catch (error) {
            console.error('Ошибка получения информации о канале:', error);
            throw error;
        }
    }
    
    // Получение всех видео канала через uploads playlist
    async getChannelVideos(options = {}) {
        if (!this.uploadsPlaylistId) {
            throw new Error('Не найден uploads playlist');
        }
        
        const maxVideos = options.maxVideos || 100;
        const periodDays = options.periodDays || 0;
        
        let allVideos = [];
        let nextPageToken = null;
        let videosToFetch = maxVideos;
        
        // Дата фильтрации
        const filterDate = periodDays > 0 
            ? new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)
            : null;
        
        // Получаем видео страницами
        while (videosToFetch > 0) {
            const params = {
                key: this.apiKey,
                playlistId: this.uploadsPlaylistId,
                part: 'snippet,contentDetails',
                maxResults: Math.min(50, videosToFetch),
                pageToken: nextPageToken
            };
            
            const url = `${this.baseUrl}/playlistItems?${this.buildQueryString(params)}`;
            
            try {
                const response = await fetch(url);
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error?.message || 'Ошибка API');
                }
                
                this.updateQuota(CONFIG.QUOTA.VIDEO_LIST_COST);
                
                // Фильтруем по дате если нужно
                let videos = data.items;
                if (filterDate) {
                    videos = videos.filter(item => {
                        const publishedAt = new Date(item.snippet.publishedAt);
                        return publishedAt >= filterDate;
                    });
                }
                
                // Собираем ID для batch запроса деталей
                const videoIds = videos.map(item => item.contentDetails.videoId);
                
                if (videoIds.length > 0) {
                    // Получаем детальную информацию
                    const detailedVideos = await this.getVideosDetails(videoIds);
                    allVideos.push(...detailedVideos);
                }
                
                videosToFetch -= videos.length;
                nextPageToken = data.nextPageToken;
                
                // Если достигли лимита или нет следующей страницы
                if (!nextPageToken || videosToFetch <= 0) {
                    break;
                }
                
                // Если видео старше нужного периода, прекращаем
                if (filterDate && videos.length < params.maxResults) {
                    break;
                }
                
            } catch (error) {
                console.error('Ошибка получения видео:', error);
                break;
            }
        }
        
        // Разделяем на Shorts и обычные видео
        this.categorizeVideos(allVideos);
        
        return allVideos;
    }
    
    // Получение деталей видео (batch)
    async getVideosDetails(videoIds) {
        const chunks = this.chunkArray(videoIds, 50);
        const allDetails = [];
        
        for (const chunk of chunks) {
            const params = {
                key: this.apiKey,
                id: chunk.join(','),
                part: 'snippet,statistics,contentDetails,status'
            };
            
            const url = `${this.baseUrl}/videos?${this.buildQueryString(params)}`;
            
            try {
                const response = await fetch(url);
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error?.message || 'Ошибка API');
                }
                
                this.updateQuota(CONFIG.QUOTA.VIDEO_LIST_COST);
                
                // Обрабатываем видео
                const processedVideos = data.items.map(video => this.processVideoData(video));
                allDetails.push(...processedVideos);
                
            } catch (error) {
                console.error('Ошибка получения деталей видео:', error);
            }
        }
        
        return allDetails;
    }
    
    // Получение плейлистов канала
    async getChannelPlaylists() {
        if (!this.channelId) {
            throw new Error('Сначала выберите канал');
        }
        
        const params = {
            key: this.apiKey,
            channelId: this.channelId,
            part: 'snippet,contentDetails',
            maxResults: 50
        };
        
        const url = `${this.baseUrl}/playlists?${this.buildQueryString(params)}`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error?.message || 'Ошибка API');
            }
            
            this.updateQuota(CONFIG.QUOTA.VIDEO_LIST_COST);
            
            this.playlists = data.items.map(playlist => ({
                id: playlist.id,
                title: playlist.snippet.title,
                description: playlist.snippet.description,
                thumbnail: playlist.snippet.thumbnails.high.url,
                videoCount: playlist.contentDetails.itemCount,
                publishedAt: playlist.snippet.publishedAt
            }));
            
            return this.playlists;
            
        } catch (error) {
            console.error('Ошибка получения плейлистов:', error);
            throw error;
        }
    }
    
    // Обработка данных видео
    processVideoData(video) {
        const stats = video.statistics || {};
        const views = parseInt(stats.viewCount || 0);
        const likes = parseInt(stats.likeCount || 0);
        const comments = parseInt(stats.commentCount || 0);
        
        // Расчет метрик
        const engagement = views > 0 ? ((likes + comments) / views) : 0;
        const likeRatio = views > 0 ? (likes / views) : 0;
        
        // Парсинг длительности
        const duration = this.parseDuration(video.contentDetails?.duration || 'PT0S');
        
        // Определяем тип видео
        const isShort = duration.seconds < 60;
        const isLiveStream = video.snippet.liveBroadcastContent === 'live' || 
                           video.snippet.liveBroadcastContent === 'upcoming';
        
        // Возраст видео
        const publishedDate = new Date(video.snippet.publishedAt);
        const now = new Date();
        const ageInDays = Math.floor((now - publishedDate) / (1000 * 60 * 60 * 24));
        
        return {
            id: video.id,
            title: video.snippet.title,
            description: video.snippet.description,
            thumbnail: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url,
            publishedAt: video.snippet.publishedAt,
            duration: duration,
            type: isLiveStream ? 'live' : (isShort ? 'shorts' : 'video'),
            stats: {
                views: views,
                likes: likes,
                comments: comments,
                engagement: engagement,
                likeRatio: likeRatio
            },
            age: ageInDays,
            tags: video.snippet.tags || [],
            categoryId: video.snippet.categoryId,
            status: video.status?.privacyStatus,
            isShort: isShort,
            isLive: isLiveStream
        };
    }
    
    // Категоризация видео
    categorizeVideos(videos) {
        this.videos = videos.filter(v => !v.isLive); // Исключаем трансляции
        this.shorts = videos.filter(v => v.isShort && !v.isLive);
    }
    
    // Парсинг длительности ISO 8601
    parseDuration(duration) {
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        
        if (!match) return { formatted: '0:00', seconds: 0 };
        
        const hours = parseInt(match[1] || 0);
        const minutes = parseInt(match[2] || 0);
        const seconds = parseInt(match[3] || 0);
        
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
        
        // Форматирование
        let formatted;
        if (hours > 0) {
            formatted = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        return {
            formatted: formatted,
            seconds: totalSeconds,
            hours: hours,
            minutes: minutes,
            secs: seconds
        };
    }
    
    // Анализ канала
    analyzeChannel() {
        if (!this.videos.length) return null;
        
        const totalViews = this.videos.reduce((sum, v) => sum + v.stats.views, 0);
        const avgViews = Math.round(totalViews / this.videos.length);
        
        const totalDuration = this.videos.reduce((sum, v) => sum + v.duration.seconds, 0);
        const avgDuration = Math.round(totalDuration / this.videos.length);
        
        const shortsCount = this.shorts.length;
        const regularCount = this.videos.length - shortsCount;
        
        // Топ видео
        const topVideos = [...this.videos]
            .sort((a, b) => b.stats.views - a.stats.views)
            .slice(0, 10);
        
        // Видео с лучшим engagement
        const topEngagement = [...this.videos]
            .sort((a, b) => b.stats.engagement - a.stats.engagement)
            .slice(0, 10);
        
        return {
            totalVideos: this.videos.length,
            shortsCount: shortsCount,
            regularCount: regularCount,
            totalViews: totalViews,
            avgViews: avgViews,
            avgDuration: avgDuration,
            topVideos: topVideos,
            topEngagement: topEngagement,
            uploadFrequency: this.calculateUploadFrequency()
        };
    }
    
    // Расчет частоты загрузок
    calculateUploadFrequency() {
        if (this.videos.length < 2) return 'Недостаточно данных';
        
        const sortedVideos = [...this.videos].sort((a, b) => 
            new Date(b.publishedAt) - new Date(a.publishedAt)
        );
        
        const newestDate = new Date(sortedVideos[0].publishedAt);
        const oldestDate = new Date(sortedVideos[sortedVideos.length - 1].publishedAt);
        const daysDiff = Math.floor((newestDate - oldestDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 0) return 'Несколько в день';
        
        const videosPerDay = this.videos.length / daysDiff;
        
        if (videosPerDay >= 1) {
            return `${Math.round(videosPerDay)} видео в день`;
        } else if (videosPerDay >= 0.14) {
            return `${Math.round(7 * videosPerDay)} видео в неделю`;
        } else {
            return `${Math.round(30 * videosPerDay)} видео в месяц`;
        }
    }
    
    // Построение строки запроса
    buildQueryString(params) {
        return Object.keys(params)
            .map(key => `${key}=${encodeURIComponent(params[key])}`)
            .join('&');
    }
    
    // Разбивка массива на части
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
    
    // Экспорт данных
    exportData() {
        const data = {
            exportDate: new Date().toISOString(),
            channel: {
                id: this.channelId,
                title: this.channelData?.snippet?.title,
                description: this.channelData?.snippet?.description,
                subscriberCount: this.channelData?.statistics?.subscriberCount,
                videoCount: this.channelData?.statistics?.videoCount,
                viewCount: this.channelData?.statistics?.viewCount
            },
            analysis: this.analyzeChannel(),
            videos: this.videos,
            shorts: this.shorts,
            playlists: this.playlists,
            quotaUsed: this.quotaUsed
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `channel_${this.channelId}_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        return data;
    }
}