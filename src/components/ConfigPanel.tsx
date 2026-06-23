import React, { useEffect, useState, useRef } from 'react';
import { Button, Select } from '@douyinfe/semi-ui';
import { workspace } from '@lark-base-open/js-sdk';
import type { IPluginConfig, ITrendFieldMap } from '@/types';
import { ANOMALY_CODES } from '@/types';
import { useWorkspace } from '@/workspace';

interface IFieldInfo { id: string; name: string; }
interface ITableInfo { id: string; name: string; }

interface IConfigPanelProps {
  config: IPluginConfig;
  onConfigChange: (config: IPluginConfig) => void;
  onSave: () => void;
}

export default function ConfigPanel({ config, onConfigChange, onSave }: IConfigPanelProps) {
  const { baseList, loadBaseList } = useWorkspace();

  const [tables, setTables] = useState<ITableInfo[]>([]);
  const [fields, setFields] = useState<IFieldInfo[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const tableCache = useRef<Map<string, ITableInfo[]>>(new Map());

  useEffect(() => { if (baseList.length === 0) loadBaseList(); }, [baseList, loadBaseList]);

  // 选择 base → 拉取表列表
  useEffect(() => {
    if (!config.trendBaseToken) { setTables([]); setFields([]); return; }
    const cached = tableCache.current.get(config.trendBaseToken);
    if (cached) { setTables(cached); return; }
    setTableLoading(true);
    workspace.getBitable(config.trendBaseToken).then((instance: any) => {
      return instance.base.getTableMetaList().then((list: any[]) => {
        const mapped = (list || []).map((t: any) => ({ id: t.id, name: t.name }));
        tableCache.current.set(config.trendBaseToken, mapped);
        setTables(mapped);
      });
    }).catch((err: any) => console.warn('加载表列表失败:', err))
    .finally(() => setTableLoading(false));
  }, [config.trendBaseToken]);

  // 选择表 → 加载字段列表
  useEffect(() => {
    if (!config.trendBaseToken || !config.trendTableId) { setFields([]); return; }
    loadFieldsForTable(config.trendBaseToken, config.trendTableId)
      .then(setFields)
      .catch(() => setFields([]));
  }, [config.trendBaseToken, config.trendTableId]);

  const allConfigured = (): boolean => {
    const f = config.trendFields;
    return !!(f.dateStartFieldId && f.dateEndFieldId && f.departmentFieldId && f.systemCodeFieldId && f.platformFieldId &&
      f.reviewCountFieldId && f.pendingCountFieldId);
  };

  return (
    <div className="config-panel">
      <h2 className="config-title">📊 外部平台异常看板 — 配置</h2>
      <p className="config-desc">选择时间趋势数据表并配置字段映射，完成后点击"保存配置"。</p>

      <section className="config-section">
        <h3 className="config-section-title">📈 时间趋势表</h3>
        <LabelSelect label="选择多维表格" placeholder="选择多维表格..." value={config.trendBaseToken}
          options={baseList.map(b => ({ value: b.token, text: b.name }))}
          onChange={v => onConfigChange({ ...config, trendBaseToken: v, trendTableId: '', trendFields: emptyTrendFields })} />
        {config.trendBaseToken && (
          <LabelSelect label="选择数据表" placeholder={tableLoading ? '加载中...' : '选择数据表...'} value={config.trendTableId}
            options={tables.map(t => ({ value: t.id, text: t.name }))}
            onChange={v => onConfigChange({ ...config, trendTableId: v, trendFields: emptyTrendFields })} />
        )}
        {fields.length > 0 && (
          <div className="config-field-group">
            <p className="config-group-hint">基础字段：</p>
            <FieldSelect label="审阅时间-起" fields={fields} value={config.trendFields.dateStartFieldId}
              onChange={v => onConfigChange({ ...config, trendFields: { ...config.trendFields, dateStartFieldId: v } })} />
            <FieldSelect label="审阅时间-末" fields={fields} value={config.trendFields.dateEndFieldId}
              onChange={v => onConfigChange({ ...config, trendFields: { ...config.trendFields, dateEndFieldId: v } })} />
            <FieldSelect label="部门" fields={fields} value={config.trendFields.departmentFieldId}
              onChange={v => onConfigChange({ ...config, trendFields: { ...config.trendFields, departmentFieldId: v } })} />
            <FieldSelect label="系统编码" fields={fields} value={config.trendFields.systemCodeFieldId}
              onChange={v => onConfigChange({ ...config, trendFields: { ...config.trendFields, systemCodeFieldId: v } })} />
            <FieldSelect label="平台" fields={fields} value={config.trendFields.platformFieldId}
              onChange={v => onConfigChange({ ...config, trendFields: { ...config.trendFields, platformFieldId: v } })} />

            <p className="config-group-hint" style={{ marginTop: 12 }}>数量字段：</p>
            <FieldSelect label="审阅异常总数" fields={fields} value={config.trendFields.reviewCountFieldId}
              onChange={v => onConfigChange({ ...config, trendFields: { ...config.trendFields, reviewCountFieldId: v } })} />
            <FieldSelect label="剩余待处理异常" fields={fields} value={config.trendFields.pendingCountFieldId}
              onChange={v => onConfigChange({ ...config, trendFields: { ...config.trendFields, pendingCountFieldId: v } })} />
            <FieldSelect label="已超时数" fields={fields} value={config.trendFields.overdueCountFieldId}
              onChange={v => onConfigChange({ ...config, trendFields: { ...config.trendFields, overdueCountFieldId: v } })} />
            <FieldSelect label="平台店铺数" fields={fields} value={config.trendFields.shopCountFieldId}
              onChange={v => onConfigChange({ ...config, trendFields: { ...config.trendFields, shopCountFieldId: v } })} />
            <FieldSelect label="平台用户数" fields={fields} value={config.trendFields.userCountFieldId}
              onChange={v => onConfigChange({ ...config, trendFields: { ...config.trendFields, userCountFieldId: v } })} />

            <p className="config-group-hint" style={{ marginTop: 12 }}>异常编码 E01~E09（R1=R3 自动推导）：</p>
            {ANOMALY_CODES.map((code) => (
              <FieldSelect key={code} label={`${code} 风险数`} fields={fields} value={config.trendFields.eFieldIds?.[code] || ''}
                onChange={v => onConfigChange({ ...config, trendFields: { ...config.trendFields, eFieldIds: { ...config.trendFields.eFieldIds, [code]: v } } })} />
            ))}
          </div>
        )}
      </section>

      <Button className="config-save-btn" theme="solid" size="large" disabled={!allConfigured()} onClick={onSave}>保存配置</Button>
      {!allConfigured() && <p className="config-hint">请完成基础字段映射后保存</p>}
    </div>
  );
}

/* ─── 辅助函数 ─── */

async function loadFieldsForTable(baseToken: string, tableId: string): Promise<IFieldInfo[]> {
  const instance = await workspace.getBitable(baseToken);
  if (!instance) return [];
  const table = await instance.base.getTable(tableId);
  let metas: any[];
  try { const view = await table.getActiveView(); metas = await view.getFieldMetaList(); }
  catch { metas = await table.getFieldMetaList(); }
  return (metas || []).map((m: any) => ({ id: m.id, name: m.name })).sort((a, b) => a.name.localeCompare(b.name));
}

function LabelSelect({ label, placeholder, value, options, onChange }: {
  label: string; placeholder: string; value: string; options: { value: string; text: string }[]; onChange: (v: string) => void;
}) {
  return (
    <div className="config-field">
      <label>{label}</label>
      <Select style={{ width: '100%' }} placeholder={placeholder} value={value || undefined} onChange={v => onChange(v as string)}>
        {options.map(opt => <Select.Option key={opt.value} value={opt.value}>{opt.text}</Select.Option>)}
      </Select>
    </div>
  );
}

function FieldSelect({ label, fields, value, onChange }: {
  label: string; fields: IFieldInfo[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="config-field">
      <label>{label}</label>
      <Select style={{ width: '100%' }} placeholder={`选择${label}列...`} value={value || undefined} onChange={v => onChange(v as string)}>
        {fields.map(f => <Select.Option key={f.id} value={f.id}>{f.name}</Select.Option>)}
      </Select>
    </div>
  );
}

const emptyTrendFields: ITrendFieldMap = {
  dateStartFieldId: '', dateEndFieldId: '', dateFieldId: '',
  departmentFieldId: '', systemCodeFieldId: '', platformFieldId: '',
  reviewCountFieldId: '', pendingCountFieldId: '', overdueCountFieldId: '',
  shopCountFieldId: '', userCountFieldId: '',
  eFieldIds: {},
};
