// admin/src/pages/Players.tsx —— 选手管理（Phase 2 完整：CRUD Form+Modal，player_code 稳定锚不可改）。
import { useEffect, useState, useCallback } from 'react';
import { Card, Table, Typography, Tag, Message, Space, Button, Modal, Form, Input, Select, Switch, Popconfirm } from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';
import { listPlayers, createRecord, updateRecord, deleteRecord } from '../api/client';
import type { Player, RacePref } from '../api/types';
import { useAuth } from '../auth/AuthContext';

const { Title } = Typography;
const FormItem = Form.Item;
const RACE: Record<string, { label: string; color: string }> = {
  t: { label: 'T', color: 'blue' }, z: { label: 'Z', color: 'purple' }, p: { label: 'P', color: 'gold' },
};

interface FormVals { nickname: string; player_code: string; race_pref: RacePref | ''; active: boolean; notes: string }

export default function Players() {
  const { account } = useAuth();
  const canEdit = account?.role === 'host' || account?.role === 'admin';
  const isAdmin = account?.role === 'admin';
  const [data, setData] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [form] = Form.useForm<FormVals>();
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    listPlayers({ perPage: 200, sort: 'nickname' })
      .then(r => setData(r.items))
      .catch(e => Message.error(`读取选手失败：${(e as Error).message}`))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openNew = () => {
    setEditing(null);
    form.setFieldsValue({ nickname: '', player_code: '', race_pref: '', active: true, notes: '' });
    setVisible(true);
  };
  const openEdit = (p: Player) => {
    setEditing(p);
    form.setFieldsValue({ nickname: p.nickname, player_code: p.player_code, race_pref: p.race_pref || '', active: p.active ?? true, notes: p.notes || '' });
    setVisible(true);
  };

  const onSubmit = async (vals: FormVals) => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        nickname: vals.nickname,
        player_code: vals.player_code,
        race_pref: vals.race_pref || undefined,
        active: vals.active,
        notes: vals.notes || undefined,
      };
      if (editing) {
        // player_code 稳定锚不可改（编辑时 disabled，不提交）
        delete body.player_code;
        await updateRecord<Player>('players', editing.id, body);
        Message.success('已更新');
      } else {
        await createRecord<Player>('players', body);
        Message.success('已新建');
      }
      setVisible(false);
      fetchData();
    } catch (e) {
      Message.error(`保存失败：${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: string) => {
    try { await deleteRecord('players', id); Message.success('已删除'); fetchData(); }
    catch (e) { Message.error(`删除失败：${(e as Error).message}`); }
  };

  const columns: TableColumnProps<Player>[] = [
    { title: '昵称', dataIndex: 'nickname' },
    { title: 'player_code', dataIndex: 'player_code', render: v => <code>{v as string}</code> },
    { title: '种族', dataIndex: 'race_pref', render: v => { const r = RACE[v as string]; return r ? <Tag color={r.color}>{r.label}</Tag> : '—'; } },
    { title: '在役', dataIndex: 'active', render: v => v ? <Tag color="green">在役</Tag> : <Tag>退役</Tag> },
    { title: '备注', dataIndex: 'notes', render: v => (v as string) || '—' },
    ...(canEdit ? [{
      title: '操作', dataIndex: 'id', render: (_: unknown, r: Player) => (
        <Space>
          <Button size="mini" type="text" onClick={() => openEdit(r)}>编辑</Button>
          {isAdmin && <Popconfirm title="确认删除？(admin)" onOk={() => del(r.id)}><Button size="mini" type="text" status="danger">删除</Button></Popconfirm>}
        </Space>
      ),
    }] : []),
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Title heading={5} style={{ margin: 0 }}>选手管理</Title>
        {canEdit && <Button type="primary" onClick={openNew}>新建选手</Button>}
      </div>
      <Table loading={loading} data={data} rowKey="id" columns={columns} pagination={{ pageSize: 15 }} />

      <Modal visible={visible} title={editing ? '编辑选手' : '新建选手'} onCancel={() => setVisible(false)} footer={null}>
        <Form form={form} layout="vertical" onSubmit={onSubmit}>
          <FormItem label="昵称" field="nickname" rules={[{ required: true, message: '请输入昵称' }]}>
            <Input placeholder="昵称（可改）" maxLength={40} />
          </FormItem>
          <FormItem label="player_code（稳定锚，直播展示用，不可改）" field="player_code" rules={[{ required: true, message: '请输入 player_code' }]}>
            <Input placeholder="报名号/工会号" maxLength={64} disabled={!!editing} />
          </FormItem>
          <FormItem label="主玩种族" field="race_pref">
            <Select allowClear placeholder="种族">
              <Select.Option value="t">T (人族)</Select.Option>
              <Select.Option value="z">Z (虫族)</Select.Option>
              <Select.Option value="p">P (星灵)</Select.Option>
            </Select>
          </FormItem>
          <FormItem label="在役" field="active" triggerPropName="checked">
            <Switch />
          </FormItem>
          <FormItem label="备注" field="notes"><Input.TextArea placeholder="备注" /></FormItem>
          <FormItem><Space><Button type="primary" htmlType="submit" loading={saving}>保存</Button><Button onClick={() => setVisible(false)}>取消</Button></Space></FormItem>
        </Form>
      </Modal>
    </Card>
  );
}
