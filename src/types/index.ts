/* ============================= 插件配置 ============================= */

export interface IPluginConfig {
  trendBaseToken: string;
  trendTableId: string;
  trendFields: ITrendFieldMap;
}

/** 时间趋势表字段映射 */
export interface ITrendFieldMap {
  dateStartFieldId: string;      // 审阅时间-起（周一）
  dateEndFieldId: string;        // 审阅时间-末（周日）
  dateFieldId: string;           // 兼容旧版单日期字段
  departmentFieldId: string;
  systemCodeFieldId: string;
  platformFieldId: string;
  reviewCountFieldId: string;    // 审阅异常总数
  pendingCountFieldId: string;   // 剩余待处理异常
  overdueCountFieldId: string;   // 已超时数
  shopCountFieldId: string;      // 平台店铺数
  userCountFieldId: string;      // 平台用户数
  eFieldIds: Record<string, string>; // E01~E09 字段ID映射 { "E01": "fld...", ... }
}

/* ============================= 数据模型 ============================= */

export interface ITrendRecord {
  date: string;          // 兼容旧版，等同 dateStart
  dateStart: string;     // 审阅时间-起（周一）
  dateEnd: string;       // 审阅时间-末（周日）
  department: string;
  systemCode: string;
  platformName: string;
  reviewCount: number;
  pendingCount: number;
  overdueCount: number;
  shopCount: number;
  userCount: number;
  eCounts: Record<string, number>; // { "E01": 99, "E02": 164, ... }
}

export interface ITrendChartDataPoint {
  date: string;
  [key: string]: number | string;
}

/* ============================= 分析结果 ============================= */

export interface IDashboardAnalytics {
  totalRemainingCount: number;
  highRiskCount: number;   // R3
  midRiskCount: number;    // R2
  lowRiskCount: number;    // R1
  platformCount: number;
  anomalyTypeCount: number;
  platformDistribution: { name: string; count: number }[];
  anomalyTypeTop10: { type: string; count: number; percentage: number }[];
  anomalyTypeByDept: ITrendChartDataPoint[];
  allDeptNames: string[];
  departmentRanking: { department: string; count: number }[];
  systemRiskRanking: { system: string; count: number; riskR3: number; riskR2: number; riskR1: number }[];
  deptRiskRanking: { department: string; count: number; riskR3: number; riskR2: number; riskR1: number }[];
  deptPlatformDetails: IDeptPlatformDetail[];
  platformDeptDetails: IPlatformDeptDetail[];
}

export interface IDeptPlatformDetail {
  department: string;
  totalCount: number;
  platforms: { platform: string; riskR3: number; riskR2: number; riskR1: number; count: number }[];
}

export interface IPlatformDeptDetail {
  platform: string;
  totalCount: number;
  departments: { department: string; riskR3: number; riskR2: number; riskR1: number; count: number }[];
}


/* ============================= 常量 ============================= */

export const RISK_LEVEL_COLORS: Record<string, string> = { R1: '#34c759', R2: '#ff9500', R3: '#ff3b30' };
export const RISK_LEVEL_LABELS: Record<string, string> = { R1: '低风险', R2: '中风险', R3: '高风险' };

/** 异常编码 → 类型名 + 风险等级。R 值 = 对应 E 编码之和  */
export const ANOMALY_CODE_MAP: Record<string, { type: string; riskLevel: string }> = {
  E01: { type: '核心信息不一致：手机号不一致', riskLevel: 'R3' },
  E02: { type: '核心信息不一致：手机号不一致, 权限配置异常：角色不一致', riskLevel: 'R3' },
  E03: { type: '账号存在性异常：无工单但后台有配置', riskLevel: 'R3' },
  E04: { type: '账号存在性异常：有工单但后台无配置', riskLevel: 'R1' },
  E05: { type: '权限配置异常：角色不一致', riskLevel: 'R2' },
  E06: { type: '辅助信息不一致：账号名（昵称）不一致', riskLevel: 'R2' },
  E07: { type: '辅助信息不一致：账号名（昵称）不一致, 权限配置异常：角色不一致', riskLevel: 'R2' },
  E08: { type: '辅助信息不一致：账号名（姓名）不一致', riskLevel: 'R2' },
  E09: { type: '辅助信息不一致：账号名（姓名）不一致, 权限配置异常：角色不一致', riskLevel: 'R2' },
};

export const ANOMALY_CODES = Object.keys(ANOMALY_CODE_MAP).sort();

/** E编码 → 风险等级索引表 */
const E_RISK: Record<string, string> = {};
for (const [code, info] of Object.entries(ANOMALY_CODE_MAP)) {
  E_RISK[code] = info.riskLevel;
}

/**
 * 从 E 编码计数中聚合 R1/R2/R3
 * 输入: { E01: 99, E02: 164, ... }
 * 输出: { R1: 350, R2: 548, R3: 321 }
 */
export function eCountsToRisk(eCounts: Record<string, number>): { R1: number; R2: number; R3: number } {
  const risk = { R1: 0, R2: 0, R3: 0 };
  for (const [code, count] of Object.entries(eCounts)) {
    const rl = E_RISK[code];
    if (rl && risk[rl as keyof typeof risk] !== undefined) {
      risk[rl as keyof typeof risk] += count;
    }
  }
  return risk;
}
