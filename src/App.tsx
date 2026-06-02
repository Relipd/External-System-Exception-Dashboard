import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { dashboard as defaultDashboard, DashboardState } from '@lark-base-open/js-sdk';
import { useTheme } from './hooks';
import { useWorkspace } from './workspace';
import classnames from 'classnames';
import StatCard from './components/StatCard';
import PlatformBarChart from './components/PlatformBarChart';
import TrendLineChart from './components/TrendLineChart';
import RiskPieChart from './components/RiskPieChart';
import StatusPieChart from './components/StatusPieChart';
import ConfigPanel from './components/ConfigPanel';
import { aggregateData } from './utils/aggregation';
import { generateMockRows } from './utils/mock';
import '@lark-base-open/js-sdk/dist/style/dashboard.css';
import './App.scss';

export interface IPluginConfig {
  baseToken?: string;
  tableId: string;
  platformFieldId: string;
  riskLevelFieldId: string;
  statusFieldId: string;
  createdAtFieldId: string;
}

const emptyConfig: IPluginConfig = {
  baseToken: '',
  tableId: '',
  platformFieldId: '',
  riskLevelFieldId: '',
  statusFieldId: '',
  createdAtFieldId: '',
};

const emptyStats = {
  todayExceptions: 0,
  pendingCount: 0,
  pendingFeedbackCount: 0,
  resolvedCount: 0,
  r3Count: 0,
  timeoutCount: 0,
};

const mockConfig: IPluginConfig = {
  baseToken: '',
  tableId: 'mock-table',
  platformFieldId: 'mock-platform',
  riskLevelFieldId: 'mock-risk',
  statusFieldId: 'mock-status',
  createdAtFieldId: 'mock-date',
};

