import React, { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { ITrendRecord, ITrendChartDataPoint } from '@/types';
import { computeTrendChartData } from '@/utils';
import { getBarColors } from './chartColors';

interface IProps {
  trendRecords: ITrendRecord[];
  weekCount: number;
  countMode: 'pending' | 'total' | 'processed';
  theme: 'light' | 'dark';
  /** 全局筛选的起止日期（用于补齐图表范围到选择边界，而非仅到数据最后一天） */
  rangeStart?: string;
  rangeEnd?: string;
}

/**
 * 时间趋势折线图
 * trendRecords 已由 App.tsx 按全局周范围预过滤，此处不再重复过滤
 * 根据所选周数自动决定聚合粒度：≤6 周按天，7~25 周按周，>25 周按月
 */
export default function TrendWarning({ trendRecords, weekCount, countMode, theme, rangeStart: propStart, rangeEnd: propEnd }: IProps) {

  // 计算趋势图数据 + 按跨度聚合 + 补齐完整日期范围（无数据填 0）
  // 聚合规则：≤6 周按天，7~25 周按周，>25 周按月
  const { chartData, groups } = useMemo(() => {
    const raw = computeTrendChartData(trendRecords, countMode, 'department');
    const grps = raw.groups;
    if (raw.chartData.length === 0) return { chartData: [], groups: grps };

    // 数据实际起止
    const sortedDates = raw.chartData.map(d => d.date).sort();
    const dataStart = parseDate(sortedDates[0]);
    const dataEnd = parseDate(sortedDates[sortedDates.length - 1]);

    // 补齐范围：优先用全局筛选边界，确保图表覆盖整个选择区间（含首尾空白周/月）
    const rangeStart = propStart ? parseDate(propStart) : dataStart;
    const rangeEnd = propEnd ? parseDate(propEnd) : dataEnd;

    if (weekCount > 25) {
      // 按月聚合后补齐缺失月
      const grouped = aggregateChartData(raw.chartData, grps, 'month');
      const chartData = padMonthly(grouped, grps, rangeStart, rangeEnd);
      return { chartData, groups: grps };
    }

    if (weekCount > 6) {
      // 按周聚合后补齐缺失周
      const grouped = aggregateChartData(raw.chartData, grps, 'week');
      const weekStart = parseDate(getWeekStart(dateToStr(rangeStart)));
      const chartData = padToFullRange(grouped, grps, weekStart, rangeEnd, 7);
      return { chartData, groups: grps };
    }

    // ≤6 周：按天展示，补齐缺失日期
    const chartData = padToFullRange(raw.chartData, grps, rangeStart, rangeEnd, 1);
    return { chartData, groups: grps };
  }, [trendRecords, countMode, weekCount, propStart, propEnd]);

  const [visibleGroups, setVisibleGroups] = useState<Set<string>>(new Set());

  // 计算期间内各分组异常总计（右侧展示用）
  const groupSummaries = useMemo(() => {
    const map = new Map<string, { pending: number; review: number; overdue: number }>();
    for (const r of trendRecords) {
      const name = r.department || '未知';
      if (!map.has(name)) {
        map.set(name, { pending: 0, review: 0, overdue: 0 });
      }
      const entry = map.get(name)!;
      entry.pending += r.pendingCount;
      entry.review += r.reviewCount;
      entry.overdue += r.overdueCount;
    }
    return Array.from(map.entries())
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => b.pending - a.pending);
  }, [trendRecords]);

  // 分组列表或时间范围变化时重置可见性
  useEffect(() => {
    if (groups.length > 0) {
      setVisibleGroups(new Set(groups));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countMode, weekCount]);

  const toggleGroup = (name: string) => {
    const next = new Set(visibleGroups);
    if (next.has(name)) {
      // 至少保留一个分组
      if (next.size > 1) next.delete(name);
    } else {
      next.add(name);
    }
    setVisibleGroups(next);
  };

  const hasTrendData = chartData.length > 0 && groups.length > 0;

  const countLabel = countMode === 'pending' ? '待处理' : countMode === 'processed' ? '完成核查' : '历史总计';

  return (
    <div className="dashboard-panel">
      {hasTrendData && (
        <div className="trend-with-summary">
          {/* 左侧：趋势折线图 */}
          <div className="chart-card trend-chart-area">
            <h3 className="chart-title">各部门审阅异常变化趋势</h3>
            <p className="chart-desc">按日期展示各部门 {countLabel} 审阅异常数量变化，支持折叠部门</p>
            <div className="dept-filter">
              {groups.map((g, i) => (
                <button
                  key={g}
                  className={`dept-filter-btn ${visibleGroups.has(g) ? 'dept-filter-btn-active' : ''}`}
                  style={visibleGroups.has(g) ? { borderColor: getBarColors(theme)[i % 10], color: getBarColors(theme)[i % 10] } : {}}
                  onClick={() => toggleGroup(g)}
                >
                  {visibleGroups.has(g) ? '✓ ' : ''}{g}
                </button>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#eee'} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={40} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#333' : '#fff',
                    border: 'none',
                    borderRadius: 8,
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  content={({ payload }) => {
                    if (!payload || payload.length === 0) return null;
                    return (
                      <div className="trend-legend-grid">
                        {payload.map((entry, i) => (
                          <span key={i} className="trend-legend-item" style={{ color: entry.color }}>
                            ● {entry.value}
                          </span>
                        ))}
                      </div>
                    );
                  }}
                />
                {groups.filter((g) => visibleGroups.has(g)).map((g, i) => (
                  <Line
                    key={g}
                    type="monotone"
                    dataKey={g}
                    name={g}
                    stroke={getBarColors(theme)[i % 10]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* 右侧：期间内部门异常管理进度 */}
          <div className="trend-right-summary">
            <h4 className="trend-summary-title">各部门异常管理进度</h4>
            <div className="trend-dept-grid">
              {groupSummaries.map((d, i) => {
                const completedCount = d.review - d.pending;
                const completionRate = d.review > 0 ? (completedCount / d.review) * 100 : 0;
                const color = getBarColors(theme)[i % 10];
                return (
                  <div key={d.name} className="trend-dept-block">
                    <div className="trend-dept-header">
                      <span className="trend-summary-dot" style={{ background: color }} />
                      <span className="trend-dept-name">{d.name}</span>
                    </div>
                    <div className="trend-dept-metrics">
                      <div className="trend-dept-metric">
                        <span className="trend-dept-label">待处理</span>
                        <span className="trend-dept-value">{d.pending.toLocaleString()}</span>
                      </div>
                      <div className="trend-dept-metric">
                        <span className="trend-dept-label">总计</span>
                        <span className="trend-dept-value trend-dept-value-total">{d.review.toLocaleString()}</span>
                      </div>
                      <div className="trend-dept-metric trend-dept-metric-completion">
                        <span className="trend-dept-label">完成比例</span>
                        <div className="trend-dept-bar-row">
                          <div className="trend-dept-bar-wrap">
                            <div className="trend-dept-bar" style={{ width: `${Math.round(completionRate)}%`, background: color }} />
                          </div>
                          <span className="trend-dept-pct">{completionRate.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 趋势数据聚合 + 补齐工具 ─── */

/** yyyy-MM-dd → Date (UTC) */
function padToFullRange(
  data: ITrendChartDataPoint[],
  groups: string[],
  rangeStart: Date,
  rangeEnd: Date,
  stepDays: number,
): ITrendChartDataPoint[] {
  const dataMap = new Map(data.map((d) => [d.date, d]));
  const result: ITrendChartDataPoint[] = [];

  const current = new Date(rangeStart);
  while (current <= rangeEnd) {
    const dateStr = dateToStr(current);
    const existing = dataMap.get(dateStr);
    if (existing) {
      result.push(existing);
    } else {
      const empty: ITrendChartDataPoint = { date: dateStr };
      for (const g of groups) empty[g] = 0;
      result.push(empty);
    }
    current.setUTCDate(current.getUTCDate() + stepDays);
  }

  return result;
}

/**
 * 按月补齐完整日期范围（按月步进，避免 30 天偏移导致后续月份 key 不匹配）
 * 仅用于 6m / 1y 等按月聚合模式
 */
function padMonthly(
  data: ITrendChartDataPoint[],
  groups: string[],
  rangeStart: Date,
  rangeEnd: Date,
): ITrendChartDataPoint[] {
  const dataMap = new Map(data.map((d) => [d.date, d]));
  const result: ITrendChartDataPoint[] = [];
  // 从 rangeStart 所在月月初开始，到 rangeEnd 所在月月末结束
  const current = new Date(rangeStart);
  current.setUTCDate(1);
  const end = new Date(rangeEnd);
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + 1); // 包含当前月
  while (current < end) {
    const dateStr = dateToStr(current);
    const existing = dataMap.get(dateStr);
    if (existing) {
      result.push(existing);
    } else {
      const empty: ITrendChartDataPoint = { date: dateStr };
      for (const g of groups) empty[g] = 0;
      result.push(empty);
    }
    current.setUTCMonth(current.getUTCMonth() + 1); // +1 月，精确保持在 -01
  }
  return result;
}

/** 按周或按月聚合趋势图数据点 */
function aggregateChartData(
  data: ITrendChartDataPoint[],
  groups: string[],
  groupBy: 'week' | 'month',
): ITrendChartDataPoint[] {
  const groupMap = new Map<string, ITrendChartDataPoint>();

  for (const point of data) {
    const groupKey = groupBy === 'week' ? getWeekStart(point.date) : getMonthStart(point.date);
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, { date: groupKey });
    }
    const target = groupMap.get(groupKey)!;
    for (const g of groups) {
      const v = (point[g] as number) || 0;
      target[g] = ((target[g] as number) || 0) + v;
    }
  }

  return Array.from(groupMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** yyyy-MM-dd → yyyy-MM-dd（所在周的周一） */
function getWeekStart(dateStr: string): string {
  const d = parseDate(dateStr);
  const day = d.getUTCDay(); // 0=Sun
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return dateToStr(d);
}

/** yyyy-MM-dd → 补齐到 01 → yyyy-MM-01 */
function getMonthStart(dateStr: string): string {
  return dateStr.slice(0, 7) + '-01';
}

/** yyyy-MM-dd → Date（UTC） */
function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00Z');
}

/** Date → yyyy-MM-dd（UTC） */
function dateToStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
