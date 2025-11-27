import { Market } from '@/types/market';

// 使用Next.js API路由代理(Polymarket API不支持浏览器CORS)
const API_PROXY = '/api/markets';
const MIN_LIQUIDITY = 10000; // 流动性要求：$10,000

export class PolymarketAPI {
  static async fetchMarkets(limit: number = 500): Promise<Market[]> {
    try {
      const now = new Date().toISOString();

      const params = new URLSearchParams({
        closed: 'false',
        end_date_min: now,
        order: 'endDate',
        ascending: 'true',
        limit: limit.toString(),
      });

      // 通过Next.js API路由代理
      const url = `${API_PROXY}?${params}`;
      const response = await fetch(url, {
        cache: 'default',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return this.processMarkets(data);
    } catch (error) {
      console.error('❌ API Error:', error);
      throw error;
    }
  }

  private static processMarkets(markets: any[]): Market[] {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3天后

    // 体育比赛关键词列表
    const sportsKeywords = [
      ' vs ', ' vs. ', 'versus',
      'spread', ' o/u ', 'over/under', 'over ', 'under ',
      'win on', 'crimson tide', 'rebels', 'terrapins',
      'club tijuana', 'tigres', 'alabama', 'ole miss', 'maryland', 'utah',
      'football', 'basketball', 'soccer', 'baseball', 'hockey',
      'nfl', 'nba', 'mlb', 'nhl', 'ncaa', 'college football', 'college basketball'
    ];

    return markets
      .map(market => {
        const question = (market.question || '').toLowerCase();
        
        // 过滤掉二元市场（"Up or Down" 类型）
        if (question.includes('up or down')) {
          return null;
        }

        // 过滤掉体育比赛类市场
        if (sportsKeywords.some(keyword => question.includes(keyword.toLowerCase()))) {
          return null;
        }

        // Extract deadline with correct priority: endDate > gameStartTime > endDateIso
        let deadline: Date | null = null;

        if (market.endDate) {
          const d = new Date(market.endDate);
          if (!isNaN(d.getTime())) deadline = d;
        }

        if (!deadline && market.gameStartTime) {
          const d = new Date(market.gameStartTime);
          if (!isNaN(d.getTime())) deadline = d;
        }

        if (!deadline && market.endDateIso) {
          const d = new Date(market.endDateIso);
          if (!isNaN(d.getTime())) deadline = d;
        }

        if (!deadline) return null;

        // 只保留最近3天到期的市场
        if (deadline > threeDaysFromNow) {
          return null;
        }

        // Calculate urgency
        const hoursUntil = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
        let urgency: 'critical' | 'urgent' | 'soon' | 'normal' = 'normal';

        if (hoursUntil < 1) urgency = 'critical';
        else if (hoursUntil < 24) urgency = 'urgent';
        else if (hoursUntil < 168) urgency = 'soon'; // 7 days

        return {
          ...market,
          _deadline: deadline,
          _urgency: urgency,
          _hoursUntil: hoursUntil,
          endDate: deadline.toISOString(),
        };
      })
      .filter((market): market is Market => {
        if (!market) return false;

        // Filter by liquidity
        const liquidity = parseFloat(market.liquidity || market.liquidityNum || '0');
        return liquidity >= MIN_LIQUIDITY && market._deadline! > now;
      })
      .sort((a, b) => {
        // Sort by deadline (soonest first)
        return a._deadline!.getTime() - b._deadline!.getTime();
      });
  }

  static getMarketUrl(market: Market): string {
    // Generate Polymarket URL for the market
    // Polymarket URL 格式优先级：
    // 1. 使用 events 数组中的 slug（最准确）
    // 2. 使用市场本身的 slug
    // 3. 使用 conditionId
    // 4. 使用 market ID
    
    // @ts-ignore - events 可能不在类型定义中
    const events = market.events || [];
    if (Array.isArray(events) && events.length > 0 && events[0].slug) {
      return `https://polymarket.com/event/${events[0].slug}`;
    }
    
    // 使用市场本身的 slug
    if (market.slug) {
      return `https://polymarket.com/event/${market.slug}`;
    }
    
    // 使用 conditionId（如果存在）
    // @ts-ignore - conditionId 可能不在类型定义中
    if (market.conditionId) {
      return `https://polymarket.com/condition/${market.conditionId}`;
    }
    
    // 最后的 fallback：使用 market ID
    return `https://polymarket.com/market/${market.id}`;
  }
}
