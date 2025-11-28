import { create } from 'zustand';
import { Market, FilterOptions, PriceHistory } from '@/types/market';

// 体育竞猜相关的类别列表
const SPORTS_CATEGORIES = [
  'sports', 'sports-betting', 'football', 'basketball', 'baseball', 
  'hockey', 'soccer', 'esports', 'valorant', 'nfl', 'nba', 'mlb', 'nhl', 'ncaa'
];

// 体育比赛关键词列表（作为类别过滤的补充，因为有些市场可能没有明确的类别）
const SPORTS_KEYWORDS = [
  ' vs ', ' vs. ', 'versus',           // 对战
  'spread', ' o/u ', 'over/under',    // 盘口
  'win on',                            // 获胜
  'fc', 'sk', 'tc',                    // 足球俱乐部后缀
  'valorant', 'csgo', 'dota',          // 电子竞技
];

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
        timePeriod: 'all', // 默认显示所有市场
        minLiquidity: 10000, // 流动性要求：$10,000
        minVolume: 0, // 最小交易量
        maxDaysUntilExpiry: 14, // 最大到期天数（2周）
        selectedCategories: undefined, // 选择的类别（undefined 表示显示所有类别）
        excludeSportsMarkets: true, // 默认排除体育竞猜
        excludeBinaryMarkets: true, // 默认排除二元期权（"Up or Down" 类型）
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
        const currentFilter = get().filter;
        const updatedFilter = { ...currentFilter, ...newFilter };
        // 确保 undefined 值正确设置（移除该属性）
        Object.keys(newFilter).forEach(key => {
          if (newFilter[key as keyof typeof newFilter] === undefined) {
            delete updatedFilter[key as keyof typeof updatedFilter];
          }
        });
        console.log('🔄 更新过滤条件:', { 
          old: currentFilter, 
          new: newFilter, 
          updated: updatedFilter 
        });
        set({ filter: updatedFilter as typeof currentFilter });
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
        
        console.log('🔍 应用过滤条件:', {
          totalMarkets: markets.length,
          minLiquidity: filter.minLiquidity,
          minVolume: filter.minVolume,
          maxDaysUntilExpiry: filter.maxDaysUntilExpiry,
          selectedCategories: filter.selectedCategories,
          timePeriod: filter.timePeriod,
        });

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
          case '72h':
            filtered = filtered.filter((m) => m._hoursUntil && m._hoursUntil <= 72);
            break;
          case 'all':
            // 显示所有市场（2周内）
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

        // Volume filter (交易量)
        if (filter.minVolume) {
          filtered = filtered.filter((m) => {
            const volume = parseFloat(String(m.volume || '0'));
            return volume >= filter.minVolume!;
          });
        }

        // Expiry time filter (到期时间)
        if (filter.maxDaysUntilExpiry) {
          const maxDaysInHours = filter.maxDaysUntilExpiry * 24;
          filtered = filtered.filter((m) => {
            return m._hoursUntil !== undefined && m._hoursUntil <= maxDaysInHours;
          });
        }

        // Selected categories filter (选择的类别)
        // 如果 selectedCategories 有值且长度 > 0，只显示选中的类别
        // 如果 selectedCategories 为 undefined 或空数组，显示所有类别
        if (filter.selectedCategories && filter.selectedCategories.length > 0) {
          const beforeCount = filtered.length;
          filtered = filtered.filter((m) => {
            const category = m.category || '';
            const included = filter.selectedCategories!.includes(category);
            return included;
          });
          console.log(`📊 类别过滤: ${beforeCount} -> ${filtered.length} (选择的类别: ${filter.selectedCategories.join(', ')})`);
        } else {
          console.log('📊 类别过滤: 显示所有类别');
        }

        // Sports markets filter (体育竞猜过滤)
        if (filter.excludeSportsMarkets) {
          const beforeCount = filtered.length;
          filtered = filtered.filter((m) => {
            const category = (m.category || '').toLowerCase();
            const question = (m.question || '').toLowerCase();
            
            // 检查类别
            const isSportsCategory = SPORTS_CATEGORIES.some(sportsCat => 
              category.includes(sportsCat.toLowerCase())
            );
            
            // 检查关键词（作为补充，因为有些市场可能没有明确的类别）
            const isSportsKeyword = SPORTS_KEYWORDS.some(keyword => 
              question.includes(keyword.toLowerCase())
            );
            
            return !isSportsCategory && !isSportsKeyword;
          });
          console.log(`📊 体育竞猜过滤: ${beforeCount} -> ${filtered.length} (已排除体育竞猜)`);
        } else {
          console.log('📊 体育竞猜过滤: 未排除体育竞猜');
        }

        // Binary markets filter (二元期权过滤)
        if (filter.excludeBinaryMarkets) {
          const beforeCount = filtered.length;
          filtered = filtered.filter((m) => {
            const question = (m.question || '').toLowerCase();
            return !question.includes('up or down');
          });
          console.log(`📊 二元期权过滤: ${beforeCount} -> ${filtered.length} (已排除 "Up or Down" 类型)`);
        } else {
          console.log('📊 二元期权过滤: 未排除二元期权');
        }

        console.log(`✅ 过滤完成: ${markets.length} -> ${filtered.length} 个市场`);
        set({ filteredMarkets: filtered });
      },
}));
