import { logoUrl, titleUrl } from '../lib/realAsset';

export interface BrandLockupProps {
  styleName: string;
  modeName: string;
  size: 'lg' | 'sm';
}

export function BrandLockup({ styleName, modeName, size }: BrandLockupProps) {
  const logo = logoUrl(styleName, modeName);
  const title = titleUrl(styleName, modeName);
  const titleHeight = size === 'lg' ? 56 : 30;

  return (
    <div className={`lockup lockup-${size}`}>
      {logo ? (
        <img className="lockup-mark" src={logo} alt="CM" />
      ) : (
        <span
          className="lockup-mark"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}
        >
          CM
        </span>
      )}
      <span className="lockup-div"></span>
      {title ? (
        <img className="lockup-title" src={title} alt="集结杯" style={{ height: titleHeight, display: 'block' }} />
      ) : (
        <span
          className="lockup-title lockup-cn"
          style={{ height: titleHeight, lineHeight: `${titleHeight}px`, display: 'block' }}
        >
          集结杯
        </span>
      )}
    </div>
  );
}
