import React, { useState, useEffect } from 'react';
import LineChart from './LineChart.js';
import MultiLineChart from './MultiLineChart.js';
import BarChart from './BarChart.js';
import MultiBarChart from './MultiBarChart.js';
import PieChart from './PieChart.js';
import MixedChart from './MixedChart.js';
import DataTable from './DataTable.js';
import { apiService } from '../services/api.js';
import './Dashboard.css';

const Dashboard = () => {
  const [activeView, setActiveView] = useState('line');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 数据加载函数
  const loadData = async (viewType) => {
    setLoading(true);
    setError(null);
    
    try {
      let result;
      switch(viewType) {
        case 'line':
          result = await apiService.fetchData('/charts/line');
          break;
        case 'multiLine':
          result = await apiService.fetchData('/charts/multi-line');
          break;
        case 'bar':
          result = await apiService.fetchData('/charts/bar');
          break;
        case 'multiBar':
          result = await apiService.fetchData('/charts/multi-bar');
          break;
        case 'mixed':
          result = await apiService.fetchData('/charts/mixed');
          break;
        case 'pie':
          result = await apiService.fetchData('/charts/pie');
          break;
        case 'table':
          result = await apiService.fetchData('/data/table');
          break;
        default:
          result = await apiService.fetchData('/charts/line');
      }
      
      setData(prev => ({
        ...prev,
        [viewType]: result
      }));
    } catch (err) {
      setError(`加载${viewType}数据失败: ${err.message}`);
      console.error('数据加载错误:', err);
    } finally {
      setLoading(false);
    }
  };

  // 切换视图时加载数据
  const handleViewChange = (viewType) => {
    setActiveView(viewType);
    if (!data[viewType]) {
      loadData(viewType);
    }
  };

  // 组件挂载时加载默认数据
  useEffect(() => {
    loadData('line');
  }, []);

  const renderChart = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>数据加载中...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={() => loadData(activeView)} className="retry-button">
            重试
          </button>
        </div>
      );
    }

    const currentData = data[activeView];
    if (!currentData) {
      return <div>暂无数据</div>;
    }

    switch(activeView) {
      case 'line':
        return <LineChart data={currentData} />;
      case 'multiLine':
        return <MultiLineChart data={currentData} />;
      case 'mixed':
        return <MixedChart data={currentData} />;
      case 'bar':
        return <BarChart data={currentData} />;
      case 'multiBar':
        return <MultiBarChart data={currentData} />;
      case 'pie':
        return <PieChart data={currentData} />;
      case 'table':
        return <DataTable data={currentData} />;
      default:
        return <LineChart data={currentData} />;
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-nav">
        <button 
          className={activeView === 'line' ? 'active' : ''} 
          onClick={() => handleViewChange('line')}
        >
          折线图
        </button>
        <button 
          className={activeView === 'multiLine' ? 'active' : ''} 
          onClick={() => handleViewChange('multiLine')}
        >
          多折线图
        </button>
        <button 
          className={activeView === 'bar' ? 'active' : ''} 
          onClick={() => handleViewChange('bar')}
        >
          柱状图
        </button>
        <button 
          className={activeView === 'multiBar' ? 'active' : ''} 
          onClick={() => handleViewChange('multiBar')}
        >
          多柱状图
        </button>
        <button 
          className={activeView === 'mixed' ? 'active' : ''} 
          onClick={() => handleViewChange('mixed')}
        >
          混合图表
        </button>
        <button 
          className={activeView === 'pie' ? 'active' : ''} 
          onClick={() => handleViewChange('pie')}
        >
          饼图
        </button>
        <button 
          className={activeView === 'table' ? 'active' : ''} 
          onClick={() => handleViewChange('table')}
        >
          表格
        </button>
      </div>
      <div className="chart-container">
        {renderChart()}
      </div>
    </div>
  );
};

export default Dashboard;