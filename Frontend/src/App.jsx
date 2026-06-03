import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Outlet } from "react-router-dom";
import { Toaster as Sonner } from "sonner";
import { Toaster } from "@/components/ui/toaster";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import ClassroomDetail from "./pages/ClassroomDetail";
import Learn from "./pages/Learn";
import NotFound from "./pages/NotFound";
import AppLayout from "./layouts/AppLayout";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('clarix_token');
  if (!token) return <Navigate to="/" replace />;
  return children;
};

const ProtectedLayout = () => {
  const token = localStorage.getItem('clarix_token');
  if (!token) return <Navigate to="/" replace />;

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/learn" element={<ProtectedRoute><Learn /></ProtectedRoute>} />
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/classroom/:id" element={<ClassroomDetail />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
      <Sonner />
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
