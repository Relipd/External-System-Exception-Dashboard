import { bitable, workspace } from '@lark-base-open/js-sdk';
import type { IPluginConfig, ITrendRecord } from '@/types';

/**
 * 读取时间趋势表（唯一数据源）的所有记录
 */
export async function loadTrendRecords(
  config: IPluginConfig,
): Promise<ITrendRecord[]> {
  if (!config.trendBaseToken || !config.trendTableId) {
    console.warn('[bitable] 趋势表未配置');
    return [];
  }

  let table: any;
  try {
    table = await bitable.base.getTable(config.trendTableId);
  } catch {
    console.warn('[bitable] 趋势表 bitable.base 失败，回退 workspace');
    const instance = await workspace.getBitable(config.trendBaseToken);
    if (!instance) throw new Error('无法获取趋势表 base 实例');
    table = await instance.base.getTable(config.trendTableId);
  }

  const records: ITrendRecord[] = [];
  const fields = config.trendFields;
  _debugFirstDone = false; // 每次加载都 dump

  // ── DEBUG: 打印字段映射配置 + 首条原始记录 ──
  console.group('%c[bitable] 字段映射诊断', 'color:#f90;font-weight:bold');
  console.log('dateStartFieldId:', fields.dateStartFieldId || '(未配)');
  console.log('dateEndFieldId:', fields.dateEndFieldId || '(未配)');
  console.log('systemCodeFieldId:', fields.systemCodeFieldId || '(未配)');
  console.log('platformFieldId:', fields.platformFieldId || '(未配)');
  console.log('departmentFieldId:', fields.departmentFieldId || '(未配)');
  console.log('reviewCountFieldId:', fields.reviewCountFieldId || '(未配)');
  console.log('pendingCountFieldId:', fields.pendingCountFieldId || '(未配)');
  console.log('shopCountFieldId:', fields.shopCountFieldId || '(未配)');
  console.log('userCountFieldId:', fields.userCountFieldId || '(未配)');
  console.groupEnd();

  let pageToken: number | undefined;
  do {
    let res: any;
    try {
      res = await table.getRecordsByPage({ pageSize: 200, pageToken });
    } catch (err: any) {
      console.error('[bitable] 趋势表 getRecordsByPage 失败:', err?.message || err);
      break;
    }
    if (!res) {
      console.error('[bitable] 趋势表读取返回空，终止分页');
      break;
    }
    const batch = (res?.records ?? []).map((r: any) => mapTrendRecord(r, fields)).filter(Boolean) as ITrendRecord[];
    records.push(...batch);
    pageToken = res?.hasMore ? (res.pageToken ?? undefined) : undefined;
  } while (pageToken !== undefined);

  return records;
}

/* ─── 映射函数 ─── */

/**
 * 双路径读取单元格值：
 * 1. record.fields[id] — 绝大部分字段正常工作
 * 2. record.getCellValue(id) — 某些 lookup 字段 fields 返回 null 时回退
 */
function readCell(record: any, fieldId: string): any {
  if (!fieldId) return undefined;
  const v = record.fields?.[fieldId];
  if (v !== null && v !== undefined) return v;
  if (typeof record.getCellValue === 'function') {
    try { return record.getCellValue(fieldId); } catch { /* ignore */ }
  }
  return v;
}

let _debugFirstDone = false;

