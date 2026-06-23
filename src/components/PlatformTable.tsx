import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { ITrendRecord } from '@/types';
import { eCountsToRisk, ANOMALY_CODE_MAP, ANOMALY_CODES, RISK_LEVEL_COLORS } from '@/types';
import { buildScMappings } from '@/utils';

/* ─── 组件外常量（避免每次渲染重建） ─── */
const R_KEYS = ['R3','R2','R1'] as const;
const R_LABELS: Record<string, string> = { R3: 'R3 高风险', R2: 'R2 中风险', R1: 'R1 低风险' };

/** 兼容 yyyy-MM-dd 和 yyyy/MM/dd 两种格式 */
function parseDate(s: string): Date {
  return new Date((s || '').replace(/\//g, '-') + 'T00:00:00Z');
}

/* ─── R分组 → E编码映射 ─── */
const R_GROUPS: Record<string, string[]> = { R3: [], R2: [], R1: [] };
for (const [code, info] of Object.entries(ANOMALY_CODE_MAP)) {
  R_GROUPS[info.riskLevel].push(code);
}
for (const r of Object.values(R_GROUPS)) r.sort();

/* ─── E编码 → 颜色 ─── */
const E_COLORS: Record<string, string> = {};
for (const [code, info] of Object.entries(ANOMALY_CODE_MAP)) E_COLORS[code] = RISK_LEVEL_COLORS[info.riskLevel];

interface IRow {
  key: string;
  dept: string;
  plat: string;
  displayPlat: string;
  shop: number; user: number;
  totalReview: number;
  rCounts: { R1: number; R2: number; R3: number };
  eCounts: Record<string, number>;
  userRatio: number;
  highRiskRatio: number;
  isDept: boolean;
}

interface IProps {
  trendRecords: ITrendRecord[];
  countMode: 'pending' | 'total' | 'processed';
  theme: 'light' | 'dark';
  rangeEnd?: string;  // 时间筛选结束日，用于取最接近结束周的店铺/用户数
}

export default function PlatformTable({ trendRecords, countMode, theme, rangeEnd }: IProps) {
  const { resolvePlatform, resolveDept } = useMemo(() => buildScMappings(trendRecords), [trendRecords]);

  const recordsByKey = useMemo(() => {
    const map = new Map<string, ITrendRecord[]>();
    for (const r of trendRecords) {
      const code = resolvePlatform(r);
      const key = `${resolveDept(r)}|${code}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [trendRecords, resolvePlatform, resolveDept]);

  /* ── e分组展开状态 ── */
  const [expandedE, setExpandedE] = useState<Set<string>>(new Set());

  /* ── 共享 Tooltip ── */
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const showTip = useCallback((e: React.MouseEvent, text: string) => {
    setTip({ text, x: e.clientX + 10, y: e.clientY - 30 });
  }, []);
  const hideTip = useCallback(() => setTip(null), []);

  /* ── 聚合（直接对传入的已过滤 records 聚合，不再二次按日期范围过滤） ── */
  const { deptRows, platRowsByDept } = useMemo(() => {
    if (trendRecords.length === 0) return { deptRows: [] as IRow[], platRowsByDept: new Map<string, IRow[]>() };

    const aggMap = new Map<string, { review: number; pending: number; shop: number; user: number; eCounts: Record<string, number> }>();
    for (const [key, recs] of recordsByKey) {
      if (!aggMap.has(key)) { const init: Record<string, number> = {}; ANOMALY_CODES.forEach(c => { init[c] = 0; }); aggMap.set(key, { review: 0, pending: 0, shop: 0, user: 0, eCounts: init }); }
      const en = aggMap.get(key)!;
      // 累加 count 字段
      for (const r of recs) {
        en.review += r.reviewCount; en.pending += r.pendingCount;
        for (const c of ANOMALY_CODES) en.eCounts[c] += r.eCounts[c] || 0;
      }
      // 店铺数/用户数：取 dateEnd 最接近 rangeEnd 的那条记录的值
      if (rangeEnd && recs.length > 0) {
        const targetMs = parseDate(rangeEnd).getTime();
        let best = recs[0];
        let bestDist = Math.abs(parseDate(best.dateEnd).getTime() - targetMs);
        for (let i = 1; i < recs.length; i++) {
          const dist = Math.abs(parseDate(recs[i].dateEnd).getTime() - targetMs);
          if (dist < bestDist) { best = recs[i]; bestDist = dist; }
        }
        en.shop = best.shopCount;
        en.user = best.userCount;
      } else if (recs.length > 0) {
        // 无 rangeEnd 时取 dateEnd 最大的那条
        let best = recs[0];
        for (let i = 1; i < recs.length; i++) {
          if (recs[i].dateEnd > best.dateEnd) best = recs[i];
        }
        en.shop = best.shopCount;
        en.user = best.userCount;
      }
    }

    const platRows: IRow[] = [];
    for (const [key, d] of aggMap) {
      const [dept, code] = key.split('|');
      const recs = recordsByKey.get(key) || [];
      const displayPlat = code;  // code 已由 resolvePlat 补全为平台名
      const risk = eCountsToRisk(d.eCounts);
      const totalRisk = risk.R1 + risk.R2 + risk.R3;
      const mc = countMode === 'pending' ? d.pending : countMode === 'total' ? d.review : d.review - d.pending;
      const ratio = d.review > 0 ? (countMode === 'pending' ? d.pending / d.review : countMode === 'total' ? 1 : (d.review - d.pending) / d.review) : 0;
      platRows.push({
        key, dept, plat: code, displayPlat, isDept: false,
        shop: d.shop, user: d.user,
        totalReview: mc,
        rCounts: { R1: Math.round(risk.R1 * ratio), R2: Math.round(risk.R2 * ratio), R3: Math.round(risk.R3 * ratio) },
        userRatio: d.user > 0 ? mc / d.user : 0,
        highRiskRatio: totalRisk > 0 ? Math.round(risk.R3 * ratio) / Math.max(Math.round(totalRisk * ratio), 1) : 0,
        eCounts: d.eCounts,
      });
    }

    const byDept = new Map<string, IRow[]>();
    const deptAgg = new Map<string, IRow>();
    for (const row of platRows) {
      if (!byDept.has(row.dept)) byDept.set(row.dept, []);
      byDept.get(row.dept)!.push(row);
      if (!deptAgg.has(row.dept)) {
        const init: Record<string, number> = {}; ANOMALY_CODES.forEach(c => { init[c] = 0; });
        deptAgg.set(row.dept, { key: row.dept, dept: row.dept, plat: '', displayPlat: '', isDept: true, shop: 0, user: 0, totalReview: 0, rCounts: { R1: 0, R2: 0, R3: 0 }, userRatio: 0, highRiskRatio: 0, eCounts: init });
      }
      const da = deptAgg.get(row.dept)!;
      da.totalReview += row.totalReview;
      da.shop += row.shop;
      da.user += row.user;
      da.rCounts.R1 += row.rCounts.R1; da.rCounts.R2 += row.rCounts.R2; da.rCounts.R3 += row.rCounts.R3;
      for (const c of ANOMALY_CODES) da.eCounts[c] += row.eCounts[c] || 0;
    }
    for (const da of deptAgg.values()) {
      da.highRiskRatio = da.totalReview > 0 ? da.rCounts.R3 / da.totalReview : 0;
      da.userRatio = da.user > 0 ? da.totalReview / da.user : 0;
    }
    const deptRows = Array.from(deptAgg.values()).sort((a, b) => b.totalReview - a.totalReview);
    return { deptRows, platRowsByDept: byDept };
  }, [recordsByKey, trendRecords, countMode]);

  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  useEffect(() => { if (deptRows.length > 0) setExpandedDepts(new Set(deptRows.map(d => d.dept))); }, [deptRows.length]);

  const visibleRows = useMemo(() => {
    const r: IRow[] = [];
    for (const d of deptRows) { r.push(d); if (expandedDepts.has(d.dept)) r.push(...(platRowsByDept.get(d.dept) || []).sort((a, b) => b.totalReview - a.totalReview)); }
    return r;
  }, [deptRows, platRowsByDept, expandedDepts]);

  if (deptRows.length === 0) return <div style={{ padding: 24, textAlign: 'center', color: '#999', fontSize: 13 }}>所选范围内暂无数据</div>;

  const isDark = theme === 'dark'; const bc = isDark ? '#444' : '#eee'; const tc = isDark ? '#ccc' : '#333'; const hbg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)';

  function riskStatus(r3: number, ratio: number): { label: string; color: string } {
    if (r3 === 0 && ratio < 0.10) return { label: '✓ 正常', color: '#34c759' };
    if (ratio > 0.30) return { label: '⚠ 重点关注', color: '#ff3b30' };
    return { label: '● 持续关注', color: '#ff9500' };
  }

  const tdStyle = (extra?: any): React.CSSProperties => ({ padding: '6px 10px', borderBottom: `1px solid ${bc}`, whiteSpace: 'nowrap', textAlign: 'center', ...extra });
  const thStyle = (extra?: any): React.CSSProperties => ({ padding: '7px 8px', textAlign: 'center', fontWeight: 600, color: tc, borderBottom: `2px solid ${bc}`, whiteSpace: 'nowrap', fontSize: 11, ...extra });

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: hbg }}>
              <th style={thStyle({ textAlign: 'left', minWidth: 100 })}>部门</th>
              <th style={thStyle({ minWidth: 64 })}>店铺数</th>
              <th style={thStyle({ minWidth: 64 })}>用户数</th>
              <th style={thStyle({ minWidth: 72 })}>异常总数</th>
              {R_KEYS.map(r => (
                <th key={r} colSpan={expandedE.has(r) ? R_GROUPS[r].length + 1 : 1}
                  style={thStyle({ color: RISK_LEVEL_COLORS[r], cursor: 'pointer', minWidth: expandedE.has(r) ? undefined : 64 })}
                  onClick={() => setExpandedE(prev => { const n = new Set(prev); if (n.has(r)) n.delete(r); else n.add(r); return n; })}
                >{expandedE.has(r) ? '▾ ' : '▸ '}{R_LABELS[r]}</th>
              ))}
              <th style={thStyle({ minWidth: 76 })}>审阅异常占比</th>
              <th style={thStyle({ minWidth: 72 })}>高风险占比</th>
              <th style={thStyle({ minWidth: 72 })}>风险状态</th>
            </tr>
            {/* E编码子列头 */}
            {(R_KEYS).some(r => expandedE.has(r)) && (
              <tr style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                <th/><th/><th/><th/>
                {(R_KEYS).map(r => expandedE.has(r) ? (
                  <React.Fragment key={r}>
                    <th style={thStyle({ color: RISK_LEVEL_COLORS[r], fontSize: 10, minWidth: 44, borderBottom: `1px solid ${bc}` })}>{r}</th>
                    {R_GROUPS[r].map(ec => <th key={ec} onMouseEnter={e => showTip(e, `${ec}: ${ANOMALY_CODE_MAP[ec].type}`)} onMouseLeave={hideTip}
                      style={thStyle({ color: E_COLORS[ec], fontSize: 10, minWidth: 40, borderBottom: `1px solid ${bc}`, cursor: 'help' })}>{ec}</th>)}
                  </React.Fragment>
                ) : <th key={r}/>)}
                <th/><th/><th/>
              </tr>
            )}
          </thead>
          <tbody>
            {visibleRows.map((row, i) => (
              <tr key={row.key + (row.isDept ? '-d' : '-p')}
                style={{ background: row.isDept ? hbg : (i % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)')) }}>
                {/* 部门/平台 */}
                <td style={tdStyle({ textAlign: 'left' })}>
                  {row.isDept
                    ? <span style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13, color: tc }} onClick={() => setExpandedDepts(prev => { const n = new Set(prev); if (n.has(row.dept)) n.delete(row.dept); else n.add(row.dept); return n; })}>
                        {expandedDepts.has(row.dept) ? '▼' : '▶'} {row.dept}</span>
                    : <span style={{ paddingLeft: 20, color: tc }}>{row.displayPlat}</span>}
                </td>
                {/* 店铺数 */}
                <td style={tdStyle({ fontWeight: row.isDept ? 700 : 400 })}>{row.shop.toLocaleString()}</td>
                {/* 用户数 */}
                <td style={tdStyle({ fontWeight: row.isDept ? 700 : 400 })}>{row.user.toLocaleString()}</td>
                {/* 异常总数 */}
                <td style={tdStyle({ fontWeight: row.isDept ? 700 : 400 })}>{row.totalReview.toLocaleString()}</td>
                {/* R分组 + E子列 */}
                {(R_KEYS).map(r => {
                  const rVal = row.rCounts[r];
                  return (
                    <React.Fragment key={r}>
                      <td style={tdStyle({ fontWeight: row.isDept ? 700 : 400 })}>{rVal.toLocaleString()}</td>
                      {expandedE.has(r) && R_GROUPS[r].map(ec => (
                        <td key={ec} onMouseEnter={e => showTip(e, `${ec}: ${ANOMALY_CODE_MAP[ec].type}`)} onMouseLeave={hideTip}
                          style={tdStyle({ fontSize: 11 })}>{(row.eCounts[ec] || 0).toLocaleString()}</td>
                      ))}
                    </React.Fragment>
                  );
                })}
                {/* 审阅异常占比 */}
                <td style={tdStyle({ fontWeight: row.isDept ? 700 : 400 })}>{row.user > 0 ? `${(row.userRatio * 100).toFixed(1)}%` : '-'}</td>
                {/* 高风险占比 */}
                <td style={tdStyle({ fontWeight: row.isDept ? 700 : 400 })}>{row.totalReview > 0 ? `${Math.round(row.highRiskRatio * 100)}%` : '-'}</td>
                {/* 风险状态 */}
                <td style={tdStyle({ fontWeight: 600 })}>{(() => { const s = riskStatus(row.rCounts.R3, row.highRiskRatio); return <span style={{ color: s.color }}>{s.label}</span>; })()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: 'right', marginTop: 6, fontSize: 11, color: '#999' }}>
          口径：{countMode === 'pending' ? '待处理' : countMode === 'processed' ? '完成核查' : '历史总计'} | 共 {deptRows.length} 个部门
        </div>
      </div>
      {/* 共享浮层 Tooltip */}
      {tip && (
        <div ref={tipRef} style={{
          position: 'fixed', left: tip.x, top: tip.y, zIndex: 9999,
          background: '#fff', color: '#333', padding: '5px 10px', borderRadius: 6,
          fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
          boxShadow: '0 2px 10px rgba(0,0,0,.15)', border: '1px solid #e5e5e5',
          pointerEvents: 'none', transition: 'opacity 0.1s',
        }}>{tip.text}</div>
      )}
    </div>
  );
}
