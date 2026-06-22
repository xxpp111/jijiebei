// admin/src/pages/Accounts.tsx —— 账号管理（admin only；Phase 3 完整：CRUD 建主播/裁判 + 改 role + 验证）。
import { useEffect, useState, useCallback } from 'react';
import { Card, Table, Typography, Tag, Message, Space, Button, Modal, Form, Input, Select, Popconfirm } from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';
import { listAccounts, createRecord, updateRecord, deleteRecord } from '../api/client';
import type { Account, Role } from '../api/types';

const { Title } = Typography;
const FormItem = Form.Item;

interface FormVals { email: string; password: string; passwordConfirm: string; display_name: string; role: Role }

export default function Accounts() {
  const [data, setData] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [form] = Form.useForm<FormVals>();
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    listAccounts({ perPage: 100, sort: 'email' })
      .then(r => setData(r.items))
      .catch(e => Message.error(`读取账号失败：${(e as Error).message}`))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openNew = () => {
    form.setFieldsValue({ email: '', password: '', passwordConfirm: '', display_name: '', role: 'host' });
    setVisible(true);
  };

  const onSubmit = async (vals: FormVals) => {
    setSaving(true);
    try {
      await createRecord<Account>('accounts', {
        email: vals.email, password: vals.password, passwordConfirm: vals.passwordConfirm,
        role: vals.role, display_name: vals.display_name,
      });
      Message.success('已建账号');
      setVisible(false);
      fetchData();
    } catch (e) {
      Message.error(`建账号失败：${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (id: string, role: Role) => {
    try { await updateRecord<Account>('accounts', id, { role }); Message.success('已改角色'); fetchData(); }
    catch (e) { Message.error(`改角色失败：${(e as Error).message}`); }
  };

  const del = async (id: string) => {
    try { await deleteRecord('accounts', id); Message.success('已删除'); fetchData(); }
    catch (e) { Message.error(`删除失败：${(e as Error).message}`); }
  };

  const columns: TableColumnProps<Account>[] = [
    { title: '邮箱', dataIndex: 'email' },
    { title: '显示名', dataIndex: 'display_name' },
    { title: '角色', dataIndex: 'role', render: (_, r) => (
      <Select value={r.role} style={{ width: 110 }} onChange={v => changeRole(r.id, v as Role)}>
        <Select.Option value="admin">admin</Select.Option>
        <Select.Option value="host">host</Select.Option>
        <Select.Option value="viewer">viewer</Select.Option>
      </Select>
    ) },
    { title: '已验证', dataIndex: 'verified', render: v => v ? <Tag color="green">✓</Tag> : <Tag>未验证</Tag> },
    { title: '操作', dataIndex: 'id', render: (_, r) => (
      <Popconfirm title="确认删除此账号？" onOk={() => del(r.id)}>
        <Button type="text" size="mini" status="danger">删除</Button>
      </Popconfirm>
    ) },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Title heading={5} style={{ margin: 0 }}>账号管理</Title>
        <Button type="primary" onClick={openNew}>新建账号</Button>
      </div>
      <Table loading={loading} data={data} rowKey="id" columns={columns} pagination={{ pageSize: 15 }} />

      <Modal visible={visible} title="新建账号（主播/裁判）" onCancel={() => setVisible(false)} footer={null}>
        <Form form={form} layout="vertical" onSubmit={onSubmit}>
          <FormItem label="邮箱" field="email" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
            <Input placeholder="email@jjb.local" />
          </FormItem>
          <FormItem label="显示名" field="display_name" rules={[{ required: true, message: '请输入显示名' }]}>
            <Input placeholder="显示名" maxLength={100} />
          </FormItem>
          <FormItem label="密码" field="password" rules={[{ required: true, message: '请输入密码' }, { minLength: 8, message: '至少 8 位' }]}>
            <Input.Password placeholder="密码" />
          </FormItem>
          <FormItem label="确认密码" field="passwordConfirm" rules={[{ required: true, message: '请确认密码' }, {
            validator: (v: string | undefined, cb: (err?: string) => void) => {
              if (v !== form.getFieldValue('password')) cb('两次密码不一致'); else cb();
            },
          }]}>
            <Input.Password placeholder="确认密码" />
          </FormItem>
          <FormItem label="角色" field="role" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="admin">admin（管理员）</Select.Option>
              <Select.Option value="host">host（主播/裁判）</Select.Option>
              <Select.Option value="viewer">viewer（只读）</Select.Option>
            </Select>
          </FormItem>
          <FormItem><Space><Button type="primary" htmlType="submit" loading={saving}>创建</Button><Button onClick={() => setVisible(false)}>取消</Button></Space></FormItem>
        </Form>
      </Modal>
    </Card>
  );
}
