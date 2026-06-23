# 外部平台异常看板 — 项目文档

> 飞书多维表格 Dashboard 插件，用于外部平台权限账号异常数据的可视化监控

---

## 一、项目概述

### 业务目标
管理层需要一张实时看板，一眼掌握外部平台权限异常情况：还剩多少没处理、谁在处理、哪里有风险。

### 关键指标
- 按风险等级聚合：高风险(R3) / 中风险(R2) / 低风险(R1) 异常数量
- 按平台聚合：各平台异常总量 TOP10
- 按部门聚合：各部门异常排行
- 按系统聚合：各系统按 R1/R2/R3 堆叠风险详情
- 预警规则：异常总数 > 50 红色预警 / 有 R3 未处理预警

---

## 二、技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18 | UI 框架 |
| TypeScript | 5.4 | 类型安全 |
| Vite | 5 | 构建工具 |
| Semi UI | 2.58 | UI 组件库 + 飞书 Dashboard 主题 |
| Recharts | 2.12 | 图表（柱状图、堆叠图） |
| @lark-base-open/js-sdk | 1.0.0 | 飞书多维表格 SDK |
| sass | 1.77 | 样式预处理 |
| reset-css | 5.0 | CSS 重置 |
| vite-plugin-semi-theming | 0.1 | Semi 主题编译插件 |

---

## 三、项目结构

```
external-platform-dashboard/
├── index.html                     # 入口（含移动端重定向）
├── package.json
├── vite.config.ts                 # Vite + Semi 主题 + 路径别名 @/
├── tsconfig.json                  # 路径映射 @/ → src/
├── src/
│   ├── main.tsx                   # React 入口，挂载 WorkspaceProvider
│   ├── App.tsx                    # 主逻辑：状态机、数据加载、路由
│   ├── App.scss                   # 全局样式（CSS 变量、布局、卡片、图表）
│   ├── workspace.tsx              # WorkspaceProvider：Base 切换、Context
│   ├── types/
│   │   └── index.ts               # IPluginConfig, IPlatformSummary, IAnomalyDetail, IDashboardAnalytics
│   ├── hooks/
│   │   └── index.ts               # useTheme(), useDashboardState()
│   ├── utils/
│   │   ├── bitable.ts             # SDK 封装：分页读取、字段映射、cellToText/cellToNumber
│   │   └── analytics.ts           # 分析引擎：所有看板指标计算
│   └── components/
│       ├── ConfigPanel.tsx         # 配置面板（选 Base → 选表 → 字段映射）
│       ├── StatCard.tsx            # 统计卡片组件
│       ├── RiskOverview.tsx        # 看板1：风险总览
│       ├── AnomalyDistribution.tsx # 看板2：异常分布
│       ├── TrendWarning.tsx        # 看板3：趋势预警
│       └── chartColors.ts          # 图表色板（light/dark 双主题）
└── CLAUDE.md                      # 本文档
```

---

## 四、架构与数据流

### 4.1 页面结构（3 个标签页）

```
📊 风险总览     📈 异常分布     🚨 趋势预警
  │               │               │
  │ 4统计卡片     │ 异常类型TOP10 │ 3统计卡片
  │ 部门排行     │ 平台TOP10     │ 平台明细表
  │ 系统风险堆叠 │ （左右并排）   │ 预警信号（底部）
  │ 系统详情列表  │               │
  └───────────────┴───────────────┴──────────────
  ⚠ 预警横幅（所有页面底部）
  📊 📈 🚨 底部导航按钮
```

### 4.2 数据流

```
飞书多维表（两张）
  │
  ├─ 异常明细表（dataConditions 主表）
  │   └─ bitable.base.getTable() → getRecordsByPage()
  │      → IAnomalyDetail[]  [{systemCode, platformName, department, anomalyCode, anomalyType, riskLevel, count}]
  │      │
  │      └─ computeAnalytics(detailData, hasCountField)
  │         → IDashboardAnalytics  {totalRemainingCount, highRiskCount, platformDistribution, ...}
  │
  └─ 时间趋势表（副表，workspace.getBitable() 绕过限制）
      └─ workspace.getBitable().base.getTable() → getRecordsByPage()
         → ITrendRecord[]  [{date, department, reviewCount, pendingCount}]
         │
         └─ computeTrendChartData(records, 'pendingCount')
            → ITrendChartDataPoint[]  [{date, '淘系运营部': 284, ...}]
```

### 4.3 状态机

