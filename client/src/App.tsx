import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import FoamLibrary from './pages/FoamLibrary';
import DacronLibrary from './pages/DacronLibrary';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import PricingCalculator from './pages/PricingCalculator';
import Quotes from './pages/Quotes';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';
import AiChat from './pages/AiChat';
import ImportQuotes from './pages/ImportQuotes';
import Skus from './pages/Skus';
import SkuDetail from './pages/SkuDetail';
import FoamOrders from './pages/FoamOrders';
import FoamOrderDetail from './pages/FoamOrderDetail';
import CutStation from './pages/CutStation';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/foams" element={<FoamLibrary />} />
          <Route path="/dacrons" element={<DacronLibrary />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/calculator" element={<PricingCalculator />} />
          <Route path="/quotes" element={<Quotes />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/ai" element={<AiChat />} />
          <Route path="/import-quotes" element={<ImportQuotes />} />
          <Route path="/skus" element={<Skus />} />
          <Route path="/skus/:id" element={<SkuDetail />} />
          <Route path="/foam-orders" element={<FoamOrders />} />
          <Route path="/foam-orders/:id" element={<FoamOrderDetail />} />
        </Route>
        <Route path="/cut-station" element={<CutStation />} />
      </Routes>
    </BrowserRouter>
  );
}
