import { Wine, Site, getCanonicalDomain } from '../types';

export interface WineSubRegionInfo {
  region: string;
  subRegion: string;
  displayLabel: string;
  orderIndex: number;
}

// Master canonical geographic sorting order matching French Sommelier and Premnord standards
export const MASTER_REGION_ORDER: string[] = [
  'Champagne',
  'Effervescences',
  'Bourgogne',
  'Bourgogne – Yonne / Chablisien',
  'Bourgogne – Côte de Nuits',
  'Bourgogne – Côte de Beaune',
  'Bourgogne – Côte Chalonnaise',
  'Bourgogne – Mâconnais',
  'Beaujolais',
  'Jura',
  'Bugey',
  'Jura – Bugey',
  'Savoie',
  'Isère',
  'Savoie – Isère',
  'Alsace',
  'Moselle',
  'Alsace – Moselle',
  'Auvergne',
  'Loire',
  'Loire – Centre Loire',
  'Loire – Touraine',
  'Loire – Anjou & Saumur',
  'Loire – Pays Nantais',
  'Bordeaux & Bordelais',
  'Sud-Ouest',
  'Bordelais & Sud-Ouest',
  'Rhône',
  'Rhône Septentrional (Nord)',
  'Rhône Méridional (Sud)',
  'Provence',
  'Corse',
  'Provence – Corse',
  'Languedoc',
  'Roussillon',
  'Languedoc & Roussillon',
  'Allemagne',
  'Autriche',
  'Suisse',
  'Italie',
  'Espagne',
  'Portugal',
  'Hongrie',
  'Slovénie',
  'Grèce',
  'Géorgie',
  'Danemark',
  'Liban',
  'États-Unis',
  'Argentine',
  'Chili',
  'Afrique du Sud',
  'Australie',
  'Nouvelle-Zélande',
  'Australie & Nouvelle-Zélande',
  'Japon',
  'Cidres & Poirés',
  'Co-fermentations & Bières',
  'Autres Régions'
];

/**
 * Classifies a wine into its primary Region and detailed Sub-Region
 */
