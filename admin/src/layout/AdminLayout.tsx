// admin/src/layout/AdminLayout.tsx
// Arco Layout：顶栏（品牌+当前赛季+账号+登出）+ 侧导航 Menu（按 role 过滤）+ 内容区 Outlet。
import { Layout, Menu, Typography, Button, Tag, Space } from '@arco-design/web-react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getScoring } from '../api/client';
import type { Role, ScoringResp } from '../api/types';

const { Header, Sider, Content } = Layout;

interface NavItem { key: string; label: string; roles: Role[] }
const NAV: NavItem[] = [
  { key: '/matches', label: '对局', roles: ['admin', 'host', 'viewer'] },
  { key: '/players', label: '选手', roles: ['admin', 'host', 'viewer'] },
  { key: '/rankings', label: '积分天梯', roles: ['admin', 'host', 'viewer'] },
  { key: '/logs', label: '日志', roles: ['admin'] },
  { key: '/accounts', label: '账号', roles: ['admin'] },
];

const ROLE_TAG: Record<Role, string> = { admin: 'red', host: 'arcoblue', viewer: 'gray' };

export default function AdminLayout() {
  const { account, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [season, setSeason] = useState<string>('');

  useEffect(() => {
    getScoring().then((s: ScoringResp) => setSeason(s.current_season)).catch(() => setSeason('—'));
  }, []);

  const items = NAV.filter(n => account && n.roles.includes(account.role));
  const selected = '/' + (loc.pathname.split('/')[1] || '');

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <Space>
          <Typography.Title heading={6} style={{ color: 'var(--color-text-1)', margin: 0 }}>集结杯 · 管理后台</Typography.Title>
          {season && <Tag color="green" bordered>赛季 {season}</Tag>}
        </Space>
        <Space>
          <Typography.Text style={{ color: 'var(--color-text-2)' }}>{account?.display_name || account?.email}</Typography.Text>
          <Tag color={account ? ROLE_TAG[account.role] : 'gray'} bordered>{account?.role}</Tag>
          <Button size="small" onClick={() => { logout(); nav('/login', { replace: true }); }}>登出</Button>
        </Space>
      </Header>
      <Layout>
        <Sider style={{ width: 200, background: 'var(--color-bg-2)' }}>
          <Menu selectedKeys={[selected]} onClickMenuItem={(key) => nav(key)}>
            {items.map(n => <Menu.Item key={n.key}>{n.label}</Menu.Item>)}
          </Menu>
        </Sider>
        <Content style={{ padding: 20, background: 'var(--color-bg-1)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
