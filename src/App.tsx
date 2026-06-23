import './App.scss';
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { dashboard as defaultDashboard } from '@lark-base-open/js-sdk';
import { Spin, Toast } from '@douyinfe/semi-ui';

import { useTheme, useDashboardState } from '@/hooks';
import { useWorkspace } from '@/workspace';
import { loadTrendRecords } from '@/utils';
import { computeAnalyticsFromTrend, buildWeekOptions, weekRangeToDates, countWeeks, buildScMappings } from '@/utils';
import { getBarColors, ConfigPanel, RiskOverview, buildRiskCodeInfo, StatCard, TrendWarning, PlatformTable } from '@/components';
import type { IPluginConfig, IDashboardAnalytics, ITrendRecord } from '@/types';
import { ANOMALY_CODES } from '@/types';

const DEFAULT_CONFIG: IPluginConfig = {
  trendBaseToken: '', trendTableId: '',
  trendFields: {
    dateStartFieldId: '', dateEndFieldId: '', dateFieldId: '',
    departmentFieldId: '', systemCodeFieldId: '', platformFieldId: '',
    reviewCountFieldId: '', pendingCountFieldId: '', overdueCountFieldId: '',
    shopCountFieldId: '', userCountFieldId: '', eFieldIds: {},
  },
};

type TrendCompact = {
  ds: string; de: string; dept: string; code: string; plat: string;  // ds=dateStart, de=dateEnd
  r: number; p: number; o: number; e: number[];  // e = [E01, E02, ... E09]
  s: number; u: number;
};

