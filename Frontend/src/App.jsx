import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Outlet } from "react-router-dom";
import { Toaster as Sonner } from "sonner";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import CreateClassroom from "./pages/CreateClassroom";
import ClassroomDetail from "./pages/ClassroomDetail";
import Learn from "./pages/Learn";
import JoinPage from "./pages/JoinPage";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import AppLayout from "./layouts/AppLayout";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('clarix_token');
  if (!token) return <Navigate to="/" replace />;
  return children;
};

const GuestRoute = ({ children }) => {
  const token = localStorage.getItem('clarix_token');
  if (token) return <Navigate to="/dashboard" replace />;
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
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<GuestRoute><Index /></GuestRoute>} />
          <Route path="/join/:code" element={<JoinPage />} />
          <Route path="/learn" element={<ProtectedRoute><Learn /></ProtectedRoute>} />
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/classroom/new" element={<CreateClassroom />} />
            <Route path="/classroom/:id" element={<ClassroomDetail />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
        <Sonner />
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
