'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, TrendingUp, DollarSign, ExternalLink, Star, AlertCircle } from 'lucide-react';
import { Market } from '@/types/market';
import { Utils } from '@/lib/utils';
import { PolymarketAPI } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { PriceChart } from './PriceChart';
import { ExternalData } from './ExternalData';

interface MarketCardProps {
  market: Market;
  index: number;
}

export function MarketCard({ market, index }: MarketCardProps) {
  const { favorites, toggleFavorite, currentTime } = useAppStore();
  const isFavorite = favorites.has(market.id);

  // 使用全局时间计算倒计时,避免每个卡片都有定时器
  const countdown = useMemo(() => {
    return Utils.calculateCountdown(market._deadline!);
  }, [market._deadline, currentTime]); // 依赖全局currentTime

  const price = Utils.getPrice(market);
  const liquidity = Utils.getLiquidity(market);
  const volume = Utils.getVolume(market);
  const urgencyColor = Utils.getUrgencyColor(market._urgency);
  const urgencyBorder = Utils.getUrgencyBorder(market._urgency);
  const urgencyBg = Utils.getUrgencyBg(market._urgency);

  const handleOpenMarket = () => {
    const url = PolymarketAPI.getMarketUrl(market);
    console.log('Opening market URL:', url, 'Market:', { id: market.id, slug: market.slug });
    // 使用 window.open 并添加 noopener noreferrer 以提高安全性
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (!newWindow) {
      // 如果弹窗被阻止，尝试直接跳转
      console.warn('Popup blocked, trying direct navigation');
      window.location.href = url;
    }
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(market.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={`glass-strong rounded-2xl p-6 border-2 ${urgencyBorder} hover:scale-[1.02] transition-transform cursor-pointer group relative overflow-hidden`}
      onClick={handleOpenMarket}
    >
      {/* Background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${urgencyColor} opacity-5 group-hover:opacity-10 transition-opacity`} />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors">
              {market.question}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`${urgencyBg} px-3 py-1 rounded-full text-xs font-medium`}>
                {Utils.getUrgencyText(market._urgency)}
              </span>
              {market.category && (
                <span className="bg-white/5 px-3 py-1 rounded-full text-xs text-gray-400">
                  {market.category}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleToggleFavorite}
            className="ml-4 p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <Star
              className={`w-5 h-5 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`}
            />
          </button>
        </div>

        {/* Countdown */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-gray-400">倒计时</span>
          </div>
          <div className="flex gap-2">
            {countdown.days > 0 && (
              <div className="flex-1 glass text-center py-3 rounded-lg">
                <div className="text-2xl font-bold text-white">{countdown.days}</div>
                <div className="text-xs text-gray-400">天</div>
              </div>
            )}
            <div className="flex-1 glass text-center py-3 rounded-lg">
              <div className="text-2xl font-bold text-white">{countdown.hours.toString().padStart(2, '0')}</div>
              <div className="text-xs text-gray-400">时</div>
            </div>
            <div className="flex-1 glass text-center py-3 rounded-lg">
              <div className="text-2xl font-bold text-white">{countdown.minutes.toString().padStart(2, '0')}</div>
              <div className="text-xs text-gray-400">分</div>
            </div>
            {countdown.urgent && (
              <div className="flex-1 glass text-center py-3 rounded-lg">
                <div className="text-2xl font-bold text-white">{countdown.seconds.toString().padStart(2, '0')}</div>
                <div className="text-xs text-gray-400">秒</div>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="glass rounded-lg p-3">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="w-3 h-3 text-green-400" />
              <span className="text-xs text-gray-400">Yes 价格</span>
            </div>
            <div className="text-lg font-bold text-white">{Utils.formatPercentage(price)}</div>
          </div>
          <div className="glass rounded-lg p-3">
            <div className="flex items-center gap-1 mb-1">
              <DollarSign className="w-3 h-3 text-blue-400" />
              <span className="text-xs text-gray-400">流动性</span>
            </div>
            <div className="text-lg font-bold text-white">${Utils.formatNumber(liquidity)}</div>
          </div>
          <div className="glass rounded-lg p-3">
            <div className="flex items-center gap-1 mb-1">
              <DollarSign className="w-3 h-3 text-purple-400" />
              <span className="text-xs text-gray-400">交易量</span>
            </div>
            <div className="text-lg font-bold text-white">${Utils.formatNumber(volume)}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-400">
            到期时间: {Utils.formatDate(market._deadline!)}
          </div>
          <div className="flex items-center gap-1 text-blue-400 text-sm group-hover:text-blue-300">
            <span>交易</span>
            <ExternalLink className="w-4 h-4" />
          </div>
        </div>

        {/* Price Chart - Temporarily disabled due to CLOB API issues */}
        {/* Will be re-enabled after implementing proper error handling */}

        {/* External Data - 加密货币价格等 */}
        <ExternalData
          marketQuestion={market.question}
          category={market.category}
        />

        {/* Urgent warning */}
        {market._urgency === 'critical' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 bg-red-500/20 border border-red-500/50 rounded-lg p-3 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-red-400 animate-pulse" />
            <span className="text-sm text-red-300">即将到期！抓紧最后机会</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
