import React from 'react';
import { useECharts } from './useECharts';
import type { TrendPoint } from '../utils/aggregation';

interface Props {
  data: TrendPoint[];
}

export default function TrendLineChart({ data }: Props) {
  const ref = useECharts((chart) => {
    chart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: data.map((d) => d.date.slice(5)),
        boundaryGap: false,
      },
      yAxis: { type: 'value' },
      series: [{
        type: 'line',
        data: data.map((d) => d.count),
        smooth: true,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
              { offset: 1, color: 'rgba(64, 158, 255, 0.02)' },
            ],
          },
        },
        lineStyle: { color: '#409eff', width: 2 },
        itemStyle: { color: '#409eff' },
      }],
    });
  }, [data]);

  return <div ref={ref} style={{ width: '100%', height: 280 }} />;
}