```
首次添加插件 → DashboardState.Create → 显示配置面板（左侧预览 + 右侧配置）
  ↓ 用户配置字段映射并点击保存
  ↓ dashboard.saveConfig()
  ↓ 飞书切换到 View 状态
查看模式 → DashboardState.View → 加载数据 → 显示看板
  ↓ 用户点击编辑按钮
  ↓ dashboard.state → Config
配置模式 → DashboardState.Config → 显示配置面板
```

### 4.4 四阶段启动流程

```
Phase 1: dashboard.getConfig() → 读取已保存配置
  若为首次创建(isCreate)则跳过，显示空面板

Phase 2: switchBase(token) → 切换 workspace base 实例
  workspace.tsx 的 WorkspaceProvider 管理 Base 切换

Phase 3: loadData() → 分页拉取两张表的数据
  明细表: bitable.base 主表直接读取（dataConditions 可访问）
  趋势表: workspace.getBitable() 绕开限制（副表，可选，加载失败不影响明细表）
  两表通过 Promise.all 并行加载

Phase 4: dashboard.setRendered() → 通知飞书容器渲染完成
  挂载后 2 秒无条件调用（含 try/catch）
```

---

## 五、数据模型

### 5.1 异常明细表（唯一数据源）

每条记录一条异常明细：

| 字段 | 示例 | 说明 |
|------|------|------|
| systemCode | DYXD | 系统编码 |
| platformName | 抖音小店 | 平台名称 |
| department | 抖快运营部 | 归属部门 |
| anomalyCode | E03 | 异常编码 |
| anomalyType | 账号存在性异常：无工单但后台有配置 | 异常描述 |
| riskLevel | R3 | 风险等级（R1/R2/R3） |
| count | 475 | 异常数量 |

### 5.2 时间趋势表（可选副表）

每条记录一个部门在某时点的快照汇总：

| 字段 | 示例 | 说明 |
|------|------|------|
| date | 2026/05/08 | 时点日期 |
| department | 淘系运营部 | 归属部门 |
| reviewCount | 285 | 时点审阅异常数量 |
| pendingCount | 284 | 时点待处理异常数量 |

### 5.3 异常分类体系

| 编码 | 异常类型 | 风险等级 |
|------|---------|---------|
| E01 | 核心信息不一致：手机号不一致 | R3 |
| E02 | 手机号不一致 + 角色不一致 | R3 |
| E03 | 账号存在性异常：无工单但后台有配置 | R3 |
| E04 | 账号存在性异常：有工单但后台无配置 | R1 |
| E05 | 权限配置异常：角色不一致 | R2 |
| E06 | 辅助信息不一致：账号名（昵称）不一致 | R2 |
| E07 | 昵称不一致 + 角色不一致 | R2 |
| E08 | 辅助信息不一致：账号名（姓名）不一致 | R2 |
| E09 | 姓名不一致 + 角色不一致 | R2 |

---

## 六、分析引擎逻辑 (analytics.ts)

### 6.1 核心原则

所有图表的"数量"使用 `SUM(count)` 累加，而非 `COUNT(records)`。

### 6.2 hasCountField 参数

关键参数，控制 count=0 的行是否被计入：

```typescript
const val = (v: number) => hasCountField ? v : Math.max(v, 1);
```

- `hasCountField = true`（用户配置了数量列）→ 用实际值，0 就是 0
- `hasCountField = false`（未配置）→ 每条记录计为 1

这个区分很重要：之前因为总是 `Math.max(d.count, 1)`，导致 count=0 的行也被计为1，出现"宠物抖音实际数据为0但显示18条"的 bug。

### 6.3 各指标计算规则

```typescript
// 总异常数 = SUM(count) over all details
totalAnomalyCount = details.reduce((sum, d) => sum + val(d.count), 0)

// 高风险 = SUM(count) where riskLevel === 'R3'
highRiskCount = details.filter(R3).reduce((sum, d) => sum + val(d.count), 0)

// 平台分布 = SUM(count) GROUP BY platformName
platformMap = new Map(name → SUM(count))

// 部门排行 = SUM(count) GROUP BY department
// 明细表无 department 时 fallback 到映射表

// 系统风险排行 = SUM(count) GROUP BY systemCode, SPLIT BY riskLevel
systemRiskMap = new Map(name → {R1, R2, R3})

// 指导员（仅映射表有，UI 已删除但保留计算）
instructorMap = new Map(instructor → SUM(remainingCount))

// 预警 = 映射表 remainingCount 总和（与 DETAIL 无关）
warnings = totalRemainingCount > 50 ? red-alert
```

