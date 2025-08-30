import React from 'react';
import { Link } from 'react-router-dom';

const HomePage = () => {
  return (
    <div className="home-page">
      <div className="navigation-cards">
        <Link to="/dashboard" className="nav-card">
          <h2>📊 仪表板</h2>
          <p>查看各种图表和数据可视化组件</p>
        </Link>
        <Link to="/docs" className="nav-card">
          <h2>📝 文档中心</h2>
          <p>浏览MDX文档和使用指南</p>
        </Link>
      </div>
    </div>
  );
};

export default HomePage;