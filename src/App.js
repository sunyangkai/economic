import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import './App.css';
import Dashboard from './components/Dashboard.js';
import HomePage from './pages/HomePage.js';
import DocsPage from './pages/DocsPage.js';
import MDXDocPage from './pages/MDXDocPage.js';
import './components/MDXFileViewer.css';

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleRipple = (e) => {
    try {
      const target = e.currentTarget;
      const rect = target.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const span = document.createElement('span');
      span.className = 'ripple';
      span.style.left = `${x}px`;
      span.style.top = `${y}px`;
      target.appendChild(span);
      const remove = () => {
        span.remove();
      };
      span.addEventListener('animationend', remove, { once: true });
      // Fallback removal
      setTimeout(remove, 650);
    } catch (_) {
      // ignore ripple failures silently
    }
  };

  return (
    <Router>
      <div className="App">
        {sidebarCollapsed && (
          <button 
            className="floating-toggle"
            onClick={() => setSidebarCollapsed(false)}
            aria-label="展开导航栏"
          >
            ☰
          </button>
        )}
        <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-header">
            <h2>{sidebarCollapsed ? '📊' : '📊 数据平台'}</h2>
            {!sidebarCollapsed && (
              <button 
                className="sidebar-toggle"
                onClick={() => setSidebarCollapsed(true)}
                aria-label="收起导航栏"
              >
                ←
              </button>
            )}
          </div>
          <nav className="sidebar-nav">
            <NavLink 
              to="/"
              className={({ isActive }) => isActive ? 'active' : ''}
              end
              title="首页"
              onClick={handleRipple}
            >
              <span className="nav-icon">🏠</span>
              <span className="nav-text">首页</span>
            </NavLink>
            <NavLink 
              to="/dashboard"
              className={({ isActive }) => isActive ? 'active' : ''}
              title="仪表板"
              onClick={handleRipple}
            >
              <span className="nav-icon">📊</span>
              <span className="nav-text">仪表板</span>
            </NavLink>
            <NavLink 
              to="/docs"
              className={({ isActive }) => isActive ? 'active' : ''}
              title="文档"
              onClick={handleRipple}
            >
              <span className="nav-icon">📝</span>
              <span className="nav-text">文档</span>
            </NavLink>
          </nav>
        </aside>
        <main className={`App-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/docs/:docId" element={<MDXDocPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