### 6.4 平台名 vs 系统编码

系统风险排行使用 `d.platformName || d.systemCode` 作为显示名，所以图表中显示的是中文平台名（如"抖音小店"），而不是编码（"DYXD"）。

---

## 七、SDK 关键约束与踩坑记录

### 7.1 飞书 SDK 版本

**必须使用 `@lark-base-open/js-sdk: "1.0.0"`**（稳定版）。

之前误用了一个 beta 版本 `https://...tgz`（0.4.1-beta.5），该版本：
- 没有类型化导出 `workspace` 模块
- 部分 API 行为不一致

### 7.2 Dashboard 插件 vs Bitable 插件的 API 差异

这是**整个项目最大的坑**。Dashboard 插件（仪表盘插件）和普通 Bitable 插件（多维表插件）的 API 权限完全不同：

| API | Bitable 插件 | Dashboard 插件 |
|-----|-------------|---------------|
| `bitable.base.getTable()` | ✅ 全表可读 | ❌ 仅可读 `dataConditions` 中配置的表 |
| `bitable.base.getTableList()` | ✅ 可用 | ❌ 仅 Config 模式可用 |
| `table.getActiveView()` | ✅ 可用 | ❌ view not found |
| `workspace.getBitable()` | ✅ 可用 | ⚠️ 有限制 |
| `dashboard.getData()` | N/A | ✅ 官方方式 |

**结论：** Dashboard 插件中：
- 主表（放在 `dataConditions` 中的表）用 `bitable.base.getTable()` 读取
- 副表（非 dataConditions）用 `workspace.getBitable(baseToken).base.getTable()` 读取
- 配置面板中拉取表列表/字段列表时也使用 `workspace.getBitable()`

### 7.3 workspace 导入方式

```typescript
// ❌ 之前从 beta SDK 导入（不存在）
import { workspace } from '@lark-base-open/js-sdk';

// ✅ 正确方式（SDK 1.0.0 支持）
import { workspace, bitable } from '@lark-base-open/js-sdk';

// 通过 workspace 切换 base
const instance = await workspace.getBitable(baseToken);
const table = await instance.base.getTable(tableId);
```

### 7.4 getRecordsByPage 的 pageToken 类型

SDK 类型中 `pageToken` 是 `number | undefined`，不是 `string`。

```typescript
// ✅ 正确
let pageToken: number | undefined;
const res = await table.getRecordsByPage({ pageSize: 200, pageToken });
pageToken = res.hasMore ? (res.pageToken as number) : undefined;
```

### 7.5 查找引用字段

飞书"查找引用"（lookup）字段通过 SDK 读取返回 `null`。`cellToText` 函数已兼容处理：

```typescript
export function cellToText(cell: any): string {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'string') return cell;
  if (Array.isArray(cell)) {
    return cell.map((c: any) => c.text ?? c.name ?? c.id ?? String(c)).join(', ');
  }
  // ... 其他类型
}
```

配置时提醒用户选择**源字段**而不是查找引用字段。

### 7.6 saveConfig 的 dataConditions

```typescript
await dashboard.saveConfig({
  customConfig: config,          // 自定义配置对象（有 4096 字符限制）
  dataConditions: [{             // 数据源条件（飞书副本映射依赖此字段）
    baseToken: 'xxx',
    tableId: 'tbl_xxx',
  }],
} as any);
```

`customConfig` 最大 4096 字符。`dataConditions` 中的 `tableId` 会被飞书记录，创建仪表盘副本时自动替换。

### 7.7 setRendered 必须调用

**必须在插件渲染完成后调用 `dashboard.setRendered()`**，否则飞书容器会一直显示 loading。建议：

```typescript
// 挂载后 2 秒无条件调用，否则用户永远看不到界面
useEffect(() => {
  const timer = setTimeout(() => {
    try { defaultDashboard.setRendered(); } catch {}
  }, 2000);
  return () => clearTimeout(timer);
}, []);
```

### 7.8 Dashboard 状态

```typescript
enum DashboardState {
  Create = 'Create',  // 首次添加
  Config = 'Config',  // 编辑配置
  View = 'View',      // 查看模式
  FullScreen = 'FullScreen'
}
```

- `Create` 只在首次添加时瞬间出现
- 必须**直接读取** `dashboard.state`，不要缓存在 React state 中，否则 saveConfig 后状态变化无法感知

