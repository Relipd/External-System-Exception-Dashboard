import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';
import type { IDashboardAnalytics } from '@/types';
import { RISK_LEVEL_COLORS, RISK_LEVEL_LABELS, ANOMALY_CODE_MAP } from '@/types';
import StatCard from './StatCard';
import { getBarColors } from './chartColors';

/** 从 ANOMALY_CODE_MAP 按风险等级聚合出 StatCard 需要的 subtitle */
export function buildRiskCodeInfo(riskLevel: string): { codes: string; tooltips: string } {
  const entries = Object.entries(ANOMALY_CODE_MAP)
    .filter(([, v]) => v.riskLevel === riskLevel);
  const codes = entries.map(([k]) => k).join('\n');
  const tooltips = entries.map(([k, v]) => `${k} ${v.type}`).join('\n');
  return { codes, tooltips };
}

interface IProps {
  data: IDashboardAnalytics;
  hideDeptRanking?: boolean;
  overdueCount?: number;
  hideStatCards?: boolean;
  theme: 'light' | 'dark';
}

/**
 * 看板1：风险总览（首页）
 * - 统计卡片
 * - 部门异常排行
 * - 系统风险排行堆叠图
 * - 系统异常详情排名列表
 */
export default function RiskOverview({ data, hideDeptRanking, overdueCount = 0, hideStatCards, theme }: IProps) {
  // 切片器：部门 / 平台
  const [riskGroupBy, setRiskGroupBy] = useState<'department' | 'platform'>('department');
  const deptRanking = data.departmentRanking;

  // 风险堆叠图数据：按切片器切换 部门/平台 维度
  const isDept = riskGroupBy === 'department';
  const rankingData = isDept ? data.deptRiskRanking : data.systemRiskRanking;
  const stackedData = rankingData.map((d) => ({
    name: isDept ? (d as typeof data.deptRiskRanking[0]).department : (d as typeof data.systemRiskRanking[0]).system,
    R3: d.riskR3,
    R2: d.riskR2,
    R1: d.riskR1,
    total: d.count,
  }));
  const chartTitle = isDept ? '各部门审阅风险等级分布' : '各平台审阅风险等级分布';
  const chartDesc = isDept ? '按部门聚合，R1低风险 / R2中风险 / R3高风险等级堆叠' : '按平台聚合，R1低风险 / R2中风险 / R3高风险等级堆叠';

  return (
    <div className="dashboard-panel">
      {/* 统计卡片 — 等宽 5 列排列 */}
      {!hideStatCards && (
        <div className="stat-cards-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          <StatCard title="异常数量" value={data.totalRemainingCount} subtitle=""
            color={data.totalRemainingCount > 50 ? '#ff3b30' : 'var(--ccm-chart-B500, #3370ff)'} />
          <StatCard title="🔴 高风险" value={data.highRiskCount}
            subtitle={buildRiskCodeInfo('R3').codes}
            subtitleTooltip={buildRiskCodeInfo('R3').tooltips}
            color="#ff3b30" />
          <StatCard title="🟡 中风险" value={data.midRiskCount}
            subtitle={buildRiskCodeInfo('R2').codes}
            subtitleTooltip={buildRiskCodeInfo('R2').tooltips}
            color="#ff9500" />
          <StatCard title="🟢 低风险" value={data.lowRiskCount}
            subtitle={buildRiskCodeInfo('R1').codes}
            subtitleTooltip={buildRiskCodeInfo('R1').tooltips}
            color="#34c759" />
          <StatCard title="⏰ 已超时" value={overdueCount} subtitle="部门治理超时"
            color={overdueCount > 0 ? '#ff3b30' : '#34c759'} />
        </div>
      )}

      {/* 部门异常排行（受控区域显示） */}
      {!hideDeptRanking && (
        <div className="charts-row">
          <div className="chart-card chart-card-full">
            <h3 className="chart-title">各部门审阅异常排名</h3>
            <p className="chart-desc">按归属部门汇总审阅异常数量，从高到低排列</p>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={deptRanking} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#eee'} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="department" width={90} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#333' : '#fff', border: 'none', borderRadius: 8 }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {deptRanking.map((entry, index) => (
                    <Cell key={entry.department} fill={getBarColors(theme)[index % 10]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 系统风险排行 + 系统异常详情（左右并排） */}
      <>
        <div className="charts-row" style={{ gridTemplateColumns: '4.8fr 5.2fr' }}>
          <div className="chart-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 className="chart-title">{chartTitle}</h3>
                <p className="chart-desc">{chartDesc}</p>
              </div>
              <div className="risk-group-toggle" style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  className={`time-filter-btn ${riskGroupBy === 'department' ? 'time-filter-btn-active' : ''}`}
                  onClick={() => setRiskGroupBy('department')}
                  style={{ whiteSpace: 'nowrap', fontSize: 12, padding: '2px 10px' }}
                >🏢 部门</button>
                <button
                  className={`time-filter-btn ${riskGroupBy === 'platform' ? 'time-filter-btn-active' : ''}`}
                  onClick={() => setRiskGroupBy('platform')}
                  style={{ whiteSpace: 'nowrap', fontSize: 12, padding: '2px 10px' }}
                >📦 平台</button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={stackedData} layout="vertical" margin={{ top: 5, right: 20, left: 90, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#eee'} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={85} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => value.toLocaleString()}
                  contentStyle={{ backgroundColor: theme === 'dark' ? '#333' : '#fff', border: 'none', borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="R3" name={RISK_LEVEL_LABELS.R3} stackId="a" fill={RISK_LEVEL_COLORS.R3} barSize={16} />
                <Bar dataKey="R2" name={RISK_LEVEL_LABELS.R2} stackId="a" fill={RISK_LEVEL_COLORS.R2} barSize={16} />
                <Bar dataKey="R1" name={RISK_LEVEL_LABELS.R1} stackId="a" fill={RISK_LEVEL_COLORS.R1} radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 部门 → 平台层级 */}
          <DeptPlatformPanel details={data.deptPlatformDetails} />
        </div>
      </>
    </div>
  );
}

/* ═══ 部门 → 平台层级组件 ═══ */

function DeptPlatformPanel({ details }: { details: import('@/types').IDeptPlatformDetail[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(details.map(d => d.department)));

  const toggle = (dept: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  };

  return (
    <div className="chart-card">
      <h3 className="chart-title">审阅风险明细层级</h3>
      <p className="chart-desc">按部门分组，点击展开查看各平台审阅风险分布</p>
      <div className="dept-platform-list" style={{ maxHeight: 380, overflowY: 'auto' }}>
        {details.map((dept) => (
          <div key={dept.department} className="dept-group">
            <div className="dept-header" onClick={() => toggle(dept.department)}>
              <span className="dept-expand-icon">{expanded.has(dept.department) ? '▼' : '▶'}</span>
              <span className="dept-header-name">{dept.department}</span>
              <span className="dept-header-total">合计 {dept.totalCount.toLocaleString()}</span>
            </div>
            {expanded.has(dept.department) && (
              <div className="dept-platform-table">
                <div className="rank-list-header" style={{ paddingLeft: 32 }}>
                  <span>平台</span>
                  <span style={{ color: RISK_LEVEL_COLORS.R3 }}>R3</span>
                  <span style={{ color: RISK_LEVEL_COLORS.R2 }}>R2</span>
                  <span style={{ color: RISK_LEVEL_COLORS.R1 }}>R1</span>
                  <span>合计</span>
                </div>
                {dept.platforms.map((p, i) => (
                  <div key={p.platform} className="rank-list-row" style={{ paddingLeft: 32 }}>
                    <span className="rank-list-name">
                      {i < 3 && <span className={`rank-badge rank-${i + 1}`}>{i + 1}</span>}
                      {p.platform}
                    </span>
                    <span style={{ color: RISK_LEVEL_COLORS.R3 }}>{p.riskR3.toLocaleString()}</span>
                    <span style={{ color: RISK_LEVEL_COLORS.R2 }}>{p.riskR2.toLocaleString()}</span>
                    <span style={{ color: RISK_LEVEL_COLORS.R1 }}>{p.riskR1.toLocaleString()}</span>
                    <span className="rank-list-total">{p.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
