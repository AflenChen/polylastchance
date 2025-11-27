export interface Market {
  id: string;
  question: string;
  description?: string;
  category?: string;

  // Time fields
  endDate: string;
  endDateIso?: string;
  gameStartTime?: string;
  startDate?: string;

  // Trading data
  volume: string | number;
  liquidity: string | number;
  liquidityNum?: number;
  outcomePrices?: string;
  lastTradePrice?: string;

  // Additional fields
  image?: string;
  icon?: string;
  slug?: string;
  outcomes?: string[];
  clobTokenIds?: string; // JSON string array of CLOB token IDs
  conditionId?: string; // Condition ID for market URL
  events?: Array<{ slug?: string; [key: string]: any }>; // Events array, may contain more accurate slug
  active?: boolean;
  closed?: boolean;

  // Computed fields (added by our app)
  _deadline?: Date;
  _urgency?: 'critical' | 'urgent' | 'soon' | 'normal';
  _hoursUntil?: number;
}

export interface MarketWithCountdown extends Market {
  countdown: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    expired: boolean;
    urgent: boolean;
    soon: boolean;
  };
}

export interface PriceHistory {
  price: number;
  timestamp: number;
}

export interface FilterOptions {
  timeFilter: 'all' | 'urgent' | 'soon' | 'favorites';
  timePeriod: '30min' | '2h' | '12h' | 'all';
  category?: string;
  minLiquidity?: number;
  searchQuery?: string;
}

export interface AppState {
  markets: Market[];
  filteredMarkets: Market[];
  favorites: Set<string>;
  priceHistory: Record<string, PriceHistory[]>;
  filter: FilterOptions;
  loading: boolean;
  error: string | null;
  lastUpdate: number | null;
}
