import dayjs from 'dayjs';

/** 从 bitable 单元格值中提取文本 */
export function cellToText(cell: any): string {
  if (!cell) return '';
  if (typeof cell === 'string') return cell;
  if (Array.isArray(cell)) {
    return cell.map((v: any) => v.text || v.name || String(v)).join(', ');
  }
  if (cell.text) return cell.text;
  if (cell.name) return cell.name;
  return String(cell);
}

/** 从 bitable 单元格值中提取日期字符串 */
export function cellToDate(cell: any): string {
  if (!cell) return '';
  if (typeof cell === 'number') return dayjs(cell).format('YYYY-MM-DD');
  if (typeof cell === 'string') return dayjs(cell).format('YYYY-MM-DD');
  if (cell.value) return dayjs(cell.value).format('YYYY-MM-DD');
  return '';
}

/** 从 bitable 单元格值中提取毫秒时间戳 */
export function cellToTimestamp(cell: any): number {
  if (!cell) return 0;
  if (typeof cell === 'number') return cell;
  if (typeof cell === 'string') return new Date(cell).getTime() || 0;
  if (cell.value) return cell.value;
  return 0;
}

export interface AggregatedStats {
  todayExceptions: number;
  pendingCount: number;
  pendingFeedbackCount: number;
  resolvedCount: number;
  r3Count: number;
  timeoutCount: number;
}

export interface PlatformCount {
  platform: string;
  count: number;
}

export interface RiskLevelCount {
  name: string;
  value: number;
}

export interface StatusCount {
  name: string;
  value: number;
}

export interface TrendPoint {
  date: string;
  count: number;
}

/** 聚合统计数据 */
export function aggregateData(
  rows: any[][],
  config: {
    platformIdx: number;
    riskLevelIdx: number;
    statusIdx: number;
    createdAtIdx: number;
  }
) {
  const today = dayjs().format('YYYY-MM-DD');
  const sevenDaysAgo = dayjs().subtract(6, 'day').format('YYYY-MM-DD');

  // 平台统计
  const platformMap = new Map<string, number>();
  // 风险等级统计
  const riskMap = new Map<string, number>();
  // 状态统计
  const statusMap = new Map<string, number>();
  // 每日趋势
  const trendMap = new Map<string, number>();

  let todayExceptions = 0;
  let pendingCount = 0;
  let pendingFeedbackCount = 0;
  let resolvedCount = 0;
  let r3Count = 0;

  for (const row of rows) {
    const platform = config.platformIdx >= 0 ? cellToText(row[config.platformIdx]) : '';
    const riskLevel = config.riskLevelIdx >= 0 ? cellToText(row[config.riskLevelIdx]) : '';
    const status = config.statusIdx >= 0 ? cellToText(row[config.statusIdx]) : '';
    const createdAt = config.createdAtIdx >= 0 ? cellToDate(row[config.createdAtIdx]) : '';

    // 平台
    if (platform) platformMap.set(platform, (platformMap.get(platform) || 0) + 1);

    // 风险等级
    if (riskLevel) riskMap.set(riskLevel, (riskMap.get(riskLevel) || 0) + 1);

    // 状态
    if (status) statusMap.set(status, (statusMap.get(status) || 0) + 1);

    // 今日异常
    if (createdAt === today) todayExceptions++;

    // 状态计数
    if (status === '待处理' || status === 'pending') pendingCount++;
    else if (status === '待反馈' || status === 'pending_feedback') pendingFeedbackCount++;
    else if (status === '已解决' || status === 'resolved') resolvedCount++;

    // R3
    if (riskLevel === 'R3') r3Count++;

    // 趋势（近7天）
    if (createdAt && createdAt >= sevenDaysAgo && createdAt <= today) {
      trendMap.set(createdAt, (trendMap.get(createdAt) || 0) + 1);
    }
  }

  // 填充趋势空缺日期
  const trendData: TrendPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
    trendData.push({ date: d, count: trendMap.get(d) || 0 });
  }

  const stats: AggregatedStats = {
    todayExceptions,
    pendingCount,
    pendingFeedbackCount,
    resolvedCount,
    r3Count,
    timeoutCount: 0, // 超时需要额外规则，demo 中暂为 0
  };

  const platformDistribution: PlatformCount[] = Array.from(platformMap.entries())
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count);

  const riskLevelDistribution: RiskLevelCount[] = [
    { name: 'R3（高风险）', value: riskMap.get('R3') || 0 },
    { name: 'R2（中风险）', value: riskMap.get('R2') || 0 },
    { name: 'R1（低风险）', value: riskMap.get('R1') || 0 },
  ].filter((r) => r.value > 0);

  const statusDistribution: StatusCount[] = [
    { name: '待处理', value: statusMap.get('待处理') || statusMap.get('pending') || 0 },
    { name: '待反馈', value: statusMap.get('待反馈') || statusMap.get('pending_feedback') || 0 },
    { name: '已解决', value: statusMap.get('已解决') || statusMap.get('resolved') || 0 },
  ].filter((s) => s.value > 0);

  return { stats, platformDistribution, riskLevelDistribution, statusDistribution, trendData };
}
