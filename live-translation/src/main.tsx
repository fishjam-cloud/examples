import './index.css';

import { FishjamProvider, Variant } from '@fishjam-cloud/react-client';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';

import Layout from './layout.tsx';
import PublishPage from './pages/publish.tsx';
import WatchPage from './pages/watch.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <FishjamProvider
    fishjamId={import.meta.env.VITE_FISHJAM_ID}
    constraints={{
      video: {
        width: {
          max: 1920,
          ideal: 1920,
          min: 640,
        },
        height: {
          max: 1080,
          ideal: 1080,
          min: 320,
        },
        frameRate: {
          max: 30,
          ideal: 30,
        },
      },
    }}
    videoConfig={{
      sentQualities: [Variant.VARIANT_LOW, Variant.VARIANT_MEDIUM, Variant.VARIANT_HIGH],
    }}>
    <Layout>
      <BrowserRouter>
        <Routes>
          <Route index element={<PublishPage />} />
          <Route path="watch/:name" element={<WatchPage />} />
        </Routes>
      </BrowserRouter>
    </Layout>
  </FishjamProvider>,
);
