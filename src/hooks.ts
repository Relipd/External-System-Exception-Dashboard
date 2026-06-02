import { DashboardState, dashboard } from '@lark-base-open/js-sdk';
import { useLayoutEffect, useState, useEffect } from 'react';

function updateTheme(theme: string) {
  document.body.setAttribute('theme-mode', theme);
}

/** 跟随飞书主题色变化 */
export function useTheme() {
  const [bgColor, setBgColor] = useState('#f4f6f9');

  useLayoutEffect(() => {
    if (typeof dashboard?.getTheme !== 'function') return;

    dashboard.getTheme().then((res) => {
      setBgColor(res.chartBgColor);
      updateTheme(res.theme.toLocaleLowerCase());
    }).catch(() => {});

    dashboard.onThemeChange((res) => {
      setBgColor(res.data.chartBgColor);
      updateTheme(res.data.theme.toLocaleLowerCase());
    });
  }, []);

  return { bgColor };
}

/** 初始化、更新 config */
export function useConfig(updateConfig: (data: any) => void) {
  const isCreate = dashboard?.state === DashboardState.Create;

  useEffect(() => {
    if (isCreate) return;
    if (typeof dashboard?.getConfig !== 'function') return;
    dashboard.getConfig().then(updateConfig).catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof dashboard?.onConfigChange !== 'function') return;
    const offConfigChange = dashboard.onConfigChange((r) => {
      updateConfig(r.data);
    });
    return () => { offConfigChange(); };
  }, []);
}

export { dashboard, DashboardState };
