import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import KlinePage from './pages/KlinePage.jsx';
import VolumeComparePage from './pages/VolumeComparePage.jsx';
import './styles.css';

/**
 * 极简路由：用 hash 区分两个页面，避免为此引入 react-router。
 *   #/kline             → K 线行情（默认）
 *   #/volume            → 大盘分时量能对比（指数取上次选择）
 *   #/volume/<indexKey> → 直接打开指定指数，便于收藏 / 分享
 */
const DEFAULT_ROUTE = '#/kline';

function readRoute() {
  return window.location.hash || DEFAULT_ROUTE;
}

function useHashRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return route;
}

function Nav({ route }) {
  const tabs = [
    { hash: '#/kline', label: 'K 线行情' },
    { hash: '#/volume', label: '大盘量能对比' },
  ];
  return (
    <nav className="app-nav">
      {tabs.map((t) => (
        <a key={t.hash} href={t.hash} className={route.startsWith(t.hash) ? 'active' : ''}>
          {t.label}
        </a>
      ))}
    </nav>
  );
}

function App() {
  const route = useHashRoute();
  const [, page, segment] = route.split('/');

  return (
    <>
      <Nav route={route} />
      {page === 'volume'
        ? <VolumeComparePage indexKey={segment} />
        : <KlinePage />}
    </>
  );
}

const container = document.getElementById('root');
createRoot(container).render(<App />);
