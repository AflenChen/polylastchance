// Polymarket EventTimer Pro - Enhanced Version
// With Favorites, Price Alerts, Notifications, Export, and History

// API Configuration
// 注意：如果部署到 Vercel，应该使用 Next.js 版本的 API 路由
// 如果使用纯前端版本，需要启动代理服务器（proxy-server.js）
const API_CONFIG = {
    BASE_URL: 'http://localhost:3001/api/markets', // 使用本地代理服务器避免 CORS 问题
    // BASE_URL: 'https://gamma-api.polymarket.com/markets', // 直接访问会被 CORS 阻止
    REFRESH_INTERVAL: 120000, // 2 minutes
    MAX_MARKETS: 150
};

// Application State
const AppState = {
    allMarkets: [],
    filteredMarkets: [],
    currentFilter: 'all',
    currentSort: 'time-asc',
    searchQuery: '',
    lastUpdate: null,
    isLoading: false,
    favorites: new Set(),
    priceHistory: {},
    marketHistory: [],
    settings: {
        priceAlerts: true,
        pushNotifications: false,
        autoRefresh: true,
        historyTracking: true
    }
};

// LocalStorage Keys
const STORAGE_KEYS = {
    FAVORITES: 'eventtimer_favorites',
    PRICE_HISTORY: 'eventtimer_price_history',
    MARKET_HISTORY: 'eventtimer_market_history',
    SETTINGS: 'eventtimer_settings'
};

// Utility Functions
const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
};

const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toFixed(0);
};

const formatPrice = (price) => {
    const num = parseFloat(price);
    if (isNaN(num)) return '-';
    return `$${num.toFixed(2)}`;
};

// LocalStorage Functions
const StorageManager = {
    save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    },

    load(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error('Failed to load from localStorage:', e);
            return defaultValue;
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error('Failed to remove from localStorage:', e);
        }
    }
};

// Favorites Management
const FavoritesManager = {
    load() {
        const favs = StorageManager.load(STORAGE_KEYS.FAVORITES, []);
        AppState.favorites = new Set(favs);
    },

    save() {
        StorageManager.save(STORAGE_KEYS.FAVORITES, Array.from(AppState.favorites));
    },

    toggle(marketId) {
        if (AppState.favorites.has(marketId)) {
            AppState.favorites.delete(marketId);
        } else {
            AppState.favorites.add(marketId);
        }
        this.save();
        updateStats();
    },

    has(marketId) {
        return AppState.favorites.has(marketId);
    },

    count() {
        return AppState.favorites.size;
    }
};

// Price History Management
const PriceHistoryManager = {
    load() {
        AppState.priceHistory = StorageManager.load(STORAGE_KEYS.PRICE_HISTORY, {});
    },

    save() {
        StorageManager.save(STORAGE_KEYS.PRICE_HISTORY, AppState.priceHistory);
    },

    update(marketId, price) {
        if (!AppState.priceHistory[marketId]) {
            AppState.priceHistory[marketId] = [];
        }

        const history = AppState.priceHistory[marketId];
        const lastPrice = history.length > 0 ? history[history.length - 1] : null;

        // Add price if it's different from last recorded price
        if (!lastPrice || Math.abs(lastPrice.price - price) > 0.001) {
            history.push({
                price,
                timestamp: Date.now()
            });

            // Keep only last 100 entries per market
            if (history.length > 100) {
                history.shift();
            }

            this.save();
        }
    },

    getChange(marketId, currentPrice) {
        const history = AppState.priceHistory[marketId];
        if (!history || history.length === 0) return null;

        const lastPrice = history[history.length - 1].price;
        const change = ((currentPrice - lastPrice) / lastPrice) * 100;

        return {
            change,
            direction: change > 0 ? 'up' : change < 0 ? 'down' : 'none'
        };
    }
};