export function classifyWineRegionAndSubRegion(wine: Wine): WineSubRegionInfo {
  const regionRaw = (wine.region || '').toLowerCase().trim();
  const subRegionRaw = (wine.subRegion || '').toLowerCase().trim();
  const appellationRaw = (wine.appellation || '').toLowerCase().trim();
  const nameRaw = (wine.name || '').toLowerCase().trim();
  const color = (wine.color || 'blanc').toLowerCase();

  const text = `${regionRaw} ${subRegionRaw} ${appellationRaw} ${nameRaw}`;
  const has = (keywords: string[]) => keywords.some(k => text.includes(k.toLowerCase()));

  // Helper to format clean sub-region with parent region if user provided subRegion
  const formatSub = (parentRegion: string, defaultSub: string, defaultLabel?: string) => {
    if (wine.subRegion && wine.subRegion.trim()) {
      const cleanSub = wine.subRegion.trim();
      if (cleanSub.toLowerCase().startsWith(parentRegion.toLowerCase())) {
        return { sub: cleanSub, label: cleanSub };
      }
      return { sub: `${parentRegion} – ${cleanSub}`, label: `${parentRegion} – ${cleanSub}` };
    }
    return { sub: defaultSub, label: defaultLabel || defaultSub };
  };

  // 1. Bubbles / Effervescents
  if (color === 'bulle' || color === 'cidre_biere' || has(['champagne', 'cremant', 'crémant', 'pet nat', 'pét-nat', 'effervescent', 'methode ancestrale', 'mousseux'])) {
    if (has(['champagne'])) {
      return {
        region: 'Champagne',
        subRegion: 'Champagne',
        displayLabel: 'Champagne',
        orderIndex: 0
      };
    }
    if (has(['bourgogne', 'burgundy'])) {
      return {
        region: 'Bourgogne',
        subRegion: 'Crémant de Bourgogne',
        displayLabel: 'Bourgogne – Effervescents',
        orderIndex: 1
      };
    }
    if (has(['loire', 'vouvray', 'montlouis', 'saumur'])) {
      return {
        region: 'Loire',
        subRegion: 'Effervescents de Loire',
        displayLabel: 'Loire – Effervescents',
        orderIndex: 2
      };
    }
    if (has(['jura', 'savoie', 'bugey', 'cerdon'])) {
      return {
        region: 'Jura – Savoie – Bugey',
        subRegion: 'Effervescents du Jura & Savoie',
        displayLabel: 'Jura / Savoie / Bugey – Effervescents',
        orderIndex: 3
      };
    }
    if (has(['alsace', 'moselle'])) {
      return {
        region: 'Alsace – Moselle',
        subRegion: 'Crémant d\'Alsace',
        displayLabel: 'Alsace – Crémant',
        orderIndex: 4
      };
    }
    if (has(['cidre', 'poire', 'poiré', 'biere', 'beer'])) {
      return {
        region: 'Cidres & Poirés',
        subRegion: 'Cidres & Poirés',
        displayLabel: 'Cidres & Poirés',
        orderIndex: 50
      };
    }
    if (has(['co-fermentation', 'cofermentation', 'mousse sauvage'])) {
      return {
        region: 'Co-fermentations & Bières',
        subRegion: 'Co-fermentations',
        displayLabel: 'Co-fermentations',
        orderIndex: 51
      };
    }
    return {
      region: 'Effervescences',
      subRegion: wine.region || 'Autres Bulles',
      displayLabel: wine.region || 'Effervescences',
      orderIndex: 5
    };
  }

  // 2. Bourgogne & Sub-regions
  if (has(['bourgogne', 'burgundy', 'chablis', 'nuits', 'beaune', 'chalonnaise', 'macon', 'mâcon', 'coteaux bourguignons', 'aligote', 'aligoté', 'hautes cotes', 'hautes côtes', 'vosne', 'gevrey', 'chambolle', 'morey', 'vougeot', 'meursault', 'puligny', 'chassagne', 'saint-aubin', 'volnay', 'pommard', 'corton', 'rully', 'mercurey', 'givry', 'montagny', 'pouilly-fuisse', 'saint-veran', 'vire-clesse'])) {
    // Yonne / Chablis
    if (has(['chablis', 'yonne', 'saint-bris', 'saint bris', 'irancy', 'vezelay', 'vézelay', 'tonnerre', 'epineuil', 'épineuil'])) {
      return {
        region: 'Bourgogne',
        subRegion: 'Bourgogne – Yonne / Chablisien',
        displayLabel: 'Bourgogne – Yonne / Chablisien',
        orderIndex: 3
      };
    }
    // Côte de Nuits
    if (has(['nuits', 'marsannay', 'fixin', 'gevrey', 'morey', 'chambolle', 'vougeot', 'vosne', 'echezeaux', 'échèzeaux', 'romanee', 'romanée', 'hautes cotes de nuits', 'hautes-côtes de nuits', 'côte de nuits-villages', 'cote de nuits-villages'])) {
      return {
        region: 'Bourgogne',
        subRegion: 'Bourgogne – Côte de Nuits',
        displayLabel: 'Bourgogne – Côte de Nuits',
        orderIndex: 4
      };
    }
    // Côte de Beaune
    if (has(['beaune', 'meursault', 'puligny', 'chassagne', 'saint-aubin', 'saint aubin', 'volnay', 'pommard', 'corton', 'ladoix', 'aloxe', 'pernand', 'savigny', 'chorey', 'auxey', 'monthélie', 'monthelie', 'santenay', 'maranges', 'saint-romain', 'saint romain', 'hautes cotes de beaune', 'hautes-côtes de beaune', 'blagny'])) {
      return {
        region: 'Bourgogne',
        subRegion: 'Bourgogne – Côte de Beaune',
        displayLabel: 'Bourgogne – Côte de Beaune',
        orderIndex: 5
      };
    }
    // Côte Chalonnaise
    if (has(['chalonnaise', 'rully', 'mercurey', 'givry', 'montagny', 'bouzeron'])) {
      return {
        region: 'Bourgogne',
        subRegion: 'Bourgogne – Côte Chalonnaise',
        displayLabel: 'Bourgogne – Côte Chalonnaise',
        orderIndex: 6
      };
    }
    // Mâconnais
    if (has(['macon', 'mâcon', 'pouilly', 'fuisse', 'fuissé', 'vinzelles', 'loche', 'lochè', 'saint-veran', 'saint-véran', 'vire-clesse', 'viré-clessé', 'lugny', 'chaintre', 'chaintré'])) {
      return {
        region: 'Bourgogne',
        subRegion: 'Bourgogne – Mâconnais',
        displayLabel: 'Bourgogne – Mâconnais',
        orderIndex: 7
      };
    }
    // If user provided another Bourgogne subRegion
    if (wine.subRegion && wine.subRegion.trim()) {
      const { sub, label } = formatSub('Bourgogne', 'Bourgogne');
      return {
        region: 'Bourgogne',
        subRegion: sub,
        displayLabel: label,
        orderIndex: 8
      };
    }
    // Régionale générique Bourgogne
    return {
      region: 'Bourgogne',
      subRegion: 'Bourgogne – Régionale',
      displayLabel: 'Bourgogne (Appellations Régionales)',
      orderIndex: 8
    };
  }

  // 3. Beaujolais
  if (has(['beaujolais', 'morgon', 'fleurie', 'moulin a vent', 'moulin-à-vent', 'brouilly', 'cote de brouilly', 'côte de brouilly', 'chiroubles', 'julienas', 'juliénas', 'chenas', 'chénas', 'saint-amour', 'regnie', 'régnié', 'lantignie', 'lantignié'])) {
    return {
      region: 'Beaujolais',
      subRegion: 'Beaujolais & Crus',
      displayLabel: 'Beaujolais',
      orderIndex: 9
    };
  }

  // 4. Jura
  if (has(['jura', 'arbois', 'chateau-chalon', 'château-chalon', 'l\'etoile', 'l\'étoile', 'cotes du jura', 'côtes du jura', 'pupillin', 'savagnin', 'trousseau', 'poulsard', 'ploussard'])) {
    return {
      region: 'Jura',
      subRegion: 'Jura',
      displayLabel: 'Jura',
      orderIndex: 10
    };
  }

  // 5. Bugey & Savoie & Isère
  if (has(['bugey', 'manicle', 'cerdon'])) {
    return {
      region: 'Bugey',
      subRegion: 'Bugey',
      displayLabel: 'Bugey',
      orderIndex: 11
    };
  }
  if (has(['savoie', 'apremont', 'abymes', 'chignin', 'monterminod', 'jongieux', 'mondeuse', 'altesse', 'roussette', 'arbin'])) {
    return {
      region: 'Savoie',
      subRegion: 'Savoie',
      displayLabel: 'Savoie',
      orderIndex: 12
    };
  }
  if (has(['isere', 'isère', 'gresivaudan', 'grésivaudan'])) {
    return {
      region: 'Isère',
      subRegion: 'Isère',
      displayLabel: 'Isère',
      orderIndex: 13
    };
  }

  // 6. Alsace & Moselle
  if (has(['alsace', 'riesling', 'gewurztraminer', 'gewürztraminer', 'pinot gris', 'sylvaner', 'muscat d\'alsace'])) {
    return {
      region: 'Alsace',
      subRegion: 'Alsace',
      displayLabel: 'Alsace',
      orderIndex: 14
    };
  }
  if (has(['moselle'])) {
    return {
      region: 'Moselle',
      subRegion: 'Moselle',
      displayLabel: 'Moselle',
      orderIndex: 15
    };
  }

  // 7. Auvergne
  if (has([
    'auvergne', 'auverge', 'cotes d\'auvergne', 'côtes d\'auvergne', 'saint-pourcain', 'saint-pourçain', 
    'cotes du forez', 'côtes du forez', 'roannaise', 'côte roannaise', 'cote roannaise', 
    'puy-de-dome', 'puy-de-dôme', 'chanturgue', 'chateaugay', 'châteaugay', 'corent', 'boudes', 'madargues'
  ])) {
    let sub = 'Auvergne';
    if (has(['cotes d\'auvergne', 'côtes d\'auvergne', 'chanturgue', 'chateaugay', 'châteaugay', 'corent', 'boudes', 'madargues'])) {
      sub = 'Côtes d\'Auvergne';
    } else if (has(['saint-pourcain', 'saint-pourçain'])) {
      sub = 'Saint-Pourçain';
    } else if (has(['cotes du forez', 'côtes du forez'])) {
      sub = 'Côtes du Forez';
    } else if (has(['roannaise', 'côte roannaise', 'cote roannaise'])) {
      sub = 'Côte Roannaise';
    } else if (has(['puy-de-dome', 'puy-de-dôme'])) {
      sub = 'Puy-de-Dôme';
    }
    return {
      region: 'Auvergne',
      subRegion: sub,
      displayLabel: `Auvergne – ${sub}`,
      orderIndex: 16
    };
  }

  // 8. Loire & Sub-regions
  if (has(['loire', 'sancerre', 'pouilly-fume', 'pouilly-fumé', 'menetou', 'vouvray', 'montlouis', 'chinon', 'bourgueil', 'saumur', 'anjou', 'savennieres', 'savennières', 'muscadet', 'cheverny', 'cour-cheverny', 'jasnieres', 'jasnières', 'coteaux du layon', 'reuilly', 'quincy'])) {
    if (has(['sancerre', 'pouilly-fume', 'pouilly-fumé', 'menetou', 'reuilly', 'quincy', 'coteaux du giennois'])) {
      return {
        region: 'Loire',
        subRegion: 'Loire – Centre Loire',
        displayLabel: 'Loire – Centre Loire',
        orderIndex: 18
      };
    }
    if (has(['vouvray', 'montlouis', 'chinon', 'bourgueil', 'saint-nicolas', 'cheverny', 'cour-cheverny', 'touraine', 'jasnieres', 'jasnières'])) {
      return {
        region: 'Loire',
        subRegion: 'Loire – Touraine',
        displayLabel: 'Loire – Touraine',
        orderIndex: 19
      };
    }
    if (has(['saumur', 'anjou', 'savennieres', 'savennières', 'coteaux du layon', 'bonnezeaux', 'quarts de chaume'])) {
      return {
        region: 'Loire',
        subRegion: 'Loire – Anjou & Saumur',
        displayLabel: 'Loire – Anjou & Saumur',
        orderIndex: 20
      };
    }
    if (has(['muscadet', 'pays nantais', 'gros plant', 'sevre et maine', 'sèvre et maine'])) {
      return {
        region: 'Loire',
        subRegion: 'Loire – Pays Nantais',
        displayLabel: 'Loire – Pays Nantais',
        orderIndex: 21
      };
    }
    return {
      region: 'Loire',
      subRegion: 'Loire',
      displayLabel: 'Vallée de la Loire',
      orderIndex: 22
    };
  }

  // 9. Bordeaux & Sud-Ouest
  if (has(['bordeaux', 'medoc', 'médoc', 'haut-medoc', 'haut-médoc', 'margaux', 'pauillac', 'saint-julien', 'saint-esteph', 'pomerol', 'saint-emilion', 'saint-émilion', 'graves', 'pessac', 'sauternes', 'barsac', 'fronsac', 'cotes de bordeaux'])) {
    return {
      region: 'Bordelais & Sud-Ouest',
      subRegion: 'Bordeaux & Bordelais',
      displayLabel: 'Bordeaux & Bordelais',
      orderIndex: 23
    };
  }
  if (has(['sud-ouest', 'south-west', 'cahors', 'madiran', 'gaillac', 'jurancon', 'jurançon', 'irouleguy', 'irouléguy', 'fronton', 'bergerac', 'monbazillac', 'pecharmant', 'pécharmant', 'marcilac', 'marcillac', 'tarn', 'marmandais'])) {
    return {
      region: 'Bordelais & Sud-Ouest',
      subRegion: 'Sud-Ouest',
      displayLabel: 'Sud-Ouest',
      orderIndex: 24
    };
  }

  // 10. Vallée du Rhône
  if (has(['rhone', 'rhône', 'cote-rotie', 'côte-rôtie', 'condrieu', 'chateau-grillet', 'saint-joseph', 'saint joseph', 'hermitage', 'crozes', 'cornas', 'saint-peray', 'saint-péray', 'chateauneuf', 'châteauneuf', 'gigondas', 'vacqueyras', 'cairanne', 'rasteau', 'beaumes de venise', 'luberon', 'ventoux', 'cotes du rhone', 'côtes du rhône', 'costieres de nimes', 'costières de nîmes', 'lirac', 'tavel'])) {
    if (has(['cote-rotie', 'côte-rôtie', 'condrieu', 'chateau-grillet', 'saint-joseph', 'saint joseph', 'hermitage', 'crozes', 'cornas', 'saint-peray', 'saint-péray', 'nord', 'septentrional'])) {
      return {
        region: 'Rhône',
        subRegion: 'Rhône Septentrional (Nord)',
        displayLabel: 'Rhône Septentrional (Nord)',
        orderIndex: 26
      };
    }
    return {
      region: 'Rhône',
      subRegion: 'Rhône Méridional (Sud)',
      displayLabel: 'Rhône Méridional (Sud)',
      orderIndex: 27
    };
  }

  // 11. Provence & Corse
  if (has(['bandol', 'cassis', 'cotes de provence', 'côtes de provence', 'coteaux d\'aix', 'baux de provence', 'bellet', 'palette', 'provence'])) {
    return {
      region: 'Provence & Corse',
      subRegion: 'Provence',
      displayLabel: 'Provence',
      orderIndex: 28
    };
  }
  if (has(['corse', 'patrimonio', 'ajaccio', 'calvi', 'sartene', 'porto-vecchio', 'figari'])) {
    return {
      region: 'Provence & Corse',
      subRegion: 'Corse',
      displayLabel: 'Corse',
      orderIndex: 29
    };
  }

  // 12. Languedoc & Roussillon
  if (has(['languedoc', 'roussillon', 'pic saint-loup', 'terrasses du larzac', 'faugeres', 'faugères', 'saint-chinian', 'minervois', 'corbieres', 'corbières', 'limoux', 'collioure', 'banyuls', 'maury', 'cotes du roussillon', 'côtes du roussillon', 'coteaux du languedoc'])) {
    if (has(['roussillon', 'collioure', 'banyuls', 'maury'])) {
      return {
        region: 'Languedoc & Roussillon',
        subRegion: 'Roussillon',
        displayLabel: 'Roussillon',
        orderIndex: 31
      };
    }
    return {
      region: 'Languedoc & Roussillon',
      subRegion: 'Languedoc',
      displayLabel: 'Languedoc',
      orderIndex: 30
    };
  }

  // 13. Vins Européens & Internationaux
  if (has(['allemagne', 'germany', 'mosel', 'rheingau', 'pfalz', 'baden', 'nahe', 'franken'])) {
    const { sub, label } = formatSub('Allemagne', 'Allemagne');
    return { region: 'Allemagne', subRegion: sub, displayLabel: label, orderIndex: 34 };
  }
  if (has(['autriche', 'austria', 'wachau', 'kamptal', 'kremstal', 'burgenland', 'steiermark'])) {
    const { sub, label } = formatSub('Autriche', 'Autriche');
    return { region: 'Autriche', subRegion: sub, displayLabel: label, orderIndex: 35 };
  }
  if (has(['suisse', 'switzerland', 'valais', 'vaud', 'lavaux', 'geneve', 'genève', 'neuchatel', 'ticino'])) {
    const { sub, label } = formatSub('Suisse', 'Suisse');
    return { region: 'Suisse', subRegion: sub, displayLabel: label, orderIndex: 36 };
  }
  if (has(['italie', 'italy', 'piemont', 'piémont', 'barolo', 'barbaresco', 'toscane', 'tuscany', 'chianti', 'brunello', 'venetie', 'vénétie', 'valpolicella', 'etna', 'sicilia', 'sardegna', 'sardaigne', 'frioul', 'alto adige'])) {
    const { sub, label } = formatSub('Italie', 'Italie');
    return { region: 'Italie', subRegion: sub, displayLabel: label, orderIndex: 37 };
  }
  if (has(['espagne', 'spain', 'rioja', 'ribera del duero', 'priorat', 'penedes', 'penedès', 'rías baixas', 'rias baixas', 'bierzo', 'jerez', 'sherry', 'toro'])) {
    const { sub, label } = formatSub('Espagne', 'Espagne');
    return { region: 'Espagne', subRegion: sub, displayLabel: label, orderIndex: 38 };
  }
  if (has(['portugal', 'douro', 'dao', 'dão', 'bairrada', 'alentejo', 'vinho verde', 'porto', 'madeira'])) {
    const { sub, label } = formatSub('Portugal', 'Portugal');
    return { region: 'Portugal', subRegion: sub, displayLabel: label, orderIndex: 39 };
  }
  if (has(['hongrie', 'hungary', 'tokaj'])) {
    const { sub, label } = formatSub('Hongrie', 'Hongrie');
    return { region: 'Hongrie', subRegion: sub, displayLabel: label, orderIndex: 40 };
  }
  if (has(['slovenie', 'slovénie', 'slovenia', 'brda'])) {
    const { sub, label } = formatSub('Slovénie', 'Slovénie');
    return { region: 'Slovénie', subRegion: sub, displayLabel: label, orderIndex: 41 };
  }
  if (has(['grece', 'grèce', 'greece', 'santorini', 'naoussa'])) {
    const { sub, label } = formatSub('Grèce', 'Grèce');
    return { region: 'Grèce', subRegion: sub, displayLabel: label, orderIndex: 42 };
  }
  if (has(['georgie', 'géorgie', 'georgia', 'kakheti', 'kvevri', 'qvevri'])) {
    const { sub, label } = formatSub('Géorgie', 'Géorgie');
    return { region: 'Géorgie', subRegion: sub, displayLabel: label, orderIndex: 43 };
  }
  if (has(['liban', 'lebanon', 'bekaa', 'békaa', 'békéaa', 'musar', 'kefraya', 'ksara', 'batroun'])) {
    const { sub, label } = formatSub('Liban', 'Liban');
    return { region: 'Liban', subRegion: sub, displayLabel: label, orderIndex: 43.5 };
  }
  if (has(['etats-unis', 'états-unis', 'usa', 'united states', 'california', 'napa', 'sonoma', 'oregon', 'willamette', 'washington'])) {
    const { sub, label } = formatSub('États-Unis', 'États-Unis');
    return { region: 'États-Unis', subRegion: sub, displayLabel: label, orderIndex: 44 };
  }
  if (has(['argentine', 'argentina', 'mendoza', 'salta', 'malbec'])) {
    const { sub, label } = formatSub('Argentine', 'Argentine');
    return { region: 'Argentine', subRegion: sub, displayLabel: label, orderIndex: 45 };
  }
  if (has(['chili', 'chile', 'maipo', 'colchagua', 'casablanca'])) {
    const { sub, label } = formatSub('Chili', 'Chili');
    return { region: 'Chili', subRegion: sub, displayLabel: label, orderIndex: 46 };
  }
  if (has(['afrique du sud', 'south africa', 'stellenbosch', 'swartland', 'walker bay'])) {
    const { sub, label } = formatSub('Afrique du Sud', 'Afrique du Sud');
    return { region: 'Afrique du Sud', subRegion: sub, displayLabel: label, orderIndex: 47 };
  }
  if (has(['nouvelle-zelande', 'nouvelle-zélande', 'new zealand', 'marlborough', 'central otago', 'hawke\'s bay', 'hawkes bay', 'martinborough'])) {
    const { sub, label } = formatSub('Nouvelle-Zélande', 'Nouvelle-Zélande');
    return { region: 'Nouvelle-Zélande', subRegion: sub, displayLabel: label, orderIndex: 48 };
  }
  if (has(['australie', 'australia', 'barossa', 'adelaide', 'mclaren', 'yarra', 'hunter valley', 'margaret river'])) {
    const { sub, label } = formatSub('Australie', 'Australie');
    return { region: 'Australie', subRegion: sub, displayLabel: label, orderIndex: 48.5 };
  }
  if (has(['australie & nouvelle-zélande', 'australie & nouvelle zelande'])) {
    const { sub, label } = formatSub('Australie', 'Australie');
    return { region: 'Australie', subRegion: sub, displayLabel: label, orderIndex: 48 };
  }
  if (has(['japon', 'japan', 'koshu', 'yamanashi'])) {
    const { sub, label } = formatSub('Japon', 'Japon');
    return { region: 'Japon', subRegion: sub, displayLabel: label, orderIndex: 49 };
  }

  // Fallback to explicit wine.region or Bourgogne
  const fallback = wine.region?.trim() || 'Bourgogne';
  const { sub, label } = formatSub(fallback, fallback);
  return {
    region: fallback,
    subRegion: sub,
    displayLabel: label,
    orderIndex: 99
  };
}

