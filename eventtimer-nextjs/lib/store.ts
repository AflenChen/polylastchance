import { create } from 'zustand';
import { Market, FilterOptions, PriceHistory } from '@/types/market';

interface AppStore {
  // State
  markets: Market[];
  filteredMarkets: Market[];
  favorites: Set<string>;
  priceHistory: Record<string, PriceHistory[]>;
  filter: FilterOptions;
  loading: boolean;
  error: string | null;
  lastUpdate: number | null;
  currentTime: number; // 全局时间戳,用于统一更新倒计时

  // Actions
  setMarkets: (markets: Market[]) => void;
  setFilteredMarkets: (markets: Market[]) => void;
  toggleFavorite: (marketId: string) => void;
  setFilter: (filter: Partial<FilterOptions>) => void;
  updatePriceHistory: (marketId: string, price: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setLastUpdate: (timestamp: number) => void;
  setCurrentTime: (time: number) => void;
  applyFilters: () => void;
}

export const useAppStore = create<AppStore>()((set, get) => ({
      // Initial state
      markets: [],
      filteredMarkets: [],
      favorites: new Set<string>(),
      priceHistory: {},
      filter: {
        timeFilter: 'all',
        timePeriod: 'all', // 默认显示所有市场，而不是只显示 2 小时内
        minLiquidity: 1000,
        searchQuery: '',
      },
      loading: false,
      error: null,
      lastUpdate: null,
      currentTime: Date.now(),

      // Actions
      setMarkets: (markets) => {
        set({ markets });
        get().applyFilters();
      },

      setFilteredMarkets: (filteredMarkets) => set({ filteredMarkets }),

      toggleFavorite: (marketId) => {
        const favorites = new Set(get().favorites);
        if (favorites.has(marketId)) {
          favorites.delete(marketId);
        } else {
          favorites.add(marketId);
        }
        set({ favorites });
        get().applyFilters();
      },

      setFilter: (newFilter) => {
        set({ filter: { ...get().filter, ...newFilter } });
        get().applyFilters();
      },

      updatePriceHistory: (marketId, price) => {
        const priceHistory = { ...get().priceHistory };
        if (!priceHistory[marketId]) {
          priceHistory[marketId] = [];
        }

        const history = priceHistory[marketId];
        const lastEntry = history[history.length - 1];

        // Only add if price changed significantly
        if (!lastEntry || Math.abs(lastEntry.price - price) > 0.001) {
          history.push({
            price,
            timestamp: Date.now(),
          });

          // Keep only last 100 entries
          if (history.length > 100) {
            history.shift();
          }

          set({ priceHistory });
        }
      },

      setLoading: (loading) => set({ loading }),

      setError: (error) => set({ error }),

      setLastUpdate: (timestamp) => set({ lastUpdate: timestamp }),

      setCurrentTime: (time) => set({ currentTime: time }),

      applyFilters: () => {
        const { markets, filter, favorites } = get();
        let filtered = [...markets];

        // Search filter
        if (filter.searchQuery) {
          const query = filter.searchQuery.toLowerCase();
          filtered = filtered.filter(
            (market) =>
              market.question?.toLowerCase().includes(query) ||
              market.category?.toLowerCase().includes(query) ||
              market.description?.toLowerCase().includes(query)
          );
        }

        // Time period filter (分页功能)
        const now = new Date();
        switch (filter.timePeriod) {
          case '30min':
            filtered = filtered.filter((m) => m._hoursUntil && m._hoursUntil <= 0.5);
            break;
          case '2h':
            filtered = filtered.filter((m) => m._hoursUntil && m._hoursUntil <= 2);
            break;
          case '12h':
            filtered = filtered.filter((m) => m._hoursUntil && m._hoursUntil <= 12);
            break;
          case 'all':
            // 显示所有市场
            break;
        }

        // Time filter (原有的筛选器)
        switch (filter.timeFilter) {
          case 'urgent':
            filtered = filtered.filter((m) => m._urgency === 'critical' || m._urgency === 'urgent');
            break;
          case 'soon':
            filtered = filtered.filter((m) => m._urgency === 'soon');
            break;
          case 'favorites':
            filtered = filtered.filter((m) => favorites.has(m.id));
            break;
        }

        // Category filter
        if (filter.category) {
          filtered = filtered.filter((m) => m.category === filter.category);
        }

        // Liquidity filter
        if (filter.minLiquidity) {
          filtered = filtered.filter((m) => {
            const liquidity = parseFloat(String(m.liquidity || m.liquidityNum || '0'));
            return liquidity >= filter.minLiquidity!;
          });
        }

        set({ filteredMarkets: filtered });
      },
}));
