// admin/src/pages/Rankings.tsx —— 积分天梯（Phase 3 完整：天梯榜 + admin 手动调分 + 调分记录）。
import { useEffect, useState, useCallback } from 'react';
import { Card, Table, Typography, Tag, Message, Form, Input, InputNumber, Button, Select, Divider } from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';
import { getRankings, getScoring, listPlayers, listMatches, listScores, createRecord } from '../api/client';
import type { RankingRow, RankingsResp, Player, Match, Score } from '../api/types';
import { useAuth } from '../auth/AuthContext';

const { Title, Text } = Typography;
const FormItem = Form.Item;

interface AdjustVals { player: string; match: string; delta: number; reason: string }

export default function Rankings() {
  const { account } = useAuth();
  const isAdmin = account?.role === 'admin';
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [season, setSeason] = useState('');
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [adjForm] = Form.useForm<AdjustVals>();
  const [adjusting, setAdjusting] = useState(false);

  const fetchRankings = useCallback(() => {
    setLoading(true);
    getRankings()
      .then((r: RankingsResp) => { setRows(r.rankings); setSeason(r.season); })
      .catch(e => Message.error(`读取天梯失败：${(e as Error).message}`))
      .finally(() => setLoading(false));
  }, []);

  const fetchScores = useCallback(() => {
    listScores({ expand: 'player,match', sort: '-created', perPage: 50 })
      .then(r => setScores(r.items))
      .catch(() => { /* 非 admin 会 403，静默 */ });
  }, []);

  useEffect(() => {
    fetchRankings();
    if (isAdmin) {
      fetchScores();
      listPlayers({ perPage: 200, sort: 'nickname' }).then(r => setPlayers(r.items)).catch(() => {});
      listMatches({ perPage: 100, sort: '-created' }).then(r => setMatches(r.items)).catch(() => {});
    }
  }, [fetchRankings, fetchScores, isAdmin]);

  const onAdjust = async (vals: AdjustVals) => {
    setAdjusting(true);
    try {
      const sc = await getScoring();
      await createRecord<Score>('scores', { player: vals.player, match: vals.match, delta: vals.delta, reason: vals.reason, season: sc.current_season });
      Message.success(`已调分 ${vals.delta > 0 ? '+' : ''}${vals.delta}（赛季 ${sc.current_season}，进审计）`);
      adjForm.resetFields();
      fetchRankings();
      fetchScores();
    } catch (e) {
      Message.error(`调分失败：${(e as Error).message}`);
    } finally {
      setAdjusting(false);
    }
  };

  const rankCols: TableColumnProps<RankingRow>[] = [
    { title: '名次', dataIndex: '_rank', render: (_, r) => <b>{rows.indexOf(r) + 1}</b> },
    { title: '选手', dataIndex: 'nickname' },
    { title: 'player_code', dataIndex: 'player_code' },
    { title: '种族', dataIndex: 'race_pref', render: v => v ? <Tag>{(v as string).toUpperCase()}</Tag> : '—' },
    { title: '总积分', dataIndex: 'total_delta', render: v => <b style={{ color: 'rgb(var(--arcoblue-6))' }}>{Number(v).toFixed(2)}</b> },
    { title: '对局数', dataIndex: 'match_count' },
  ];

  const scoreCols: TableColumnProps<Score>[] = [
    { title: '时间', dataIndex: 'created', render: v => new Date(v as string).toLocaleString('zh-CN') },
    { title: '选手', dataIndex: 'player', render: (_, r) => (r as unknown as { player?: Player }).player?.nickname || (r as unknown as { player?: string }).player || '—' },
    { title: 'delta', dataIndex: 'delta', render: v => <b style={{ color: Number(v) >= 0 ? 'rgb(var(--green-6))' : 'rgb(var(--red-6))' }}>{Number(v) >= 0 ? '+' : ''}{Number(v).toFixed(2)}</b> },
    { title: 'reason', dataIndex: 'reason', render: v => (v as string) || '—' },
    { title: '来源对局', dataIndex: 'match', render: v => (v as string)?.slice(0, 8) || '手动' },
    { title: '赛季', dataIndex: 'season' },
  ];

  return (
    <Card>
      <Title heading={5} style={{ marginTop: 0 }}>积分天梯 {season && <Tag color="green" bordered>{season}</Tag>}</Title>
      <Table loading={loading} data={rows} rowKey="player_id" columns={rankCols} pagination={false} />

      {isAdmin && (
        <>
          <Divider />
          <Title heading={6}>手动调分（admin）</Title>
          <Text type="secondary">选手 + 来源对局 + delta + reason → POST scores（scores.match 必填，调分关联来源对局可追溯），进审计日志，天梯实时刷新。</Text>
          <Form form={adjForm} layout="inline" onSubmit={onAdjust} style={{ marginTop: 12 }}>
            <FormItem field="player" rules={[{ required: true, message: '选选手' }]}>
              <Select placeholder="选手" style={{ width: 200 }} showSearch>
                {players.map(p => <Select.Option key={p.id} value={p.id}>{p.nickname} ({p.player_code})</Select.Option>)}
              </Select>
            </FormItem>
            <FormItem field="match" rules={[{ required: true, message: '选来源对局' }]}>
              <Select placeholder="来源对局" style={{ width: 260 }} showSearch>
                {matches.map(m => <Select.Option key={m.id} value={m.id}>{m.game_mode} · {new Date(m.created).toLocaleDateString('zh-CN')} · {m.id.slice(0, 8)}</Select.Option>)}
              </Select>
            </FormItem>
            <FormItem field="delta" rules={[{ required: true, message: '输入 delta' }]}>
              <InputNumber placeholder="delta（如 5 / -2）" style={{ width: 160 }} step={0.1} />
            </FormItem>
            <FormItem field="reason" rules={[{ required: true, message: '输入原因' }]}>
              <Input placeholder="原因（如：补录/修正）" style={{ width: 220 }} />
            </FormItem>
            <FormItem><Button type="primary" htmlType="submit" loading={adjusting}>调分</Button></FormItem>
          </Form>

          <Title heading={6} style={{ marginTop: 20 }}>调分记录</Title>
          <Table data={scores} rowKey="id" columns={scoreCols} pagination={{ pageSize: 10 }} />
        </>
      )}
    </Card>
  );
}
