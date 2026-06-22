// admin/src/guard/RoleRoute.tsx
// role 路由守卫：未登录跳 /login；role 不足显示 403（防直接访问 URL）。
// 菜单可见性在 AdminLayout 按 role 过滤；这里兜底拦截深链。
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Result } from '@arco-design/web-react';
import type { Role } from '../api/types';
import { useAuth } from '../auth/AuthContext';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  if (!account) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RoleRoute({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { account } = useAuth();
  if (!account) return <Navigate to="/login" replace />;
  if (!allow.includes(account.role)) {
    return <Result status="403" title="无权限" subTitle={`当前角色 ${account.role} 无权访问此模块`} />;
  }
  return <>{children}</>;
}
