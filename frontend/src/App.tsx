import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import History from './pages/History';
import Landing from './pages/Landing';
import Layout from './components/Layout';
import PublicLayout from './components/PublicLayout';

// ── Protected: redirect to /login if not authenticated ────────────────────────
const ProtectedRoute = ({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) => {
  const { token, user } = useAuth();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
};

// ── Smart Root: Landing for guests, Dashboard for logged-in users ─────────────
const RootRoute = () => {
  const { token, user } = useAuth();
  if (token && user) {
    return (
      <Layout>
        <Dashboard />
      </Layout>
    );
  }
  return (
    <PublicLayout>
      <Landing />
    </PublicLayout>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRoute />} />

          {/* Protected routes */}
          <Route path="/history" element={
            <ProtectedRoute>
              <Layout>
                <History />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute adminOnly>
              <Layout>
                <Admin />
              </Layout>
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
