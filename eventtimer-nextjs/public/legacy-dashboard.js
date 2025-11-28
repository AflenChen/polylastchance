// EventTimer Pro Dashboard
// Modern Apple-style Dashboard

// Configuration
const CONFIG = {
    // Use proxy server to avoid CORS issues
    API_URL: 'http://localhost:3001/api/markets',
    REFRESH_INTERVAL: 120000, // 2 minutes
    MAX_MARKETS: 500, // Increased to get more markets including those expiring soon
    ANIMATION_DELAY: 50
};

// Application State
const State = {
    markets: [],
    filteredMarkets: [],
    currentFilter: 'all',
    searchQuery: '',
    favorites: new Set(),
    priceHistory: {},
    lastUpdate: null
};

// LocalStorage Manager
const Storage = {
    KEYS: {
        FAVORITES: 'eventtimer_favorites_v2',
        PRICE_HISTORY: 'eventtimer_prices_v2',
        SETTINGS: 'eventtimer_settings_v2'
    },

    save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error('Storage error:', e);
        }
    },

    load(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    }
};

// Favorites Manager
const Favorites = {
    load() {
        const favs = Storage.load(Storage.KEYS.FAVORITES, []);
        State.favorites = new Set(favs);
    },

    toggle(marketId) {
        if (State.favorites.has(marketId)) {
            State.favorites.delete(marketId);
        } else {
            State.favorites.add(marketId);
        }
        Storage.save(Storage.KEYS.FAVORITES, Array.from(State.favorites));
        updateStats();
    },

    has(marketId) {
        return State.favorites.has(marketId);
    },

    count() {
        return State.favorites.size;
    }
};

// Price History Manager
const PriceHistory = {
    load() {
        State.priceHistory = Storage.load(Storage.KEYS.PRICE_HISTORY, {});
    },

    update(marketId, price) {
        if (!State.priceHistory[marketId]) {
            State.priceHistory[marketId] = [];
        }

        const history = State.priceHistory[marketId];
        const lastEntry = history[history.length - 1];

        if (!lastEntry || Math.abs(lastEntry.price - price) > 0.001) {
            history.push({
                price,
                timestamp: Date.now()
            });

            if (history.length > 50) {
                history.shift();
            }

            Storage.save(Storage.KEYS.PRICE_HISTORY, State.priceHistory);
        }
    },

    getChange(marketId, currentPrice) {
        const history = State.priceHistory[marketId];
        if (!history || history.length < 2) return null;

        const oldPrice = history[0].price;
        const change = ((currentPrice - oldPrice) / oldPrice) * 100;

        return {
            change,
            direction: change > 0 ? 'up' : change < 0 ? 'down' : 'none'
        };
    }
};

// Utility Functions
const Utils = {
    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toFixed(0);
    },

    formatDate(dateStr) {
        const date = new Date(dateStr);
        // Use local timezone instead of Bangkok
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    },

    calculateCountdown(endDate) {
        const now = new Date();
        const end = new Date(endDate);
        const diff = end - now;

        // Debug logging (first call only to avoid spam)
        if (!this._debugLogged) {
            console.log(`🔍 Countdown calculation debug:`);
            console.log(`   Input endDate: ${endDate}`);
            console.log(`   Parsed end: ${end.toISOString()}`);
            console.log(`   Now: ${now.toISOString()}`);
            console.log(`   Diff hours: ${(diff / (1000 * 60 * 60)).toFixed(2)}h`);
            this._debugLogged = true;
        }

        if (diff <= 0) {
            return {
                expired: true,
                days: 0,
                hours: 0,
                minutes: 0,
                seconds: 0,
                urgent: false,
                soon: false
            };
        }

        const totalSeconds = Math.floor(diff / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return {
            expired: false,
            days,
            hours,
            minutes,
            seconds,
            urgent: days === 0 && hours < 24,
            soon: days < 7
        };
    },

    calculateProgress(startDate, endDate) {
        const now = new Date();
        const start = new Date(startDate);
        const end = new Date(endDate);

        const total = end - start;
        const elapsed = now - start;

        if (elapsed <= 0) return 0;
        if (elapsed >= total) return 100;

        return Math.min(100, Math.max(0, (elapsed / total) * 100));
    },

    debounce(func, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), delay);
        };
    }
};

