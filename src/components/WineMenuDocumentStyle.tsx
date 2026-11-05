import React, { useState, useMemo, useEffect } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Wine } from '../types';
import { PREMNORD_WATERMARK_BASE64 } from '../assets/watermarkBase64';
import { 
  OFFICIAL_WORD_SECTIONS, 
  WordSection, 
  WordSubRegionGroup, 
  WordDomaineGroup, 
  WordWineLine 
} from '../data/officialWordMenuData';
import { 
  Printer, 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  Eye, 
  EyeOff, 
  Search, 
  Filter, 
  Sparkles,
  ExternalLink,
  Layers,
  X,
  FileText,
  Info
} from 'lucide-react';

export interface WineMenuDocumentStyleProps {
  onSelectWine?: (wine: Wine) => void;
}

// Normalisation insensible aux accents et caractères spéciaux
const normalizeText = (str: string | undefined | null): string => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

// Vérifie si un vin est DPR
const isDPRString = (str: string): boolean => {
  const norm = normalizeText(str);
  return norm.includes('prieure') || norm.includes('roch') || norm === 'dpr';
};

// Sommaire officiel 100% ISO au document Word carte_vins_2026_10_29.docx
interface SommaireEntry {
  title: string;
  page: number;
  sectionId: 'dpr' | 'bulle' | 'blanc' | 'rose' | 'rouge';
  isHeader: boolean;
}

const SOMMAIRE_COL_1: SommaireEntry[] = [
  { title: 'Domaine Prieuré Roch', page: 3, sectionId: 'dpr', isHeader: true },
  { title: 'Effervescences', page: 6, sectionId: 'bulle', isHeader: true },
  { title: 'Champagne', page: 6, sectionId: 'bulle', isHeader: false },
  { title: 'Bourgogne', page: 7, sectionId: 'bulle', isHeader: false },
  { title: 'Loire – Jura', page: 7, sectionId: 'bulle', isHeader: false },
  { title: 'Savoie – Bugey', page: 8, sectionId: 'bulle', isHeader: false },
  { title: 'Alsace – Moselle', page: 8, sectionId: 'bulle', isHeader: false },
  { title: 'Sud-ouest', page: 8, sectionId: 'bulle', isHeader: false },
  { title: 'Corse', page: 8, sectionId: 'bulle', isHeader: false },
  { title: 'Espagne', page: 8, sectionId: 'bulle', isHeader: false },
  { title: 'Portugal', page: 8, sectionId: 'bulle', isHeader: false },
  { title: 'Italie', page: 9, sectionId: 'bulle', isHeader: false },
  { title: 'Etats-Unis', page: 9, sectionId: 'bulle', isHeader: false },
  { title: 'Co-fermentations', page: 9, sectionId: 'bulle', isHeader: false },
  { title: 'Cidres et Poirés', page: 9, sectionId: 'bulle', isHeader: false },
  { title: 'Vins Blancs', page: 10, sectionId: 'blanc', isHeader: true },
  { title: 'Bourgogne', page: 10, sectionId: 'blanc', isHeader: false },
  { title: 'Beaujolais – Champagne – Jura', page: 15, sectionId: 'blanc', isHeader: false },
  { title: 'Savoie et vignobles alpins', page: 16, sectionId: 'blanc', isHeader: false },
  { title: 'Alsace', page: 17, sectionId: 'blanc', isHeader: false },
  { title: 'Moselle – Auvergne – Loire', page: 18, sectionId: 'blanc', isHeader: false },
  { title: 'Bordelais et Sud-Ouest', page: 20, sectionId: 'blanc', isHeader: false },
  { title: 'Rhône', page: 20, sectionId: 'blanc', isHeader: false },
  { title: 'Provence – Corse', page: 21, sectionId: 'blanc', isHeader: false },
  { title: 'Languedoc et Roussillon', page: 22, sectionId: 'blanc', isHeader: false },
  { title: 'Allemagne', page: 23, sectionId: 'blanc', isHeader: false },
  { title: 'Suisse', page: 23, sectionId: 'blanc', isHeader: false },
  { title: 'Autriche', page: 23, sectionId: 'blanc', isHeader: false },
  { title: 'Italie', page: 23, sectionId: 'blanc', isHeader: false },
  { title: 'Hongrie', page: 24, sectionId: 'blanc', isHeader: false },
];