export default function App() {
  const { bgColor, theme } = useTheme();
  const { switchBase } = useWorkspace();
  const { isCreate, isConfig } = useDashboardState();
  const isView = !isCreate && !isConfig;

  const [config, setConfig] = useState<IPluginConfig>(DEFAULT_CONFIG);
  const [configLoaded, setConfigLoaded] = useState(false);
  const renderedRef = useRef(false);

  const [trendRecords, setTrendRecords] = useState<ITrendRecord[]>([]);
  const platformMetaRef = useRef<Record<string, { s: number; u: number }>>({});
  const [countMode, setCountMode] = useState<'pending' | 'total' | 'processed'>('pending');
  const [globalDepartments, setGlobalDepartments] = useState<Set<string>>(new Set());

  /* ── 全局周时间筛选（周一 ~ 周日下拉，默认近一个季度） ── */
  const weekOptions = useMemo(() => buildWeekOptions(90), []);
  const [startMonday, setStartMonday] = useState<string>('');
  const [endSunday, setEndSunday] = useState<string>('');
  useEffect(() => {
    if (weekOptions.length > 0 && !startMonday && !endSunday) {
      setStartMonday(weekOptions[weekOptions.length - 1].monday);
      setEndSunday(weekOptions[0].sunday);
    }
  }, [weekOptions.length]);
  const handleStartMonday = (v: string) => {
    setStartMonday(v);
    // 确保起始周一不超过结束周日
    const sOpt = weekOptions.find(t => t.monday === v);
    const eOpt = weekOptions.find(t => t.sunday === endSunday);
    if (sOpt && eOpt && sOpt.monday > eOpt.monday) setEndSunday(sOpt.sunday);
  };
  const handleEndSunday = (v: string) => {
    setEndSunday(v);
    const eOpt = weekOptions.find(t => t.sunday === v);
    const sOpt = weekOptions.find(t => t.monday === startMonday);
    if (sOpt && eOpt && eOpt.monday < sOpt.monday) setStartMonday(eOpt.monday);
  };
  const weekRange = useMemo(() => weekRangeToDates(startMonday, endSunday, weekOptions), [startMonday, endSunday, weekOptions]);
  const weekCount = useMemo(() => countWeeks(startMonday, endSunday, weekOptions), [startMonday, endSunday, weekOptions]);

  /* ── systemCode → { platformName, department } 映射（从全量 records 构建）── */
  const { resolveDept } = useMemo(() => buildScMappings(trendRecords), [trendRecords]);

  const allDepartments = useMemo(
    () => Array.from(new Set(trendRecords.map(r => resolveDept(r)).filter(Boolean))).sort(),
    [trendRecords, resolveDept],
  );
  useEffect(() => {
    if (allDepartments.length > 0 && globalDepartments.size === 0) setGlobalDepartments(new Set(allDepartments));
  }, [allDepartments.length]);

  const toggleGlobalDept = (dept: string) => {
    setGlobalDepartments(prev => {
      const next = new Set(prev);
      if (next.has(dept)) { if (next.size > 1) next.delete(dept); }
      else next.add(dept);
      return next;
    });
  };

  const timeFilteredTrends = useMemo(() => {
    if (trendRecords.length === 0 || !weekRange) return trendRecords;
    return trendRecords.filter(r => r.dateStart >= weekRange.start && r.dateStart <= weekRange.end);
  }, [trendRecords, weekRange]);

  const filteredTrendRecords = useMemo(() => {
    let result = timeFilteredTrends;
    if (globalDepartments.size > 0 && allDepartments.length > 0) result = result.filter(r => globalDepartments.has(resolveDept(r)));
    return result;
  }, [timeFilteredTrends, globalDepartments, allDepartments, resolveDept]);

  const analytics = useMemo<IDashboardAnalytics | null>(
    () => filteredTrendRecords.length > 0 ? computeAnalyticsFromTrend(filteredTrendRecords, countMode) : null,
    [filteredTrendRecords, countMode],
  );

  const overdueCount = useMemo(() => {
    return filteredTrendRecords.reduce((s, r) => s + r.overdueCount, 0);
  }, [filteredTrendRecords]);

  /* ── Phase 1 ── */
  useEffect(() => {
    if (isCreate) { setConfigLoaded(true); return; }
    defaultDashboard.getConfig().then(async (res: any) => {
      const { customConfig, dataConditions } = res;
      if (customConfig) {
        const raw = customConfig as any;
        const rawTrend: any[] = raw._trendData || [];

        const savedTrend: ITrendRecord[] = rawTrend.map((r: any) => {
          const eArr: number[] = r.e || [0,0,0,0,0,0,0,0,0];
          const eCounts: Record<string, number> = {};
          ANOMALY_CODES.forEach((code, i) => { eCounts[code] = eArr[i] || 0; });
          // ds/de 优先，兼容旧版 d 字段
          const ds = r.ds || r.d || '';
          const de = r.de || r.d || '';
          return {
            date: ds,
            dateStart: ds,
            dateEnd: de,
            department: r.department || r.dept || '',
            systemCode: r.systemCode || r.code || '',
            platformName: r.platformName || r.plat || '',
            reviewCount: r.reviewCount ?? r.r ?? 0,
            pendingCount: r.pendingCount ?? r.p ?? 0,
            overdueCount: r.overdueCount ?? r.o ?? 0,
            shopCount: r.shopCount ?? r.s ?? 0,
            userCount: r.userCount ?? r.u ?? 0,
            eCounts,
          };
        });

        const platMeta: Record<string, { s: number; u: number }> = raw._platformMeta || {};
        platformMetaRef.current = platMeta;
        if (Object.keys(platMeta).length > 0) {
          const { resolvePlatform } = buildScMappings(savedTrend);
          for (const r of savedTrend) {
            const meta = platMeta[resolvePlatform(r)];
            if (meta && !r.shopCount && !r.userCount) { r.shopCount = meta.s; r.userCount = meta.u; }
          }
        }

        if (savedTrend.length > 0) setTrendRecords(savedTrend);
        const baseToken = dataConditions?.[0]?.baseToken || '';
        const merged = {
          ...DEFAULT_CONFIG, ...raw,
          trendFields: { ...DEFAULT_CONFIG.trendFields, ...(raw.trendFields || {}), eFieldIds: raw.trendFields?.eFieldIds || {} },
          ...(baseToken && !raw.trendBaseToken ? { trendBaseToken: baseToken } : {}),
        };
        setConfig(merged);
        if (baseToken) await switchBase(baseToken);
      }
      setConfigLoaded(true);
    }).catch(() => { setConfigLoaded(true); });
  }, []);

  /* ── Phase 3 ── */
  const loadData = useCallback(async (cfg: IPluginConfig) => {
    const trendData = cfg.trendTableId
      ? await loadTrendRecords(cfg).catch((err: any) => { console.error('[loadData] 趋势表加载失败:', err); return [] as ITrendRecord[]; })
      : [];
    if (trendData.length > 0) {
      // 合并 platformMeta 到趋势记录（live 数据可能 shopCount/userCount 为 0）
      const pm = platformMetaRef.current;
      if (Object.keys(pm).length > 0) {
        const { resolvePlatform } = buildScMappings(trendData);
        for (const r of trendData) {
          const meta = pm[resolvePlatform(r)];
          if (meta && !r.shopCount && !r.userCount) { r.shopCount = meta.s; r.userCount = meta.u; }
        }
      }
      setTrendRecords(trendData);
    }
    else if (cfg.trendTableId) Toast.error('无法读取趋势表，请检查字段映射');
  }, []);

  useEffect(() => {
    if (configLoaded && isView && config.trendTableId) loadData(config);
  }, [configLoaded, isView]);

  useEffect(() => {
    if (renderedRef.current) return;
    const t = setTimeout(() => { try { defaultDashboard.setRendered(); renderedRef.current = true; } catch {} }, 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isView) return;
    return defaultDashboard.onDataChange(() => { if (config.trendTableId) loadData(config); });
  }, [isView, config, loadData]);

  /* ── 保存 ── */
  const handleSaveConfig = async () => {
    try {
      let trendData: ITrendRecord[] = [];
      if (config.trendBaseToken && config.trendTableId) {
        trendData = await loadTrendRecords(config).catch(() => []);
      }
      const totalOverdue = trendData.reduce((s, r) => s + r.overdueCount, 0);

      // 用映射补全后的平台名作为 platformMeta 的 key
      const { resolvePlatform } = buildScMappings(trendData);
      const platMetaMap = new Map<string, { s: number; u: number }>();
      for (const t of trendData) {
        const plat = resolvePlatform(t);
        if (!platMetaMap.has(plat) || t.shopCount > platMetaMap.get(plat)!.s) {
          platMetaMap.set(plat, { s: t.shopCount, u: t.userCount });
        }
      }

      const meaningful = trendData.filter(t => t.reviewCount > 0 || t.pendingCount > 0);
      const compactData: TrendCompact[] = meaningful.map(t => ({
        ds: t.dateStart, de: t.dateEnd, dept: t.department, code: t.systemCode, plat: t.platformName,
        r: t.reviewCount, p: t.pendingCount, o: t.overdueCount,
        s: t.shopCount, u: t.userCount,
        e: ANOMALY_CODES.map(code => t.eCounts[code] || 0),
      }));

      const CONFIG_LIMIT = 4064;
      const makePayload = (data: TrendCompact[]) => {
        const payload: any = {
          trendBaseToken: config.trendBaseToken, trendTableId: config.trendTableId, trendFields: config.trendFields,
          _trendData: data, _platformMeta: Object.fromEntries(platMetaMap), _totalOverdue: totalOverdue,
        };
        return payload;
      };

      let finalData = compactData;
      if (JSON.stringify(makePayload(finalData)).length > CONFIG_LIMIT) {
        const sorted = [...compactData].sort((a, b) => a.ds.localeCompare(b.ds));
        let truncated: TrendCompact[] = [];
        for (let i = sorted.length - 1; i >= 0; i--) {
          if (JSON.stringify(makePayload([...truncated, sorted[i]])).length <= CONFIG_LIMIT) truncated.unshift(sorted[i]);
          else break;
        }
        finalData = truncated;
        Toast.warning(`趋势数据较大，已保留最近 ${truncated.length} 条`);
      }

      await defaultDashboard.saveConfig({
        customConfig: JSON.parse(JSON.stringify(makePayload(finalData))),
        dataConditions: [{ baseToken: config.trendBaseToken, tableId: config.trendTableId }],
      } as any);
      Toast.success('配置已保存');
      setTrendRecords(trendData);
      // 更新 platformMetaRef 以确保后续 loadData 使用最新元数据
      platformMetaRef.current = Object.fromEntries(platMetaMap);
      loadData(config);
    } catch (err: any) { Toast.error('保存失败：' + (err?.message || '未知错误')); }
  };

  if (!configLoaded) return <div className="app-loading" style={{ backgroundColor: bgColor }}><Spin size="large" /><p>加载中...</p></div>;

  const hasConfig = !!config.trendTableId;
  const hasData = hasConfig && !!analytics;
  const dashboardContent = (
    <>
      {hasConfig && (
        <div className="global-filter-bar">
          <div className="global-filter-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="time-filter-label">📊 处理状态</span>
              {(['pending','processed','total'] as const).map(m => (
                <button key={m} className={`time-filter-btn ${countMode===m?'time-filter-btn-active':''}`} onClick={()=>setCountMode(m)}>
                  {m==='pending'?'待处理':m==='processed'?'完成核查':'历史总计'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="time-filter-label">📅 起始周</span>
              <select className="week-select" value={startMonday} onChange={e => handleStartMonday(e.target.value)}>
                {weekOptions.map(t => <option key={t.monday} value={t.monday}>{t.monday}</option>)}
              </select>
              <span style={{ color: 'var(--text-tertiary)' }}>~</span>
              <span className="time-filter-label">结束周</span>
              <select className="week-select" value={endSunday} onChange={e => handleEndSunday(e.target.value)}>
                {weekOptions.map(t => <option key={t.sunday} value={t.sunday}>{t.sunday}</option>)}
              </select>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 4 }}>{weekCount} 周</span>
            </div>
          </div>
          <div className="global-filter-row">
            <span className="time-filter-label">🏢 部门</span>
            <div className="dept-filter">
              {allDepartments.map((dept,i) => (
                <button key={dept} className={`dept-filter-btn ${globalDepartments.has(dept)?'dept-filter-btn-active':''}`}
                  style={globalDepartments.has(dept)?{borderColor:getBarColors('light')[i%10],color:getBarColors('light')[i%10]}:{}}
                  onClick={()=>toggleGlobalDept(dept)}>{globalDepartments.has(dept)?'✓ ':''}{dept}</button>
              ))}
            </div>
          </div>
        </div>
      )}
      {hasData && (
        <div className="dashboard-content">
          <div className="stat-cards-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 24 }}>
            <StatCard title="异常数量" value={analytics!.totalRemainingCount} subtitle="" color={analytics!.totalRemainingCount > 50 ? '#ff3b30' : 'var(--ccm-chart-B500, #3370ff)'} />
            <StatCard title="🔴 高风险" value={analytics!.highRiskCount} subtitle={buildRiskCodeInfo('R3').codes} subtitleTooltip={buildRiskCodeInfo('R3').tooltips} color="#ff3b30" />
            <StatCard title="🟡 中风险" value={analytics!.midRiskCount} subtitle={buildRiskCodeInfo('R2').codes} subtitleTooltip={buildRiskCodeInfo('R2').tooltips} color="#ff9500" />
            <StatCard title="🟢 低风险" value={analytics!.lowRiskCount} subtitle={buildRiskCodeInfo('R1').codes} subtitleTooltip={buildRiskCodeInfo('R1').tooltips} color="#34c759" />
            <StatCard title="⏰ 已超时" value={overdueCount} subtitle="部门治理超时" color={overdueCount > 0 ? '#ff3b30' : '#34c759'} />
          </div>
          <section className="dashboard-section"><h2 className="section-title">📊 审阅异常风险概览</h2>
            <RiskOverview data={analytics!} hideDeptRanking hideStatCards overdueCount={overdueCount} theme={theme} /></section>
          <section className="dashboard-section"><h2 className="section-title">📈 审阅异常趋势变化</h2>
            {trendRecords.length > 0 && <TrendWarning trendRecords={filteredTrendRecords} weekCount={weekCount} countMode={countMode} theme={theme} rangeStart={weekRange?.start} rangeEnd={weekRange?.end} />}</section>
          {filteredTrendRecords.length > 0 && <section className="dashboard-section"><h2 className="section-title">📋 审阅异常明细表</h2>
            <PlatformTable trendRecords={filteredTrendRecords} countMode={countMode} theme={theme} rangeEnd={weekRange?.end} /></section>}
        </div>
      )}
      {hasConfig && !hasData && (
        <div className="dashboard-content" style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--text-tertiary)' }}>
          <p style={{ fontSize: 24, marginBottom: 12 }}>📭</p>
          <p style={{ fontSize: 14, marginBottom: 4 }}>所选时间范围内暂无数据</p>
          <p style={{ fontSize: 12 }}>请在上方调整起始周或结束周，扩大时间范围再试</p>
        </div>
      )}
    </>
  );

  if (isConfig) return (
    <div className="app app-config-layout" style={{ backgroundColor: bgColor }}>
      <div className="app-config-preview">{dashboardContent}</div>
      <div className="app-config-sidebar"><ConfigPanel config={config} onConfigChange={setConfig} onSave={handleSaveConfig} /></div>
    </div>
  );

  return <div className="app" style={{ backgroundColor: bgColor }}>{dashboardContent}</div>;
}
