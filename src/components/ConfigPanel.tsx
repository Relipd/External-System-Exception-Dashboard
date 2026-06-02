import React, { useEffect, useCallback, useState } from 'react';
import { Select, Button } from '@douyinfe/semi-ui';
import { bitable, dashboard } from '@lark-base-open/js-sdk';
import { useTranslation } from 'react-i18next';
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

/** 根据字段名关键词自动匹配字段 ID */
function autoDetectFields(fields: FieldMeta[], config: IPluginConfig): Partial<IPluginConfig> {
  const detected: Record<string, string> = {};
  const rules: [string, keyof IPluginConfig][] = [
    ['平台', 'platformFieldId'],
    ['risk', 'platformFieldId'],
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
      if (name.includes(keyword.toLowerCase()) && !config[key]) {
        detected[key] = field.id;
        break;
      }
    }
  }

  return detected as Partial<IPluginConfig>;
}

export default function ConfigPanel({ config, setConfig }: Props) {
  const { t } = useTranslation();
  const [tables, setTables] = useState<{ id: string; name: string }[]>([]);
  const [fields, setFields] = useState<FieldMeta[]>([]);

  // 加载数据表列表
  useEffect(() => {
    bitable.base.getTableMetaList().then((list) => {
      setTables(list.map((t) => ({ id: t.id, name: t.name })));
      if (!config.tableId && list.length > 0) {
        setConfig({ ...config, tableId: list[0].id });
      }
    });
  }, []);

  // 加载字段列表（使用 View 模块保证字段有序）
  useEffect(() => {
    if (!config.tableId) return;
    bitable.base.getTable(config.tableId).then(async (table) => {
      try {
        const view = await table.getActiveView();
        const metas = await view.getFieldMetaList();
        const list = metas.map((m) => ({ id: m.id, name: m.name }));
        setFields(list);
        // 初次加载时自动匹配字段
        const detected = autoDetectFields(list, config);
        if (Object.keys(detected).length > 0) {
          setConfig({ ...config, ...detected });
        }
      } catch {
        // fallback 到 Table 模块
        const metas = await table.getFieldMetaList();
        setFields(metas.map((m) => ({ id: m.id, name: m.name })));
      }
    });
  }, [config.tableId]);

  const handleSave = useCallback(() => {
    dashboard.saveConfig({
      customConfig: config,
      dataConditions: [
        {
          tableId: config.tableId,
        },
      ],
    } as any);
  }, [config]);

  const fieldOptions = fields.map((f) => ({ label: f.name, value: f.id }));
  const tableOptions = tables.map((t) => ({ label: t.name, value: t.id }));

  return (
    <div className="config-panel">
      <div className="config-form">
        <div className="config-item">
          <label>{t('config.table')}</label>
          <Select
            value={config.tableId}
            optionList={tableOptions}
            onChange={(v) => setConfig({ ...config, tableId: v as string })}
            style={{ width: '100%' }}
            placeholder={t('config.table')}
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
            placeholder={t('config.field.platform')}
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
            placeholder={t('config.field.riskLevel')}
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
            placeholder={t('config.field.status')}
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
            placeholder={t('config.field.createdAt')}
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
