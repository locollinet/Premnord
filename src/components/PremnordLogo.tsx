import React from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { PREMNORD_EMBLEM_BASE64 } from '../assets/premnordEmblemBase64';

interface PremnordLogoProps {
  className?: string;
  size?: number | string;
  color?: string;
}

/**
 * Véritable emblème officiel de Premnord (Mandala culinaire et vinicole officiel).
 * Remplace définitivement l'ancien SVG approximatif.
 */
export const PremnordLogo: React.FC<PremnordLogoProps> = ({ 
  className = '', 
  size = 40,
  color
}) => {
  let appLogo: string | null = null;
  try {
    const context = useFirebase();
    appLogo = context?.appLogo || null;
  } catch (e) {
    // Fail-safe si rendu hors Provider
  }

  const logoSrc = appLogo || PREMNORD_EMBLEM_BASE64;
  const sizeStyle = typeof size === 'number' ? `${size}px` : size;

  return (
    <div 
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: sizeStyle, height: sizeStyle }}
      title="Premnord"
    >
      <img 
        src={logoSrc} 
        alt="Logo Officiel Premnord" 
        className="w-full h-full object-contain"
        style={{ maxHeight: sizeStyle, maxWidth: sizeStyle }}
      />
    </div>
  );
};

export default PremnordLogo;
