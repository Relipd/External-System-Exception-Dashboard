/**
 * 条形图渐变色阶（按主题返回实际色值，SVG fill 不支持 CSS 变量）
 * 索引越小颜色越深（TOP1 最严重）
 */

export const CHART_COLORS = {
  light: [
    '#f54a45', // 红   - TOP1
    '#ff8a00', // 橙   - TOP2
    '#ffc60a', // 黄   - TOP3
    '#3370ff', // 蓝   - TOP4
    '#5e8cff', // 浅蓝  - TOP5
    '#7f3bf5', // 紫   - TOP6
    '#a06ef8', // 浅紫  - TOP7
    '#14c0ff', // 青   - TOP8
    '#5dd3ff', // 浅青  - TOP9
    '#34c759', // 绿   - TOP10
  ],
  dark: [
    '#f05b56', // 红
    '#f2962c', // 橙
    '#fac823', // 黄
    '#4c88ff', // 蓝
    '#70a0ff', // 浅蓝
    '#9762f5', // 紫
    '#b483fc', // 浅紫
    '#42bdeb', // 青
    '#6fd4fe', // 浅青
    '#54c248', // 绿
  ],
};

export function getBarColors(theme: 'light' | 'dark'): string[] {
  return CHART_COLORS[theme] || CHART_COLORS.light;
}
