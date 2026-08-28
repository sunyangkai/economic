import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);
ChartJS.register(ChartDataLabels);

const MultiLineChart = ({ data, yMin, yMax, title = '多条折线对比图', height = 360 }) => {
  const preparedData = React.useMemo(() => {
    if (!data) return data;
    const datasets = (data.datasets || []).map((ds, idx) => ({
      ...ds,
      hidden: idx !== 0, // 默认只显示第一条
      pointRadius: 3,
      pointHoverRadius: 5,
    }));
    return { ...data, datasets };
  }, [data]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { left: 48, right: 48, top: 12, bottom: 8 } },
    plugins: {
      legend: { position: 'top', align: 'start' },
      title: {
        display: true,
        text: title,
      },
      datalabels: {
        display: (ctx) => Number.isFinite(ctx?.dataset?.data?.[ctx.dataIndex]),
        color: '#374151',
        formatter: (v) => (typeof v === 'number' ? v.toFixed(1) : ''),
        font: { size: 10 },
        clip: false,
        clamp: true,
        align: 'top',
        anchor: 'end',
        offset: 6,
      },
    },
    scales: {
      y: {
        beginAtZero: yMin == null,
        min: yMin,
        max: yMax,
      },
      x: {
        offset: true,
        ticks: { autoSkip: true, maxRotation: 0, minRotation: 0 },
      },
    },
  };

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <Line data={preparedData} options={options} />
    </div>
  );
};

export default MultiLineChart;
