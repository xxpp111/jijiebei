import { logoUrl } from '../lib/realAsset';

export interface BrandLockupProps {
  styleName: string;
  modeName: string;
  size: 'lg' | 'sm' | 'obs';
}

export function BrandLockup({ styleName, modeName, size }: BrandLockupProps) {
  const logo = logoUrl(styleName, modeName);
  const obs = size === 'obs';

  return (
    <div className={`lockup lockup-${size}`} data-brand-lockup>
      {logo ? (
        <img className={'lockup-mark' + (obs ? ' obs-score-mark' : '')} src={logo} alt="CM" />
      ) : (
        <span
          className={'lockup-mark' + (obs ? ' obs-score-mark' : '')}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}
        >
          CM
        </span>
      )}
      <span className={'lockup-div' + (obs ? ' obs-score-div' : '')}></span>
      <div className="lockup-word" aria-label="集结杯 REGROUP CUP">
        <span className={'lockup-cn' + (obs ? ' obs-score-cn' : '')}>
          集结杯
        </span>
        <span className={'lockup-en' + (obs ? ' obs-score-en' : '')}>
          REGROUP CUP
        </span>
      </div>
    </div>
  );
}
