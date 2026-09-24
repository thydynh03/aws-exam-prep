import React from 'react';
import type { AWSDomain } from '../core/types';
import { getDomainMeta } from '../core/domainMeta';
import { Shield, Layers, Zap, DollarSign } from 'lucide-react';

interface ContentDomainBadgeProps {
  domain: AWSDomain;
  showWeight?: boolean;
  size?: 'sm' | 'md' | 'lg';
  shortText?: boolean;
  className?: string;
}

export const ContentDomainBadge: React.FC<ContentDomainBadgeProps> = ({
  domain,
  showWeight = true,
  size = 'md',
  shortText = false,
  className = '',
}) => {
  const meta = getDomainMeta(domain);

  const renderIcon = () => {
    switch (meta.id) {
      case 1:
        return <Shield className="h-3.5 w-3.5 shrink-0" />;
      case 2:
        return <Layers className="h-3.5 w-3.5 shrink-0" />;
      case 3:
        return <Zap className="h-3.5 w-3.5 shrink-0" />;
      case 4:
        return <DollarSign className="h-3.5 w-3.5 shrink-0" />;
    }
  };

  const textSize = size === 'sm' ? 'text-[11px] px-2 py-0.5' : size === 'lg' ? 'text-xs sm:text-sm px-3 py-1' : 'text-xs px-2.5 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-md border shadow-2xs transition-colors ${meta.badgeClasses} ${textSize} ${className}`}
      title={`${meta.domain} (${meta.weightLabel} of exam content): ${meta.descriptionVi}`}
    >
      {renderIcon()}
      <span>
        {shortText ? (
          <>
            <strong className="font-mono">{meta.code}</strong>
            <span className="hidden xs:inline">: {meta.shortTitle}</span>
          </>
        ) : (
          meta.domain
        )}
      </span>
      {showWeight && (
        <span className="rounded bg-black/5 dark:bg-white/10 px-1 py-0.2 font-mono text-[10px] font-bold">
          {meta.weightLabel}
        </span>
      )}
    </span>
  );
};