// Market History Management
const MarketHistoryManager = {
    load() {
        AppState.marketHistory = StorageManager.load(STORAGE_KEYS.MARKET_HISTORY, []);
    },

    save() {
        StorageManager.save(STORAGE_KEYS.MARKET_HISTORY, AppState.marketHistory);
    },

    add(market) {
        if (!AppState.settings.historyTracking) return;

        const entry = {
            id: market.id,
            question: market.question,
            endDate: market.endDate,
            finalPrice: market.outcomePrices ? JSON.parse(market.outcomePrices)[0] : null,
            volume: market.volume,
            resolvedAt: new Date().toISOString()
        };

        AppState.marketHistory.unshift(entry);

        // Keep only last 50 entries
        if (AppState.marketHistory.length > 50) {
            AppState.marketHistory = AppState.marketHistory.slice(0, 50);
        }

        this.save();
        updateHistoryBadge();
    },

    clear() {
        AppState.marketHistory = [];
        this.save();
        updateHistoryBadge();
    }
};

// Settings Management
const SettingsManager = {
    load() {
        const settings = StorageManager.load(STORAGE_KEYS.SETTINGS, AppState.settings);
        AppState.settings = { ...AppState.settings, ...settings };
    },

    save() {
        StorageManager.save(STORAGE_KEYS.SETTINGS, AppState.settings);
    },

    toggle(key) {
        AppState.settings[key] = !AppState.settings[key];
        this.save();
    }
};

// Notification Manager
const NotificationManager = {
    permission: 'default',

    async requestPermission() {
        if (!('Notification' in window)) {
            alert('此浏览器不支持桌面通知');
            return false;
        }

        if (Notification.permission === 'granted') {
            this.permission = 'granted';
            return true;
        }

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            this.permission = permission;
            return permission === 'granted';
        }

        return false;
    },

    send(title, options = {}) {
        if (!AppState.settings.pushNotifications) return;
        if (this.permission !== 'granted') return;

        new Notification(title, {
            icon: '/icon.png',
            badge: '/badge.png',
            ...options
        });
    },

    priceAlert(marketQuestion, change) {
        this.send('价格变化提醒', {
            body: `${marketQuestion}\n价格变化: ${change > 0 ? '+' : ''}${change.toFixed(2)}%`,
            tag: 'price-alert'
        });
    },

    expiryAlert(marketQuestion, timeLeft) {
        this.send('市场即将到期', {
            body: `${marketQuestion}\n剩余时间: ${timeLeft}`,
            tag: 'expiry-alert'
        });
    }
};

// Time Calculation Functions
const calculateCountdown = (endDate) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end - now;

    if (diff <= 0) {
        return {
            expired: true,
            text: '已到期',
            urgent: false,
            soon: false,
            days: -1,
            hours: 0,
            minutes: 0,
            seconds: 0,
            totalSeconds: 0
        };
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / (60 * 60 * 24));
    const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    const seconds = totalSeconds % 60;

    const urgent = days === 0 && hours < 24;
    const soon = days < 7;

    let text = '';
    if (days > 0) {
        text = `${days}天 ${hours}小时`;
    } else if (hours > 0) {
        text = `${hours}小时 ${minutes}分钟`;
    } else {
        text = `${minutes}分钟 ${seconds}秒`;
    }

    return {
        expired: false,
        text,
        urgent,
        soon,
        days,
        hours,
        minutes,
        seconds,
        totalSeconds
    };
};

const calculateProgress = (startDate, endDate) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    const total = end - start;
    const elapsed = now - start;

    if (elapsed <= 0) return 0;
    if (elapsed >= total) return 100;

    return Math.min(100, Math.max(0, (elapsed / total) * 100));
};

// API Functions
const fetchMarkets = async () => {
    const startTime = Date.now();

    try {
        const response = await fetch(
            `${API_CONFIG.BASE_URL}?active=true&closed=false&limit=${API_CONFIG.MAX_MARKETS}`
        );

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const markets = await response.json();
        const endTime = Date.now();
        const responseTime = ((endTime - startTime) / 1000).toFixed(2);

        // Update API stats
        document.getElementById('api-time').textContent = `${responseTime}s`;
        document.getElementById('api-status').textContent = '✓ 已连接';

        // Update price history
        markets.forEach(market => {
            const price = market.outcomePrices ? parseFloat(JSON.parse(market.outcomePrices)[0]) : 0;
            PriceHistoryManager.update(market.id, price);

            // Check for price alerts
            if (AppState.settings.priceAlerts) {
                const priceChange = PriceHistoryManager.getChange(market.id, price);
                if (priceChange && Math.abs(priceChange.change) > 5) {
                    NotificationManager.priceAlert(market.question, priceChange.change);
                }
            }
        });

        return markets;
    } catch (error) {
        showError('API 调用失败', error.message);
        document.getElementById('api-status').textContent = '✗ 连接失败';
        return [];
    }
};