使用 `useDashboardState()` 钩子：
```typescript
export function useDashboardState() {
  const [refreshKey, forceRefresh] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const off = defaultDashboard.onConfigChange(() => forceRefresh());
    return () => off();
  }, []);
  const state = defaultDashboard.state;  // 直接读取，不缓存
  const isCreate = state === DashboardState.Create;
  const isConfig = state === DashboardState.Config || isCreate;
  const isView = state === DashboardState.View;
  return { state, isCreate, isConfig, isView };
}
```

---

## 八、已知问题与限制

### 8.1 数据源架构

- **异常明细表**：主表，放在 `dataConditions` 中，用 `bitable.base.getTable()` 读取
- **时间趋势表**：副表（可选），用 `workspace.getBitable()` 绕开限制读取，独立于主表
- 已移除旧的映射表（平台汇总表），其字段在明细表中均有对应

### 8.2 count 字段必须配置

如果用户不配置"数量（异常次数）"字段：
- `hasCountField = false`
- 所有记录每条计为 1
- 平台有 9 种异常类型就显示 9（即使实际数据为 0）

这会导致"宠物抖音"类问题（实际0但显示18）。

### 8.3 配置面板的 base 切换时序

`switchBase()` 是异步的，ConfigPanel 在 `.then()` 回调中调用 `getBaseInstance()` 时，workspace 上下文可能尚未更新。解决：在 `switchBase` 中同步调用 `setBaseInstance(instance.base)`。

### 8.4 SVG fill 不支持 CSS 变量

Recharts 的 `Bar` / `Cell` 使用 SVG `fill` 属性（非 CSS），CSS 变量 `var(--ccm-chart-R500)` 不生效，显示为黑色。**必须使用 hex 硬色值**。

`chartColors.ts` 中定义了 light/dark 两套色板，通过 `getBarColors(theme)` 函数获取。

### 8.5 配置保存上限

`dashboard.saveConfig()` 的 `customConfig` 最大 4096 字符。当前字段映射数量在安全范围内，但如果大幅增加映射字段需要留意。

### 8.6 pageSize 限制

`table.getRecordsByPage({ pageSize })` 的 `pageSize` 最大 200，设置更大不会报错但只会返回 200 条。

---

## 九、开发命令

```bash
cd "D:\vscode\飞书\external-platform-dashboard"

npm run dev      # 开发模式（通常端口 5176-519x）
npm run build    # 构建（tsc + vite build）
npm run preview  # 预览构建产物
```

### 构建产物

`dist/` 目录下生成：
- `index.html`
- `assets/index-*.js`（~1.6MB，含 Semi UI + Recharts）
- `assets/index-*.css`（~175KB）
- `assets/RenderMarkDown-*.js`（~162KB）

---

## 十、飞书插件上传

1. 执行 `npm run build`
2. 将 `dist/` 目录所有文件打包为 zip
3. 在[飞书开发者后台](https://open.feishu.cn/app) → 对应应用 → 多维表格插件 → 上传版本
4. 设置调试模式的 URL 为 `http://10.221.139.23:5176/`（或 ngrok HTTPS 地址）

---

## 十一、关键文件清单

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/App.tsx` | ~288 | 状态机、数据加载、页面路由 |
| `src/workspace.tsx` | ~90 | WorkspaceProvider、Base 切换 |
| `src/types/index.ts` | ~120 | 所有类型定义 + 常量 |
| `src/utils/bitable.ts` | ~130 | SDK 封装、分页读取、字段映射、cellToText |
| `src/utils/analytics.ts` | ~155 | 分析引擎、所有指标计算 |
| `src/components/ConfigPanel.tsx` | ~210 | 配置面板：选 Base → 选表 → 字段映射 |
| `src/components/RiskOverview.tsx` | ~130 | 风险总览：统计卡片 + 部门排行 + 系统风险 |
| `src/components/AnomalyDistribution.tsx` | ~80 | 异常分布：异常类型TOP10 + 平台TOP10 |
| `src/components/TrendWarning.tsx` | ~140 | 趋势预警：预警信号 + 平台明细表 |
| `src/components/StatCard.tsx` | ~40 | 统计卡片组件 |
| `src/components/chartColors.ts` | ~30 | 图表色板（light/dark） |
| `src/App.scss` | ~500 | 全局样式 |
| `src/hooks/index.ts` | ~50 | useTheme + useDashboardState |
