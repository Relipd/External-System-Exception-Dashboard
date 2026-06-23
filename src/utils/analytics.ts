import type { IDashboardAnalytics, ITrendRecord, ITrendChartDataPoint } from '@/types';
import { ANOMALY_CODE_MAP, ANOMALY_CODES, eCountsToRisk } from '@/types';

/* ═══════════════════════════ shared: systemCode 1:1 映射 ═══════════════════════════ */

export interface IScMapping {
  resolvePlatform: (r: ITrendRecord) => string;
  resolveDept: (r: ITrendRecord) => string;
}

/** 从全量 records 构建 systemCode → { plat, dept } 映射，返回补全函数 */
export function buildScMappings(
  records: ITrendRecord[],
): IScMapping {
  const scInfo = new Map<string, { plat: string; dept: string }>();
  for (const r of records) {
    if (!r.systemCode) continue;
    const cur = scInfo.get(r.systemCode);
    const plat = r.platformName || cur?.plat || '';
    const dept = r.department || cur?.dept || '';
    if (plat || dept) scInfo.set(r.systemCode, { plat, dept });
  }
  return {
    resolvePlatform: (r: ITrendRecord) => {
      // 优先级：record 自身 platformName > scInfo 推断 > systemCode > '未知'
      if (r.platformName) return r.platformName;
      return scInfo.get(r.systemCode)?.plat || r.systemCode || '未知';
    },
    resolveDept: (r: ITrendRecord) =>
      r.department || scInfo.get(r.systemCode)?.dept || '未知',
  };
}

/* ═══════════════════════════ computeAnalyticsFromTrend ═══════════════════════════ */

