import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import FoamLibrary from './pages/FoamLibrary';
import DacronLibrary from './pages/DacronLibrary';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';
import Skus from './pages/Skus';
import SkuDetail from './pages/SkuDetail';
import FoamOrders from './pages/FoamOrders';
import FoamOrderDetail from './pages/FoamOrderDetail';
import CutStation from './pages/CutStation';
import Scrap from './pages/Scrap';
import Remnants from './pages/Remnants';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/skus" element={<Skus />} />
          <Route path="/skus/:id" element={<SkuDetail />} />
          <Route path="/foam-orders" element={<FoamOrders />} />
          <Route path="/foam-orders/:id" element={<FoamOrderDetail />} />
          <Route path="/foams" element={<FoamLibrary />} />
          <Route path="/dacrons" element={<DacronLibrary />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/scrap" element={<Scrap />} />
          <Route path="/remnants" element={<Remnants />} />
          <Route path="/remnants/:id" element={<Remnants />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="/cut-station" element={<CutStation />} />
        <Route path="/cut-station/:id" element={<CutStation />} />
      </Routes>
    </BrowserRouter>
  );
}
