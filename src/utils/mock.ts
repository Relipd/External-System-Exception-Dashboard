import dayjs from 'dayjs';

const platforms = ['美团', '饿了么', '抖音', '快手', '京东', '淘宝', '拼多多', '小红书', '得物', '微信小程序'];
const riskLevels = ['R3', 'R2', 'R2', 'R1', 'R1', 'R1'];
const statuses = ['待处理', '待处理', '待反馈', '已解决', '已解决', '已解决', '已解决'];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 生成模拟的 bitable 行数据（每行 4 列：平台、风险等级、状态、创建时间） */
export function generateMockRows(count = 200): any[][] {
  const rows: any[][] = [];
  for (let i = 0; i < count; i++) {
    const daysAgo = randInt(0, 30);
    const date = dayjs().subtract(daysAgo, 'day').format('YYYY-MM-DD');
    rows.push([
      [{ text: pick(platforms) }],
      pick(riskLevels),
      pick(statuses),
      date,
    ]);
  }
  return rows;
}
