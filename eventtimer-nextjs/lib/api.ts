import { Market } from '@/types/market';

// 使用Next.js API路由代理(Polymarket API不支持浏览器CORS)
const API_PROXY = '/api/markets';
const MIN_LIQUIDITY = 10000; // 流动性要求：$10,000

export class PolymarketAPI {
  static async fetchMarkets(limit: number = 1000): Promise<Market[]> {
    try {
      const now = new Date();
      const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 2周后

      // 尝试多种查询方式以获取更多市场
      // 方法1: 按到期时间排序（包含已过期的，稍后过滤）
      const params1 = new URLSearchParams({
        closed: 'false',
        // 暂时移除 end_date_min，看看能否获取到目标市场
        // end_date_min: now.toISOString(),
        order: 'endDate',
        ascending: 'true',
        limit: '500', // API 似乎限制为 500
      });
      
      // 方法2: 按流动性排序（可能包含不同的市场）
      const params2 = new URLSearchParams({
        closed: 'false',
        order: 'liquidity',
        ascending: 'false',
        limit: '500',
      });
      
      // 先尝试方法1
      const params = params1;

      // 通过Next.js API路由代理
      const url = `${API_PROXY}?${params}`;
      const response = await fetch(url, {
        cache: 'default',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      let data = await response.json();
      console.log(`📊 API 返回原始数据（按到期时间）: ${data.length} 个市场`);
      
      // 如果第一次查询没找到目标市场，尝试按流动性排序
      const targetInFirst = data.find((m: any) => {
        const q = (m.question || '').toLowerCase();
        return (q.includes('largest') && q.includes('company') && q.includes('november'));
      });
      
      if (!targetInFirst) {
        // 如果第一次查询没找到目标市场，尝试按流动性排序
        console.log('🔄 目标市场不在第一次查询结果中，尝试按流动性排序获取更多市场...');
        const url2 = `${API_PROXY}?${params2}`;
        const response2 = await fetch(url2, { cache: 'default' });
        if (response2.ok) {
          const data2 = await response2.json();
          console.log(`📊 API 返回原始数据（按流动性）: ${data2.length} 个市场`);
          // 合并两个结果，去重
          const combined = [...data];
          const existingIds = new Set(data.map((m: any) => m.id));
          data2.forEach((m: any) => {
            if (!existingIds.has(m.id)) {
              combined.push(m);
            }
          });
          data = combined;
          console.log(`📊 合并后总数据: ${data.length} 个市场`);
        }
      }
      
      // 检查目标市场是否在原始数据中（使用更宽松的搜索）
      // 搜索所有包含 "largest company" 的市场（包括 "Will Apple be the largest company..." 等）
      const allLargestCompanyMarkets = data.filter((m: any) => {
        const q = (m.question || '').toLowerCase();
        return q.includes('largest company') || 
               (q.includes('largest') && q.includes('company') && q.includes('world'));
      });
      
      // 优先匹配 "end of november" 的市场
      let targetMarket = allLargestCompanyMarkets.find((m: any) => {
        const q = (m.question || '').toLowerCase();
        return q.includes('end of november') && 
               !q.includes('third') && 
               !q.includes('second');
      });
      
      // 如果没找到，尝试匹配包含 "november" 的市场（排除 third/second）
      if (!targetMarket) {
        targetMarket = allLargestCompanyMarkets.find((m: any) => {
          const q = (m.question || '').toLowerCase();
          return q.includes('november') && 
                 !q.includes('third') && 
                 !q.includes('second');
        });
      }
      
      // 如果还是没找到，返回第一个包含 "largest company" 的市场
      if (!targetMarket && allLargestCompanyMarkets.length > 0) {
        targetMarket = allLargestCompanyMarkets[0];
      }
      
      // 显示所有包含 "largest company" 的市场（用于调试）
      if (allLargestCompanyMarkets.length > 0) {
        console.log(`🔍 找到 ${allLargestCompanyMarkets.length} 个包含 "largest company" 的市场:`);
        allLargestCompanyMarkets.forEach((m: any, i: number) => {
          const q = (m.question || '').toLowerCase();
          const isEndOfNovember = q.includes('end of november');
          const isNovember = q.includes('november');
          const isApple = q.includes('apple');
          let marker = '  ';
          if (isEndOfNovember) marker = '🎯';
          else if (isApple) marker = '🍎';
          else if (isNovember) marker = '📅';
          console.log(`${marker} ${i + 1}. ${m.question} (endDate: ${m.endDate}, liquidity: ${m.liquidity || m.liquidityNum})`);
        });
      }
      
      // 查找所有包含 "company" 和 "november" 的市场（用于调试）
      const companyNovemberMarkets = data.filter((m: any) => {
        const q = (m.question || '').toLowerCase();
        return q.includes('company') && (q.includes('november') || q.includes('nov'));
      });
      if (targetMarket) {
        console.log('✅ 在原始数据中找到目标市场:', targetMarket.question);
        console.log('  - category:', targetMarket.category);
        console.log('  - endDate:', targetMarket.endDate);
        console.log('  - liquidity:', targetMarket.liquidity || targetMarket.liquidityNum);
        console.log('  - active:', targetMarket.active);
        console.log('  - closed:', targetMarket.closed);
        
        // 检查日期
        if (targetMarket.endDate) {
          const endDate = new Date(targetMarket.endDate);
          const daysUntil = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          console.log('  - 距离到期:', daysUntil.toFixed(1), '天');
          console.log('  - 是否在2周内:', daysUntil <= 14 ? '✅' : '❌');
        }
      } else {
        console.log('❌ 目标市场不在原始数据中');
        console.log('  可能原因:');
        console.log('  1. 不在前', limit, '个结果中（API可能有限制）');
        console.log('  2. 市场已关闭或未激活');
        console.log('  3. 到期时间已过或太远');
        // 显示包含 "company" 和 "november" 的市场
        if (companyNovemberMarkets.length > 0) {
          console.log(`  找到 ${companyNovemberMarkets.length} 个包含 "company" 和 "november" 的市场:`);
          companyNovemberMarkets.slice(0, 10).forEach((m: any, i: number) => {
            console.log(`    ${i + 1}. ${m.question} (endDate: ${m.endDate}, category: ${m.category})`);
          });
        } else {
          // 显示一些包含 "company" 或 "november" 的市场作为参考
          const relatedMarkets = data.filter((m: any) => {
            const q = (m.question || '').toLowerCase();
            return q.includes('company') || q.includes('november');
          }).slice(0, 5);
          if (relatedMarkets.length > 0) {
            console.log('  相关市场示例:');
            relatedMarkets.forEach((m: any, i: number) => {
              console.log(`    ${i + 1}. ${m.question?.substring(0, 60)}... (endDate: ${m.endDate})`);
            });
          }
        }
      }
      
      return this.processMarkets(data);
    } catch (error) {
      console.error('❌ API Error:', error);
      throw error;
    }
  }

  private static processMarkets(markets: any[]): Market[] {
    const now = new Date();
    const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 2周后
    
    console.log(`🔄 开始处理 ${markets.length} 个市场`);

    // 体育竞猜相关的过滤已移到前端，不在这里过滤

    // 数字货币单日预测关键词列表（只包含价格预测模式，不包含月份）
    // 注意：如果数字货币有特定类别，也可以在这里添加
    const dailyCryptoPredictionPatterns = [
      'will the price of',
      'price of bitcoin be',
      'price of ethereum be',
      'price of solana be',
      'price of btc be',
      'price of eth be',
      'price of sol be'
    ];

    const result = markets
      .map(market => {
        const question = (market.question || '').toLowerCase();
        
        // 调试：检查特定市场 - 精确匹配 "Largest Company end of November"
        const isTargetMarket = (question.includes('largest company') && question.includes('end of november')) ||
                               (question.includes('largest company') && question.includes('november') && !question.includes('third'));
        if (isTargetMarket) {
          console.log('🔍 找到目标市场:', market.question);
          console.log('  - category:', market.category);
          console.log('  - liquidity:', market.liquidity || market.liquidityNum);
          console.log('  - endDate:', market.endDate);
        }
        
        // 体育竞猜和二元期权的过滤已移到前端，不在这里过滤

        // 过滤掉数字货币单日预测类市场
        // 只有当同时包含价格预测模式和具体日期时才过滤（月份关键词不应该单独过滤）
        const hasPricePattern = dailyCryptoPredictionPatterns.some(pattern => 
          question.includes(pattern)
        );
        const hasDatePattern = /on (november|december|january|february|march|april|may|june|july|august|september|october) \d{1,2}/i.test(question);
        
        if (hasPricePattern && hasDatePattern) {
          if (isTargetMarket) console.log('  ❌ 被过滤: 数字货币单日预测');
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

        if (!deadline) {
          if (isTargetMarket) console.log('  ❌ 被过滤: 没有 deadline');
          return null;
        }

        // 不在这里过滤到期时间，改为前端过滤
        // 只检查是否已过期
        if (deadline <= now) {
          if (isTargetMarket) console.log('  ❌ 被过滤: 已过期', deadline, '<=', now);
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
        
        // 只检查是否已过期，其他过滤（流动性、到期时间、交易量）改为前端处理
        return market._deadline! > now;
      })
      .sort((a, b) => {
        // Sort by deadline (soonest first)
        return a._deadline!.getTime() - b._deadline!.getTime();
      });
    
    console.log(`✅ 处理完成: ${markets.length} -> ${result.length} 个市场通过过滤`);
    
    // 再次检查目标市场是否在最终结果中
    const targetInResult = result.find((m: Market) => {
      const q = (m.question || '').toLowerCase();
      return q.includes('largest company') && q.includes('november');
    });
    if (targetInResult) {
      console.log('✅ 目标市场在最终结果中！');
    } else {
      console.log('❌ 目标市场不在最终结果中（被过滤掉了）');
    }
    
    return result;
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