// Filter Functions
const filterMarkets = (markets, filter, searchQuery = '') => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    const nextSunday = new Date(weekStart);
    nextSunday.setDate(weekStart.getDate() + (7 - weekStart.getDay()));

    let filtered = markets.filter(market => {
        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesSearch =
                market.question?.toLowerCase().includes(query) ||
                market.category?.toLowerCase().includes(query) ||
                market.description?.toLowerCase().includes(query);

            if (!matchesSearch) return false;
        }

        // Favorites filter
        if (filter === 'favorites') {
            return FavoritesManager.has(market.id);
        }

        // Time filter
        const endDate = new Date(market.endDate);
        const countdown = calculateCountdown(market.endDate);

        switch(filter) {
            case 'urgent':
                return countdown.urgent && !countdown.expired;
            case 'soon':
                return countdown.soon && !countdown.expired;
            case 'week':
                return endDate >= now && endDate <= nextSunday && !countdown.expired;
            default:
                return !countdown.expired;
        }
    });

    return filtered;
};

// Sort Functions
const sortMarkets = (markets, sortType) => {
    const sorted = [...markets];

    switch(sortType) {
        case 'time-asc':
            return sorted.sort((a, b) => new Date(a.endDate) - new Date(b.endDate));

        case 'time-desc':
            return sorted.sort((a, b) => new Date(b.endDate) - new Date(a.endDate));

        case 'volume-desc':
            return sorted.sort((a, b) => {
                const volA = parseFloat(a.volume || 0);
                const volB = parseFloat(b.volume || 0);
                return volB - volA;
            });

        case 'liquidity-desc':
            return sorted.sort((a, b) => {
                const liqA = parseFloat(a.liquidity || 0);
                const liqB = parseFloat(b.liquidity || 0);
                return liqB - liqA;
            });

        default:
            return sorted;
    }
};

