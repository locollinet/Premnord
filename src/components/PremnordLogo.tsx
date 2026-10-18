import React from 'react';
import { useFirebase } from '../context/FirebaseContext';

interface PremnordLogoProps {
  className?: string;
  size?: number | string;
  color?: string;
}

export const PremnordLogo: React.FC<PremnordLogoProps> = ({ 
  className = '', 
  size = 40, 
  color = '#6E776E' // Premium Sage/Olive green from Premnord brand
}) => {
  let appLogo: string | null = null;
  try {
    const context = useFirebase();
    appLogo = context?.appLogo || null;
  } catch (e) {
    // Fail-safe if rendered outside FirebaseProvider
  }

  if (appLogo) {
    const heightVal = typeof size === 'number' ? `${size}px` : size;
    const maxWidthVal = typeof size === 'number' ? `${size * 4}px` : '240px';

    return (
      <img 
        src={appLogo} 
        alt="Logo Premnord" 
        style={{ 
          height: heightVal,
          maxWidth: maxWidthVal,
          width: 'auto',
          objectFit: 'contain'
        }}
        className={`${className} max-w-full`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <svg 
      viewBox="0 0 100 100" 
      width={size} 
      height={size} 
      className={className}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      id="premnord-brand-logo"
    >
      {/* Circle Crown (The foliage/grapes) */}
      <circle cx="50" cy="40" r="28" fill={color} />
      
      {/* 5 Distinct Elegance Negative Space Dots (representing grape berries/foliage) */}
      {/* Top right */}
      <circle cx="62" cy="28" r="4.5" fill="#FAF8F5" className="fill-[var(--bg-card)] transition-colors duration-200" style={{ fill: 'inherit', fillOpacity: 0.15 }} />
      <circle cx="62" cy="28" r="3" fill="#FAF8F5" />
      
      {/* Mid left */}
      <circle cx="38" cy="35" r="4.5" fill="#FAF8F5" className="fill-[var(--bg-card)] transition-colors duration-200" style={{ fill: 'inherit', fillOpacity: 0.15 }} />
      <circle cx="38" cy="35" r="3" fill="#FAF8F5" />
      
      {/* Center dot */}
      <circle cx="50" cy="43" r="3" fill={color} opacity="0.3" />
      
      {/* Mid-lower right */}
      <circle cx="65" cy="48" r="4.5" fill="#FAF8F5" className="fill-[var(--bg-card)] transition-colors duration-200" style={{ fill: 'inherit', fillOpacity: 0.15 }} />
      <circle cx="65" cy="48" r="3" fill="#FAF8F5" />
      
      {/* Bottom right */}
      <circle cx="56" cy="58" r="4.5" fill="#FAF8F5" className="fill-[var(--bg-card)] transition-colors duration-200" style={{ fill: 'inherit', fillOpacity: 0.15 }} />
      <circle cx="56" cy="58" r="3" fill="#FAF8F5" />
      
      {/* Lower left */}
      <circle cx="38" cy="50" r="4.5" fill="#FAF8F5" className="fill-[var(--bg-card)] transition-colors duration-200" style={{ fill: 'inherit', fillOpacity: 0.15 }} />
      <circle cx="38" cy="50" r="3" fill="#FAF8F5" />

      {/* Trunk/Stem */}
      <rect x="48" y="65" width="4" height="12" fill={color} />

      {/* Elegant Pot/Base (Crest foundation) */}
      <path 
        d="M26 77H74L71 93H29L26 77Z" 
        fill={color} 
      />
    </svg>
  );
};