const SOMMAIRE_COL_2: SommaireEntry[] = [
  { title: 'Afrique du Sud', page: 26, sectionId: 'blanc', isHeader: false },
  { title: 'Australie – Nouvelle-Zélande', page: 27, sectionId: 'blanc', isHeader: false },
  { title: 'Japon', page: 27, sectionId: 'blanc', isHeader: false },
  { title: 'Vins Rosés', page: 25, sectionId: 'rose', isHeader: true },
  { title: 'Bourgogne', page: 25, sectionId: 'rose', isHeader: false },
  { title: 'Rhône sud – Provence - Corse', page: 25, sectionId: 'rose', isHeader: false },
  { title: 'Espagne', page: 25, sectionId: 'rose', isHeader: false },
  { title: 'Bordelais', page: 25, sectionId: 'rose', isHeader: false },
  { title: 'Afrique du Sud', page: 25, sectionId: 'rose', isHeader: false },
  { title: 'Vins Rouges', page: 26, sectionId: 'rouge', isHeader: true },
  { title: 'Bourgogne', page: 26, sectionId: 'rouge', isHeader: false },
  { title: 'Beaujolais', page: 30, sectionId: 'rouge', isHeader: false },
  { title: 'Alsace – Moselle – Jura', page: 32, sectionId: 'rouge', isHeader: false },
  { title: 'Bugey – Savoie – Isère', page: 33, sectionId: 'rouge', isHeader: false },
  { title: 'Auvergne – Loire', page: 33, sectionId: 'rouge', isHeader: false },
  { title: 'Sud-ouest et Bordelais', page: 35, sectionId: 'rouge', isHeader: false },
  { title: 'Rhône nord', page: 36, sectionId: 'rouge', isHeader: false },
  { title: 'Rhône sud', page: 37, sectionId: 'rouge', isHeader: false },
  { title: 'Provence', page: 37, sectionId: 'rouge', isHeader: false },
  { title: 'Corse – Languedoc – Roussillon', page: 38, sectionId: 'rouge', isHeader: false },
  { title: 'Allemagne', page: 39, sectionId: 'rouge', isHeader: false },
  { title: 'Danemark', page: 39, sectionId: 'rouge', isHeader: false },
  { title: 'Suisse', page: 39, sectionId: 'rouge', isHeader: false },
  { title: 'Autriche', page: 39, sectionId: 'rouge', isHeader: false },
  { title: 'Italie', page: 39, sectionId: 'rouge', isHeader: false },
  { title: 'Espagne', page: 40, sectionId: 'rouge', isHeader: false },
  { title: 'Portugal', page: 40, sectionId: 'rouge', isHeader: false },
  { title: 'Grèce', page: 41, sectionId: 'rouge', isHeader: false },
  { title: 'Géorgie', page: 41, sectionId: 'rouge', isHeader: false },
  { title: 'Etats-Unis', page: 41, sectionId: 'rouge', isHeader: false },
  { title: 'Argentine', page: 41, sectionId: 'rouge', isHeader: false },
  { title: 'Chili', page: 41, sectionId: 'rouge', isHeader: false },
  { title: 'Afrique du Sud', page: 42, sectionId: 'rouge', isHeader: false },
  { title: 'Australie – Nouvelle-Zélande', page: 42, sectionId: 'rouge', isHeader: false },
  { title: 'Japon', page: 42, sectionId: 'rouge', isHeader: false },
];

