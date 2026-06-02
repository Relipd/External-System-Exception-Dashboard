import { useLayoutEffect, useState, useEffect } from 'react';
import { useWorkspace, DashboardState } from './workspace';

function updateTheme(theme: string) {
  document.body.setAttribute('theme-mode', theme);
}

export function useTheme() {
  const { dashboard } = useWorkspace();
  const [bgColor, setBgColor] = useState('#f4f6f9');

  useLayoutEffect(() => {
    if (!dashboard || typeof dashboard.getTheme !== 'function') return;

    dashboard.getTheme().then((res: any) => {
      setBgColor(res.chartBgColor);
      updateTheme(res.theme.toLocaleLowerCase());
    }).catch(() => {});

    dashboard.onThemeChange((res: any) => {
      setBgColor(res.data.chartBgColor);
      updateTheme(res.data.theme.toLocaleLowerCase());
    });
  }, [dashboard]);

  return { bgColor };
}

export function useConfig(updateConfig: (data: any) => void) {
  const { dashboard } = useWorkspace();
  const isCreate = dashboard?.state === DashboardState.Create;

  useEffect(() => {
    if (isCreate || !dashboard?.getConfig) return;
    dashboard.getConfig().then(updateConfig).catch(() => {});
  }, [dashboard, isCreate, updateConfig]);

  useEffect(() => {
    if (!dashboard?.onConfigChange) return;
    const off = dashboard.onConfigChange((r: any) => updateConfig(r.data));
    return () => off();
  }, [dashboard, updateConfig]);
}

export { DashboardState };