// API Functions
const API = {
    async fetchMarkets() {
        try {
            console.log('Fetching markets from:', CONFIG.API_URL);

            // 使用正确的 API 参数：按结束时间升序排序
            const now = new Date();
            const nowISO = now.toISOString();

            const params = new URLSearchParams({
                closed: 'false',
                end_date_min: nowISO,
                order: 'endDate',
                ascending: 'true',
                limit: CONFIG.MAX_MARKETS.toString()
            });

            const response = await fetch(`${CONFIG.API_URL}?${params}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const allMarkets = await response.json();
            console.log(`📥 Loaded ${allMarkets.length} markets from API (sorted by end date)`);

            // Extract deadline from multiple possible fields and filter by liquidity
            const activeMarkets = allMarkets
                .map(market => {
                    let deadline = null;

                    // Priority: endDate (full timestamp) > gameStartTime > endDateIso (date only)
                    // NOTE: endDateIso is often just a date without time, so use endDate first!
                    if (market.endDate) {
                        try {
                            deadline = new Date(market.endDate);
                            // Validate it's a real date with time
                            if (isNaN(deadline.getTime())) {
                                deadline = null;
                            }
                        } catch (e) {
                            deadline = null;
                        }
                    }

                    if (!deadline && market.gameStartTime) {
                        try {
                            deadline = new Date(market.gameStartTime);
                            if (isNaN(deadline.getTime())) {
                                deadline = null;
                            }
                        } catch (e) {
                            deadline = null;
                        }
                    }

                    // Only use endDateIso if nothing else worked
                    if (!deadline && market.endDateIso) {
                        try {
                            deadline = new Date(market.endDateIso);
                            if (isNaN(deadline.getTime())) {
                                deadline = null;
                            }
                        } catch (e) {
                            deadline = null;
                        }
                    }

                    return {
                        ...market,
                        _deadline: deadline,
                        endDate: deadline ? deadline.toISOString() : market.endDate  // 统一使用 _deadline
                    };
                })
                .filter(market => {
                    // 过滤条件：未过期 + 流动性 >= 1000
                    const liquidity = parseFloat(market.liquidity || market.liquidityNum || 0);
                    return market._deadline &&
                           market._deadline > now &&
                           liquidity >= 1000;
                });

            console.log(`✅ ${activeMarkets.length} active markets (未过期且流动性≥1K)`);

            // Debug: Log first 3 markets to verify deadlines
            if (activeMarkets.length > 0) {
                console.log('📊 Sample markets with deadlines:');
                activeMarkets.slice(0, 3).forEach((m, i) => {
                    const now = new Date();
                    const hoursUntil = (m._deadline - now) / (1000 * 60 * 60);
                    console.log(`  ${i+1}. ${m.question.substring(0, 50)}...`);
                    console.log(`     Deadline: ${m._deadline.toISOString()}`);
                    console.log(`     Hours until: ${hoursUntil.toFixed(2)}h`);
                });
            }

            // Update price history
            activeMarkets.forEach(market => {
                const price = market.outcomePrices ?
                    parseFloat(JSON.parse(market.outcomePrices)[0]) : 0;
                PriceHistory.update(market.id, price);
            });

            return activeMarkets;
        } catch (error) {
            console.error('❌ API Error:', error);
            showError('无法加载数据', error.message);
            return [];
        }
    }
};

// Filter Functions
const Filters = {
    apply(markets, filter, searchQuery = '') {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setHours(0, 0, 0, 0);
        const nextSunday = new Date(weekStart);
        nextSunday.setDate(weekStart.getDate() + (7 - weekStart.getDay()));

        const filtered = markets.filter(market => {
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matches =
                    market.question?.toLowerCase().includes(query) ||
                    market.category?.toLowerCase().includes(query) ||
                    market.description?.toLowerCase().includes(query);
                if (!matches) return false;
            }

            // Favorites filter
            if (filter === 'favorites') {
                return Favorites.has(market.id);
            }

            // Time-based filters
            const countdown = Utils.calculateCountdown(market.endDate);
            const endDate = new Date(market.endDate);

            switch (filter) {
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

        // Sort by end date (soonest first)
        return filtered.sort((a, b) => {
            return new Date(a.endDate) - new Date(b.endDate);
        });
    }
};

// UI Rendering
const UI = {
    renderMarketCard(market, index) {
        const countdown = Utils.calculateCountdown(market.endDate);
        const progress = Utils.calculateProgress(market.startDate, market.endDate);

        const urgencyClass = countdown.urgent ? 'urgent' :
                            countdown.soon ? 'soon' : 'normal';

        const isFavorited = Favorites.has(market.id);

        const lastPrice = market.outcomePrices ?
            JSON.parse(market.outcomePrices)[0] : (market.lastTradePrice || 0);
        const priceValue = parseFloat(lastPrice);
        const pricePercent = (priceValue * 100).toFixed(1);

        const priceChange = PriceHistory.getChange(market.id, priceValue);
        let priceChangeHtml = '';
        if (priceChange && priceChange.direction !== 'none') {
            const icon = priceChange.direction === 'up' ? '↑' : '↓';
            const changeClass = priceChange.direction === 'up' ? 'positive' : 'negative';
            priceChangeHtml = `
                <span class="stat-change ${changeClass}">
                    ${icon} ${Math.abs(priceChange.change).toFixed(2)}%
                </span>
            `;
        }

        const volume = Utils.formatNumber(parseFloat(market.volume || 0));
        const liquidity = Utils.formatNumber(parseFloat(market.liquidity || 0));

        const card = document.createElement('div');
        card.className = `market-card ${urgencyClass} fade-in`;
        card.style.animationDelay = `${index * CONFIG.ANIMATION_DELAY}ms`;
        card.dataset.marketId = market.id;

        card.innerHTML = `
            <div class="market-header">
                <h3 class="market-title">${market.question}</h3>
                <div class="market-actions">
                    <button class="icon-btn ${isFavorited ? 'favorited' : ''}"
                            onclick="toggleFavorite('${market.id}')">
                        ${isFavorited ? '⭐' : '☆'}
                    </button>
                </div>
            </div>

            <div class="countdown-container">
                <div class="countdown-display" data-countdown="${market.id}">
                    ${countdown.days > 0 ? `
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
                <div class="progress-bar">
                    <div class="progress-fill ${urgencyClass}" style="width: ${progress}%"></div>
                </div>
            </div>

            <div class="market-details">
                <div class="detail-item">
                    <div class="detail-label">到期时间</div>
                    <div class="detail-value">${Utils.formatDate(market.endDate)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">交易量</div>
                    <div class="detail-value">$${volume}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">流动性</div>
                    <div class="detail-value">$${liquidity}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Yes 价格</div>
                    <div class="detail-value">
                        ${pricePercent}%
                        ${priceChangeHtml}
                    </div>
                </div>
            </div>
        `;

        return card;
    },

    renderMarkets() {
        const container = document.getElementById('markets-grid');

        if (State.filteredMarkets.length === 0) {
            const emptyMessage = State.currentFilter === 'favorites' ?
                '还没有收藏任何市场' :
                State.searchQuery ?
                '没有找到匹配的市场' :
                '当前筛选条件下没有市场';

            container.innerHTML = `
                <div class="loading-container">
                    <div style="font-size: 4rem; margin-bottom: 20px;">🔍</div>
                    <p style="color: var(--text-tertiary);">${emptyMessage}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        State.filteredMarkets.forEach((market, index) => {
            const card = this.renderMarketCard(market, index);
            container.appendChild(card);
        });
    },

    // Update only countdown elements without re-rendering cards
    updateCountdowns() {
        State.filteredMarkets.forEach(market => {
            const countdownEl = document.querySelector(`[data-countdown="${market.id}"]`);
            if (!countdownEl) return;

            const countdown = Utils.calculateCountdown(market.endDate);
            const urgencyClass = countdown.urgent ? 'urgent' :
                                countdown.soon ? 'soon' : 'normal';

            // Build countdown HTML
            let html = '';
            if (countdown.days > 0) {
                html += `
                    <div class="time-unit ${urgencyClass}">
                        <span class="time-value">${countdown.days}</span>
                        <span class="time-label">天</span>
                    </div>
                `;
            }
            html += `
                <div class="time-unit ${urgencyClass}">
                    <span class="time-value">${countdown.hours.toString().padStart(2, '0')}</span>
                    <span class="time-label">时</span>
                </div>
                <div class="time-unit ${urgencyClass}">
                    <span class="time-value">${countdown.minutes.toString().padStart(2, '0')}</span>
                    <span class="time-label">分</span>
                </div>
            `;
            if (countdown.days === 0 && countdown.hours < 1) {
                html += `
                    <div class="time-unit ${urgencyClass}">
                        <span class="time-value">${countdown.seconds.toString().padStart(2, '0')}</span>
                        <span class="time-label">秒</span>
                    </div>
                `;
            }

            countdownEl.innerHTML = html;
        });
    }
};

// Stats Update
function updateStats() {
    const allMarkets = Filters.apply(State.markets, 'all');
    const urgentMarkets = Filters.apply(State.markets, 'urgent');
    const soonMarkets = Filters.apply(State.markets, 'soon');
    const weekMarkets = Filters.apply(State.markets, 'week');
    const favCount = Favorites.count();

    // Update stat cards (optional - only if elements exist)
    const totalMarketsEl = document.getElementById('total-markets');
    if (totalMarketsEl) totalMarketsEl.textContent = allMarkets.length;

    const favoriteCountEl = document.getElementById('favorite-count');
    if (favoriteCountEl) favoriteCountEl.textContent = favCount;

    const urgentCountEl = document.getElementById('urgent-count');
    if (urgentCountEl) urgentCountEl.textContent = urgentMarkets.length;

    const weekCountEl = document.getElementById('week-count');
    if (weekCountEl) weekCountEl.textContent = weekMarkets.length;

    // Update pill badges
    const countAllEl = document.getElementById('count-all');
    if (countAllEl) countAllEl.textContent = allMarkets.length;

    const countFavoritesEl = document.getElementById('count-favorites');
    if (countFavoritesEl) countFavoritesEl.textContent = favCount;

    const countUrgentEl = document.getElementById('count-urgent');
    if (countUrgentEl) countUrgentEl.textContent = urgentMarkets.length;

    const countSoonEl = document.getElementById('count-soon');
    if (countSoonEl) countSoonEl.textContent = soonMarkets.length;

    const countWeekEl = document.getElementById('count-week');
    if (countWeekEl) countWeekEl.textContent = weekMarkets.length;

    // Update last update time (optional)
    const totalChangeEl = document.getElementById('total-change');
    if (totalChangeEl && State.lastUpdate) {
        const minutes = Math.floor((Date.now() - State.lastUpdate) / 60000);
        totalChangeEl.textContent = `${minutes}分钟前更新`;
    }
}

// Error Display
function showError(title, message) {
    console.error(`${title}: ${message}`);
    // Could add toast notification here
}

// Global Functions
window.toggleFavorite = (marketId) => {
    Favorites.toggle(marketId);
    UI.renderMarkets();
};

// Event Listeners
function setupEventListeners() {
    // Search (optional - only if element exists)
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', Utils.debounce((e) => {
            State.searchQuery = e.target.value;
            State.filteredMarkets = Filters.apply(
                State.markets,
                State.currentFilter,
                State.searchQuery
            );
            UI.renderMarkets();
            updateStats();
        }, 300));
    }

    // Filter pills
    document.querySelectorAll('.pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            State.currentFilter = pill.dataset.filter;
            State.filteredMarkets = Filters.apply(
                State.markets,
                State.currentFilter,
                State.searchQuery
            );
            UI.renderMarkets();
        });
    });

    // Refresh button (optional)
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadData);
    }

    // Export button (optional)
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const data = JSON.stringify(State.filteredMarkets, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `eventtimer-export-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }
}

// Data Loading
async function loadData() {
    const markets = await API.fetchMarkets();

    if (markets.length > 0) {
        State.markets = markets;
        State.filteredMarkets = Filters.apply(
            markets,
            State.currentFilter,
            State.searchQuery
        );
        State.lastUpdate = Date.now();

        updateStats();
        UI.renderMarkets();
    }
}

// Auto Refresh
function startAutoRefresh() {
    setInterval(() => {
        console.log('🔄 Auto-refreshing...');
        loadData();
    }, CONFIG.REFRESH_INTERVAL);
}

// Countdown Update
function startCountdownUpdate() {
    setInterval(() => {
        if (State.filteredMarkets.length > 0) {
            UI.updateCountdowns();
        }
    }, 1000);
}

// Initialize
async function init() {
    console.log('🚀 EventTimer Pro Dashboard initializing...');

    // Load saved data
    Favorites.load();
    PriceHistory.load();

    // Setup UI
    setupEventListeners();

    // Load market data
    await loadData();

    // Start background tasks
    startAutoRefresh();
    startCountdownUpdate();

    console.log('✅ Dashboard ready!');
    console.log(`📊 ${State.markets.length} markets loaded`);
    console.log(`⭐ ${Favorites.count()} favorites`);
}

// Start app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
