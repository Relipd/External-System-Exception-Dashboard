import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { dashboard, DashboardState, bitable } from '@lark-base-open/js-sdk';
import { useTheme, useConfig } from './hooks';
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
  tableId: string;
  platformFieldId: string;
  riskLevelFieldId: string;
  statusFieldId: string;
  createdAtFieldId: string;
}

const emptyConfig: IPluginConfig = {
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

// 本地开发时自动使用 mock 配置
const mockConfig: IPluginConfig = {
  tableId: 'mock-table',
  platformFieldId: 'mock-platform',
  riskLevelFieldId: 'mock-risk',
  statusFieldId: 'mock-status',
  createdAtFieldId: 'mock-date',
};

export default function App() {
  const { bgColor } = useTheme();
  const { t } = useTranslation();

  const isSDKAvailable = typeof dashboard?.getConfig === 'function';
  const isCreate = dashboard?.state === DashboardState.Create;
  const isConfig = dashboard?.state === DashboardState.Config || isCreate;

  const [config, setConfig] = useState<IPluginConfig>(
    isSDKAvailable ? emptyConfig : mockConfig
  );
  const [stats, setStats] = useState(emptyStats);
  const [platformDist, setPlatformDist] = useState<{ platform: string; count: number }[]>([]);
  const [riskDist, setRiskDist] = useState<{ name: string; value: number }[]>([]);
  const [statusDist, setStatusDist] = useState<{ name: string; value: number }[]>([]);
  const [trendData, setTrendData] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载配置
  useConfig((res) => {
    const { customConfig } = res;
    if (customConfig) {
      setConfig(customConfig);
      setTimeout(() => dashboard.setRendered(), 3000);
    }
  });

  // 从多维表格读取数据并聚合
  const fetchData = useCallback(async (cfg: IPluginConfig) => {
    if (!cfg.tableId || !cfg.platformFieldId) return;
    setLoading(true);
    try {
      let rows: any[][] = [];
      let platformIdx = -1, riskLevelIdx = -1, statusIdx = -1, createdAtIdx = -1;

      // 检测 SDK 是否可用（本地开发时不可用）
      const isSDKAvailable = typeof bitable?.base?.getTable === 'function';

      if (isSDKAvailable) {
        const table = await bitable.base.getTable(cfg.tableId);
        const fieldMetaList = await table.getFieldMetaList();
        const fieldIdToIdx = new Map<string, number>();
        fieldMetaList.forEach((meta, idx) => fieldIdToIdx.set(meta.id, idx));

        platformIdx = fieldIdToIdx.get(cfg.platformFieldId) ?? -1;
        riskLevelIdx = fieldIdToIdx.get(cfg.riskLevelFieldId) ?? -1;
        statusIdx = fieldIdToIdx.get(cfg.statusFieldId) ?? -1;
        createdAtIdx = fieldIdToIdx.get(cfg.createdAtFieldId) ?? -1;

        if (dashboard.state === DashboardState.Create || dashboard.state === DashboardState.Config) {
          const previewData = await (table as any).getPreviewData();
          rows = previewData?.records || [];
        } else {
          const data = await (table as any).getData();
          rows = data?.records || [];
        }
      } else {
        // 本地开发：使用 mock 数据（列顺序：平台=0, 风险等级=1, 状态=2, 创建时间=3）
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
  }, []);

  // 配置变更时重新拉取数据
  useEffect(() => {
    if (config.tableId && config.platformFieldId) {
      fetchData(config);
    }
  }, [config, fetchData]);

  // 监听多维表格数据变化实时刷新
  useEffect(() => {
    if (typeof dashboard?.onDataChange !== 'function') return;
    const off = dashboard.onDataChange(() => {
      if (config.tableId) fetchData(config);
    });
    return () => off();
  }, [config, fetchData]);

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
            {/* 统计卡片行 */}
            <div className="stats-row">
              <StatCard title={t('stat.today')} value={stats.todayExceptions} icon="Warning" color="#e6a23c" />
              <StatCard title={t('stat.pending')} value={stats.pendingCount} icon="Clock" color="#f56c6c" />
              <StatCard title={t('stat.pendingFeedback')} value={stats.pendingFeedbackCount} icon="ChatDotSquare" color="#409eff" />
              <StatCard title={t('stat.resolved')} value={stats.resolvedCount} icon="CircleCheck" color="#67c23a" />
              <StatCard title={t('stat.r3')} value={stats.r3Count} icon="WarningFilled" color="#f56c6c" />
              <StatCard title={t('stat.timeout')} value={stats.timeoutCount} icon="Timer" color="#909399" />
            </div>

            {/* 图表区域 */}
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