// UI Render Functions
const renderMarketCard = (market) => {
    const countdown = calculateCountdown(market.endDate);
    const progress = calculateProgress(market.startDate, market.endDate);
    const endDate = new Date(market.endDate);

    const urgencyClass = countdown.urgent ? 'urgent' : (countdown.soon ? 'soon' : 'normal');
    const badgeText = countdown.urgent ? '🔥 紧急' : (countdown.soon ? '⚡ 即将到期' : '✓ 正常');

    const volume = formatNumber(parseFloat(market.volume || 0));
    const liquidity = formatNumber(parseFloat(market.liquidity || 0));

    const lastPrice = market.outcomePrices ?
        JSON.parse(market.outcomePrices)[0] :
        (market.lastTradePrice || 0);

    const priceValue = parseFloat(lastPrice);
    const pricePercent = (priceValue * 100).toFixed(1);

    // Price change indicator
    const priceChange = PriceHistoryManager.getChange(market.id, priceValue);
    let priceChangeHtml = '';
    if (priceChange && priceChange.direction !== 'none') {
        const icon = priceChange.direction === 'up' ? '↑' : '↓';
        priceChangeHtml = `
            <span class="price-change ${priceChange.direction}">
                ${icon} ${Math.abs(priceChange.change).toFixed(2)}%
            </span>
        `;
    }

    // Favorite button
    const isFavorited = FavoritesManager.has(market.id);
    const favIcon = isFavorited ? '⭐' : '☆';

    // Format end date for Bangkok timezone
    const bangkokTime = endDate.toLocaleString('zh-CN', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    return `
        <div class="market-card ${urgencyClass}" data-market-id="${market.id}">
            <div class="market-header">
                <h3 class="market-title">${market.question}</h3>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button class="fav-btn ${isFavorited ? 'favorited' : ''}"
                            onclick="toggleFavorite('${market.id}')"
                            title="${isFavorited ? '取消收藏' : '添加收藏'}">
                        ${favIcon}
                    </button>
                    <div class="market-badge ${urgencyClass}">${badgeText}</div>
                </div>
            </div>

            <div class="countdown-section">
                <div class="countdown-time">
                    ${countdown.days >= 0 ? `
                        <div class="time-unit ${urgencyClass}">
                            <span class="time-value">${countdown.days}</span>
                            <span class="time-label">天</span>
                        </div>
                    ` : ''}
                    <div class="time-unit ${urgencyClass}">
                        <span class="time-value">${countdown.hours.toString().padStart(2, '0')}</span>
                        <span class="time-label">时</span>
                    </div>
                    <div class="time-unit ${urgencyClass}">
                        <span class="time-value">${countdown.minutes.toString().padStart(2, '0')}</span>
                        <span class="time-label">分</span>
                    </div>
                    ${countdown.days === 0 && countdown.hours < 1 ? `
                        <div class="time-unit ${urgencyClass}">
                            <span class="time-value">${countdown.seconds.toString().padStart(2, '0')}</span>
                            <span class="time-label">秒</span>
                        </div>
                    ` : ''}
                </div>

                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill ${urgencyClass}" style="width: ${progress}%"></div>
                    </div>
                    <div class="progress-text">${progress.toFixed(1)}% 已过</div>
                </div>
            </div>

            <div class="market-details">
                <div class="detail-item">
                    <span class="detail-label">到期时间</span>
                    <span class="detail-value">${bangkokTime}</span>
                </div>

                <div class="detail-item">
                    <span class="detail-label">交易量</span>
                    <span class="detail-value highlight">$${volume}</span>
                </div>

                <div class="detail-item">
                    <span class="detail-label">流动性</span>
                    <span class="detail-value highlight">$${liquidity}</span>
                </div>

                <div class="detail-item">
                    <span class="detail-label">当前价格 (Yes)</span>
                    <div>
                        <span class="detail-value" style="color: ${priceValue > 0.5 ? '#10b981' : '#ef4444'}">
                            ${pricePercent}%
                        </span>
                        ${priceChangeHtml}
                    </div>
                </div>

                ${market.category ? `
                    <div class="detail-item">
                        <span class="detail-label">分类</span>
                        <span class="detail-value">${market.category}</span>
                    </div>
                ` : ''}

                <div class="detail-item">
                    <span class="detail-label">市场链接</span>
                    <a href="https://polymarket.com/event/${market.slug}"
                       target="_blank"
                       style="color: var(--primary-color); text-decoration: none;">
                        查看详情 →
                    </a>
                </div>
            </div>
        </div>
    `;
};

const renderMarkets = () => {
    const container = document.getElementById('markets-container');

    if (AppState.isLoading) {
        container.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <div class="empty-text">正在加载市场数据...</div>
            </div>
        `;
        return;
    }

    if (AppState.filteredMarkets.length === 0) {
        const emptyMessage = AppState.currentFilter === 'favorites'
            ? '还没有收藏任何市场'
            : AppState.searchQuery
            ? '没有找到匹配的市场'
            : '当前筛选条件下没有市场';

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <div class="empty-text">${emptyMessage}</div>
            </div>
        `;
        return;
    }

    const sortedMarkets = sortMarkets(AppState.filteredMarkets, AppState.currentSort);
    container.innerHTML = sortedMarkets.map(renderMarketCard).join('');
};

// Toggle Favorite
window.toggleFavorite = (marketId) => {
    FavoritesManager.toggle(marketId);
    renderMarkets();
};

// Update Statistics
const updateStats = () => {
    const allFiltered = filterMarkets(AppState.allMarkets, 'all');
    const favoritesCount = FavoritesManager.count();
    const urgentCount = filterMarkets(AppState.allMarkets, 'urgent').length;
    const soonCount = filterMarkets(AppState.allMarkets, 'soon').length;
    const weekCount = filterMarkets(AppState.allMarkets, 'week').length;

    document.getElementById('total-markets').textContent = allFiltered.length;
    document.getElementById('urgent-markets').textContent = urgentCount;
    document.getElementById('week-markets').textContent = soonCount;

    document.getElementById('count-all').textContent = allFiltered.length;
    document.getElementById('count-favorites').textContent = favoritesCount;
    document.getElementById('count-urgent').textContent = urgentCount;
    document.getElementById('count-soon').textContent = soonCount;
    document.getElementById('count-week').textContent = weekCount;

    const totalChange = document.getElementById('total-change');
    if (AppState.lastUpdate) {
        const timeSince = Math.floor((Date.now() - AppState.lastUpdate) / 1000 / 60);
        totalChange.textContent = `${timeSince}分钟前更新`;
    } else {
        totalChange.textContent = '首次加载';
    }
};

// Update History Badge
const updateHistoryBadge = () => {
    const badge = document.getElementById('history-badge');
    const count = AppState.marketHistory.length;
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
};

// Error Display
const showError = (title, message) => {
    const container = document.getElementById('error-container');
    container.innerHTML = `
        <div class="error-container">
            <div class="error-title">⚠️ ${title}</div>
            <div class="error-message">${message}</div>
        </div>
    `;

    setTimeout(() => {
        container.innerHTML = '';
    }, 10000);
};

// Export Functions
const ExportManager = {
    toCSV(markets) {
        const headers = ['Market', 'End Date', 'Category', 'Volume', 'Liquidity', 'Price (Yes)', 'URL'];
        const rows = markets.map(m => {
            const price = m.outcomePrices ? JSON.parse(m.outcomePrices)[0] : '0';
            return [
                `"${m.question}"`,
                m.endDate,
                m.category || 'N/A',
                m.volume || '0',
                m.liquidity || '0',
                price,
                `https://polymarket.com/event/${m.slug}`
            ];
        });

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        this.download(csv, 'eventtimer-export.csv', 'text/csv');
    },

    toJSON(markets) {
        const data = JSON.stringify(markets, null, 2);
        this.download(data, 'eventtimer-export.json', 'application/json');
    },

    download(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }
};

// Modal Functions
const ModalManager = {
    open(modalId) {
        document.getElementById(modalId).classList.add('active');
    },

    close(modalId) {
        document.getElementById(modalId).classList.remove('active');
    },

    setupCloseHandlers() {
        // Close on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });

        // Close buttons
        document.getElementById('close-settings').addEventListener('click', () => {
            this.close('settings-modal');
        });

        document.getElementById('close-history').addEventListener('click', () => {
            this.close('history-modal');
        });

        document.getElementById('close-export').addEventListener('click', () => {
            this.close('export-modal');
        });
    }
};

// Render History
const renderHistory = () => {
    const container = document.getElementById('history-content');

    if (AppState.marketHistory.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📜</div>
                <div class="empty-text">暂无历史记录</div>
            </div>
        `;
        return;
    }

    container.innerHTML = AppState.marketHistory.map(entry => `
        <div class="setting-item">
            <div style="margin-bottom: 8px; font-weight: 600;">${entry.question}</div>
            <div style="font-size: 0.875rem; color: var(--text-secondary);">
                结算价格: ${entry.finalPrice ? (parseFloat(entry.finalPrice) * 100).toFixed(1) + '%' : 'N/A'}<br>
                结算时间: ${new Date(entry.resolvedAt).toLocaleString('zh-CN')}
            </div>
        </div>
    `).join('');
};

// Event Listeners
const setupEventListeners = () => {
    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            AppState.currentFilter = tab.dataset.filter;
            AppState.filteredMarkets = filterMarkets(
                AppState.allMarkets,
                AppState.currentFilter,
                AppState.searchQuery
            );
            renderMarkets();
        });
    });

    // Sort buttons
    document.querySelectorAll('.sort-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.sort-button').forEach(b => b.classList.remove('active'));
            button.classList.add('active');

            AppState.currentSort = button.dataset.sort;
            renderMarkets();
        });
    });

    // Search input
    const searchInput = document.getElementById('search-input');
    const clearButton = document.getElementById('clear-search');

    searchInput.addEventListener('input', debounce((e) => {
        AppState.searchQuery = e.target.value;
        AppState.filteredMarkets = filterMarkets(
            AppState.allMarkets,
            AppState.currentFilter,
            AppState.searchQuery
        );
        renderMarkets();
        updateStats();

        clearButton.style.display = AppState.searchQuery ? 'block' : 'none';
    }, 300));

    clearButton.addEventListener('click', () => {
        searchInput.value = '';
        AppState.searchQuery = '';
        AppState.filteredMarkets = filterMarkets(
            AppState.allMarkets,
            AppState.currentFilter,
            ''
        );
        renderMarkets();
        updateStats();
        clearButton.style.display = 'none';
    });

    // Action buttons
    document.getElementById('export-btn').addEventListener('click', () => {
        ModalManager.open('export-modal');
    });

    document.getElementById('history-btn').addEventListener('click', () => {
        renderHistory();
        ModalManager.open('history-modal');
    });

    document.getElementById('settings-btn').addEventListener('click', () => {
        // Sync toggles with current settings
        document.getElementById('price-alert-toggle').checked = AppState.settings.priceAlerts;
        document.getElementById('push-notification-toggle').checked = AppState.settings.pushNotifications;
        document.getElementById('auto-refresh-toggle').checked = AppState.settings.autoRefresh;
        document.getElementById('history-tracking-toggle').checked = AppState.settings.historyTracking;

        ModalManager.open('settings-modal');
    });

    // Export buttons
    document.getElementById('export-csv').addEventListener('click', () => {
        ExportManager.toCSV(AppState.filteredMarkets);
        ModalManager.close('export-modal');
    });

    document.getElementById('export-json').addEventListener('click', () => {
        ExportManager.toJSON(AppState.filteredMarkets);
        ModalManager.close('export-modal');
    });

    // Settings toggles
    document.getElementById('price-alert-toggle').addEventListener('change', (e) => {
        AppState.settings.priceAlerts = e.target.checked;
        SettingsManager.save();
    });

    document.getElementById('push-notification-toggle').addEventListener('change', async (e) => {
        if (e.target.checked) {
            const granted = await NotificationManager.requestPermission();
            if (!granted) {
                e.target.checked = false;
                alert('通知权限被拒绝，请在浏览器设置中允许通知');
                return;
            }
        }
        AppState.settings.pushNotifications = e.target.checked;
        SettingsManager.save();
    });

    document.getElementById('auto-refresh-toggle').addEventListener('change', (e) => {
        AppState.settings.autoRefresh = e.target.checked;
        SettingsManager.save();
    });

    document.getElementById('history-tracking-toggle').addEventListener('change', (e) => {
        AppState.settings.historyTracking = e.target.checked;
        SettingsManager.save();
    });

    // Setup modal close handlers
    ModalManager.setupCloseHandlers();
};

// Data Loading
const loadData = async () => {
    AppState.isLoading = true;
    renderMarkets();

    const markets = await fetchMarkets();

    if (markets.length > 0) {
        AppState.allMarkets = markets;
        AppState.filteredMarkets = filterMarkets(
            markets,
            AppState.currentFilter,
            AppState.searchQuery
        );
        AppState.lastUpdate = Date.now();
        AppState.isLoading = false;

        updateStats();
        renderMarkets();
    } else {
        AppState.isLoading = false;
        showError('数据加载失败', '无法获取市场数据，请检查网络连接');
    }
};

// Auto Refresh
let refreshInterval;
const startAutoRefresh = () => {
    if (refreshInterval) clearInterval(refreshInterval);

    refreshInterval = setInterval(() => {
        if (AppState.settings.autoRefresh) {
            loadData();
            console.log('🔄 Auto-refreshing market data...');
        }
    }, API_CONFIG.REFRESH_INTERVAL);
};

// Countdown Update
const startCountdownUpdate = () => {
    setInterval(() => {
        if (AppState.filteredMarkets.length > 0) {
            renderMarkets();
        }
    }, 1000); // Update every second
};

// Initialize Application
const init = async () => {
    console.log('🚀 EventTimer Pro initializing...');

    // Load saved data
    FavoritesManager.load();
    PriceHistoryManager.load();
    MarketHistoryManager.load();
    SettingsManager.load();

    // Setup UI
    setupEventListeners();
    updateHistoryBadge();

    // Load market data
    await loadData();

    // Start background tasks
    startAutoRefresh();
    startCountdownUpdate();

    console.log('✅ EventTimer Pro ready!');
    console.log(`📊 ${FavoritesManager.count()} favorites loaded`);
    console.log(`📜 ${AppState.marketHistory.length} history entries loaded`);
};

// Start the app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
