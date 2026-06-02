import React from 'react';
import { useECharts } from './useECharts';
import type { PlatformCount } from '../utils/aggregation';

interface Props {
  data: PlatformCount[];
}

export default function PlatformBarChart({ data }: Props) {
  const ref = useECharts((chart) => {
    chart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: data.map((d) => d.platform),
        axisLabel: { rotate: 30, fontSize: 11 },
      },
      yAxis: { type: 'value' },
      series: [{
        type: 'bar',
        data: data.map((d) => d.count),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#409eff' },
              { offset: 1, color: '#79bbff' },
            ],
          },
          borderRadius: [4, 4, 0, 0],
        },
      }],
    });
  }, [data]);

  return <div ref={ref} style={{ width: '100%', height: 280 }} />;
}
