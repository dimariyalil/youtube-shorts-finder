// app.js - Основная логика приложения

class App {
    constructor() {
        this.api = new YouTubeAPI();
        this.currentFilter = 'all';
        this.selectedQueries = new Set();
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadSavedData();
        this.api.updateQuotaUI();
    }
    
    setupEventListeners() {
        // Выбор поисковых запросов
        document.querySelectorAll('.query-item').forEach(item => {
            item.addEventListener('click', (e) => this.toggleQuery(e));
        });
        
        // Кнопки действий
        document.getElementById('searchBtn').addEventListener('click', () => this.performSearch());
        document.getElementById('analyzeBtn').addEventListener('click', () => this.analyzeResults());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportResults());
        
        // Фильтры результатов
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.filterResults(e));
        });
        
        // Модальное окно
        document.querySelector('.close').addEventListener('click', () => this.closeModal());
        window.addEventListener('click', (e) => {
            if (e.target.id === 'videoModal') this.closeModal();
        });
    }
    
    toggleQuery(e) {
        const item = e.currentTarget;
        const isCustom = item.classList.contains('custom-query');
        
        if (isCustom) {
            const input = item.querySelector('input');
            if (input.value.trim()) {
                item.classList.toggle('active');
                if (item.classList.contains('active')) {
                    this.selectedQueries.add(input.value.trim());
                } else {
                    this.selectedQueries.delete(input.value.trim());
                }
            }
        } else {
            item.classList.toggle('active');
            const query = item.dataset.query;
            if (item.classList.contains('active')) {
                this.selectedQueries.add(query);
            } else {
                this.selectedQueries.delete(query);
            }
        }
    }
    
    async performSearch() {
        if (this.selectedQueries.size === 0) {
            alert('Выберите хотя бы один поисковый запрос');
            return;
        }
        
        this.showLoader('Поиск видео...');
        
        const publishedAfterDays = parseInt(document.getElementById('publishedAfter').value);
        const maxResults = parseInt(document.getElementById('maxResults').value);
        const category = document.getElementById('category').value;
        
        const options = {
            publishedAfterDays,
            maxResults
        };
        
        if (category) {
            options.videoCategoryId = category;
        }
        
        let totalFound = 0;
        const allVideoIds = [];
        
        // Выполняем поиск по каждому запросу
        for (const query of this.selectedQueries) {
            try {
                this.updateLoader(`Поиск: ${query}`);
                const results = await this.api.searchVideos(query, options);
                
                const videoIds = results.map(item => item.id.videoId);
                allVideoIds.push(...videoIds);
                totalFound += results.length;
                
                // Небольшая задержка между запросами
                await this.delay(1000);
                
            } catch (error) {
                console.error(`Ошибка поиска "${query}":`, error);
                this.showError(`Ошибка при поиске "${query}": ${error.message}`);
            }
        }
        
        if (allVideoIds.length > 0) {
            this.updateLoader('Получение детальной информации...');
            
            // Получаем детали всех видео
            await this.api.getVideoDetails(allVideoIds);
            
            // Сохраняем результаты
            this.api.saveToStorage();
            
            // Отображаем результаты
            this.displayResults();
            this.updateStats();
            
            // Активируем кнопки
            document.getElementById('analyzeBtn').disabled = false;
            document.getElementById('exportBtn').disabled = false;
        }
        
        this.hideLoader();
    }
    
    async analyzeResults() {
        this.showLoader('Анализ результатов...');
        
        // Получаем все видео без фильтрации по просмотрам
        const allVideos = Array.from(this.api.videoDetails.values());
        
        // Получаем дополнительные детали для топ видео
        const topVideos = allVideos
            .sort((a, b) => b.stats.viralScore - a.stats.viralScore)
            .slice(0, 20);
        
        // Здесь можно добавить дополнительный анализ
        // Например, получение комментариев для поиска таймкодов
        
        this.hideLoader();
        
        // Показываем детальную статистику
        this.showDetailedStats(allVideos);
    }
    
    displayResults() {
        const grid = document.getElementById('resultsGrid');
        grid.innerHTML = '';
        
        const videos = Array.from(this.api.videoDetails.values())
            .filter(video => this.applyFilter(video))
            .sort((a, b) => b.stats.viralScore - a.stats.viralScore);
        
        videos.forEach(video => {
            const card = this.createVideoCard(video);
            grid.appendChild(card);
        });
        
        // Показываем секции
        document.getElementById('statsPanel').style.display = 'block';
        document.getElementById('resultsSection').style.display = 'block';
    }
    
    createVideoCard(video) {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.onclick = () => this.showVideoDetails(video);
        
        const badges = [];
        if (video.isViral) badges.push('<span class="viral-badge">🔥 VIRAL</span>');
        
        card.innerHTML = `
            <div style="position: relative;">
                <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail">
                <span class="video-duration">${video.duration}</span>
                ${badges.join('')}
            </div>
            <div class="video-info">
                <div class="video-title">${this.escapeHtml(video.title)}</div>
                <div class="video-channel">${this.escapeHtml(video.channel)}</div>
                <div class="video-stats">
                    <span class="video-views">${this.formatNumber(video.stats.views)} просмотров</span>
                    <span>${video.age.days}д назад</span>
                </div>
                <div class="video-metrics">
                    <div class="metric">
                        <span>👍</span>
                        <span>${this.formatNumber(video.stats.likes)}</span>
                    </div>
                    <div class="metric">
                        <span>💬</span>
                        <span>${this.formatNumber(video.stats.comments)}</span>
                    </div>
                    <div class="metric">
                        <span>📈</span>
                        <span>${(video.stats.engagement * 100).toFixed(1)}%</span>
                    </div>
                    <div class="metric">
                        <span>🚀</span>
                        <span>${video.stats.viralScore.toFixed(0)}</span>
                    </div>
                </div>
            </div>
        `;
        
        return card;
    }
    
    showVideoDetails(video) {
        const modal = document.getElementById('videoModal');
        const content = document.getElementById('modalContent');
        
        const categoryName = CONFIG.MALE_CATEGORIES[video.categoryId] || 'Другое';
        
        content.innerHTML = `
            <h2>${this.escapeHtml(video.title)}</h2>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                <div>
                    <img src="${video.thumbnail}" style="width: 100%; border-radius: 10px;">
                </div>
                <div>
                    <h3>Статистика</h3>
                    <table style="width: 100%;">
                        <tr><td>Просмотры:</td><td><strong>${this.formatNumber(video.stats.views)}</strong></td></tr>
                        <tr><td>Лайки:</td><td><strong>${this.formatNumber(video.stats.likes)}</strong></td></tr>
                        <tr><td>Комментарии:</td><td><strong>${this.formatNumber(video.stats.comments)}</strong></td></tr>
                        <tr><td>Engagement:</td><td><strong>${(video.stats.engagement * 100).toFixed(2)}%</strong></td></tr>
                        <tr><td>Like Ratio:</td><td><strong>${(video.stats.likeRatio * 100).toFixed(2)}%</strong></td></tr>
                        <tr><td>Viral Score:</td><td><strong>${video.stats.viralScore.toFixed(1)}</strong></td></tr>
                    </table>
                </div>
            </div>
            
            <div style="margin: 20px 0;">
                <h3>Информация</h3>
                <p><strong>Канал:</strong> ${this.escapeHtml(video.channel)}</p>
                <p><strong>Категория:</strong> ${categoryName}</p>
                <p><strong>Опубликовано:</strong> ${new Date(video.publishedAt).toLocaleString('ru')}</p>
                <p><strong>Возраст:</strong> ${video.age.days} дней (${video.age.hours} часов)</p>
                <p><strong>Длительность:</strong> ${video.duration}</p>
            </div>
            
            ${video.tags.length > 0 ? `
                <div style="margin: 20px 0;">
                    <h3>Теги</h3>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                        ${video.tags.slice(0, 20).map(tag => 
                            `<span style="background: #f0f0f0; padding: 5px 10px; border-radius: 5px;">${this.escapeHtml(tag)}</span>`
                        ).join('')}
                    </div>
                </div>
            ` : ''}
            
            <div style="margin: 20px 0;">
                <h3>Описание</h3>
                <p style="white-space: pre-wrap;">${this.escapeHtml(video.description.substring(0, 500))}...</p>
            </div>
            
            <div style="margin: 20px 0; display: flex; gap: 10px;">
                <a href="https://youtube.com/watch?v=${video.id}" target="_blank" 
                   style="padding: 10px 20px; background: #ff0000; color: white; text-decoration: none; border-radius: 5px;">
                    Открыть на YouTube
                </a>
                <a href="https://youtube.com/channel/${video.channelId}" target="_blank"
                   style="padding: 10px 20px; background: #333; color: white; text-decoration: none; border-radius: 5px;">
                    Открыть канал
                </a>
            </div>
        `;
        
        modal.style.display = 'block';
    }
    
    closeModal() {
        document.getElementById('videoModal').style.display = 'none';
    }
    
    updateStats() {
        const videos = Array.from(this.api.videoDetails.values());
        
        if (videos.length === 0) return;
        
        const viralCount = videos.filter(v => v.stats.views > 100000).length;
        const totalViews = videos.reduce((sum, v) => sum + v.stats.views, 0);
        const avgViews = Math.round(totalViews / videos.length);
        const avgEngagement = videos.reduce((sum, v) => sum + v.stats.engagement, 0) / videos.length;
        
        document.getElementById('totalFound').textContent = videos.length;
        document.getElementById('viralCount').textContent = viralCount;
        document.getElementById('avgViews').textContent = this.formatNumber(avgViews);
        document.getElementById('avgEngagement').textContent = (avgEngagement * 100).toFixed(1) + '%';
    }
    
    showDetailedStats(videos) {
        // Группировка по категориям
        const byCategory = {};
        videos.forEach(video => {
            const category = CONFIG.MALE_CATEGORIES[video.categoryId] || 'Другое';
            if (!byCategory[category]) {
                byCategory[category] = [];
            }
            byCategory[category].push(video);
        });
        
        // Топ каналы
        const byChannel = {};
        videos.forEach(video => {
            if (!byChannel[video.channel]) {
                byChannel[video.channel] = [];
            }
            byChannel[video.channel].push(video);
        });
        
        const topChannels = Object.entries(byChannel)
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 10);
        
        // Показываем статистику
        console.log('Статистика по категориям:', byCategory);
        console.log('Топ каналы:', topChannels);
        
        alert(`Анализ завершен!\n\nВсего видео: ${videos.length}\n\nТоп категории:\n${
            Object.entries(byCategory)
                .map(([cat, vids]) => `${cat}: ${vids.length} видео`)
                .join('\n')
        }\n\nТоп каналы:\n${
            topChannels
                .map(([channel, vids]) => `${channel}: ${vids.length} видео`)
                .join('\n')
        }`);
    }
    
    filterResults(e) {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        e.target.classList.add('active');
        
        this.currentFilter = e.target.dataset.filter;
        this.displayResults();
    }
    
    applyFilter(video) {
        switch(this.currentFilter) {
            case 'viral':
                return video.isViral;
            case 'high':
                return video.isHighEngagement;
            case 'fresh':
                return video.isFresh;
            default:
                return true;
        }
    }
    
    exportResults() {
        const data = this.api.exportResults();
        alert(`Экспортировано ${data.videos.length} видео!\nФайл сохранен.`);
    }
    
    loadSavedData() {
        const saved = this.api.loadFromStorage();
        if (saved && saved.videoDetails && saved.videoDetails.length > 0) {
            this.displayResults();
            this.updateStats();
            document.getElementById('analyzeBtn').disabled = false;
            document.getElementById('exportBtn').disabled = false;
        }
    }
    
    // Утилиты
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showLoader(message) {
        document.getElementById('loader').style.display = 'block';
        document.querySelector('.loader p').textContent = message;
    }
    
    updateLoader(message) {
        document.querySelector('.loader p').textContent = message;
    }
    
    hideLoader() {
        document.getElementById('loader').style.display = 'none';
    }
    
    showError(message) {
        alert('Ошибка: ' + message);
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});