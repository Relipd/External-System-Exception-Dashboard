import { dashboard as defaultDashboard, DashboardState } from '@lark-base-open/js-sdk';
import { useEffect, useLayoutEffect, useReducer, useState } from 'react';

/**
 * 跟随主题色变化
 */
export function useTheme() {
  const [bgColor, setBgColor] = useState('#ffffff');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useLayoutEffect(() => {
    defaultDashboard.getTheme().then((res: { chartBgColor: string; theme: string }) => {
      setBgColor(res.chartBgColor);
      setTheme(res.theme.toLowerCase() as 'light' | 'dark');
    });
    defaultDashboard.onThemeChange((res: { data: { chartBgColor: string; theme: string } }) => {
      setBgColor(res.data.chartBgColor);
      setTheme(res.data.theme.toLowerCase() as 'light' | 'dark');
    });
  }, []);

  return { bgColor, theme };
}

/**
 * 仪表盘状态 Hook
 * 和 Instructor 项目一致：每次渲染直接读 dashboard.state，保证状态实时同步
 * 用 onConfigChange 触发重新渲染
 */
export function useDashboardState() {
  // 用 counter 强制刷新（onConfigChange 时递增）
  const [refreshKey, forceRefresh] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const off = defaultDashboard.onConfigChange(() => {
      forceRefresh();
    });
    return () => off();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const state = defaultDashboard.state;
  const isCreate = state === DashboardState.Create;
  const isConfig = state === DashboardState.Config || isCreate;
  const isView = state === DashboardState.View;

  return { state, isCreate, isConfig, isView };
}
