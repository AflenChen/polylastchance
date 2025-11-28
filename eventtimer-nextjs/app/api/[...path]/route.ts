import { NextRequest } from 'next/server';
import { sanitizePath, sanitizeQueryParams, getCorsOrigin } from '@/lib/security';

const POLYMARKET_API = 'https://gamma-api.polymarket.com';

// 暂时禁用 Edge Runtime，使用 Node.js Runtime 以确保兼容性
// export const runtime = 'edge';

// 缓存60秒 - 显著减少API调用
export const revalidate = 60;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  try {
    const params = await context.params;
    const pathSegments = params.path || [];
    
    // 验证和清理路径参数（防止 SSRF 攻击）
    const sanitizedPath = sanitizePath(pathSegments);
    if (!sanitizedPath) {
      return new Response(
        JSON.stringify({ error: 'Invalid path' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // 清理查询参数
    const searchParams = req.nextUrl.searchParams;
    const sanitizedParams = sanitizeQueryParams(searchParams);
    const queryString = sanitizedParams.toString();
    const search = queryString ? `?${queryString}` : '';

    const targetUrl = `${POLYMARKET_API}/${sanitizedPath}${search}`;

    console.log('Proxying request to:', targetUrl);

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EventTimer/2.0)',
      },
      // 使用Next.js缓存,60秒后重新验证
      next: { revalidate: 60 },
    });

    const body = await res.text();
    const corsOrigin = getCorsOrigin();

    return new Response(body, {
      status: res.status,
      headers: {
        'Content-Type': 'application/json',
        // 允许浏览器缓存60秒,之后必须重新验证
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        ...(corsOrigin && { 'Access-Control-Allow-Origin': corsOrigin }),
      },
    });
  } catch (error: any) {
    console.error('Proxy error:', error);
    const corsOrigin = getCorsOrigin();
    
    return new Response(
      JSON.stringify({ error: 'Proxy error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...(corsOrigin && { 'Access-Control-Allow-Origin': corsOrigin }),
        },
      }
    );
  }
}