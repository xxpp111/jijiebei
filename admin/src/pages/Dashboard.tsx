// admin/src/pages/Dashboard.tsx
// 首页：当前赛季 + 系数表（/api/scoring）。
import { useEffect, useState } from 'react';
import { Card, Typography, Table, Spin, Message } from '@arco-design/web-react';
import { getScoring } from '../api/client';
import type { ScoringResp } from '../api/types';

const { Title, Text } = Typography;

export default function Dashboard() {
  const [data, setData] = useState<ScoringResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getScoring()
      .then(setData)
      .catch(e => Message.error(`读取系数失败：${(e as Error).message}`))
      .finally(() => setLoading(false));
  }, []);

  const rows = data ? Object.entries(data.coefficients).map(([mode, coef]) => ({ mode, coef })) : [];

  return (
    <Card>
      <Title heading={5} style={{ marginTop: 0 }}>概览</Title>
      {loading ? <Spin /> : data ? (
        <>
          <Text>当前赛季：<b>{data.current_season}</b></Text>
          <Text style={{ marginLeft: 16, color: 'var(--color-text-3)' }}>{data.formula}</Text>
          <Table
            style={{ marginTop: 12 }}
            data={rows}
            rowKey="mode"
            pagination={false}
            columns={[
              { title: '赛制 (game_mode)', dataIndex: 'mode' },
              { title: '系数', dataIndex: 'coef' },
            ]}
          />
        </>
      ) : <Text type="error">系数未加载</Text>}
    </Card>
  );
}
