import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { workspace, DashboardState } from '@lark-base-open/js-sdk';

interface BitableApp {
  dashboard: any;
  base: any;
  bridge: any;
  ui: any;
}

interface WorkspaceCtxValue {
  app: BitableApp | null;
  baseToken: string;
  dashboard: any;
  base: any;
  bridge: any;
  ui: any;
  switchBase: (token: string) => Promise<boolean>;
  baseList: { name: string; token: string }[];
  loadBaseList: () => Promise<void>;
}

const WorkspaceCtx = createContext<WorkspaceCtxValue>({
  app: null,
  baseToken: '',
  dashboard: null,
  base: null,
  bridge: null,
  ui: null,
  switchBase: async () => false,
  baseList: [],
  loadBaseList: async () => {},
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [app, setApp] = useState<BitableApp | null>(null);
  const [baseToken, setBaseToken] = useState('');
  const [baseList, setBaseList] = useState<{ name: string; token: string }[]>([]);

  const loadBaseList = useCallback(async () => {
    try {
      const res = await workspace.getBaseList({});
      const list = (res.base_list || []).map((b: any) => ({
        name: b.name,
        token: b.token,
      }));
      setBaseList(list);
    } catch (e) {
      console.warn('loadBaseList failed:', e);
    }
  }, []);

  const switchBase = useCallback(async (token: string) => {
    if (!token) return false;
    try {
      const instance = await workspace.getBitable(token);
      if (!instance) return false;
      // 直接 setApp，ConfigPanel 不依赖 switchBase 的同步效果
      setApp({
        dashboard: instance.dashboard,
        base: instance.base,
        bridge: instance.bridge,
        ui: instance.ui,
      });
      setBaseToken(token);
      return true;
    } catch (e) {
      console.warn('switchBase failed:', e);
      return false;
    }
  }, []);

  const ctxValue = useMemo(() => ({
    app,
    baseToken,
    dashboard: app?.dashboard ?? null,
    base: app?.base ?? null,
    bridge: app?.bridge ?? null,
    ui: app?.ui ?? null,
    switchBase,
    baseList,
    loadBaseList,
  }), [app, baseToken, baseList, switchBase, loadBaseList]);

  return (
    <WorkspaceCtx.Provider value={ctxValue}>
      {children}
    </WorkspaceCtx.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceCtx);
}
