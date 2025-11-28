'use client';

import { motion } from 'framer-motion';
import { Clock, Zap, Timer, Layers } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export function TimePeriodTabs() {
  const { filter, setFilter, markets } = useAppStore();

  // 应用除 timePeriod 之外的所有筛选条件，用于计算时间段数量
  const getFilteredMarketsForCount = () => {
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

    // Time filter (原有的筛选器)
    switch (filter.timeFilter) {
      case 'urgent':
        filtered = filtered.filter((m) => m._urgency === 'critical' || m._urgency === 'urgent');
        break;
      case 'soon':
        filtered = filtered.filter((m) => m._urgency === 'soon');
        break;
      case 'favorites':
        // 这里需要 favorites，但组件中没有，暂时跳过
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

    // Volume filter
    if (filter.minVolume) {
      filtered = filtered.filter((m) => {
        const volume = parseFloat(String(m.volume || '0'));
        return volume >= filter.minVolume!;
      });
    }

    // Expiry time filter
    if (filter.maxDaysUntilExpiry) {
      const maxDaysInHours = filter.maxDaysUntilExpiry * 24;
      filtered = filtered.filter((m) => {
        return m._hoursUntil !== undefined && m._hoursUntil <= maxDaysInHours;
      });
    }

    // Selected categories filter
    if (filter.selectedCategories && filter.selectedCategories.length > 0) {
      filtered = filtered.filter((m) => {
        const category = m.category || '';
        return filter.selectedCategories!.includes(category);
      });
    }

    // Sports markets filter
    if (filter.excludeSportsMarkets) {
      const SPORTS_CATEGORIES = [
        'sports', 'sports-betting', 'football', 'basketball', 'baseball', 
        'hockey', 'soccer', 'esports', 'valorant', 'nfl', 'nba', 'mlb', 'nhl', 'ncaa'
      ];
      const SPORTS_KEYWORDS = [
        ' vs ', ' vs. ', 'versus', 'spread', ' o/u ', 'over/under', 
        'win on', 'fc', 'sk', 'tc', 'valorant', 'csgo', 'dota'
      ];
      filtered = filtered.filter((m) => {
        const category = (m.category || '').toLowerCase();
        const question = (m.question || '').toLowerCase();
        const isSportsCategory = SPORTS_CATEGORIES.some(sportsCat => 
          category.includes(sportsCat.toLowerCase())
        );
        const isSportsKeyword = SPORTS_KEYWORDS.some(keyword => 
          question.includes(keyword.toLowerCase())
        );
        return !isSportsCategory && !isSportsKeyword;
      });
    }

    // Binary markets filter
    if (filter.excludeBinaryMarkets) {
      filtered = filtered.filter((m) => {
        const question = (m.question || '').toLowerCase();
        return !question.includes('up or down');
      });
    }

    return filtered;
  };

  const filteredMarketsForCount = getFilteredMarketsForCount();

  const tabs = [
    {
      id: '30min',
      label: '30分钟内',
      icon: Zap,
      count: filteredMarketsForCount.filter(m => m._hoursUntil && m._hoursUntil <= 0.5).length,
      color: 'from-red-500 to-orange-500',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/50',
    },
    {
      id: '2h',
      label: '2小时内',
      icon: Clock,
      count: filteredMarketsForCount.filter(m => m._hoursUntil && m._hoursUntil <= 2).length,
      color: 'from-orange-500 to-yellow-500',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/50',
    },
    {
      id: '12h',
      label: '12小时内',
      icon: Timer,
      count: filteredMarketsForCount.filter(m => m._hoursUntil && m._hoursUntil <= 12).length,
      color: 'from-yellow-500 to-blue-500',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/50',
    },
    {
      id: '72h',
      label: '72小时内',
      icon: Layers,
      count: filteredMarketsForCount.filter(m => m._hoursUntil && m._hoursUntil <= 72).length,
      color: 'from-blue-500 to-purple-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/50',
    },
    {
      id: 'all',
      label: '全部',
      icon: Layers,
      count: filteredMarketsForCount.length,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/50',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="mb-6"
    >
      <div className="glass-strong rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-bold text-white">时间段筛选</h3>
          <span className="text-sm text-gray-400">（选择要查看的时间范围）</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = filter.timePeriod === tab.id;

            return (
              <motion.button
                key={tab.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setFilter({ timePeriod: tab.id as any })}
                className={`
                  relative p-4 rounded-xl transition-all
                  ${isActive
                    ? `glass-strong border-2 ${tab.borderColor} ${tab.bgColor}`
                    : 'glass border border-white/10 hover:border-white/20'
                  }
                `}
              >
                {/* Gradient background on active */}
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className={`absolute inset-0 bg-gradient-to-br ${tab.color} opacity-10 rounded-xl`}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <Icon
                      className={`w-5 h-5 ${
                        isActive ? 'text-white' : 'text-gray-400'
                      }`}
                    />
                    <span
                      className={`
                        text-2xl font-bold
                        ${isActive ? 'text-white' : 'text-gray-400'}
                      `}
                    >
                      {tab.count}
                    </span>
                  </div>
                  <div
                    className={`
                      text-sm font-medium
                      ${isActive ? 'text-white' : 'text-gray-400'}
                    `}
                  >
                    {tab.label}
                  </div>
                </div>

                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full"
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Info text */}
        <div className="mt-4 text-xs text-gray-500 text-center">
          💡 默认显示所有 2 周内的市场，点击其他时间段查看更多
        </div>
      </div>
    </motion.div>
  );
}
