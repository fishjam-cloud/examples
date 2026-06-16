import './index.css';

import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';

import Layout from './layout.tsx';
import PublishPage from './pages/publish.tsx';
import WatchPage from './pages/watch.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Layout>
    <BrowserRouter>
      <Routes>
        <Route index element={<PublishPage />} />
        <Route path="watch/:name" element={<WatchPage />} />
      </Routes>
    </BrowserRouter>
  </Layout>,
);
