import { raceUrl } from '../lib/realAsset';
import { raceNameZh, type RaceCode } from '../data/aiEnemyPool';

// EnemyBadge — 随机敌方「印花块」(.menemy)，承接 Claude Design 项目 e956fe00 的 proposals/random-enemy/02-enemy-block。
// 叠在地图缩略图右上角：种族印花(印花即种族) + AI 敌军组合中文名。三档尺寸 lg(select)/md(battle)/sm(obs，省「敌方」字)。
// 真印花 png 入库前 raceUrl 返回 '' → 走种族文字徽章(神/人/虫 + 种族色)兜底，入库后自动用真图。
export function EnemyBadge({ race, ai, size = 'lg' }: { race?: RaceCode; ai?: string; size?: 'lg' | 'md' | 'sm' }) {
  if (!race && !ai) return null; // OFF：整块不渲染（留白不占位）
  const img = race ? raceUrl(race) : '';
  return (
    <span className={'menemy menemy-' + size} data-enemy-race={race ?? ''} data-screen-label="enemy-badge">
      {img ? (
        <img className="menemy-em" src={img} alt={race ? raceNameZh(race) : ''} />
      ) : race ? (
        <span className="menemy-glyph" data-race={race}>{raceNameZh(race).charAt(0)}</span>
      ) : null}
      <span className="menemy-col">
        {size !== 'sm' && <span className="menemy-rk">敌方</span>}
        {ai && <span className="menemy-nm">{ai}</span>}
      </span>
    </span>
  );
}
