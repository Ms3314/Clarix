import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "sonner";
import { Toaster } from "@/components/ui/toaster";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import ClassroomDetail from "./pages/ClassroomDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }) => {
  const token = document.cookie
    .split('; ')
    .find(row => row.startsWith('clarix_token='));

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/classroom/:id"
          element={
            <ProtectedRoute>
              <ClassroomDetail />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
      <Sonner />
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
