# 外部平台异常看板 — 改动总结

> 本文档记录近期对「飞书多维表格 Dashboard 插件」的一系列数据逻辑、时间筛选、平台映射、UI 调整改动。
> 生成时间：2026-06-23

---

## 一、技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18 | UI 框架 |
| TypeScript | 5.4 | 类型安全 |
| Vite | 5 | 构建（dev 默认端口 5176） |
| Semi UI | 2.58 | UI 组件库 |
| Recharts | 2.12 | 图表（折线/柱状/堆叠） |
| @lark-base-open/js-sdk | 1.0.0 | 飞书 Dashboard SDK（必须 1.0.0 稳定版） |
| sass | 1.77 | 样式（含弃用警告，不影响功能） |

**调试地址**：`http://10.221.136.231:5176/`（本机局域网 IP，填入飞书开发者后台调试模式）

---

## 二、数据架构（单数据源）

唯一数据源 = 时间趋势表。每条记录 = 某部门某平台在某时点的审阅异常快照。

### 关键字段

| 字段 | 说明 |
|------|------|
| dateStart / dateEnd | 审阅时间-起（周一）/ 审阅时间-末（周日） |
| systemCode | 系统编码（**1:1 稳定键**，对应平台和部门） |
| platformName | 平台名称（仅用于显示，SDK 可能读不到） |
| department | 归属部门（多个 systemCode 聚合到同一部门） |
| reviewCount / pendingCount / overdueCount | 审阅异常总数 / 待处理 / 已超时 |
| shopCount / userCount | 平台店铺数 / 用户数 |
| E01~E09 | 9 类异常各自数量（R 值由 E 自动推导） |

### 数据关系

```
systemCode (权限中心)  ←1:1→  platformName (平台)
systemCode (权限中心)  ←1:1→  department (部门)
多个 systemCode        ←N:1→  同一个 department（部门聚合）
```

---

## 三、改动详情

### 3.1 趋势图聚合覆盖 Bug 修复

**文件**：`src/utils/analytics.ts` — `computeTrendChartData`

**问题**：趋势图按 department 聚合时，同一 `date + department` 下存在多条记录（不同 platform），原代码用 `=` 直接覆盖，导致显示结果取决于记录排序，改变时间范围后数据就变了。

**修复**：改为累加 `+=`。

```typescript
// ❌ 旧：覆盖
dm.get(r.date)![gn] = countMode === 'pending' ? r.pendingCount : ...

// ✅ 新：累加
const val = countMode === 'pending' ? r.pendingCount : ...;
dm.get(r.dateStart)![gn] = ((dm.get(r.dateStart)![gn] as number) || 0) + val;
```

---

### 3.2 时间筛选：周四 → 周一/周日

**文件**：`src/utils/analytics.ts`、`src/App.tsx`、`src/utils/index.ts`

**改动**：下拉框从显示周四改为显示周一（起始周）/ 周日（结束周）。

| 旧 | 新 |
|---|---|
| `buildThursdayOptions()` → `{monday, thursday}` | `buildWeekOptions()` → `{monday, sunday}` |
| `thursdayRangeToDates(startThu, endThu)` | `weekRangeToDates(startMonday, endSunday)` |
| `countWeeks(startThu, endThu)` | `countWeeks(startMonday, endSunday)` |
| 下拉显示周四 | 起始周显示周一、结束周显示周日 |

周之间的交叉校验逻辑同步更新（选起始周一时自动调整结束周日，反之亦然）。

---

### 3.3 空数据时筛选栏不消失

**文件**：`src/App.tsx`

**问题**：选到无数据的时间范围时，`analytics` 为 `null`，`hasData` 变 `false`，整个界面（含筛选栏）消失，用户被困住。

**修复**：筛选栏用独立的 `hasConfig` 控制（只检查是否配了表），数据区独立处理空态。

```
hasConfig ──→ 筛选栏（始终可见）
hasData  ──→ 数据区
hasConfig && !hasData ──→ 空态提示
```

---

### 3.4 趋势图聚合粒度三档

**文件**：`src/components/TrendWarning.tsx`

**改动**：从两档（≤8 周按周，>8 周按月）改为三档：

