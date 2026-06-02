import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
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
}

const WorkspaceCtx = createContext<WorkspaceCtxValue>({
  app: null,
  baseToken: '',
  dashboard: null,
  base: null,
  bridge: null,
  ui: null,
  switchBase: async () => false,
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [app, setApp] = useState<BitableApp | null>(null);
  const [baseToken, setBaseToken] = useState('');

  const switchBase = useCallback(async (token: string) => {
    const instance = await workspace.getBitable(token);
    if (!instance) return false;
    setApp({
      dashboard: instance.dashboard,
      base: instance.base,
      bridge: instance.bridge,
      ui: instance.ui,
    });
    setBaseToken(token);
    return true;
  }, []);

  return (
    <WorkspaceCtx.Provider
      value={{
        app,
        baseToken,
        dashboard: app?.dashboard ?? null,
        base: app?.base ?? null,
        bridge: app?.bridge ?? null,
        ui: app?.ui ?? null,
        switchBase,
      }}
    >
      {children}
    </WorkspaceCtx.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceCtx);
}

export { workspace, DashboardState };