function mapTrendRecord(record: any, fields: IPluginConfig['trendFields']): ITrendRecord | null {
  try {
    const raw = record.fields;
    // 优先用 dateStart/dateEnd，兼容旧版 dateFieldId
    const rawDateStart = readCell(record, fields.dateStartFieldId || fields.dateFieldId);
    const rawDateEnd = readCell(record, fields.dateEndFieldId || fields.dateFieldId);
    const dateStart = cellToDateText(rawDateStart);
    const dateEnd = cellToDateText(rawDateEnd);

    const eCounts: Record<string, number> = {};
    for (const code of Object.keys(fields.eFieldIds)) {
      eCounts[code] = cellToNumber(readCell(record, fields.eFieldIds[code]));
    }

    const systemCode = cellToText(readCell(record, fields.systemCodeFieldId));
    const rawPlatform = readCell(record, fields.platformFieldId);
    const platformName = cellToText(rawPlatform);
    const department = cellToText(readCell(record, fields.departmentFieldId));

    // ── DEBUG: 首条记录 dump ──
    if (!_debugFirstDone) {
      _debugFirstDone = true;
      console.group('%c[bitable] 首条原始字段 (getCellValue 回退)', 'color:#0af;font-weight:bold');
      console.log('platformFieldId:', fields.platformFieldId);
      console.log('record.fields[platformFieldId]:', record.fields?.[fields.platformFieldId]);
      if (typeof record.getCellValue === 'function') {
        console.log('record.getCellValue(platformFieldId):', record.getCellValue(fields.platformFieldId));
      } else {
        console.log('record 没有 getCellValue 方法');
      }
      console.log('→ cellToText 结果:', JSON.stringify(platformName));
      console.log('systemCode:', systemCode, '| department:', department);
      const rawShop = readCell(record, fields.shopCountFieldId);
      const rawUser = readCell(record, fields.userCountFieldId);
      console.log('shopCountFieldId:', fields.shopCountFieldId, '| raw:', rawShop, '→', cellToNumber(rawShop));
      console.log('userCountFieldId:', fields.userCountFieldId, '| raw:', rawUser, '→', cellToNumber(rawUser));
      console.groupEnd();
    }

    return {
      date: dateStart,
      dateStart,
      dateEnd,
      department,
      systemCode,
      platformName,
      reviewCount: cellToNumber(readCell(record, fields.reviewCountFieldId)),
      pendingCount: cellToNumber(readCell(record, fields.pendingCountFieldId)),
      overdueCount: cellToNumber(readCell(record, fields.overdueCountFieldId)),
      shopCount: cellToNumber(readCell(record, fields.shopCountFieldId)),
      userCount: cellToNumber(readCell(record, fields.userCountFieldId)),
      eCounts,
    };
  } catch { return null; }
}

/* ─── 单元格值转换工具 ─── */

export function cellToText(cell: any): string {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'number') return String(cell);
  if (typeof cell === 'boolean') return cell ? '是' : '否';
  if (Array.isArray(cell)) {
    return cell.map((c: any) => c.text ?? c.name ?? c.id ?? String(c)).join(', ');
  }
  if (cell.text !== undefined) return String(cell.text);
  if (cell.name !== undefined) return String(cell.name);
  if (cell.id !== undefined) return String(cell.id);
  return String(cell);
}

function cellToNumber(cell: any): number {
  if (cell === null || cell === undefined) return 0;
  if (typeof cell === 'number') return cell;
  if (typeof cell === 'string') return Number(cell) || 0;
  if (Array.isArray(cell)) {
    let sum = 0;
    for (const item of cell) {
      if (typeof item === 'number') sum += item;
      else if (typeof item === 'string') sum += Number(item) || 0;
      else if (item && typeof item === 'object') {
        const v = item.text ?? item.value ?? item.name ?? item.id;
        if (v !== undefined) sum += Number(v) || 0;
      }
    }
    return sum;
  }
  if (cell.text !== undefined) return Number(cell.text) || 0;
  if (cell.value !== undefined) return Number(cell.value) || 0;
  return Number(cell) || 0;
}

function cellToDateText(cell: any): string {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'number') return timestampToDateStr(cell);
  if (typeof cell === 'string') {
    // 10位以上纯数字才视为时间戳，短数字如 "20240623" 直接返回
    if (/^\d{10,}$/.test(cell)) return timestampToDateStr(Number(cell));
    // 统一斜杠为横杠，保证日期格式一致性
    return /^\d{4}[\/-]\d{2}[\/-]\d{2}/.test(cell) ? cell.replace(/\//g, '-') : cell;
  }
  if (cell.text !== undefined) return cellToDateText(cell.text);
  if (cell.value !== undefined) return cellToDateText(cell.value);
  return String(cell);
}

function timestampToDateStr(ms: number): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(new Date(ms));
}