| 时间跨度 | 聚合粒度 |
|---------|---------|
| ≤6 周 | 按天 |
| 7~25 周 | 按周 |
| >25 周 | 按月 |

---

### 3.5 趋势图补齐到选择范围边界

**文件**：`src/components/TrendWarning.tsx`、`src/App.tsx`

**问题**：补齐范围用数据实际起止日期，数据到 5/4 就停了，图表也停在 5/4。

**修复**：`TrendWarning` 新增 `rangeStart` / `rangeEnd` props，由 `App.tsx` 传入全局筛选的起止日期，补齐到选择范围边界（空白区域填 0）。

---

### 3.6 双日期字段（审阅时间-起 / 审阅时间-末）

**文件**：`src/types/index.ts`、`src/utils/bitable.ts`、`src/utils/analytics.ts`、`src/App.tsx`、`src/components/ConfigPanel.tsx`

**改动**：从单日期字段改为双日期字段。

- `ITrendFieldMap` 新增 `dateStartFieldId` / `dateEndFieldId`
- `ITrendRecord` 新增 `dateStart` / `dateEnd`，保留 `date` 兼容
- `mapTrendRecord` 分别读 `dateStartFieldId` / `dateEndFieldId`，fallback 到旧 `dateFieldId`
- 时间筛选、排序、分组键从 `r.date` 切换为 `r.dateStart`（周一）
- `TrendCompact` 从 `d` 改为 `ds`/`de`，配置持久化读写兼容旧格式
- 配置面板"审阅时间"拆为"审阅时间-起" + "审阅时间-末"

---

### 3.7 systemCode 统一映射（核心）

**文件**：`src/utils/analytics.ts`（新增 `buildScMappings`）、`src/components/PlatformTable.tsx`、`src/App.tsx`

**问题**：四个地方各自实现了不同的 systemCode 映射逻辑，不一致导致平台/部门分组分裂。

**修复**：提取共享工具 `buildScMappings(records, platformMap?)`，返回 `resolvePlatform` / `resolveDept`，四个消费点统一调用：

| 消费点 | 之前 | 现在 |
|--------|------|------|
| `computeAnalyticsFromTrend` | 自己实现 | `buildScMappings(records, platformMap)` |
| `computeTrendChartData` | 简陋 first-match | `buildScMappings(records)` |
| `PlatformTable` | 复制一份 | `buildScMappings(trendRecords, platformMap)` |
| `App.tsx` | 简陋 first-match | `buildScMappings(trendRecords, config.platformMap)` |

**解析优先级**：

```
平台名 = record 的 platformName 字段
       → 手动映射表 (config.platformMap)
       → 同 systemCode 其他记录的 platformName
       → systemCode（兜底）

部门   = record 的 department 字段
       → 同 systemCode 其他记录的 department
       → '未知'
```

---

### 3.8 平台名称手动映射（platformMap）

**文件**：`src/types/index.ts`、`src/utils/analytics.ts`、`src/App.tsx`、`src/components/ConfigPanel.tsx`、`src/components/PlatformTable.tsx`

**背景**：飞书 SDK 对**查找引用（lookup）字段**返回 `null`。当平台 lookup 字段的源表无数据时，`platformName` 始终为空，只能 fallback 到 systemCode（如 `QNSJGZT`），无法显示中文名。

**解决方案**：在配置面板新增「🏷️ 平台名称映射」文本框，用户粘贴 JSON：

```json
{"QNSJGZT": "企业资质", "DYXD": "抖音小店"}
```

- `IPluginConfig` 新增 `platformMap?: Record<string, string>`
- `buildScMappings` 接收 `platformMap` 参数，`resolvePlatform` 优先查映射表
- `computeAnalyticsFromTrend` 和 `PlatformTable` 透传 `platformMap`
- **保存时写入 `customConfig`**（关键修复：之前只存内存，View 模式加载不到）

---

### 3.9 单元格读取双路径（getCellValue 回退）

**文件**：`src/utils/bitable.ts`

**改动**：新增 `readCell()` 函数，当 `record.fields[id]` 返回 `null` 时，自动回退到 `record.getCellValue(id)`。

