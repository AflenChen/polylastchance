import { NextRequest, NextResponse } from 'next/server';
import { sanitizeCoinId, getCorsOrigin } from '@/lib/security';

// 暂时禁用 Edge Runtime，使用 Node.js Runtime 以确保兼容性
// export const runtime = 'edge';

/**
 * CoinGecko API Proxy
 * Solves CORS issues by calling from server-side
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const coinId = searchParams.get('id');

  if (!coinId) {
    return NextResponse.json({ error: 'Missing coin ID' }, { status: 400 });
  }

  // 验证和清理 coin ID（防止注入攻击）
  const sanitizedCoinId = sanitizeCoinId(coinId);
  if (!sanitizedCoinId) {
    return NextResponse.json(
      { error: 'Invalid coin ID format' },
      { status: 400 }
    );
  }

  try {
    // 使用清理后的 coin ID
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(sanitizedCoinId)}&vs_currencies=usd&include_24hr_change=true`,
      {
        headers: {
          'Accept': 'application/json',
        },
        // Cache for 30 seconds
        next: { revalidate: 30 },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch crypto price' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const corsOrigin = getCorsOrigin();

    return NextResponse.json(data, {
      headers: {
        ...(corsOrigin && { 'Access-Control-Allow-Origin': corsOrigin }),
      },
    });
  } catch (error) {
    console.error('Failed to fetch crypto price:', error);
    const corsOrigin = getCorsOrigin();
    
    return NextResponse.json(
      { error: 'Failed to fetch crypto price' },
      { 
        status: 500,
        headers: {
          ...(corsOrigin && { 'Access-Control-Allow-Origin': corsOrigin }),
        },
      }
    );
  }
}
