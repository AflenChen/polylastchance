/**
 * 安全工具函数
 * 用于防止 SSRF、XSS 和其他安全漏洞
 */

// 允许的 API 端点白名单
const ALLOWED_POLYMARKET_PATHS = [
  'markets',
  'events',
  'conditions',
  'tokens',
  'trades',
  'orders',
];

// 允许的查询参数白名单
const ALLOWED_QUERY_PARAMS = [
  'limit',
  'offset',
  'closed',
  'active',
  'order',
  'ascending',
  'end_date_min',
  'end_date_max',
  'category',
  'search',
];

/**
 * 验证和清理查询参数
 * 只允许白名单中的参数
 */
export function sanitizeQueryParams(searchParams: URLSearchParams): URLSearchParams {
  const sanitized = new URLSearchParams();
  
  // 使用 Array.from 来避免迭代器问题
  Array.from(searchParams.entries()).forEach(([key, value]) => {
    // 只允许白名单中的参数
    if (ALLOWED_QUERY_PARAMS.includes(key)) {
      // 根据参数名验证值的格式
      const sanitizedValue = sanitizeParamValue(key, value);
      if (sanitizedValue !== null) {
        sanitized.append(key, sanitizedValue);
      }
    }
  });
  
  return sanitized;
}

/**
 * 清理参数值，防止注入攻击
 * @param paramName 参数名
 * @param value 参数值
 */
function sanitizeParamValue(paramName: string, value: string): string | null {
  // 移除潜在的恶意字符
  const cleaned = value
    .trim()
    .replace(/[<>'"&]/g, '') // 移除 HTML/JS 特殊字符
    .substring(0, 200); // 限制长度
  
  // 验证数字参数
  if (paramName === 'limit' || paramName === 'offset') {
    const num = parseInt(cleaned, 10);
    if (isNaN(num) || num < 0 || num > 10000) {
      return null; // 无效值
    }
    return num.toString();
  }
  
  // 验证布尔参数
  if (paramName === 'closed' || paramName === 'active' || paramName === 'ascending') {
    return cleaned === 'true' || cleaned === 'false' ? cleaned : null;
  }
  
  // 验证日期参数 (ISO 8601)
  if (paramName === 'end_date_min' || paramName === 'end_date_max') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(cleaned)) {
      return cleaned;
    }
    return null;
  }
  
  // 验证排序参数
  if (paramName === 'order') {
    const allowedOrders = ['endDate', 'liquidity', 'volume', 'createdAt'];
    return allowedOrders.includes(cleaned) ? cleaned : null;
  }
  
  // 其他参数（category, search）：只允许字母、数字、连字符、下划线和空格
  if (/^[a-zA-Z0-9\s\-_]+$/.test(cleaned)) {
    return cleaned;
  }
  
  return null;
}

/**
 * 验证路径参数，防止 SSRF 攻击
 */
export function sanitizePath(pathSegments: string[]): string | null {
  if (pathSegments.length === 0) {
    return null;
  }
  
  const firstSegment = pathSegments[0];
  
  // 只允许白名单中的路径
  if (!ALLOWED_POLYMARKET_PATHS.includes(firstSegment)) {
    return null;
  }
  
  // 验证后续路径段（只允许字母、数字、连字符、下划线）
  for (const segment of pathSegments) {
    if (!/^[a-zA-Z0-9\-_]+$/.test(segment)) {
      return null;
    }
    // 防止路径遍历攻击
    if (segment.includes('..') || segment.includes('//')) {
      return null;
    }
  }
  
  return pathSegments.join('/');
}

/**
 * 验证 CoinGecko coin ID
 */
export function sanitizeCoinId(coinId: string): string | null {
  // CoinGecko coin ID 只允许小写字母、数字和连字符
  if (!/^[a-z0-9\-]+$/.test(coinId)) {
    return null;
  }
  
  // 限制长度
  if (coinId.length > 50) {
    return null;
  }
  
  // 防止路径遍历
  if (coinId.includes('..') || coinId.includes('/')) {
    return null;
  }
  
  return coinId;
}

/**
 * 获取安全的 CORS 来源
 * 在生产环境中应该限制为特定域名
 * 兼容 Edge Runtime 和 Node.js Runtime
 */
export function getCorsOrigin(): string {
  // 在 Edge Runtime 中，使用全局对象检查环境
  // 在 Node.js Runtime 中，使用 process.env
  const isEdge = typeof EdgeRuntime !== 'undefined';
  const nodeEnv = isEdge 
    ? (globalThis as any).process?.env?.NODE_ENV 
    : process.env.NODE_ENV;
  const allowedOrigin = isEdge
    ? (globalThis as any).process?.env?.ALLOWED_ORIGIN
    : process.env.ALLOWED_ORIGIN;
  
  if (allowedOrigin) {
    return allowedOrigin;
  }
  
  // Vercel 生产环境：允许所有来源（因为 Vercel 已经处理了 CORS）
  // 其他生产环境应该设置 ALLOWED_ORIGIN 环境变量
  if (nodeEnv === 'production') {
    // 在 Vercel 上，允许所有来源（vercel.json 已经配置了 CORS）
    // 如果设置了 VERCEL 环境变量，说明在 Vercel 上运行
    const isVercel = isEdge
      ? (globalThis as any).process?.env?.VERCEL
      : process.env.VERCEL;
    
    if (isVercel) {
      return '*'; // Vercel 上允许所有来源
    }
    
    // 其他生产环境默认不允许所有来源
    return '';
  }
  
  return '*'; // 开发环境允许所有来源
}

/**
 * 创建安全的错误响应，不泄露内部信息
 */
export function createErrorResponse(
  message: string,
  status: number = 500,
  logError?: any
): Response {
  if (logError) {
    console.error('API Error:', logError);
  }
  
  // 在生产环境中，不返回详细的错误信息
  const isProduction = process.env.NODE_ENV === 'production';
  const errorMessage = isProduction 
    ? message 
    : (logError?.message || message);
  
  return new Response(
    JSON.stringify({ 
      error: message,
      ...(isProduction ? {} : { details: errorMessage })
    }),
    { 
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

