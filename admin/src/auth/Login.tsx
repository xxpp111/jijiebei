// admin/src/auth/Login.tsx
// 后台 B 端登录（Arco Form）。邮箱+密码 → /api/collections/accounts/auth-with-password。
// 与展示层登录(Brief F, SC2 风)分离——后台是 B 端 Arco 登录（IA「登录」段）。
import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Message } from '@arco-design/web-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const FormItem = Form.Item;
const { Title } = Typography;

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const from = (loc.state as { from?: string })?.from || '/';

  const onSubmit = async (values: { identity: string; password: string }) => {
    setLoading(true);
    try {
      const acc = await login(values.identity, values.password);
      Message.success(`欢迎，${acc.display_name || acc.email}`);
      nav(from, { replace: true });
    } catch (e) {
      const msg = (e as Error).message || '登录失败';
      Message.error(msg.includes('401') || msg.includes('400') ? '邮箱或密码错误' : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 380 }} bordered>
        <Title heading={4} style={{ marginTop: 0, marginBottom: 4 }}>集结杯 · 管理后台</Title>
        <Typography.Text type="secondary">主播 / 裁判操作台</Typography.Text>
        <Form form={form} layout="vertical" onSubmit={onSubmit} style={{ marginTop: 16 }}
          wrapperCol={{ style: { width: '100%' } }}>
          <FormItem label="邮箱" field="identity" rules={[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '邮箱格式不正确' },
          ]}>
            <Input placeholder="admin@jjb.local" />
          </FormItem>
          <FormItem label="密码" field="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password placeholder="密码" />
          </FormItem>
          <FormItem>
            <Button type="primary" htmlType="submit" long loading={loading}>登录</Button>
          </FormItem>
        </Form>
      </Card>
    </div>
  );
}