export function computeAnalyticsFromTrend(
  records: ITrendRecord[],
  countMode: 'pending' | 'total' | 'processed' = 'pending',
): IDashboardAnalytics {
  let totalCount = 0;
  const platCountMap = new Map<string, number>();
  const deptMap = new Map<string, number>();
  const deptRiskMap = new Map<string, { R1: number; R2: number; R3: number }>();
  const platformRiskMap = new Map<string, { R1: number; R2: number; R3: number }>();
  const deptPlatformMap = new Map<string, Map<string, { R1: number; R2: number; R3: number }>>();
  const allDeptSet = new Set<string>();
  const platformSet = new Set<string>();
  const typeMap = new Map<string, number>();
  const typeDeptMap = new Map<string, Map<string, number>>();

  const { resolvePlatform, resolveDept } = buildScMappings(records);

  for (const r of records) {
    const mainTotal = Math.max(0, countMode === 'pending' ? r.pendingCount
                    : countMode === 'total' ? r.reviewCount
                    : r.reviewCount - r.pendingCount);

    const ratio = r.reviewCount > 0
      ? Math.max(0, countMode === 'pending' ? r.pendingCount / r.reviewCount
        : countMode === 'total' ? 1
        : (r.reviewCount - r.pendingCount) / r.reviewCount)
      : 0;

    // R1/R2/R3 从 E 编码自动推导
    const rawRisk = eCountsToRisk(r.eCounts);
    const r1 = Math.max(0, Math.round(rawRisk.R1 * ratio));
    const r2 = Math.max(0, Math.round(rawRisk.R2 * ratio));
    const r3 = Math.max(0, Math.round(rawRisk.R3 * ratio));

    totalCount += mainTotal;
    const plat = resolvePlatform(r);
    const dept = resolveDept(r);

    platCountMap.set(plat, (platCountMap.get(plat) || 0) + mainTotal);
    if (plat !== '未知') platformSet.add(plat);

    allDeptSet.add(dept);
    deptMap.set(dept, (deptMap.get(dept) || 0) + mainTotal);

    if (!deptRiskMap.has(dept)) deptRiskMap.set(dept, { R1: 0, R2: 0, R3: 0 });
    const dr = deptRiskMap.get(dept)!; dr.R1 += r1; dr.R2 += r2; dr.R3 += r3;

    if (!deptPlatformMap.has(dept)) deptPlatformMap.set(dept, new Map());
    const pm = deptPlatformMap.get(dept)!;
    if (!pm.has(plat)) pm.set(plat, { R1: 0, R2: 0, R3: 0 });
    const pe = pm.get(plat)!; pe.R1 += r1; pe.R2 += r2; pe.R3 += r3;

    if (!platformRiskMap.has(plat)) platformRiskMap.set(plat, { R1: 0, R2: 0, R3: 0 });
    const se = platformRiskMap.get(plat)!; se.R1 += r1; se.R2 += r2; se.R3 += r3;

    // E01~E09 聚合
    for (const code of ANOMALY_CODES) {
      const v = Math.round((r.eCounts[code] || 0) * ratio);
      if (v <= 0) continue;
      const typeName = ANOMALY_CODE_MAP[code].type;
      typeMap.set(typeName, (typeMap.get(typeName) || 0) + v);
      if (!typeDeptMap.has(typeName)) typeDeptMap.set(typeName, new Map());
      const tdm = typeDeptMap.get(typeName)!;
      tdm.set(dept, (tdm.get(dept) || 0) + v);
    }
  }

  const platformDistribution = Array.from(platCountMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  const allDeptNames = Array.from(allDeptSet).sort();

  const anomalyTypeTop10 = Array.from(typeMap.entries())
    .map(([type, count]) => ({ type, count, percentage: Math.round((count / Math.max(totalCount, 1)) * 100) }))
    .sort((a, b) => b.count - a.count).slice(0, 10);

  const topTypes = new Set(anomalyTypeTop10.map(t => t.type));
  const anomalyTypeByDept = Array.from(typeDeptMap.entries())
    .filter(([type]) => topTypes.has(type))
    .map(([type, dm]) => { const p: any = { type }; for (const d of allDeptNames) p[d] = dm.get(d) || 0; return p as ITrendChartDataPoint; })
    .sort((a, b) => {
      const aT = allDeptNames.reduce((s, d) => s + ((a[d] as number) || 0), 0);
      const bT = allDeptNames.reduce((s, d) => s + ((b[d] as number) || 0), 0);
      return bT - aT;
    });

  const departmentRanking = Array.from(deptMap.entries()).map(([department, count]) => ({ department, count })).sort((a, b) => b.count - a.count);
  const deptRiskRanking = Array.from(deptRiskMap.entries()).map(([department, d]) => ({ department, count: d.R1 + d.R2 + d.R3, riskR3: d.R3, riskR2: d.R2, riskR1: d.R1 })).sort((a, b) => b.count - a.count);
  // plat 已是补全后的平台名，直接作为 system 显示
  const platformRiskRanking = Array.from(platformRiskMap.entries()).map(([plat, risks]) => ({ system: plat, count: risks.R1 + risks.R2 + risks.R3, riskR3: risks.R3, riskR2: risks.R2, riskR1: risks.R1 })).sort((a, b) => b.count - a.count);
  const deptPlatformDetails = Array.from(deptPlatformMap.entries()).map(([department, pm]) => {
    const platforms = Array.from(pm.entries()).map(([plat, risks]) => ({ platform: plat, riskR3: risks.R3, riskR2: risks.R2, riskR1: risks.R1, count: risks.R1 + risks.R2 + risks.R3 })).sort((a, b) => b.count - a.count);
    return { department, totalCount: platforms.reduce((s, p) => s + p.count, 0), platforms };
  }).sort((a, b) => b.totalCount - a.totalCount);

  // 平台 → 部门反查（key 即为补全后的平台名）
  const platformDeptMap = new Map<string, Map<string, { R1: number; R2: number; R3: number }>>();
  for (const [dept, pm] of deptPlatformMap) {
    for (const [plat, risks] of pm) {
      if (!platformDeptMap.has(plat)) platformDeptMap.set(plat, new Map());
      const dm = platformDeptMap.get(plat)!;
      if (!dm.has(dept)) dm.set(dept, { R1: 0, R2: 0, R3: 0 });
      const de = dm.get(dept)!;
      de.R1 += risks.R1; de.R2 += risks.R2; de.R3 += risks.R3;
    }
  }
  const platformDeptDetails = Array.from(platformDeptMap.entries()).map(([plat, dm]) => {
    const departments = Array.from(dm.entries()).map(([department, risks]) => ({
      department, riskR3: risks.R3, riskR2: risks.R2, riskR1: risks.R1,
      count: risks.R1 + risks.R2 + risks.R3,
    })).sort((a, b) => b.count - a.count);
    return { platform: plat, totalCount: departments.reduce((s, d) => s + d.count, 0), departments };
  }).sort((a, b) => b.totalCount - a.totalCount);

  let h = 0, m = 0, l = 0;
  for (const d of deptRiskMap.values()) { h += d.R3; m += d.R2; l += d.R1; }

  return {
    totalRemainingCount: totalCount, highRiskCount: h, midRiskCount: m, lowRiskCount: l,
    platformCount: platformSet.size, anomalyTypeCount: typeMap.size,
    platformDistribution, anomalyTypeTop10, anomalyTypeByDept, allDeptNames,
    departmentRanking, deptRiskRanking, systemRiskRanking: platformRiskRanking, deptPlatformDetails, platformDeptDetails,
  };
}

export function computeTrendChartData(
  records: ITrendRecord[], countMode: 'pending' | 'total' | 'processed' = 'pending',
  groupKey: 'department' | 'systemCode' = 'department',
): { chartData: ITrendChartDataPoint[]; groups: string[] } {
  const { resolveDept } = buildScMappings(records);

  const gs = new Set<string>(), dm = new Map<string, ITrendChartDataPoint>();
  for (const r of [...records].sort((a, b) => a.dateStart.localeCompare(b.dateStart))) {
    const gn = groupKey === 'department'
      ? resolveDept(r)
      : (r.systemCode || '未知');
    gs.add(gn);
    const val = countMode === 'pending' ? r.pendingCount : countMode === 'total' ? r.reviewCount : r.reviewCount - r.pendingCount;
    if (!dm.has(r.dateStart)) dm.set(r.dateStart, { date: r.dateStart });
    dm.get(r.dateStart)![gn] = ((dm.get(r.dateStart)![gn] as number) || 0) + val;
  }
  return { chartData: Array.from(dm.values()), groups: Array.from(gs) };
}

export type CountMode = 'pending' | 'total' | 'processed';

function getTodayLocalStr(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/* ============================= 周时间筛选（周一 ~ 周日下拉） ============================= */

/** yyyy-MM-dd → 所在周的周一（UTC） */
function getWeekMonday(d: string): string {
  const dt = new Date(d + 'T00:00:00Z');
  const day = dt.getUTCDay();
  dt.setUTCDate(dt.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return dt.toISOString().slice(0, 10);
}

/** 周一 → 该周末日（+6 天，周日） */
function mondayToSunday(m: string): string {
  const d = new Date(m + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

export interface IWeekOption { monday: string; sunday: string; }

/**
 * 生成可选的周下拉列表（从今天往回推 days 天，按周切分，倒序排列）。
 * 返回 [{monday, sunday}, ...]，第 0 项是最近一周。
 */
export function buildWeekOptions(days: number): IWeekOption[] {
  const today = new Date(getTodayLocalStr() + 'T00:00:00Z');
  const sd = new Date(today);
  sd.setUTCDate(sd.getUTCDate() - days + 1);
  const sm = new Date(getWeekMonday(sd.toISOString().slice(0, 10)) + 'T00:00:00Z');
  const em = new Date(getWeekMonday(today.toISOString().slice(0, 10)) + 'T00:00:00Z');
  const list: IWeekOption[] = [];
  const cur = new Date(sm);
  while (cur <= em) {
    const m = cur.toISOString().slice(0, 10);
    list.push({ monday: m, sunday: mondayToSunday(m) });
    cur.setUTCDate(cur.getUTCDate() + 7);
  }
  return list.reverse();
}

/** 给定起止周（monday/sunday），返回日期范围（含端点） */
export function weekRangeToDates(startMonday: string, endSunday: string, options: IWeekOption[]): { start: string; end: string } | null {
  const s = options.find(t => t.monday === startMonday);
  const e = options.find(t => t.sunday === endSunday);
  if (!s || !e) return null;
  return { start: s.monday, end: e.sunday };
}

/** 统计两个周之间包含多少周（含端点） */
export function countWeeks(startMonday: string, endSunday: string, options: IWeekOption[]): number {
  const s = options.find(t => t.monday === startMonday);
  const e = options.find(t => t.sunday === endSunday);
  if (!s || !e) return 0;
  return options.filter(t => t.monday >= s.monday && t.sunday <= e.sunday).length;
}
