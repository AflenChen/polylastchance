'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellOff } from 'lucide-react';
import { Header } from '@/components/Header';
import { TimePeriodTabs } from '@/components/TimePeriodTabs';
import { FilterBar } from '@/components/FilterBar';
import { FilterPanel } from '@/components/FilterPanel';
import { MarketGrid } from '@/components/MarketGrid';
import { useAppStore } from '@/lib/store';
import { PolymarketAPI } from '@/lib/api';
import { notificationManager } from '@/lib/notifications';

export default function Home() {
  const { setMarkets, setLoading, setError, setLastUpdate, setCurrentTime, filteredMarkets } = useAppStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    const loadMarkets = async () => {
      setLoading(true);
      setError(null);

      try {
        const markets = await PolymarketAPI.fetchMarkets();
        setMarkets(markets);
        setLastUpdate(Date.now());
        console.log(`✅ Loaded ${markets.length} markets`);
      } catch (error) {
        console.error('Failed to load markets:', error);
        // Keep showing old data if available, just show error message
        setError('数据刷新失败，显示上次缓存数据');
      } finally {
        setLoading(false);
      }
    };

    // Initial load
    loadMarkets();

    let dataInterval: NodeJS.Timeout | null = null;
    let countdownInterval: NodeJS.Timeout | null = null;

    // 启动定时器
    const startIntervals = () => {
      // Auto-refresh every 5 minutes (优化: 从2分钟改为5分钟)
      dataInterval = setInterval(loadMarkets, 300000);

      // 全局倒计时定时器 - 每秒更新一次全局时间
      countdownInterval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
    };

    // 停止定时器
    const stopIntervals = () => {
      if (dataInterval) clearInterval(dataInterval);
      if (countdownInterval) clearInterval(countdownInterval);
      dataInterval = null;
      countdownInterval = null;
    };

    // 页面可见性检测 - 不可见时停止定时器以节省资源
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('📴 Page hidden, pausing updates');
        stopIntervals();
      } else {
        console.log('👀 Page visible, resuming updates');
        loadMarkets(); // 重新可见时立即刷新一次
        startIntervals();
      }
    };

    // 启动定时器
    startIntervals();

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopIntervals();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [setMarkets, setLoading, setError, setLastUpdate, setCurrentTime]);

  // 通知系统
  useEffect(() => {
    if (!notificationManager) return;

    // 检查通知权限状态
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  // 检查市场通知
  useEffect(() => {
    if (notificationsEnabled && notificationManager && filteredMarkets.length > 0) {
      notificationManager.checkMarkets(filteredMarkets);
    }
  }, [filteredMarkets, notificationsEnabled]);

  const handleToggleNotifications = async () => {
    if (!notificationManager) return;

    if (!notificationsEnabled) {
      const granted = await notificationManager.requestPermission();
      if (granted) {
        setNotificationsEnabled(true);
        notificationManager.testNotification();
      }
    } else {
      // 已启用，显示提示
      alert('通知已启用！您会收到市场即将到期的提醒。');
    }
  };

  return (
    <main className="min-h-screen p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Static Background - 移除旋转动画以节省GPU资源 */}
        <div className="fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 blur-3xl" />
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-green-500/10 via-yellow-500/10 to-red-500/10 blur-3xl" />
        </div>

        {/* Header */}
        <Header />

        {/* Notification Toggle Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center"
        >
          <button
            onClick={handleToggleNotifications}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
              notificationsEnabled
                ? 'bg-green-500/20 border-2 border-green-500/50 text-green-400 hover:bg-green-500/30'
                : 'bg-blue-500/20 border-2 border-blue-500/50 text-blue-400 hover:bg-blue-500/30'
            }`}
          >
            {notificationsEnabled ? (
              <>
                <Bell className="w-5 h-5" />
                <span>通知已启用</span>
              </>
            ) : (
              <>
                <BellOff className="w-5 h-5" />
                <span>启用智能提醒</span>
              </>
            )}
          </button>
        </motion.div>

        {/* Time Period Tabs (分页) */}
        <TimePeriodTabs />

        {/* Filter Bar */}
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1">
            <FilterBar />
          </div>
          <FilterPanel />
        </div>

        {/* Market Grid */}
        <MarketGrid />

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center py-8 text-gray-500 text-sm"
        >
          <p>数据来自 Polymarket Gamma API + CoinGecko • 每 5 分钟自动刷新</p>
          <p className="mt-2">🚀 PolyLastChance - 把握最后机会</p>
        </motion.footer>
      </div>
    </main>
  );
}