/**
 * Normalizes and extracts Site order index (1 -> 2 -> 3 -> 4, etc.)
 */
export function getSiteSequenceIndex(siteIdOrName?: string): number {
  const norm = (siteIdOrName || '').toLowerCase().trim();
  if (norm === 'site-1' || norm.startsWith('site 1') || norm.startsWith('1')) return 1;
  if (norm === 'site-2' || norm.startsWith('site 2') || norm.startsWith('2')) return 2;
  if (norm === 'site-3' || norm.startsWith('site 3') || norm.startsWith('3')) return 3;
  if (norm === 'site-4' || norm.startsWith('site 4') || norm.startsWith('4')) return 4;
  if (norm === 'site-5' || norm.startsWith('site 5') || norm.startsWith('5')) return 5;
  if (norm === 'site-6' || norm.startsWith('site 6') || norm.startsWith('6')) return 6;
  if (norm === 'site-7' || norm.startsWith('site 7') || norm.startsWith('7')) return 7;
  return 99;
}

export interface DomainGroup {
  domainName: string;
  wines: Wine[];
}

export interface SubRegionGroup {
  subRegionKey: string;
  displayLabel: string;
  orderIndex: number;
  domains: DomainGroup[];
  totalWinesCount: number;
}

export interface SiteWineGroup {
  site: Site;
  siteSequence: number;
  subRegions: SubRegionGroup[];
  totalWinesCount: number;
  totalBottlesCount: number;
}

