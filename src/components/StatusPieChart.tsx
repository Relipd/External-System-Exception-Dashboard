import React from 'react';
import { useECharts } from './useECharts';
import type { StatusCount } from '../utils/aggregation';

interface Props {
  data: StatusCount[];
}

const COLORS = ['#f56c6c', '#e6a23c', '#67c23a'];

export default function StatusPieChart({ data }: Props) {
  const ref = useECharts((chart) => {
    chart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0, textStyle: { fontSize: 12 } },
      color: COLORS,
      series: [{
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: 'var(--semi-color-bg-2, #fff)', borderWidth: 2 },
        label: { show: true, formatter: '{b}\n{c}条' },
        data,
      }],
    });
  }, [data]);

  return <div ref={ref} style={{ width: '100%', height: 280 }} />;
}
