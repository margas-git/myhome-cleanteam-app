import React from "react";
import { Route, Switch, useLocation } from "wouter";
import { Login } from "./pages/Login";
import { StaffDashboard } from "./pages/staff/StaffDashboard";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { StaffManagement } from "./pages/admin/StaffManagement";
import { CustomerManagement } from "./pages/admin/CustomerManagement";
import { TeamManagement } from "./pages/admin/TeamManagement";
import { Reports } from "./pages/admin/Reports";
import Settings from "./pages/admin/Settings";
import { useAuth } from "./hooks/useAuth";

function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
    return <Redirect to={user.role === 'staff' ? '/staff/dashboard' : '/admin'} />;
  }
  
  return <>{children}</>;
}

function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  React.useEffect(() => {
    setLocation(to);
  }, [to, setLocation]);
  return null;
}

function App() {
  const { user } = useAuth();

  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* Staff Routes */}
      <Route path="/staff/dashboard">
        <ProtectedRoute requiredRole="staff">
          <StaffDashboard />
        </ProtectedRoute>
      </Route>

      {/* Admin Routes */}
      <Route path="/admin">
        <ProtectedRoute requiredRole="admin">
          <AdminDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/staff">
        <ProtectedRoute requiredRole="admin">
          <StaffManagement />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/customers">
        <ProtectedRoute requiredRole="admin">
          <CustomerManagement />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/teams">
        <ProtectedRoute requiredRole="admin">
          <TeamManagement />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/reports">
        <ProtectedRoute requiredRole="admin">
          <Reports />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/settings">
        <ProtectedRoute requiredRole="admin">
          <Settings />
        </ProtectedRoute>
      </Route>

      {/* Root redirect based on user role */}
      <Route path="/">
        {user ? (
          <Redirect to={user.role === 'admin' || user.role === 'manager' ? '/admin' : '/staff/dashboard'} />
        ) : (
          <Redirect to="/login" />
        )}
      </Route>
    </Switch>
  );
}

export default App;
