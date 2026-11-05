import React from 'react';
import { Wine } from '../types';
import { WineMenuDocumentStyle } from './WineMenuDocumentStyle';

export interface WineMenuProps {
  onSelectWine?: (wine: Wine) => void;
}

/**
 * La Carte des Vins Officielle de Premnord (Livre de Cave).
 * 
 * Seule carte officielle faisant foi dans l'application Premnord,
 * conforme au document de référence du restaurant (carte_vins_2026_10_29.docx).
 * 
 * Caractéristiques principales :
 * - Connectée en temps réel à l'inventaire Firebase (stock total & par sites).
 * - Format Livre de Cave : Couplage 75cl / 150cl (Magnum) sur une seule ligne.
 * - Millésimes alignés à gauche, Cuvées/Appellations entre guillemets, prix 75cl / 150cl à droite.
 * - Mode Sommelier intégré : Afficher / Masquer granularisé par vin, section et domaine.
 * - Filtres dynamiques : Vins en stock uniquement / Tout le catalogue.
 * - Affichage conditionnel des badges de stock physique pour le sommelier.
 * - Export haute fidélité pour impression papier et PDF A4.
 */
export const WineMenu: React.FC<WineMenuProps> = ({ onSelectWine }) => {
  return <WineMenuDocumentStyle onSelectWine={onSelectWine} />;
};

export default WineMenu;
