// admin/src/pages/Matches.tsx —— 对局管理（Phase 2 完整：筛选 + 详情 Drawer + admin 删）。
import { useEffect, useState, useCallback } from 'react';
import { Card, Table, Typography, Select, Button, Drawer, Tag, Popconfirm, Message, Space } from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';
import { listMatches, deleteRecord } from '../api/client';
import type { Match } from '../api/types';
import { useAuth } from '../auth/AuthContext';

const { Title, Paragraph, Text } = Typography;
const GAME_MODES = ['std8', 'std10', 'std12', 'rescue', 'one-a', 'hard1', 'hard2', 'feiqiu', 'suiji', 'doubles', 'feiqiu-doubles'];

export default function Matches() {
  const { account } = useAuth();
  const isAdmin = account?.role === 'admin';
  const [data, setData] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<string>('');
  const [gameMode, setGameMode] = useState<string>('');
  const [detail, setDetail] = useState<Match | null>(null);

  const fetchData = useCallback(() => {
    const f: string[] = [];
    if (mode) f.push(`mode='${mode}'`);
    if (gameMode) f.push(`game_mode='${gameMode}'`);
    setLoading(true);
    listMatches({ expand: 'players,host', sort: '-created', perPage: 100, ...(f.length ? { filter: f.join(' && ') } : {}) })
      .then(r => setData(r.items))
      .catch(e => Message.error(`读取对局失败：${(e as Error).message}`))
      .finally(() => setLoading(false));
  }, [mode, gameMode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const del = async (id: string) => {
    try { await deleteRecord('matches', id); Message.success('已删除'); fetchData(); }
    catch (e) { Message.error(`删除失败：${(e as Error).message}`); }
  };

  const columns: TableColumnProps<Match>[] = [
    { title: '时间', dataIndex: 'created', render: v => new Date(v as string).toLocaleString('zh-CN') },
    { title: '模式', dataIndex: 'mode', render: v => v === 'match' ? <Tag color="green">比赛</Tag> : <Tag>练习</Tag> },
    { title: '赛制', dataIndex: 'game_mode' },
    { title: '选手', dataIndex: 'players', render: (_, r) => {
      const ps = (r as unknown as { players?: Array<{ nickname: string }> }).players;
      return ps?.map(p => p.nickname).join('、') || '—';
    } },
    { title: '比分', dataIndex: 'score_total' },
    { title: 'host', dataIndex: 'host', render: (_, r) => {
      const h = (r as unknown as { host?: { display_name?: string } }).host;
      return h?.display_name || '—';
    } },
    { title: '操作', dataIndex: 'id', render: (_, r) => (
      <Space>
        <Button size="mini" type="text" onClick={() => setDetail(r)}>详情</Button>
        {isAdmin && (
          <Popconfirm title="确认删除此对局？(admin)" onOk={() => del(r.id)}>
            <Button size="mini" type="text" status="danger">删除</Button>
          </Popconfirm>
        )}
      </Space>
    ) },
  ];

  return (
    <Card>
      <Title heading={5} style={{ marginTop: 0 }}>对局管理</Title>
      <Space style={{ marginBottom: 12 }}>
        <Select value={mode || undefined} placeholder="模式" style={{ width: 120 }} allowClear onChange={v => setMode((v as string) || '')}>
          <Select.Option value="match">比赛</Select.Option>
          <Select.Option value="practice">练习</Select.Option>
        </Select>
        <Select value={gameMode || undefined} placeholder="赛制" style={{ width: 150 }} allowClear onChange={v => setGameMode((v as string) || '')}>
          {GAME_MODES.map(m => <Select.Option key={m} value={m}>{m}</Select.Option>)}
        </Select>
        <Button type="primary" onClick={fetchData}>查询</Button>
      </Space>
      <Table loading={loading} data={data} rowKey="id" columns={columns} pagination={{ pageSize: 15 }} />

      <Drawer visible={!!detail} width={540} title="对局详情" onCancel={() => setDetail(null)} footer={null}>
        {detail && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 8, fontSize: 14 }}>
              <Text type="secondary">时间</Text><Text>{new Date(detail.created).toLocaleString('zh-CN')}</Text>
              <Text type="secondary">模式</Text><Text>{detail.mode}</Text>
              <Text type="secondary">赛制</Text><Text>{detail.game_mode}</Text>
              <Text type="secondary">比分</Text><Text>{String(detail.score_total ?? '—')}</Text>
              <Text type="secondary">result</Text><Text>{JSON.stringify(detail.result) || '—'}</Text>
              <Text type="secondary">started_at</Text><Text>{detail.started_at || '—'}</Text>
              <Text type="secondary">ended_at</Text><Text>{detail.ended_at || '—'}</Text>
            </div>
            <div style={{ marginTop: 12 }}>
              <Text type="secondary">payload_code：</Text>
              <Paragraph copyable={{ text: detail.payload_code }} style={{ wordBreak: 'break-all', fontSize: 12, margin: '4px 0' }}>{detail.payload_code}</Paragraph>
              <Button size="small" onClick={() => window.open(`/#${detail.payload_code}`, '_blank')}>贴码还原（跳展示层）</Button>
            </div>
            {detail.bp_config != null && (
              <div style={{ marginTop: 12 }}>
                <Text type="secondary">bp_config 快照：</Text>
                <pre style={{ background: '#f6f8fa', padding: 8, fontSize: 12, overflow: 'auto', maxHeight: 240 }}>{JSON.stringify(detail.bp_config, null, 2)}</pre>
              </div>
            )}
          </>
        )}
      </Drawer>
    </Card>
  );
}
