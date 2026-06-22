// admin/src/App.tsx —— 路由。/login 公开；其余在 RequireAuth(AdminLayout) 下，每模块 RoleRoute 兜底 role。
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './auth/Login';
import AdminLayout from './layout/AdminLayout';
import Dashboard from './pages/Dashboard';
import Matches from './pages/Matches';
import Players from './pages/Players';
import Rankings from './pages/Rankings';
import Logs from './pages/Logs';
import Accounts from './pages/Accounts';
import { RequireAuth, RoleRoute } from './guard/RoleRoute';
import type { Role } from './api/types';

const ALL: Role[] = ['admin', 'host', 'viewer'];
const ADMIN: Role[] = ['admin'];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><AdminLayout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="/matches" element={<RoleRoute allow={ALL}><Matches /></RoleRoute>} />
        <Route path="/players" element={<RoleRoute allow={ALL}><Players /></RoleRoute>} />
        <Route path="/rankings" element={<RoleRoute allow={ALL}><Rankings /></RoleRoute>} />
        <Route path="/logs" element={<RoleRoute allow={ADMIN}><Logs /></RoleRoute>} />
        <Route path="/accounts" element={<RoleRoute allow={ADMIN}><Accounts /></RoleRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
