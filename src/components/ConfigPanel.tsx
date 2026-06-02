import React, { useEffect, useCallback, useState } from 'react';
import { Select, Button } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useWorkspace, workspace } from '../workspace';
import type { IPluginConfig } from '../App';
import './ConfigPanel.scss';

interface Props {
  config: IPluginConfig;
  setConfig: (c: IPluginConfig) => void;
}

interface FieldMeta {
  id: string;
  name: string;
}

interface BaseInfo {
  name: string;
  token: string;
}

/** 根据字段名关键词自动匹配字段 ID */
function autoDetectFields(fields: FieldMeta[], cfg: IPluginConfig): Partial<IPluginConfig> {
  const detected: Record<string, string> = {};
  const rules: [string, keyof IPluginConfig][] = [
    ['平台', 'platformFieldId'],
    ['platform', 'platformFieldId'],
    ['风险等级', 'riskLevelFieldId'],
    ['risk', 'riskLevelFieldId'],
    ['状态', 'statusFieldId'],
    ['status', 'statusFieldId'],
    ['创建时间', 'createdAtFieldId'],
    ['created', 'createdAtFieldId'],
    ['date', 'createdAtFieldId'],
  ];

  for (const field of fields) {
    const name = field.name.toLowerCase();
    for (const [keyword, key] of rules) {
      if (name.includes(keyword.toLowerCase()) && !cfg[key]) {
        (detected as any)[key] = field.id;
        break;
      }
    }
  }

  return detected as Partial<IPluginConfig>;
}

export default function ConfigPanel({ config, setConfig }: Props) {
  const { t } = useTranslation();
  const { base: workspaceBase, dashboard: workspaceDashboard, switchBase } = useWorkspace();
  const [baseList, setBaseList] = useState<BaseInfo[]>([]);
  const [tables, setTables] = useState<{ id: string; name: string }[]>([]);
  const [fields, setFields] = useState<FieldMeta[]>([]);

  // 1. 加载多维表格列表
  useEffect(() => {
    workspace.getBaseList({}).then((res: any) => {
      const list = res.base_list.map((b: any) => ({ name: b.name, token: b.token }));
      setBaseList(list);
      // 创建状态或首次加载时默认选中第一个
      if (!config.baseToken && list.length > 0) {
        handleBaseChange(list[0].token);
      }
    });
  }, []);

  // 2. 当 baseToken 变化时切换 workspace
  useEffect(() => {
    if (config.baseToken) {
      switchBase(config.baseToken);
    }
  }, [config.baseToken]);

  // 3. 当 workspace base 实例就绪，加载表列表
  useEffect(() => {
    if (!workspaceBase) return;
    workspaceBase.getTableMetaList().then((list: any) => {
      const mapped = list.map((t: any) => ({ id: t.id, name: t.name }));
      setTables(mapped);
      if (!config.tableId && mapped.length > 0) {
        setConfig({ ...config, tableId: mapped[0].id });
      }
    });
  }, [workspaceBase]);

  // 4. 当 tableId 变化，加载字段列表
  useEffect(() => {
    if (!workspaceBase || !config.tableId) return;
    workspaceBase.getTable(config.tableId).then(async (table: any) => {
      try {
        const view = await table.getActiveView();
        const metas = await view.getFieldMetaList();
        const list = metas.map((m: any) => ({ id: m.id, name: m.name }));
        setFields(list);
        const detected = autoDetectFields(list, config);
        if (Object.keys(detected).length > 0) {
          setConfig({ ...config, ...detected });
        }
      } catch {
        const metas = await table.getFieldMetaList();
        setFields(metas.map((m: any) => ({ id: m.id, name: m.name })));
      }
    });
  }, [workspaceBase, config.tableId]);

  const handleBaseChange = useCallback((token: string) => {
    setConfig({ ...config, baseToken: token, tableId: '' });
  }, [config, setConfig]);

  const handleSave = useCallback(() => {
    const dash = workspaceDashboard;
    if (!dash || typeof dash.saveConfig !== 'function') return;
    dash.saveConfig({
      customConfig: config,
      dataConditions: [
        {
          baseToken: config.baseToken,
          tableId: config.tableId,
        },
      ],
    } as any);
  }, [config, workspaceDashboard]);

  const fieldOptions = fields.map((f) => ({ label: f.name, value: f.id }));
  const tableOptions = tables.map((t) => ({ label: t.name, value: t.id }));
  const baseOptions = baseList.map((b) => ({ label: b.name, value: b.token }));

  return (
    <div className="config-panel">
      <div className="config-form">
        <div className="config-item">
          <label>{t('config.base') || '多维表格'}</label>
          <Select
            value={config.baseToken}
            optionList={baseOptions}
            onChange={(v) => handleBaseChange(v as string)}
            style={{ width: '100%' }}
            filter
          />
        </div>

        <div className="config-item">
          <label>{t('config.table')}</label>
          <Select
            value={config.tableId}
            optionList={tableOptions}
            onChange={(v) => setConfig({ ...config, tableId: v as string })}
            style={{ width: '100%' }}
            filter
          />
        </div>

        <div className="config-item">
          <label>{t('config.field.platform')}</label>
          <Select
            value={config.platformFieldId}
            optionList={fieldOptions}
            onChange={(v) => setConfig({ ...config, platformFieldId: v as string })}
            style={{ width: '100%' }}
            filter
          />
        </div>

        <div className="config-item">
          <label>{t('config.field.riskLevel')}</label>
          <Select
            value={config.riskLevelFieldId}
            optionList={fieldOptions}
            onChange={(v) => setConfig({ ...config, riskLevelFieldId: v as string })}
            style={{ width: '100%' }}
            filter
          />
        </div>

        <div className="config-item">
          <label>{t('config.field.status')}</label>
          <Select
            value={config.statusFieldId}
            optionList={fieldOptions}
            onChange={(v) => setConfig({ ...config, statusFieldId: v as string })}
            style={{ width: '100%' }}
            filter
          />
        </div>

        <div className="config-item">
          <label>{t('config.field.createdAt')}</label>
          <Select
            value={config.createdAtFieldId}
            optionList={fieldOptions}
            onChange={(v) => setConfig({ ...config, createdAtFieldId: v as string })}
            style={{ width: '100%' }}
            filter
          />
        </div>
      </div>

      <div className="config-btn-wrapper">
        <Button theme="solid" className="config-btn" onClick={handleSave}>
          {t('confirm')}
        </Button>
      </div>
    </div>
  );
}
