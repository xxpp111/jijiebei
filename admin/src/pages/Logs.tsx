// admin/src/pages/Logs.tsx —— 日志审计（admin only，只读；Phase 3 完整：筛选 action/操作者 + detail 展开）。
import { useEffect, useState, useCallback } from 'react';
import { Card, Table, Typography, Tag, Message, Space, Input, Button } from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';
import { listLogs } from '../api/client';
import type { LogEntry } from '../api/types';

const { Title, Text } = Typography;

export default function Logs() {
  const [data, setData] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');

  const fetchData = useCallback(() => {
    const f: string[] = [];
    if (action) f.push(`action='${action}'`);
    if (actor) f.push(`actor='${actor}'`);
    setLoading(true);
    listLogs({ expand: 'actor', sort: '-created', perPage: 100, ...(f.length ? { filter: f.join(' && ') } : {}) })
      .then(r => setData(r.items))
      .catch(e => Message.error(`读取日志失败：${(e as Error).message}`))
      .finally(() => setLoading(false));
  }, [action, actor]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns: TableColumnProps<LogEntry>[] = [
    { title: '时间', dataIndex: 'created', render: v => new Date(v as string).toLocaleString('zh-CN') },
    { title: '操作者', dataIndex: 'actor', render: (_, r) => {
      const a = (r as unknown as { actor?: { display_name?: string } }).actor;
      return a?.display_name || '系统';
    } },
    { title: '动作', dataIndex: 'action', render: v => <Tag color="arcoblue">{v as string}</Tag> },
    { title: '对象', dataIndex: 'target_type' },
    { title: '对象 ID', dataIndex: 'target_id', render: v => (v as string)?.slice(0, 8) || '—' },
    { title: 'IP', dataIndex: 'ip', render: v => (v as string) || '—' },
    { title: '详情', dataIndex: 'detail', render: v => v ? <Text style={{ fontSize: 12 }}>{JSON.stringify(v).slice(0, 80)}</Text> : '—' },
  ];

  return (
    <Card>
      <Title heading={5} style={{ marginTop: 0 }}>日志审计 <Tag bordered style={{ marginLeft: 8 }}>只读</Tag></Title>
      <Space style={{ marginBottom: 12 }}>
        <Input value={action} onChange={v => setAction(v)} placeholder="动作（如 match.create）" style={{ width: 200 }} allowClear />
        <Input value={actor} onChange={v => setActor(v)} placeholder="操作者 ID" style={{ width: 220 }} allowClear />
        <Button type="primary" onClick={fetchData}>查询</Button>
      </Space>
      <Table loading={loading} data={data} rowKey="id" columns={columns} pagination={{ pageSize: 15 }} />
    </Card>
  );
}