export default function App() {
  const { bgColor } = useTheme();
  const { t } = useTranslation();
  const { base: workspaceBase, dashboard: workspaceDashboard, switchBase } = useWorkspace();

  const isSDKAvailable = typeof defaultDashboard?.getConfig === 'function';
  const isCreate = defaultDashboard?.state === DashboardState.Create;
  const isConfig = defaultDashboard?.state === DashboardState.Config || isCreate;

  const [config, setConfig] = useState<IPluginConfig>(
    isSDKAvailable ? emptyConfig : mockConfig
  );
  const [stats, setStats] = useState(emptyStats);
  const [platformDist, setPlatformDist] = useState<{ platform: string; count: number }[]>([]);
  const [riskDist, setRiskDist] = useState<{ name: string; value: number }[]>([]);
  const [statusDist, setStatusDist] = useState<{ name: string; value: number }[]>([]);
  const [trendData, setTrendData] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);

  // Phase 1: load config using default dashboard, then init workspace
  useEffect(() => {
    if (isCreate || !isSDKAvailable) return;
    defaultDashboard.getConfig().then((res: any) => {
      const { customConfig, dataConditions } = res;
      const baseToken = dataConditions?.[0]?.baseToken || '';
      setConfig((prev) => ({ ...prev, ...customConfig, baseToken }));

      if (baseToken) {
        switchBase(baseToken);
      }
    }).catch(() => {
      console.warn('getConfig failed, using default config');
    }).finally(() => {
      // 必须调用 setRendered，否则飞书会一直显示 loading
      setTimeout(() => {
        try { defaultDashboard.setRendered(); } catch {}
      }, 2000);
    });
  }, []);

  // 从多维表格读取数据并聚合
  const fetchData = useCallback(async (cfg: IPluginConfig) => {
    if (!cfg.tableId || !cfg.platformFieldId) return;
    setLoading(true);
    try {
      let rows: any[][] = [];
      const fieldOrder: string[] = [];
      let platformIdx = -1, riskLevelIdx = -1, statusIdx = -1, createdAtIdx = -1;

      const activeBase = workspaceBase;
      const isActive = typeof activeBase?.getTable === 'function';

      if (isActive) {
        const table = await activeBase.getTable(cfg.tableId);
        const fieldMetaList = await table.getFieldMetaList();
        fieldMetaList.forEach((meta: any, idx: number) => {
          fieldOrder.push(meta.id);
          if (meta.id === cfg.platformFieldId) platformIdx = idx;
          if (meta.id === cfg.riskLevelFieldId) riskLevelIdx = idx;
          if (meta.id === cfg.statusFieldId) statusIdx = idx;
          if (meta.id === cfg.createdAtFieldId) createdAtIdx = idx;
        });

        // 使用 SDK v1.0.0 getRecords 分页获取数据
        const allRecords: any[] = [];
        let pageToken: string | undefined;
        let res: any;
        do {
          res = await table.getRecords({ pageSize: 200, pageToken } as any);
          allRecords.push(...res.records);
          pageToken = res.pageToken;
        } while (res?.hasMore);

        // 将 records 转为 rows[][] 格式（兼容 aggregateData）
        rows = allRecords.map((r: any) => {
          return fieldOrder.map((fid: string) => r.fields?.[fid] ?? null);
        });
      } else {
        console.log('[DEV] SDK not available, using mock data');
        rows = generateMockRows(200);
        platformIdx = 0;
        riskLevelIdx = 1;
        statusIdx = 2;
        createdAtIdx = 3;
      }

      const result = aggregateData(rows, { platformIdx, riskLevelIdx, statusIdx, createdAtIdx });
      setStats(result.stats);
      setPlatformDist(result.platformDistribution);
      setRiskDist(result.riskLevelDistribution);
      setStatusDist(result.statusDistribution);
      setTrendData(result.trendData);
    } catch (e) {
      console.error('Fetch data error:', e);
    } finally {
      setLoading(false);
    }
  }, [workspaceBase]);

  // 配置变更时重新拉取数据
  useEffect(() => {
    if (config.tableId && config.platformFieldId) {
      fetchData(config);
    }
  }, [config, fetchData]);

  // 监听多维表格数据变化实时刷新
  useEffect(() => {
    // 选择当前激活的 dashboard（workspace 已初始化则用 workspace 的实例）
    const activeDashboard = workspaceDashboard || defaultDashboard;
    if (!activeDashboard || typeof activeDashboard.onDataChange !== 'function') return;

    const off = activeDashboard.onDataChange(() => {
      if (config.tableId) fetchData(config);
    });
    return () => off();
  }, [config, fetchData, workspaceDashboard]);

  return (
    <main
      style={{ backgroundColor: bgColor }}
      className={classnames({ 'main-config': isConfig, main: true })}
    >
      <div className="content">
        {!config.tableId || !config.platformFieldId ? (
          <div className="empty-hint">{t('please.config')}</div>
        ) : (
          <div className="dashboard-grid">
            <div className="stats-row">
              <StatCard title={t('stat.today')} value={stats.todayExceptions} icon="Warning" color="#e6a23c" />
              <StatCard title={t('stat.pending')} value={stats.pendingCount} icon="Clock" color="#f56c6c" />
              <StatCard title={t('stat.pendingFeedback')} value={stats.pendingFeedbackCount} icon="ChatDotSquare" color="#409eff" />
              <StatCard title={t('stat.resolved')} value={stats.resolvedCount} icon="CircleCheck" color="#67c23a" />
              <StatCard title={t('stat.r3')} value={stats.r3Count} icon="WarningFilled" color="#f56c6c" />
              <StatCard title={t('stat.timeout')} value={stats.timeoutCount} icon="Timer" color="#909399" />
            </div>

            <div className="charts-row">
              <div className="chart-card">
                <div className="chart-title">{t('chart.platformDist')}</div>
                <PlatformBarChart data={platformDist} />
              </div>
              <div className="chart-card">
                <div className="chart-title">{t('chart.trend')}</div>
                <TrendLineChart data={trendData} />
              </div>
            </div>
            <div className="charts-row">
              <div className="chart-card">
                <div className="chart-title">{t('chart.riskDist')}</div>
                <RiskPieChart data={riskDist} />
              </div>
              <div className="chart-card">
                <div className="chart-title">{t('chart.statusDist')}</div>
                <StatusPieChart data={statusDist} />
              </div>
            </div>
          </div>
        )}
      </div>

      {isConfig && <ConfigPanel config={config} setConfig={setConfig} />}
    </main>
  );
}
