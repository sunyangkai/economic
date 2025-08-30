import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

const PieChart = ({ data, width = 400, height = 400 }) => {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: '饼图统计',
      },
    },
  };

  return (
    <div style={{ width: `${width}px`, height: `${height}px`, margin: '0 auto' }}>
      <Pie data={data} options={options} />
    </div>
  );
};

export default PieChart;