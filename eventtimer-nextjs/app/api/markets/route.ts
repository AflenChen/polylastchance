import { NextRequest, NextResponse } from 'next/server';
import { sanitizeQueryParams, getCorsOrigin } from '@/lib/security';

const POLYMARKET_API = 'https://gamma-api.polymarket.com/markets';

// 使用 Node.js Runtime 以确保在 Vercel 上正常工作
// export const runtime = 'edge'; // 暂时禁用 Edge Runtime，因为可能在 Vercel 上有兼容性问题

// 缓存60秒 - 显著减少API调用
export const revalidate = 60;

export async function GET(req: NextRequest) {
  try {
    // 获取并清理查询参数（防止 SSRF 和注入攻击）
    const searchParams = req.nextUrl.searchParams;
    const sanitizedParams = sanitizeQueryParams(searchParams);

    // 构建目标URL（使用清理后的参数）
    const queryString = sanitizedParams.toString();
    const targetUrl = queryString 
      ? `${POLYMARKET_API}?${queryString}`
      : POLYMARKET_API;

    console.log('Proxying to Polymarket:', targetUrl);

    // Add timeout using AbortController (45 seconds - Polymarket API can be very slow)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    // 调用Polymarket API
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EventTimer/2.0)',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Polymarket API returned ${response.status}`);
      throw new Error(`Polymarket API error: ${response.status}`);
    }

    const data = await response.json();

    // 获取 CORS 来源
    const corsOrigin = getCorsOrigin();

    // 返回数据并设置缓存头
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        ...(corsOrigin && { 'Access-Control-Allow-Origin': corsOrigin }),
      },
    });
  } catch (error: any) {
    console.error('API Proxy Error:', error);

    const corsOrigin = getCorsOrigin();

    // Return 500 error so the frontend can display proper error message
    // The frontend at page.tsx:30 will catch this and show "加载市场数据失败，请稍后重试"
    return NextResponse.json(
      { error: 'Failed to fetch markets' },
      {
        status: 500,
        headers: {
          // Short cache for errors
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          ...(corsOrigin && { 'Access-Control-Allow-Origin': corsOrigin }),
        },
      }
    );
  }
}