/**
 * Standard hierarchical sorter for wines inside a domain:
 * 1. Name / Cuvée ascending
 * 2. Vintage descending (e.g. 2022, 2021, 2020... S.A.)
 */
export function sortWinesByNameAndVintage(a: Wine, b: Wine): number {
  const nameCompare = (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' });
  if (nameCompare !== 0) return nameCompare;

  const vA = parseInt(a.vintage || '0') || 0;
  const vB = parseInt(b.vintage || '0') || 0;
  if (vA !== vB) return vB - vA; // Newer first

  return (a.format || '').localeCompare(b.format || '');
}

/**
 * Groups wines strictly by Site 1 -> 2 -> 3 -> 4, and inside each site by Région / Sous-Région -> Domaine -> Vin
 */
export function groupWinesBySiteAndSubRegion(
  wines: Wine[],
  sites: Site[],
  options?: {
    allowedSiteIds?: string[];
    onlyAvailable?: boolean;
    editVisibilityMode?: boolean;
  }
): SiteWineGroup[] {
  const allowedSiteIds = options?.allowedSiteIds || ['site-1', 'site-2', 'site-3', 'site-4'];
  const onlyAvailable = options?.onlyAvailable ?? true;
  const editVisibilityMode = options?.editVisibilityMode ?? false;

  // Build a map of sites by ID or create placeholder sites
  const sitesMap = new Map<string, Site>();
  sites.forEach(s => sitesMap.set(s.id, s));

  // Ensure default sites 1-4 exist in map even if not yet saved in Firestore
  const fallbackSites: Site[] = [
    { id: 'site-1', name: 'Site 1 : Vins blancs à la carte', description: 'Sélection active de vins blancs', createdAt: 0 },
    { id: 'site-2', name: 'Site 2 : Vins rouges à la carte', description: 'Sélection active de vins rouges', createdAt: 0 },
    { id: 'site-3', name: 'Site 3 : Effervescents à la carte', description: 'Sélection active d’effervescents', createdAt: 0 },
    { id: 'site-4', name: 'Site 4 : Cuisine DPR', description: 'Vins de cuisine et préparations culinaires', createdAt: 0 }
  ];
  fallbackSites.forEach(s => {
    if (!sitesMap.has(s.id)) sitesMap.set(s.id, s);
  });

  // Group wines by siteId
  const winesBySiteId = new Map<string, Wine[]>();
  wines.forEach(wine => {
    // Determine effective siteId
    const siteId = wine.siteId || 'site-1';
    if (allowedSiteIds.length > 0 && !allowedSiteIds.includes(siteId)) {
      return;
    }

    if (!editVisibilityMode && wine.hideFromMenu) {
      return;
    }

    if (onlyAvailable && !editVisibilityMode && wine.quantity <= 0 && !wine.isPreSale) {
      return;
    }

    if (!winesBySiteId.has(siteId)) {
      winesBySiteId.set(siteId, []);
    }
    winesBySiteId.get(siteId)!.push(wine);
  });

  // Target ordered site list (1 -> 2 -> 3 -> 4)
  const targetSiteIds = ['site-1', 'site-2', 'site-3', 'site-4'].filter(id => allowedSiteIds.includes(id));

  const result: SiteWineGroup[] = [];

  targetSiteIds.forEach(siteId => {
    const siteObj = sitesMap.get(siteId) || {
      id: siteId,
      name: `Site ${siteId.replace('site-', '')}`,
      createdAt: 0
    };

    const siteWines = winesBySiteId.get(siteId) || [];
    const siteSequence = getSiteSequenceIndex(siteId);

    // Group by SubRegion
    const subRegionMap = new Map<string, { label: string; orderIndex: number; wines: Wine[] }>();

    siteWines.forEach(wine => {
      const classif = classifyWineRegionAndSubRegion(wine);
      const subKey = classif.subRegion;

      if (!subRegionMap.has(subKey)) {
        subRegionMap.set(subKey, {
          label: classif.displayLabel,
          orderIndex: classif.orderIndex,
          wines: []
        });
      }
      subRegionMap.get(subKey)!.wines.push(wine);
    });

    // Sort SubRegions by orderIndex
    const sortedSubRegions: SubRegionGroup[] = Array.from(subRegionMap.entries())
      .sort((a, b) => {
        if (a[1].orderIndex !== b[1].orderIndex) return a[1].orderIndex - b[1].orderIndex;
        return a[1].label.localeCompare(b[1].label, 'fr', { sensitivity: 'base' });
      })
      .map(([subRegionKey, data]) => {
        // Group wines inside subRegion by canonical Domain
        const domainMap = new Map<string, Wine[]>();
        data.wines.forEach(w => {
          const dom = getCanonicalDomain(w.domain) || 'Domaine Inconnu';
          if (!domainMap.has(dom)) domainMap.set(dom, []);
          domainMap.get(dom)!.push(w);
        });

        // Sort domains alphabetically
        const domains: DomainGroup[] = Array.from(domainMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0], 'fr', { sensitivity: 'base' }))
          .map(([domainName, dWines]) => {
            return {
              domainName,
              wines: [...dWines].sort(sortWinesByNameAndVintage)
            };
          });

        return {
          subRegionKey,
          displayLabel: data.label,
          orderIndex: data.orderIndex,
          domains,
          totalWinesCount: data.wines.length
        };
      });

    const totalBottles = siteWines.reduce((acc, w) => acc + (w.quantity || 0), 0);

    result.push({
      site: siteObj,
      siteSequence,
      subRegions: sortedSubRegions,
      totalWinesCount: siteWines.length,
      totalBottlesCount: totalBottles
    });
  });

  // Sort sites strictly 1 -> 2 -> 3 -> 4
  return result.sort((a, b) => a.siteSequence - b.siteSequence);
}

/**
 * Deduce canonical country for any wine if not explicitly provided
 */
export function inferWineCountry(wine: Partial<Wine>): string {
  if (wine.country && wine.country.trim()) return wine.country.trim();
  const classif = classifyWineRegionAndSubRegion(wine as Wine);
  const foreignCountries = [
    'Allemagne', 'Autriche', 'Suisse', 'Italie', 'Espagne', 'Portugal', 
    'Hongrie', 'Slovénie', 'Grèce', 'Géorgie', 'États-Unis', 'Argentine', 
    'Chili', 'Afrique du Sud', 'Australie & Nouvelle-Zélande', 'Australie', 
    'Nouvelle-Zélande', 'Japon', 'Danemark', 'Liban'
  ];
  if (foreignCountries.includes(classif.region)) {
    return classif.region;
  }
  return 'France';
}