export const WineMenuDocumentStyle: React.FC<WineMenuDocumentStyleProps> = ({ onSelectWine }) => {
  const { wines, updateWine } = useFirebase();

  // Contrôles Métier Essentiels (Aucun slider superflu)
  const [selectedSection, setSelectedSection] = useState<'couverture' | 'sommaire' | 'dpr' | 'bulle' | 'blanc' | 'rose' | 'rouge'>('dpr');
  const [viewMode, setViewMode] = useState<'chapitre' | 'tout_defiler'>('chapitre');
  const [stockFilter, setStockFilter] = useState<'tous' | 'en_stock'>('tous');
  const [perimeter, setPerimeter] = useState<'salle' | 'cave'>('salle');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showStockBadges, setShowStockBadges] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [hiddenWines, setHiddenWines] = useState<Record<string, boolean>>({});

  // Détection Iframe
  const [isInIframe, setIsInIframe] = useState<boolean>(false);
  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

  // Map des vins Firebase indexés pour recherche rapide et calcul de stock
  const firebaseWineIndex = useMemo(() => {
    const map = new Map<string, Wine>();
    if (!wines) return map;

    // Règle Oncle : EXCLURE STRICTEMENT les spiritueux et softs de la carte des vins
    const wineList = wines.filter(w => w.color !== 'spiritueux' && w.color !== 'soft');

    wineList.forEach(w => {
      const dNorm = normalizeText(w.domain);
      const isDPR = isDPRString(w.domain || '');
      const vNorm = (w.vintage || '').toString().trim();
      const nNorm = normalizeText(w.name || '');
      const cNorm = normalizeText(w.cuvee || '');

      // Clefs d'indexation
      const keyDomain = isDPR ? 'dpr' : dNorm;
      if (keyDomain && vNorm && (nNorm || cNorm)) {
        map.set(`${keyDomain}_${vNorm}_${nNorm}`, w);
        if (cNorm && cNorm !== nNorm) {
          map.set(`${keyDomain}_${vNorm}_${cNorm}`, w);
        }
      }
    });

    return map;
  }, [wines]);

  // Récupérer le stock et les métadonnées d'une ligne de vin Word
  const getWineLiveStock = (line: WordWineLine, domaineName: string) => {
    const isDPR = isDPRString(domaineName);
    const dKey = isDPR ? 'dpr' : normalizeText(domaineName);
    const vKey = (line.vintage || '').trim();
    const nKey = normalizeText(line.name);

    // Recherche directe
    let matched: Wine | undefined = firebaseWineIndex.get(`${dKey}_${vKey}_${nKey}`);

    // Recherche floue si non trouvé
    if (!matched && wines) {
      matched = wines.find(w => {
        if (w.color === 'spiritueux' || w.color === 'soft') return false;
        const wDPR = isDPRString(w.domain || '');
        if (isDPR && !wDPR) return false;
        if (!isDPR && !normalizeText(w.domain).includes(dKey) && !dKey.includes(normalizeText(w.domain))) return false;
        if (vKey && vKey !== 'NV' && w.vintage && w.vintage.toString() !== vKey) return false;
        const wNameNorm = normalizeText(w.name);
        return wNameNorm.includes(nKey) || nKey.includes(wNameNorm);
      });
    }

    if (!matched) {
      return { matchedWine: undefined, stock75: 0, stock150: 0, totalStock: 0, isHidden: false };
    }

    const isHidden = !!matched.hideFromMenu || !!hiddenWines[matched.id];

    if (perimeter === 'salle') {
      const siteStocks = matched.siteStocks || {};
      let s75 = 0;
      let s150 = 0;
      for (let i = 1; i <= 4; i++) {
        const entry = siteStocks[`site-${i}`];
        if (entry) {
          s75 += (entry.stock75 || 0);
          s150 += (entry.stock150 || 0);
        }
      }
      const hasSites = Object.keys(siteStocks).length > 0;
      const total = hasSites ? (s75 + s150) : ((matched.stock75 || 0) + (matched.stock150 || 0));
      return { 
        matchedWine: matched, 
        stock75: hasSites ? s75 : (matched.stock75 || 0), 
        stock150: hasSites ? s150 : (matched.stock150 || 0), 
        totalStock: total, 
        isHidden 
      };
    } else {
      const s75 = matched.stock75 || 0;
      const s150 = matched.stock150 || 0;
      return { 
        matchedWine: matched, 
        stock75: s75, 
        stock150: s150, 
        totalStock: s75 + s150, 
        isHidden 
      };
    }
  };

  // Toggle masquer / afficher une référence
  const toggleWineVisibility = async (wine: Wine | undefined, wineKey: string) => {
    if (wine && updateWine) {
      try {
        await updateWine(wine.id, { hideFromMenu: !wine.hideFromMenu });
      } catch (err) {
        console.error('Erreur mise à jour visibilité vin:', err);
      }
    }
    setHiddenWines(prev => ({ ...prev, [wineKey]: !prev[wineKey] }));
  };

  // Lancement de l'impression native A4 haute-fidélité
  const handlePrint = () => {
    window.print();
  };

  // Filigrane officiel 100% ISO Word (Mandala basse page, opacité subtile 13%)
  const renderWatermark = () => (
    <div 
      className="watermark-container pointer-events-none absolute inset-x-0 bottom-4 flex justify-center items-center opacity-[0.13] select-none z-0"
      style={{ height: '52%' }}
      aria-hidden="true"
    >
      <img 
        src={PREMNORD_WATERMARK_BASE64} 
        alt="" 
        className="max-h-full max-w-[85%] object-contain" 
      />
    </div>
  );

  // Rendu de la page de couverture (Page 1)
  const renderCoverPage = () => (
    <div className="book-page-a4 bg-white text-[#334552] relative shadow-lg rounded-sm mx-auto mb-8 w-full max-w-[210mm] min-h-[297mm] p-[18mm_20mm] flex flex-col justify-between overflow-hidden print:m-0 print:shadow-none print:rounded-none print:w-full print:min-h-[297mm] print:break-after-page print:p-[15mm_20mm]">
      {renderWatermark()}
      
      <div className="flex-1 flex flex-col justify-center items-center text-center z-10 pt-16">
        <h1 className="text-4xl sm:text-5xl font-black text-[#A4513C] tracking-[0.25em] uppercase font-title">
          PREMNORD
        </h1>
        <h2 className="text-xl sm:text-2xl font-bold text-[#A4513C] tracking-[0.2em] uppercase mt-6 font-title">
          LIVRE DE CAVE
        </h2>
      </div>

      <div className="z-10 pb-4 text-center">
        <p className="text-[10.5px] text-[#8C9BA5] tracking-wide font-normal">
          Prix nets, service compris
        </p>
      </div>
    </div>
  );

  // Rendu du Sommaire (Page 2)
  const renderSommairePage = () => (
    <div className="book-page-a4 bg-white text-[#334552] relative shadow-lg rounded-sm mx-auto mb-8 w-full max-w-[210mm] min-h-[297mm] p-[18mm_20mm] flex flex-col justify-between overflow-hidden print:m-0 print:shadow-none print:rounded-none print:w-full print:min-h-[297mm] print:break-after-page print:p-[15mm_20mm]">
      {renderWatermark()}

      <div className="z-10 w-full pt-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 text-[12px] leading-relaxed">
          {/* Colonne 1 */}
          <div className="space-y-1">
            {SOMMAIRE_COL_1.map((item, idx) => (
              <div 
                key={idx}
                onClick={() => setSelectedSection(item.sectionId)}
                className={`flex justify-between items-baseline group cursor-pointer transition-colors ${
                  item.isHeader 
                    ? 'font-bold text-[#334552] text-[13px] pt-2.5 pb-0.5' 
                    : 'text-[#334552] pl-3 hover:text-[#A4513C]'
                }`}
              >
                <span className="truncate pr-2 group-hover:underline">
                  {item.title}
                </span>
                <span className="shrink-0 text-[#334552] font-normal">
                  p.{item.page}
                </span>
              </div>
            ))}
          </div>

          {/* Colonne 2 */}
          <div className="space-y-1">
            {SOMMAIRE_COL_2.map((item, idx) => (
              <div 
                key={idx}
                onClick={() => setSelectedSection(item.sectionId)}
                className={`flex justify-between items-baseline group cursor-pointer transition-colors ${
                  item.isHeader 
                    ? 'font-bold text-[#334552] text-[13px] pt-2.5 pb-0.5' 
                    : 'text-[#334552] pl-3 hover:text-[#A4513C]'
                }`}
              >
                <span className="truncate pr-2 group-hover:underline">
                  {item.title}
                </span>
                <span className="shrink-0 text-[#334552] font-normal">
                  p.{item.page}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="z-10 pt-4 flex justify-between items-center text-[10px] text-[#8C9BA5] border-t border-stone-100 print:border-none">
        <span>Premnord — Livre de Cave</span>
        <span>Page 2</span>
      </div>
    </div>
  );

  // Rendu d'une section officielle complète
  const renderSectionContent = (section: WordSection) => {
    const isDPR = section.id === 'dpr';

    // Filtrage des sous-régions et vins selon les critères de recherche et de stock
    const filteredSubRegions = section.subRegions.map(sub => {
      const filteredDomaines = sub.domaines.map(dom => {
        const filteredWines = dom.wines.filter(line => {
          const { matchedWine, totalStock, isHidden } = getWineLiveStock(line, dom.name);

          // Filtre masquage sommelier
          if (isHidden && !editMode) return false;

          // Filtre de stock
          if (stockFilter === 'en_stock') {
            // Si le vin est matche dans Firebase et son stock est <= 0, masquer
            if (matchedWine && totalStock <= 0) return false;
          }

          // Filtre de recherche textuelle
          if (searchQuery.trim()) {
            const q = normalizeText(searchQuery);
            const lineNorm = normalizeText(line.name);
            const domNorm = normalizeText(dom.name);
            const subNorm = normalizeText(sub.title);
            const vNorm = (line.vintage || '').trim();
            if (!lineNorm.includes(q) && !domNorm.includes(q) && !subNorm.includes(q) && !vNorm.includes(q)) {
              return false;
            }
          }

          return true;
        });

        return { ...dom, wines: filteredWines };
      }).filter(dom => dom.wines.length > 0);

      return { ...sub, domaines: filteredDomaines };
    }).filter(sub => sub.domaines.length > 0);

    return (
      <div className="book-page-a4 bg-white text-[#334552] relative shadow-lg rounded-sm mx-auto mb-8 w-full max-w-[210mm] min-h-[297mm] p-[18mm_20mm] flex flex-col justify-between overflow-hidden print:m-0 print:shadow-none print:rounded-none print:w-full print:min-h-[297mm] print:break-after-page print:p-[15mm_20mm]">
        {renderWatermark()}

        <div className="z-10 w-full">
          {/* En-tête de colonnes 75 cl / 150 cl (strictement aligné en haut à droite) */}
          <div className="flex justify-end items-center gap-10 text-[11px] font-semibold text-[#A4513C] tracking-wide mb-2 pr-1">
            <span className="w-16 text-right">75 cl</span>
            <span className="w-16 text-right">150 cl</span>
          </div>

          {/* Titre officiel de la section */}
          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl font-black text-[#A4513C] tracking-[0.14em] uppercase font-title">
              {section.title}
            </h2>
            {isDPR && (
              <p className="text-xs font-semibold text-[#334552] italic mt-1">
                Par Henry-Frédéric Roch depuis 1988
              </p>
            )}
          </div>

          {/* Liste des sous-régions, domaines et cuvées */}
          <div className="space-y-6">
            {filteredSubRegions.map((sub, sIdx) => (
              <div key={sIdx} className="space-y-4">
                {/* Sous-titre de région (ex: Blancs, Rosés, Rouges, Champagne...) */}
                <h3 className="text-base sm:text-lg font-bold text-[#A4513C] tracking-wide pb-1 border-b border-stone-100 print:border-none">
                  {sub.title}
                </h3>

                {/* Domaines */}
                <div className="space-y-4">
                  {sub.domaines.map((dom, dIdx) => (
                    <div key={dIdx} className="space-y-1.5">
                      {/* Afficher le domaine sauf si c'est DPR (qui a son titre principal en haut) */}
                      {!isDPR && dom.name && dom.name !== 'Domaine Inconnu' && (
                        <h4 className="text-[13px] font-bold text-[#334552] pt-1">
                          {dom.name}
                        </h4>
                      )}

                      {/* Lignes de vins officielles */}
                      <div className="space-y-1">
                        {dom.wines.map((line, wIdx) => {
                          const { matchedWine, totalStock, isHidden } = getWineLiveStock(line, dom.name);
                          const wineKey = `${dom.name}_${line.vintage}_${line.name}`;

                          return (
                            <div 
                              key={wIdx}
                              onClick={() => matchedWine && onSelectWine && onSelectWine(matchedWine)}
                              className={`flex items-baseline text-[12.5px] leading-snug group transition-colors py-0.5 ${
                                matchedWine && onSelectWine ? 'cursor-pointer hover:bg-stone-50/80 rounded px-1 -mx-1' : ''
                              } ${isHidden ? 'opacity-40 line-through' : ''}`}
                            >
                              {/* Bouton Sommelier Masquer / Afficher */}
                              {editMode && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleWineVisibility(matchedWine, wineKey);
                                  }}
                                  className="mr-2 text-stone-400 hover:text-[#A4513C] print:hidden shrink-0"
                                  title={isHidden ? 'Révéler sur la carte' : 'Masquer de la carte'}
                                >
                                  {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-stone-600" />}
                                </button>
                              )}

                              {/* Colonne 1 : Millésime */}
                              <span className="w-12 shrink-0 font-normal text-[#334552] text-left">
                                {line.vintage || ''}
                              </span>

                              {/* Colonne 2 : Nom de Cuvée / Appellation */}
                              <span className="flex-1 text-[#334552] font-normal truncate pr-4">
                                {line.name}

                                {/* Badge de stock en direct si activé par le sommelier */}
                                {showStockBadges && matchedWine && (
                                  <span className="ml-2 text-[10px] px-1.5 py-0.2 rounded bg-stone-100 text-[#334552] font-medium print:hidden">
                                    {totalStock} bt
                                  </span>
                                )}
                              </span>

                              {/* Colonne 3 : Prix 75 cl */}
                              <span className="w-16 shrink-0 text-right font-normal text-[#334552]">
                                {line.price75 || ''}
                              </span>

                              {/* Colonne 4 : Prix 150 cl */}
                              <span className="w-16 shrink-0 text-right font-normal text-[#334552]">
                                {line.price150 || ''}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {filteredSubRegions.length === 0 && (
              <div className="py-12 text-center text-stone-400 text-xs italic">
                Aucun vin ne correspond aux critères de recherche actuels.
              </div>
            )}
          </div>
        </div>

        {/* Pied de page officiel */}
        <div className="z-10 pt-6 flex justify-between items-center text-[10px] text-[#8C9BA5] border-t border-stone-100 print:border-none">
          <span>Premnord — Livre de Cave</span>
          <span>Page {section.pageNumber}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-stone-100/60 text-[#334552] word-iso-font">
      {/* Styles d'impression CSS A4 natifs et polices Word ISO */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

        .word-iso-font {
          font-family: 'Woodford Bourne', 'Woodford Bourne SemiBold', Calibri, 'Plus Jakarta Sans', 'Segoe UI', Candara, -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .font-title {
          font-family: 'Sugo Pro Display Trial', 'Sugo Pro', 'Plus Jakarta Sans', Calibri, 'Segoe UI', sans-serif;
          letter-spacing: 0.14em;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print, header, nav, aside, button, input {
            display: none !important;
          }
          #wine-book-print-root {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .book-page-a4 {
            width: 210mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            height: 297mm !important;
            margin: 0 auto !important;
            padding: 15mm 20mm !important;
            page-break-after: always !important;
            break-after: page !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            position: relative !important;
            overflow: hidden !important;
          }
          .watermark-container {
            opacity: 0.14 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Barre latérale des contrôles Sommelier (Masquée lors de l'impression) */}
      <aside className="no-print w-full lg:w-80 bg-white border-r border-stone-200/80 p-5 space-y-6 shrink-0 shadow-sm">
        {/* Titre & Statut Officiel */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5 text-[#A4513C]" />
            <h2 className="text-base font-bold text-[#334552] tracking-tight">
              Livre de Cave Premnord
            </h2>
          </div>
          <p className="text-[11px] text-stone-500">
            Édition officielle conforme au Word (1 223 vins)
          </p>
        </div>

        {/* Bouton d'exportation / impression A4 */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#A4513C] hover:bg-[#8D4432] text-white font-semibold text-xs transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer / Exporter en PDF (A4)</span>
          </button>

          {isInIframe && (
            <button
              type="button"
              onClick={() => window.open(window.location.href, '_blank')}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ouvrir en plein écran pour impression</span>
            </button>
          )}
        </div>

        {/* Recherche instantanée */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[#334552] uppercase tracking-wider">
            Recherche dans le livre
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrer vin, cuvée, domaine..."
              className="w-full pl-8 pr-8 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs text-[#334552] placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#A4513C] focus:border-[#A4513C]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-stone-400 hover:text-stone-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filtre Stock en direct */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[#334552] uppercase tracking-wider">
            Filtre Bouteilles en Stock
          </label>
          <div className="grid grid-cols-2 gap-1 bg-stone-100 p-1 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setStockFilter('tous')}
              className={`py-1.5 rounded-md font-medium text-center transition-all ${
                stockFilter === 'tous'
                  ? 'bg-white text-[#334552] shadow-xs'
                  : 'text-stone-600 hover:text-[#334552]'
              }`}
            >
              Toutes réf.
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('en_stock')}
              className={`py-1.5 rounded-md font-medium text-center transition-all ${
                stockFilter === 'en_stock'
                  ? 'bg-white text-[#334552] shadow-xs'
                  : 'text-stone-600 hover:text-[#334552]'
              }`}
            >
              En stock ({'>'} 0)
            </button>
          </div>
        </div>

        {/* Périmètre de stock (Salle vs Cave entière) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[#334552] uppercase tracking-wider">
            Périmètre de Stock
          </label>
          <div className="grid grid-cols-2 gap-1 bg-stone-100 p-1 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setPerimeter('salle')}
              className={`py-1.5 rounded-md font-medium text-center transition-all ${
                perimeter === 'salle'
                  ? 'bg-white text-[#334552] shadow-xs'
                  : 'text-stone-600 hover:text-[#334552]'
              }`}
            >
              Salle (1 à 4)
            </button>
            <button
              type="button"
              onClick={() => setPerimeter('cave')}
              className={`py-1.5 rounded-md font-medium text-center transition-all ${
                perimeter === 'cave'
                  ? 'bg-white text-[#334552] shadow-xs'
                  : 'text-stone-600 hover:text-[#334552]'
              }`}
            >
              Cave Entière
            </button>
          </div>
        </div>

        {/* Navigation par chapitre */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[#334552] uppercase tracking-wider">
            Chapitre à Afficher
          </label>
          <div className="space-y-1">
            {[
              { id: 'couverture', label: '📖 Couverture (Page 1)' },
              { id: 'sommaire', label: '📑 Sommaire (Page 2)' },
              { id: 'dpr', label: '🍷 Domaine Prieuré Roch (p.3)' },
              { id: 'bulle', label: '🥂 Effervescences (p.6)' },
              { id: 'blanc', label: '🌕 Vins Blancs (p.10)' },
              { id: 'rose', label: '🌸 Vins Rosés (p.25)' },
              { id: 'rouge', label: '🍷 Vins Rouges (p.26)' },
            ].map(ch => (
              <button
                key={ch.id}
                type="button"
                onClick={() => {
                  setSelectedSection(ch.id as any);
                  setViewMode('chapitre');
                }}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors flex justify-between items-center ${
                  selectedSection === ch.id && viewMode === 'chapitre'
                    ? 'bg-[#A4513C]/10 text-[#A4513C] font-semibold'
                    : 'text-stone-600 hover:bg-stone-50 hover:text-[#334552]'
                }`}
              >
                <span>{ch.label}</span>
                {selectedSection === ch.id && viewMode === 'chapitre' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#A4513C]" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Mode d'affichage */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[#334552] uppercase tracking-wider">
            Mode d'Affichage
          </label>
          <div className="grid grid-cols-2 gap-1 bg-stone-100 p-1 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setViewMode('chapitre')}
              className={`py-1.5 rounded-md font-medium text-center transition-all ${
                viewMode === 'chapitre'
                  ? 'bg-white text-[#334552] shadow-xs'
                  : 'text-stone-600 hover:text-[#334552]'
              }`}
            >
              Par Chapitre
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tout_defiler')}
              className={`py-1.5 rounded-md font-medium text-center transition-all ${
                viewMode === 'tout_defiler'
                  ? 'bg-white text-[#334552] shadow-xs'
                  : 'text-stone-600 hover:text-[#334552]'
              }`}
            >
              Tout Défiler
            </button>
          </div>
        </div>

        {/* Options Sommelier Avancées */}
        <div className="pt-2 border-t border-stone-200/80 space-y-3">
          {/* Badges de stock à l'écran */}
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-xs text-[#334552]">Badges de stock (Écran)</span>
            <input
              type="checkbox"
              checked={showStockBadges}
              onChange={(e) => setShowStockBadges(e.target.checked)}
              className="rounded text-[#A4513C] focus:ring-[#A4513C] h-4 w-4"
            />
          </label>

          {/* Mode Édition Sommelier */}
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-xs text-[#334552]">Mode Édition (Masquer vins)</span>
            <input
              type="checkbox"
              checked={editMode}
              onChange={(e) => setEditMode(e.target.checked)}
              className="rounded text-[#A4513C] focus:ring-[#A4513C] h-4 w-4"
            />
          </label>

          {/* Note règle Oncle : Spiritueux exclus */}
          <div className="bg-amber-50/70 border border-amber-200/60 rounded-lg p-2.5 text-[11px] text-amber-900 leading-relaxed">
            <span className="font-semibold block mb-0.5">ℹ️ Règle Livre de Cave</span>
            Les alcools forts, spiritueux et softs sont automatiquement exclus de ce livre officiel.
          </div>
        </div>
      </aside>

      {/* Zone Principale de Prévisualisation & Impression */}
      <main id="wine-book-print-root" className="flex-1 p-4 sm:p-8 overflow-y-auto flex flex-col items-center">
        {viewMode === 'chapitre' ? (
          <div>
            {selectedSection === 'couverture' && renderCoverPage()}
            {selectedSection === 'sommaire' && renderSommairePage()}
            {selectedSection !== 'couverture' && selectedSection !== 'sommaire' && (
              renderSectionContent(
                OFFICIAL_WORD_SECTIONS.find(s => s.id === selectedSection) || OFFICIAL_WORD_SECTIONS[0]
              )
            )}
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            {renderCoverPage()}
            {renderSommairePage()}
            {OFFICIAL_WORD_SECTIONS.map((sec) => (
              <React.Fragment key={sec.id}>
                {renderSectionContent(sec)}
              </React.Fragment>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default WineMenuDocumentStyle;
