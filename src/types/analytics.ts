import type { Link, Prisma } from "../../generated/prisma/client.js";

export interface ChartValue { name: string; value: number }
export interface ClickTrend { name: string; clicks: number }
export interface ReferrerCount { source: string; clicks: number }
export interface RecentClick {
    timestamp: string;
    country: string;
    city: string;
    browser: string | null;
    device: string | null;
    referrer: string;
}
export interface AnalyticsBreakdowns {
    clickTrend: ClickTrend[];
    countriesData: ChartValue[];
    devices: ChartValue[];
    cities: ChartValue[];
    os: ChartValue[];
    browsers: ChartValue[];
    referrers: ReferrerCount[];
    recentClicks: RecentClick[];
}
export interface LinkAnalyticsRow extends AnalyticsBreakdowns,
    Pick<Link, "id" | "longUrl" | "shortCode" | "title" | "tags" | "createdAt" | "expiresAt" | "isActive" | "is_password_protected"> {
    domainName: string | null;
    totalClicks: bigint;
    uniqueVisitors: bigint;
    countries: bigint;
    lastClicked: Date | null;
    avgDailyClicks: Prisma.Decimal | number;
}
export interface OverallAnalyticsRow extends AnalyticsBreakdowns {
    totalLinks: number;
    activeLinks: number;
    pausedLinks: number;
    expiredLinks: number;
    totalClicks: number;
    uniqueVisitors: number;
    avgDailyClicks: number;
    countriesReached: number;
    topLinks: { id: number; desc: string | null; shortLink: string; domainName?: string | null; shortUrl?: string; clicks: number }[];
}
export interface HourlyClicksRow { hour: Date; clicks: bigint }
export interface TopLinkRow { linkId: number; clicks: number; shortCode: string; longUrl: string; domainName: string | null }
