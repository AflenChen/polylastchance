'use client';

import { motion } from 'framer-motion';
import { Filter, X, DollarSign, TrendingUp, Clock, Tag, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useState } from 'react';

export function FilterPanel() {
  const { filter, setFilter, markets, filteredMarkets } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);

  // 获取所有可用的类别（从所有市场，不是过滤后的）
  const availableCategories = Array.from(
    new Set(markets.map(m => m.category).filter(Boolean))
  ).sort() as string[];

  // 计算统计信息（使用实际过滤后的数据）
  const stats = {
    total: markets.length,
    filtered: filteredMarkets.length,
  };

  return (
    <>
      {/* Toggle Button */}
      <motion.button
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 glass-strong rounded-xl hover:scale-105 transition-transform"
      >
        <Filter className="w-5 h-5 text-blue-400" />
        <span className="text-sm text-white font-medium">筛选</span>
        {stats.filtered !== stats.total && (
          <span className="px-2 py-0.5 bg-blue-500/30 text-blue-300 rounded-full text-xs font-bold">
            {stats.filtered}
          </span>
        )}
      </motion.button>

      {/* Filter Modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />
          
          {/* Modal Content */}
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => {
                // 点击弹窗内容区域不关闭
                e.stopPropagation();
              }}
              className="glass-strong rounded-2xl p-6 space-y-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto"
            >
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-400" />
              筛选条件
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-400">总市场数: <span className="text-white font-bold">{stats.total}</span></span>
            <span className="text-gray-400">符合条件: <span className="text-blue-400 font-bold">{stats.filtered}</span></span>
          </div>

          {/* Liquidity Filter */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-white">
              <DollarSign className="w-4 h-4 text-green-400" />
              最小流动性 ($)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                step="1000"
                value={filter.minLiquidity || 0}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  console.log('设置最小流动性:', value);
                  setFilter({ minLiquidity: value });
                }}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="10000"
              />
              <button
                onClick={() => setFilter({ minLiquidity: 0 })}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-400 transition-colors"
              >
                清除
              </button>
            </div>
          </div>

          {/* Volume Filter */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-white">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              最小交易量 ($)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                step="1000"
                value={filter.minVolume || 0}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  console.log('设置最小交易量:', value);
                  setFilter({ minVolume: value });
                }}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="0"
              />
              <button
                onClick={() => setFilter({ minVolume: 0 })}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-400 transition-colors"
              >
                清除
              </button>
            </div>
          </div>

          {/* Expiry Time Filter */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-white">
              <Clock className="w-4 h-4 text-orange-400" />
              最大到期时间 (天)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                step="1"
                value={filter.maxDaysUntilExpiry || 14}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 14;
                  console.log('设置最大到期时间:', value);
                  setFilter({ maxDaysUntilExpiry: value });
                }}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="14"
              />
              <button
                onClick={() => setFilter({ maxDaysUntilExpiry: 999 })}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-400 transition-colors"
              >
                全部
              </button>
            </div>
          </div>

          {/* Selected Categories */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-white">
              <Tag className="w-4 h-4 text-blue-400" />
              选择的类别
              <span className="text-xs text-gray-400 font-normal">
                ({filter.selectedCategories && filter.selectedCategories.length > 0 ? `已选择 ${filter.selectedCategories.length} 个` : '未选择，显示所有类别'})
              </span>
            </label>
            {filter.selectedCategories && filter.selectedCategories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {filter.selectedCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const currentSelected = filter.selectedCategories || [];
                      const newSelected = currentSelected.filter(c => c !== cat);
                      console.log('移除类别:', cat, '新列表:', newSelected);
                      setFilter({ selectedCategories: newSelected.length > 0 ? newSelected : undefined });
                    }}
                    className="px-3 py-1 bg-blue-500/20 border border-blue-500/50 rounded-lg text-xs text-blue-300 hover:bg-blue-500/30 transition-colors flex items-center gap-1"
                  >
                    {cat}
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}
            {availableCategories.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-gray-400 mb-2">
                  {filter.selectedCategories && filter.selectedCategories.length > 0 
                    ? '添加更多类别:' 
                    : '选择要显示的类别（不选择则显示所有）:'}
                </p>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {availableCategories
                    .filter(cat => !filter.selectedCategories?.includes(cat))
                    .map((cat) => (
                      <button
                        key={cat}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const currentSelected = filter.selectedCategories || [];
                          const newSelected = [...currentSelected, cat];
                          console.log('添加类别:', cat, '新列表:', newSelected);
                          setFilter({ selectedCategories: newSelected });
                        }}
                        className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/10 hover:border-blue-500/50 transition-colors"
                      >
                        + {cat}
                      </button>
                    ))}
                </div>
              </div>
            )}
            {filter.selectedCategories && filter.selectedCategories.length > 0 && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('清除所有类别选择');
                  setFilter({ selectedCategories: undefined });
                }}
                className="mt-2 px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 transition-colors"
              >
                清除所有选择（显示所有类别）
              </button>
            )}
          </div>

          {/* Sports Markets Filter (体育竞猜过滤) */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-white">
              <Tag className="w-4 h-4 text-red-400" />
              排除体育竞猜
              <span className="text-xs text-gray-400 font-normal">
                (排除体育比赛、电子竞技等)
              </span>
            </label>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const newValue = !filter.excludeSportsMarkets;
                console.log('切换体育竞猜过滤:', newValue);
                setFilter({ excludeSportsMarkets: newValue });
              }}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg border transition-all
                ${filter.excludeSportsMarkets 
                  ? 'bg-red-500/20 border-red-500/50' 
                  : 'bg-white/5 border-white/10 hover:border-white/20'
                }
              `}
            >
              {filter.excludeSportsMarkets ? (
                <ToggleRight className="w-6 h-6 text-red-400" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-gray-400" />
              )}
              <div className="flex-1 text-left">
                <div className={`text-sm font-medium ${filter.excludeSportsMarkets ? 'text-red-300' : 'text-gray-300'}`}>
                  {filter.excludeSportsMarkets ? '已启用' : '已禁用'}
                </div>
                <div className="text-xs text-gray-400">
                  {filter.excludeSportsMarkets 
                    ? '将排除所有体育竞猜相关的市场' 
                    : '将显示所有市场，包括体育竞猜'}
                </div>
              </div>
            </button>
          </div>

          {/* Binary Markets Filter (二元期权过滤) */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-white">
              <Tag className="w-4 h-4 text-yellow-400" />
              排除二元期权
              <span className="text-xs text-gray-400 font-normal">
                (排除 "Up or Down" 类型的市场)
              </span>
            </label>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const newValue = !filter.excludeBinaryMarkets;
                console.log('切换二元期权过滤:', newValue);
                setFilter({ excludeBinaryMarkets: newValue });
              }}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg border transition-all
                ${filter.excludeBinaryMarkets 
                  ? 'bg-yellow-500/20 border-yellow-500/50' 
                  : 'bg-white/5 border-white/10 hover:border-white/20'
                }
              `}
            >
              {filter.excludeBinaryMarkets ? (
                <ToggleRight className="w-6 h-6 text-yellow-400" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-gray-400" />
              )}
              <div className="flex-1 text-left">
                <div className={`text-sm font-medium ${filter.excludeBinaryMarkets ? 'text-yellow-300' : 'text-gray-300'}`}>
                  {filter.excludeBinaryMarkets ? '已启用' : '已禁用'}
                </div>
                <div className="text-xs text-gray-400">
                  {filter.excludeBinaryMarkets 
                    ? '将排除所有 "Up or Down" 类型的市场' 
                    : '将显示所有市场，包括 "Up or Down" 类型'}
                </div>
              </div>
            </button>
          </div>

          {/* Reset Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('重置为默认值');
              setFilter({
                minLiquidity: 10000,
                minVolume: 0,
                maxDaysUntilExpiry: 14,
                selectedCategories: undefined, // 默认显示所有类别
                excludeSportsMarkets: true, // 默认排除体育竞猜
                excludeBinaryMarkets: true, // 默认排除二元期权
              });
            }}
            className="w-full px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-300 transition-colors"
          >
            重置为默认值
          </button>
            </motion.div>
          </div>
        </>
      )}
    </>
  );
}