```typescript
function readCell(record: any, fieldId: string): any {
  if (!fieldId) return undefined;
  const v = record.fields?.[fieldId];
  if (v !== null && v !== undefined) return v;
  if (typeof record.getCellValue === 'function') {
    try { return record.getCellValue(fieldId); } catch { /* ignore */ }
  }
  return v;
}
```

所有字段读取统一改用 `readCell`（dateStart/dateEnd、systemCode、platformName、department、各 count、E 编码）。

> 注：实测 `getCellValue` 对某些 lookup 仍返回 null（SDK 限制），最终靠 `platformMap` 手动映射解决。

---

### 3.10 审阅风险明细层级顺序交换

**文件**：`src/components/RiskOverview.tsx`

**改动**：右侧面板从「平台 → 部门」改为「**部门 → 平台**」。展开部门可看到下属各平台的 R1/R2/R3 分布。

- 组件 `PlatformDeptPanel` → `DeptPlatformPanel`
- 数据源 `data.platformDeptDetails` → `data.deptPlatformDetails`
- 表头列名「部门」→「平台」

---

### 3.11 其他清理

| 项 | 说明 |
|----|------|
| `cellToNumber` 数组 fallback | 求和为 0 时不再错误返回 `cell.length`，直接返回 `0` |
| `overdueCount` 口径 | 始终从 `filteredTrendRecords` 计算，移除全量 `savedTotalOverdue` fallback |
| `platformMeta` key | 保存/加载时用 `resolvePlatform(r)` 作为 key，确保 shopCount/userCount 正确匹配 |
| 调试代码 | 移除 `computeAnalyticsFromTrend` 中的 `console.group` 调试块 |
| 死代码 | `mondayToThursday` 从导出中移除 |

---

## 四、文件改动清单

| 文件 | 主要改动 |
|------|---------|
| `src/types/index.ts` | `ITrendFieldMap` 双日期字段、`ITrendRecord` 双日期、`IPluginConfig.platformMap` |
| `src/utils/bitable.ts` | `readCell` 双路径读取、`mapTrendRecord` 重构、`cellToNumber` 修复 |
| `src/utils/analytics.ts` | `buildScMappings` 共享工具、`computeAnalyticsFromTrend` 接收 platformMap、时间函数重命名 |
| `src/utils/index.ts` | barrel 导出更新 |
| `src/App.tsx` | 时间筛选改周一/周日、空态处理、platformMap 透传与保存、overdueCount 修复 |
| `src/components/ConfigPanel.tsx` | 双日期字段选择器、platformMap JSON 文本框 |
| `src/components/TrendWarning.tsx` | 三档聚合粒度、rangeStart/rangeEnd 补齐 |
| `src/components/PlatformTable.tsx` | 统一用 `buildScMappings`、接收 platformMap |
| `src/components/RiskOverview.tsx` | 明细层级改为部门→平台 |

---

## 五、已知限制与注意事项

1. **SDK lookup 限制**：查找引用字段可能返回 `null`，平台名需靠 `platformMap` 手动映射。
2. **View 模式数据时效**：View 模式读保存时缓存的 `_trendData`，改数据后需重新进入 Config 保存。
3. **customConfig 4096 字符限制**：趋势数据较大时会自动裁剪保留最近记录。
4. **sass 弃用警告**：`@import "reset-css"` 和 legacy JS API 警告，不影响功能。
5. **pageSize 限制**：`getRecordsByPage` 最大 200 条/页。
6. **SVG fill 不支持 CSS 变量**：Recharts 的 Bar/Cell 必须用 hex 硬色值。

---

## 六、调试方法

1. 启动 dev server：`npm run dev`（端口 5176）
2. 飞书开发者后台调试模式 URL 填 `http://10.221.136.231:5176/`
3. 浏览器 F12 控制台查看日志：
   - `[bitable] 字段映射诊断` — 字段 ID 配置
   - `[bitable] 首条原始字段` — 原始数据 dump
4. 验证 platformMap 是否加载：`console.log(JSON.stringify(config.platformMap))`

---

## 七、构建与发布

```bash
npm run build    # tsc + vite build → dist/
```

- `dist/` 即飞书发版所需全部产物
- 打包 `dist` 为 zip，上传到飞书开发者后台 → 多维表格插件 → 上传版本
