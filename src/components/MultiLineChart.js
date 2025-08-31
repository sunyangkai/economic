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

const MultiLineChart = ({ data, yMin, yMax, title = '多条折线对比图' }) => {
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
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: title,
      },
      datalabels: {
        display: (ctx) => {
          const v = ctx?.dataset?.data?.[ctx.dataIndex];
          return Number.isFinite(v);
        },
        color: '#111827',
        backgroundColor: 'rgba(255,255,255,0.8)',
        borderColor: 'rgba(0,0,0,0.1)',
        borderWidth: 1,
        borderRadius: 4,
        padding: 4,
        align: 'top',
        offset: 4,
        formatter: (v) => (typeof v === 'number' ? v.toFixed(1) : ''),
        font: { size: 10 },
        clip: true,
      },
    },
    scales: {
      y: {
        beginAtZero: yMin == null,
        min: yMin,
        max: yMax,
      },
    },
  };

  return <Line data={preparedData} options={options} />;
};

export default MultiLineChart;
