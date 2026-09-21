import { createRoot } from 'react-dom/client';
import KlinePage from './pages/KlinePage.jsx';
import './styles.css';

const container = document.getElementById('root');
createRoot(container).render(<KlinePage />);
