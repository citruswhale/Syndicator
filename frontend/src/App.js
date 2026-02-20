import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AnalysisProvider } from "@/context/AnalysisContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { Sidebar } from "@/components/Sidebar";
import LandingPage from "@/pages/LandingPage";
import DashboardPage from "@/pages/DashboardPage";
import GraphExplorer from "@/pages/GraphExplorer";
import FraudRingsPage from "@/pages/FraudRingsPage";
import SuspiciousAccountsPage from "@/pages/SuspiciousAccountsPage";
import JsonOutputPage from "@/pages/JsonOutputPage";

function App() {
  return (
    <ThemeProvider>
      <AnalysisProvider>
        <BrowserRouter>
          <div className="flex h-screen bg-[#09090b] dark:bg-[#09090b] light:bg-gray-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-auto">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/graph" element={<GraphExplorer />} />
                <Route path="/rings" element={<FraudRingsPage />} />
                <Route path="/accounts" element={<SuspiciousAccountsPage />} />
                <Route path="/json" element={<JsonOutputPage />} />
              </Routes>
            </main>
          </div>
          <Toaster
            theme="dark"
            position="top-right"
            toastOptions={{
              style: {
                background: '#18181b',
                border: '1px solid #27272a',
                color: '#fafafa',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '12px',
              },
          }}
        />
      </BrowserRouter>
    </AnalysisProvider>
    </ThemeProvider>
  );
}

export default App;
