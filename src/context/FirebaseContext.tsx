import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  getFirebaseAuth, 
  getFirebaseDb, 
  checkFirebaseAvailable, 
  handleFirestoreError, 
  OperationType 
} from '../lib/firebase';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  Auth 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  Firestore,
  getDocs,
  writeBatch,
  deleteField
} from 'firebase/firestore';
import { Wine, Site, Movement, UserProfile, WineRegion, getCanonicalDomain, normalizeWineString, isSameWineReference, getWineReferenceKey } from '../types';
import { calculateSellingPrice } from '../lib/pricing';
import { inferWineCountry } from '../lib/wineGrouping';
import { DEFAULT_WINE_REGIONS, DEFAULT_REGION_GROUPS, generateRegionId } from '../lib/regions';

interface FirebaseContextType {
  user: UserProfile | null;
  loading: boolean;
  isDemo: boolean;
  error: string | null;
  wines: Wine[];
  sites: Site[];
  movements: Movement[];
  loginWithGoogle: () => Promise<void>;
  loginAsGuest: (name: string) => void;
  logout: () => Promise<void>;
  
  // Data actions
  addWine: (wine: Omit<Wine, 'id' | 'createdAt' | 'updatedAt'>, options?: { importMode?: 'accumulate' | 'replace' }) => Promise<string>;
  updateWine: (id: string, updates: Partial<Wine>, action: 'edit' | 'stock', options?: { propagateReference?: boolean }) => Promise<void>;
  deleteWine: (id: string) => Promise<void>;
  deleteWinesBatch: (ids: string[]) => Promise<number>;
  
  addSite: (name: string, description?: string) => Promise<string>;
  updateSite: (id: string, name: string, description?: string) => Promise<void>;
  deleteSite: (id: string) => Promise<void>;
  seedDefaultSites: () => Promise<void>;
  
  // Region & Terroir Master Data Actions
  regions: WineRegion[];
  regionGroups: string[];
  addRegion: (region: Omit<WineRegion, 'id'>) => Promise<string>;
  updateRegion: (id: string, updates: Partial<WineRegion>, options?: { propagateRenameToWines?: boolean; oldName?: string }) => Promise<{ success: boolean; winesUpdatedCount: number }>;
  deleteRegion: (id: string, options?: { reassignWinesToRegion?: string }) => Promise<{ success: boolean; winesReassignedCount: number }>;
  reorderRegions: (newOrderedRegions: WineRegion[]) => Promise<void>;
  resetRegionsToDefault: () => Promise<void>;

  addMovement: (movement: Omit<Movement, 'id' | 'userId' | 'userName' | 'createdAt'> & { createdAt?: number; userId?: string; userName?: string }) => Promise<string>;
  syncLocalToFirebase: () => Promise<void>;
  cleanZeroStockResiduals: () => Promise<number>;
  deduplicateCellar: (selectedKeys?: string[], customOverrides?: Record<string, Partial<Wine>>) => Promise<number>;
  repairWinesData: () => Promise<number>;
  apply3TierPricingToAllWines: () => Promise<number>;
  resetAllStocks: () => Promise<number>;
  clearMovementsHistory: () => Promise<number>;
  clearDatabase: () => Promise<void>;
  appLogo: string | null;
  updateAppLogo: (logo: string | null) => Promise<void>;
  watermarkLogo: string | null;
  updateWatermarkLogo: (logo: string | null) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

// Helper to strip undefined values so they are not sent to Firestore
function cleanUndefined<T extends object>(obj: T): T {
  const result = { ...obj } as any;
  Object.keys(result).forEach(key => {
    if (result[key] === undefined) {
      delete result[key];
    } else if (result[key] !== null && typeof result[key] === 'object') {
      if (Array.isArray(result[key])) {
        result[key] = result[key].map((item: any) => 
          (item !== null && typeof item === 'object') ? cleanUndefined(item) : item
        );
      } else {
        result[key] = cleanUndefined(result[key]);
      }
    }
  });
  return result;
}

// Helper to transform undefined values into deleteField() for Firestore updateDoc
function prepareFirestoreUpdate(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    if (val === undefined) {
      result[key] = deleteField();
    } else if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = cleanUndefined(val);
    } else {
      result[key] = val;
    }
  });
  return result;
}

// Initial/default sites to bootstrap the system
const DEFAULT_SITES: Omit<Site, 'createdAt'>[] = [
  { id: 'site-1', name: 'Site 1 : Vins blancs à la carte', description: 'Sélection active de vins blancs servis en salle' },
  { id: 'site-2', name: 'Site 2 : Vins rouges à la carte', description: 'Sélection active de vins rouges servis en salle' },
  { id: 'site-3', name: 'Site 3 : Effervescents à la carte', description: 'Sélection active d’effervescents à la carte' },
  { id: 'site-4', name: 'Site 4 : Cuisine DPR', description: 'Vins de cuisine et préparations culinaires' },
  { id: 'site-5', name: 'Site 5 : Stock 1,2,3 et 4', description: 'Réserve de stock principal pour les sites 1, 2, 3 et 4' },
  { id: 'site-6', name: 'Site 6 : Vieillissement', description: 'Vins en cours de vieillissement' },
  { id: 'site-7', name: 'Site 7 : À se débarrasser', description: 'Déclassements et bouteilles à liquider' }
];

/**
 * Ensures system master wine regions are complete, modern, and aligned with sommelier standards.
 * Adds Auvergne, Liban, splits Australia and New Zealand, and enriches Sud-Ouest/Languedoc terroirs.
 */
function harmonizeWineRegions(list: WineRegion[]): { list: WineRegion[]; changed: boolean } {
  let changed = false;
  let updated = [...list];

  // 1. Ensure Auvergne is present
  const hasAuvergne = updated.some(r => 
    r.name.toLowerCase().trim() === 'auvergne' || 
    r.name.toLowerCase().trim() === 'auverge' ||
    r.id === 'france-auvergne'
  );
  if (!hasAuvergne) {
    const auvergneDef = DEFAULT_WINE_REGIONS.find(r => r.id === 'france-auvergne');
    if (auvergneDef) {
      const alsaceIdx = updated.findIndex(r => r.name.toLowerCase() === 'alsace');
      if (alsaceIdx >= 0) {
        updated.splice(alsaceIdx + 1, 0, auvergneDef);
      } else {
        updated.unshift(auvergneDef);
      }
      changed = true;
    }
  }

  // 2. Ensure Liban is present in Vignobles d'Europe & Méditerranée
  const hasLiban = updated.some(r => 
    r.name.toLowerCase().trim() === 'liban' || 
    r.id === 'europe-liban'
  );
  if (!hasLiban) {
    const libanDef = DEFAULT_WINE_REGIONS.find(r => r.id === 'europe-liban');
    if (libanDef) {
      const suisseIdx = updated.findIndex(r => r.name.toLowerCase() === 'suisse');
      if (suisseIdx >= 0) {
        updated.splice(suisseIdx + 1, 0, libanDef);
      } else {
        const europeIdx = updated.map((r, i) => r.group.includes('Europe') ? i : -1).filter(i => i >= 0).pop();
        if (europeIdx !== undefined && europeIdx >= 0) {
          updated.splice(europeIdx + 1, 0, libanDef);
        } else {
          updated.push(libanDef);
        }
      }
      changed = true;
    }
  }

  // 3. Split Australie & Nouvelle-Zélande into two distinct countries
  const combinedIdx = updated.findIndex(r => 
    r.id === 'world-australie-nz' || 
    r.name.toLowerCase().includes('australie & nouvelle')
  );
  if (combinedIdx >= 0) {
    const ausDef = DEFAULT_WINE_REGIONS.find(r => r.id === 'world-australie')!;
    const nzDef = DEFAULT_WINE_REGIONS.find(r => r.id === 'world-nouvelle-zelande')!;
    updated.splice(combinedIdx, 1, ausDef, nzDef);
    changed = true;
  } else {
    // Ensure both exist
    const hasAus = updated.some(r => r.name.toLowerCase().trim() === 'australie');
    const hasNz = updated.some(r => r.name.toLowerCase().trim() === 'nouvelle-zélande' || r.name.toLowerCase().trim() === 'nouvelle-zelande');
    if (!hasAus) {
      const ausDef = DEFAULT_WINE_REGIONS.find(r => r.id === 'world-australie');
      if (ausDef) { updated.push(ausDef); changed = true; }
    }
    if (!hasNz) {
      const nzDef = DEFAULT_WINE_REGIONS.find(r => r.id === 'world-nouvelle-zelande');
      if (nzDef) { updated.push(nzDef); changed = true; }
    }
  }

  // 4. Enrich Sud-Ouest and Languedoc-Roussillon sub-regions if they lack richer suggestions
  const languedocIdx = updated.findIndex(r => r.name.toLowerCase() === 'languedoc-roussillon');
  if (languedocIdx >= 0) {
    const curr = updated[languedocIdx];
    const defaultDef = DEFAULT_WINE_REGIONS.find(r => r.id === 'france-languedoc-roussillon');
    if (defaultDef && (!curr.subRegions || curr.subRegions.length < 8)) {
      const mergedSubs = Array.from(new Set([...(curr.subRegions || []), ...defaultDef.subRegions]));
      updated[languedocIdx] = { ...curr, subRegions: mergedSubs };
      changed = true;
    }
  }

  const sudOuestIdx = updated.findIndex(r => r.name.toLowerCase() === 'sud-ouest');
  if (sudOuestIdx >= 0) {
    const curr = updated[sudOuestIdx];
    const defaultDef = DEFAULT_WINE_REGIONS.find(r => r.id === 'france-sud-ouest');
    if (defaultDef && (!curr.subRegions || curr.subRegions.length < 9)) {
      const mergedSubs = Array.from(new Set([...(curr.subRegions || []), ...defaultDef.subRegions]));
      updated[sudOuestIdx] = { ...curr, subRegions: mergedSubs };
      changed = true;
    }
  }

  return { list: updated, changed };
}

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [wines, setWines] = useState<Wine[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [appLogo, setAppLogo] = useState<string | null>(null);
  const [watermarkLogo, setWatermarkLogo] = useState<string | null>(null);

  // Dynamic Wine Regions repository
  const [regions, setRegions] = useState<WineRegion[]>(DEFAULT_WINE_REGIONS);
  const [regionGroups, setRegionGroups] = useState<string[]>(DEFAULT_REGION_GROUPS);

  // Keep latest references for non-reactive triggers to prevent dependency pollution
  const isDemoRef = useRef<boolean>(false);
  const userRef = useRef<UserProfile | null>(null);
  const winesStateRef = useRef<Wine[]>([]);
  const sitesStateRef = useRef<Site[]>([]);
  const movementsStateRef = useRef<Movement[]>([]);
  const regionsStateRef = useRef<WineRegion[]>(DEFAULT_WINE_REGIONS);
  const regionGroupsStateRef = useRef<string[]>(DEFAULT_REGION_GROUPS);
  
  useEffect(() => {
    isDemoRef.current = isDemo;
  }, [isDemo]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    winesStateRef.current = wines;
  }, [wines]);

  useEffect(() => {
    sitesStateRef.current = sites;
  }, [sites]);

  useEffect(() => {
    movementsStateRef.current = movements;
  }, [movements]);

  useEffect(() => {
    regionsStateRef.current = regions;
  }, [regions]);

  useEffect(() => {
    regionGroupsStateRef.current = regionGroups;
  }, [regionGroups]);

  // Try initializing Firebase
  useEffect(() => {
    const { available, error: err } = checkFirebaseAvailable();
    if (!available) {
      console.log("Firebase not available. Falling back to Demo mode:", err);
      setIsDemo(true);
      setError("Fonctionnement en mode démo local. Connectez votre projet Firebase dans AI Studio pour activer la persistance cloud.");
      loadLocalData();
      setLoading(false);
      return;
    }

    let unsubscribeAuth = () => {};
    let unsubscribeWines = () => {};
    let unsubscribeSites = () => {};
    let unsubscribeMovements = () => {};
    let unsubscribeBranding = () => {};
    let unsubscribeRegions = () => {};

    try {
      const auth = getFirebaseAuth();
      const db = getFirebaseDb();

      unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          const profile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Employé',
            photoURL: firebaseUser.photoURL
          };
          setUser(profile);
          setIsDemo(false);
          setError(null);
        } else {
          localStorage.removeItem('premnord_guest_user');
          setUser(null);
          setIsDemo(false);
          winesStateRef.current = [];
          sitesStateRef.current = [];
          movementsStateRef.current = [];
          setWines([]);
          setSites([]);
          setMovements([]);
        }
        setLoading(false);
      }, (err) => {
        console.error("Auth state change error:", err);
        setIsDemo(true);
        loadLocalData();
        setLoading(false);
      });
    } catch (e) {
      console.error("Firebase Auth bind error:", e);
      setIsDemo(true);
      loadLocalData();
      setLoading(false);
    }

    return () => {
      unsubscribeAuth();
      unsubscribeWines();
      unsubscribeSites();
      unsubscribeMovements();
    };
  }, []);

  // Set up Firestore snapshot listeners when a user is signed in and we are NOT in demo mode
  const userIdStr = user?.uid || '';
  const isDemoVal = isDemo;

  useEffect(() => {
    if (isDemoVal || !userIdStr) {
      return;
    }

    let unsubscribeWines = () => {};
    let unsubscribeSites = () => {};
    let unsubscribeMovements = () => {};
    let unsubscribeBranding = () => {};
    let unsubscribeRegions = () => {};

    try {
      const db = getFirebaseDb();
      
      // 1. Sites sync & auto-seed
      const sitesRef = collection(db, 'sites');
      unsubscribeSites = onSnapshot(query(sitesRef, orderBy('name')), (snapshot) => {
        const sitesList: Site[] = [];
        snapshot.forEach((doc) => {
          sitesList.push({ id: doc.id, ...doc.data() } as Site);
        });
        
        // Auto-seed if database is empty
        if (sitesList.length === 0) {
          bootstrapDefaultSites(db);
        } else {
          // Self-healing & Name Synchronization: check if any default sites are missing or have outdated names
          const sitesToSync: Omit<Site, 'createdAt'>[] = [];
          DEFAULT_SITES.forEach(ds => {
            const existing = sitesList.find(s => s.id === ds.id);
            if (!existing || existing.name !== ds.name) {
              sitesToSync.push(ds);
            }
          });

          if (sitesToSync.length > 0) {
            bootstrapDefaultSites(db, sitesToSync);
          } else {
            setSites(sitesList);
          }
        }
      }, (err) => {
        console.warn("Sites stream error - falling back to Local Storage:", err);
        setError("Accès cloud limité : Mode démo hors-ligne activé (les données sont stockées localement dans votre navigateur).");
        setIsDemo(true);
        loadLocalData();
      });

      // 2. Wines sync
      const winesRef = collection(db, 'wines');
      unsubscribeWines = onSnapshot(query(winesRef, orderBy('name')), (snapshot) => {
        const winesList: Wine[] = [];
        const missingCountryDocs: Array<{ id: string; country: string; region?: string }> = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          let domain = data.domain || '';
          if (domain && (domain.trim().toLowerCase() === 'dpr' || domain.trim().toLowerCase() === 'domaine prieuré-roch' || domain.trim().toLowerCase() === 'domaine prieure-roch')) {
            domain = 'Domaine Prieuré-Roch';
          }
          let region = (data.region || '').trim();
          let rawCountry = (data.country || '').trim();

          // Migrate legacy combined Australia & New Zealand region
          if (region === 'Australie & Nouvelle-Zélande' || region === 'Australie & Nouvelle Zélande') {
            const contextText = `${data.appellation || ''} ${data.subRegion || ''} ${data.name || ''}`.toLowerCase();
            if (contextText.includes('marlborough') || contextText.includes('otago') || contextText.includes('hawke') || contextText.includes('martinborough') || contextText.includes('zealand') || contextText.includes('zelande')) {
              region = 'Nouvelle-Zélande';
              if (!rawCountry || rawCountry === 'Australie & Nouvelle-Zélande') rawCountry = 'Nouvelle-Zélande';
            } else {
              region = 'Australie';
              if (!rawCountry || rawCountry === 'Australie & Nouvelle-Zélande') rawCountry = 'Australie';
            }
          }

          const country = rawCountry || inferWineCountry({ ...data, domain, region } as Wine);
          if (!rawCountry || data.region !== region) {
            missingCountryDocs.push({ id: doc.id, country, region });
          }
          winesList.push({ id: doc.id, ...data, domain, region, country } as Wine);
        });
        setWines(winesList);

        // One-time automatic backfill to Firestore for existing wines lacking a country field or needing region update
        if (missingCountryDocs.length > 0 && !localStorage.getItem('premnord_country_backfill_v2')) {
          localStorage.setItem('premnord_country_backfill_v2', 'true');
          try {
            const batch = writeBatch(db);
            missingCountryDocs.slice(0, 450).forEach(({ id, country, region }) => {
              batch.set(doc(db, 'wines', id), { country, region }, { merge: true });
            });
            batch.commit().catch(e => console.warn('Auto backfill country/region error:', e));
          } catch (e) {
            console.warn('Auto backfill country/region batch error:', e);
          }
        }
      }, (err) => {
        console.warn("Wines stream error - falling back to Local Storage:", err);
        setError("Accès cloud limité : Mode démo hors-ligne activé (les données sont stockées localement dans votre navigateur).");
        setIsDemo(true);
        loadLocalData();
      });

      // 3. Movements sync (full historical tracking for accounting extraction and monthly history)
      const movementsRef = collection(db, 'movements');
      unsubscribeMovements = onSnapshot(query(movementsRef, orderBy('createdAt', 'desc')), (snapshot) => {
        const movementsList: Movement[] = [];
        snapshot.forEach((doc) => {
          movementsList.push({ id: doc.id, ...doc.data() } as Movement);
        });

        setMovements(movementsList);
      }, (err) => {
        console.warn("Movements stream error - falling back to Local Storage:", err);
        setError("Accès cloud limité : Mode démo hors-ligne activé (les données sont stockées localement dans votre navigateur).");
        setIsDemo(true);
        loadLocalData();
      });

      // 4. Branding logo sync
      const brandingDocRef = doc(db, 'settings', 'branding');
      unsubscribeBranding = onSnapshot(brandingDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setAppLogo(docSnap.data().logo || null);
          setWatermarkLogo(docSnap.data().watermark || null);
        } else {
          setAppLogo(null);
          setWatermarkLogo(null);
        }
      }, (err) => {
        console.warn("Branding logo stream error - falling back to Local Storage:", err);
      });

      // 5. Dynamic Wine Regions master data sync
      const regionsDocRef = doc(db, 'settings', 'regions');
      unsubscribeRegions = onSnapshot(regionsDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && Array.isArray(data.regions) && data.regions.length > 0) {
            let list: WineRegion[] = data.regions;
            const harmonization = harmonizeWineRegions(list);
            if (harmonization.changed) {
              list = harmonization.list;
              setDoc(regionsDocRef, {
                regions: list,
                groups: data.groups || DEFAULT_REGION_GROUPS,
                updatedAt: Date.now()
              }, { merge: true }).catch(err => console.warn("Regions harmonization sync write warning:", err));
            }
            setRegions(list);
            regionsStateRef.current = list;
            const grps = Array.isArray(data.groups) && data.groups.length > 0 ? data.groups : DEFAULT_REGION_GROUPS;
            setRegionGroups(grps);
            regionGroupsStateRef.current = grps;
            saveLocalRegions(list, grps);
          } else {
            bootstrapDefaultRegions(db);
          }
        } else {
          bootstrapDefaultRegions(db);
        }
      }, (err) => {
        console.warn("Wine regions stream error - falling back to Local Storage:", err);
      });

    } catch (e) {
      console.error("Failed to set up Firestore snapshots:", e);
    }

    return () => {
      unsubscribeWines();
      unsubscribeSites();
      unsubscribeMovements();
      unsubscribeBranding();
      unsubscribeRegions();
    };
  }, [userIdStr, isDemoVal]);

  // Seeding default sites to Firestore
  const bootstrapDefaultSites = async (firestoreDb: Firestore, customSitesList?: Omit<Site, 'createdAt'>[]) => {
    try {
      const batch = writeBatch(firestoreDb);
      const listToSeed = customSitesList || DEFAULT_SITES;
      listToSeed.forEach((site) => {
        const docRef = doc(collection(firestoreDb, 'sites'), site.id);
        batch.set(docRef, cleanUndefined({
          ...site,
          createdAt: Date.now()
        }));
      });
      await batch.commit();
    } catch (e) {
      console.error("Error bootstrapping sites:", e);
    }
  };

  // Seeding default wine regions repository to Firestore
  const bootstrapDefaultRegions = async (firestoreDb: Firestore) => {
    try {
      const docRef = doc(firestoreDb, 'settings', 'regions');
      await setDoc(docRef, {
        regions: DEFAULT_WINE_REGIONS,
        groups: DEFAULT_REGION_GROUPS,
        updatedAt: Date.now()
      });
      setRegions(DEFAULT_WINE_REGIONS);
      regionsStateRef.current = DEFAULT_WINE_REGIONS;
      setRegionGroups(DEFAULT_REGION_GROUPS);
      regionGroupsStateRef.current = DEFAULT_REGION_GROUPS;
      saveLocalRegions(DEFAULT_WINE_REGIONS, DEFAULT_REGION_GROUPS);
    } catch (e) {
      console.error("Error bootstrapping regions:", e);
    }
  };

  const saveLocalRegions = (newRegions: WineRegion[], newGroups?: string[]) => {
    try {
      const grps = newGroups || regionGroupsStateRef.current || DEFAULT_REGION_GROUPS;
      localStorage.setItem('premnord_custom_regions', JSON.stringify({
        regions: newRegions,
        groups: grps
      }));
    } catch (e) {
      console.error("Error writing regions to local storage:", e);
    }
  };

  // LocalStorage Fallback Handlers
  const loadLocalData = () => {
    try {
      const storedWines = localStorage.getItem('premnord_wines');
      const storedSites = localStorage.getItem('premnord_sites');
      const storedMovements = localStorage.getItem('premnord_movements');
      const storedLogo = localStorage.getItem('premnord_custom_logo');
      const storedWatermark = localStorage.getItem('premnord_watermark_logo');
      const storedRegions = localStorage.getItem('premnord_custom_regions');
      
      setAppLogo(storedLogo || null);
      setWatermarkLogo(storedWatermark || null);

      if (storedRegions) {
        try {
          const parsed = JSON.parse(storedRegions);
          let list = Array.isArray(parsed.regions) && parsed.regions.length > 0 ? parsed.regions : DEFAULT_WINE_REGIONS;
          const harmonization = harmonizeWineRegions(list);
          if (harmonization.changed) {
            list = harmonization.list;
            saveLocalRegions(list, parsed.groups || DEFAULT_REGION_GROUPS);
          }
          setRegions(list);
          regionsStateRef.current = list;
          const grps = Array.isArray(parsed.groups) && parsed.groups.length > 0 ? parsed.groups : DEFAULT_REGION_GROUPS;
          setRegionGroups(grps);
          regionGroupsStateRef.current = grps;
        } catch (e) {
          setRegions(DEFAULT_WINE_REGIONS);
          setRegionGroups(DEFAULT_REGION_GROUPS);
        }
      } else {
        setRegions(DEFAULT_WINE_REGIONS);
        setRegionGroups(DEFAULT_REGION_GROUPS);
        saveLocalRegions(DEFAULT_WINE_REGIONS, DEFAULT_REGION_GROUPS);
      }

      if (storedSites) {
        const parsedSites: Site[] = JSON.parse(storedSites);
        let hasChanges = false;

        const syncedSites = parsedSites.map(s => {
          const ds = DEFAULT_SITES.find(d => d.id === s.id);
          if (ds && s.name !== ds.name) {
            hasChanges = true;
            return { ...s, name: ds.name, description: ds.description || s.description };
          }
          return s;
        });

        const missing = DEFAULT_SITES.filter(ds => !syncedSites.some(s => s.id === ds.id));
        if (missing.length > 0) {
          hasChanges = true;
          missing.forEach(m => syncedSites.push({ ...m, createdAt: Date.now() }));
        }

        if (hasChanges) {
          localStorage.setItem('premnord_sites', JSON.stringify(syncedSites));
        }
        sitesStateRef.current = syncedSites;
        setSites(syncedSites);
      } else {
        // Seed default sites in local storage
        const initialSites = DEFAULT_SITES.map(s => ({ ...s, createdAt: Date.now() }));
        localStorage.setItem('premnord_sites', JSON.stringify(initialSites));
        sitesStateRef.current = initialSites;
        setSites(initialSites);
      }

      if (storedWines) {
        const parsedWines: Wine[] = JSON.parse(storedWines).map((w: Wine) => ({
          ...w,
          country: (w.country && w.country.trim()) || inferWineCountry(w)
        }));
        winesStateRef.current = parsedWines;
        setWines(parsedWines);
      } else {
        winesStateRef.current = [];
        setWines([]);
      }

      if (storedMovements) {
        const parsedMovements = JSON.parse(storedMovements);
        movementsStateRef.current = parsedMovements;
        setMovements(parsedMovements);
      } else {
        movementsStateRef.current = [];
        setMovements([]);
      }
    } catch (e) {
      console.error("Error loading local storage data:", e);
    }
  };

  const saveLocalData = (newWines?: Wine[], newSites?: Site[], newMovements?: Movement[]) => {
    try {
      if (newWines) {
        localStorage.setItem('premnord_wines', JSON.stringify(newWines));
        winesStateRef.current = newWines;
        setWines(newWines);
      }
      if (newSites) {
        localStorage.setItem('premnord_sites', JSON.stringify(newSites));
        sitesStateRef.current = newSites;
        setSites(newSites);
      }
      if (newMovements) {
        localStorage.setItem('premnord_movements', JSON.stringify(newMovements));
        movementsStateRef.current = newMovements;
        setMovements(newMovements);
      }
    } catch (e) {
      console.error("Error writing to local storage:", e);
    }
  };

  // Google Login Actions
  const loginWithGoogle = async () => {
    try {
      const authInstance = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(authInstance, provider);
    } catch (err) {
      console.error("Google Auth Error:", err);
      setError("Échec de la connexion avec Google. Le navigateur ou les cookies de l'iframe peuvent bloquer la fenêtre contextuelle.");
      throw err;
    }
  };

  const loginAsGuest = (_name: string) => {
    console.warn("Mode démo invité désactivé : veuillez vous connecter avec un compte Google.");
  };

  const logout = async () => {
    try {
      localStorage.removeItem('premnord_guest_user');
      if (!isDemo) {
        const authInstance = getFirebaseAuth();
        await signOut(authInstance);
      }
      setUser(null);
    } catch (err) {
      console.error("Logout Error:", err);
    }
  };

  // --- WINE MUTATIONS ---
  const addWine = async (
    wineInput: Omit<Wine, 'id' | 'createdAt' | 'updatedAt'>,
    options?: { importMode?: 'accumulate' | 'replace' }
  ): Promise<string> => {
    // Normalize domain using our robust canonical domain helper
    const normalizedDomain = getCanonicalDomain(wineInput.domain);
    const finalWineInput = { ...wineInput, domain: normalizedDomain };

    // Check if a wine with the same domain, vintage, and siteId already exists - ONLY during batch import!
    // Manual additions by the sommelier should never be silently absorbed.
    const isBatchImport = Boolean(options?.importMode);
    const existing = isBatchImport ? winesStateRef.current.find(w => {
      const sameSite = w.siteId === finalWineInput.siteId;
      if (!sameSite) return false;
      return isSameWineReference(w, finalWineInput);
    }) : null;

    if (existing) {
      console.log("Existing matching wine found, updating quantity instead of duplicating:", existing);
      
      const isReplaceMode = options?.importMode === 'replace';
      
      // If replace mode, check if it's identical (ISO) to avoid redundant updates
      if (isReplaceMode) {
        const isIso = 
          existing.quantity === finalWineInput.quantity &&
          (existing.bin || '') === (finalWineInput.bin || '') &&
          existing.priceBuy === finalWineInput.priceBuy &&
          existing.priceBuyHt === finalWineInput.priceBuyHt &&
          existing.shippingCost === finalWineInput.shippingCost &&
          existing.priceSell === finalWineInput.priceSell &&
          existing.color === finalWineInput.color &&
          (existing.region || '') === (finalWineInput.region || '') &&
          (existing.appellation || '') === (finalWineInput.appellation || '') &&
          (existing.cuvee || '') === (finalWineInput.cuvee || '');
          
        if (isIso) {
          console.log("Wine is identical (ISO) in replace mode, skipping update:", existing.id);
          return existing.id;
        }
      }

      const updatedFields: Partial<Wine> = {
        quantity: isReplaceMode ? finalWineInput.quantity : existing.quantity + finalWineInput.quantity,
        updatedAt: Date.now()
      };
      
      if (isReplaceMode) {
        updatedFields.bin = finalWineInput.bin || undefined;
        updatedFields.priceBuy = finalWineInput.priceBuy !== undefined ? finalWineInput.priceBuy : undefined;
        updatedFields.priceBuyHt = finalWineInput.priceBuyHt !== undefined ? finalWineInput.priceBuyHt : undefined;
        updatedFields.shippingCost = finalWineInput.shippingCost !== undefined ? finalWineInput.shippingCost : undefined;
        updatedFields.priceSell = finalWineInput.priceSell !== undefined ? finalWineInput.priceSell : undefined;
        updatedFields.region = finalWineInput.region || undefined;
        updatedFields.subRegion = finalWineInput.subRegion || undefined;
        updatedFields.color = finalWineInput.color;
        updatedFields.appellation = finalWineInput.appellation || undefined;
        updatedFields.cuvee = finalWineInput.cuvee || undefined;
        if (finalWineInput.notes) updatedFields.notes = finalWineInput.notes;
        if (finalWineInput.technicalSheet) updatedFields.technicalSheet = finalWineInput.technicalSheet;
      } else {
        if (finalWineInput.bin) updatedFields.bin = finalWineInput.bin;
        if (finalWineInput.priceBuy !== undefined) updatedFields.priceBuy = finalWineInput.priceBuy;
        if (finalWineInput.priceBuyHt !== undefined) updatedFields.priceBuyHt = finalWineInput.priceBuyHt;
        if (finalWineInput.shippingCost !== undefined) updatedFields.shippingCost = finalWineInput.shippingCost;
        if (finalWineInput.priceSell !== undefined) updatedFields.priceSell = finalWineInput.priceSell;
        if (finalWineInput.notes) updatedFields.notes = finalWineInput.notes;
        if (finalWineInput.region) updatedFields.region = finalWineInput.region;
        if (finalWineInput.subRegion) updatedFields.subRegion = finalWineInput.subRegion;
        if (finalWineInput.appellation) updatedFields.appellation = finalWineInput.appellation;
        if (finalWineInput.cuvee) updatedFields.cuvee = finalWineInput.cuvee;
        if (finalWineInput.technicalSheet) updatedFields.technicalSheet = finalWineInput.technicalSheet;
      }
      
      await updateWine(existing.id, updatedFields, 'edit');
      return existing.id;
    }

    const id = `wine_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const now = Date.now();
    const country = (finalWineInput.country && finalWineInput.country.trim()) || inferWineCountry(finalWineInput);
    const newWine: Wine = {
      ...finalWineInput,
      country,
      id,
      createdAt: now,
      updatedAt: now
    };

    if (isDemo || !user) {
      const updatedWines = [...winesStateRef.current, newWine];
      saveLocalData(updatedWines, undefined, undefined);
      return id;
    }

    // Optimistic update of local ref to prevent duplicates in sequential fast-loops
    winesStateRef.current = [...winesStateRef.current, newWine];
    setWines(winesStateRef.current);

    const path = `wines/${id}`;
    try {
      const db = getFirebaseDb();
      await setDoc(doc(db, 'wines', id), cleanUndefined(newWine));
      return id;
    } catch (err) {
      // Revert local state in case of failure
      winesStateRef.current = winesStateRef.current.filter(w => w.id !== id);
      setWines(winesStateRef.current);
      handleFirestoreError(err, OperationType.CREATE, path);
      throw err;
    }
  };

  const updateWine = async (
    id: string, 
    updates: Partial<Wine>, 
    action: 'edit' | 'stock',
    options?: { propagateReference?: boolean }
  ): Promise<void> => {
    const shouldPropagate = options?.propagateReference !== false && action === 'edit';

    // Normalize domain using canonical domain helper
    const finalUpdates = { ...updates };
    if (finalUpdates.domain) {
      finalUpdates.domain = getCanonicalDomain(finalUpdates.domain);
    }

    const now = Date.now();
    const previousWines = [...winesStateRef.current];
    const targetWine = winesStateRef.current.find(w => w.id === id);

    if (!targetWine) {
      console.warn("updateWine: target wine not found with id", id);
      return;
    }

    // 1. Identify other wines sharing the exact same reference across other sites
    const otherMatchingWines = shouldPropagate
      ? winesStateRef.current.filter(w => w.id !== id && isSameWineReference(w, targetWine))
      : [];

    // Reference fields to propagate across sites:
    const REFERENCE_FIELDS: (keyof Wine)[] = [
      'name',
      'domain',
      'vintage',
      'color',
      'region',
      'subRegion',
      'country',
      'appellation',
      'cuvee',
      'priceSell',
      'priceBuy',
      'priceBuyHt',
      'shippingCost',
      'notes',
      'technicalSheet',
      'format',
      'hideFromMenu',
      'isPreSale'
    ];

    const refUpdates: Partial<Wine> = {};
    REFERENCE_FIELDS.forEach(field => {
      if (field in finalUpdates) {
        (refUpdates as any)[field] = (finalUpdates as any)[field];
      }
    });
    const hasRefUpdates = Object.keys(refUpdates).length > 0;

    // 2. Perform Optimistic Local State Update (NEVER delete or merge wines automatically on edit)
    const nextWines = winesStateRef.current.map(w => {
      if (w.id === id) {
        const updated = { ...w, ...finalUpdates, updatedAt: now };
        // Clean undefined fields so they don't linger in local state
        Object.keys(finalUpdates).forEach(k => {
          if ((finalUpdates as any)[k] === undefined) {
            delete (updated as any)[k];
          }
        });
        return updated;
      }
      if (otherMatchingWines.some(other => other.id === w.id) && hasRefUpdates) {
        const updated = { ...w, ...refUpdates, updatedAt: now };
        Object.keys(refUpdates).forEach(k => {
          if ((refUpdates as any)[k] === undefined) {
            delete (updated as any)[k];
          }
        });
        return updated;
      }
      return w;
    });

    winesStateRef.current = nextWines;
    setWines(nextWines);

    if (isDemo || !user) {
      saveLocalData(nextWines, undefined, undefined);
      return;
    }

    // 3. Persist to Firestore
    try {
      const db = getFirebaseDb();
      const batch = writeBatch(db);
      const mainUpdates = prepareFirestoreUpdate({
        ...finalUpdates,
        updatedAt: now
      });
      batch.update(doc(db, 'wines', id), mainUpdates);

      if (hasRefUpdates && otherMatchingWines.length > 0) {
        otherMatchingWines.forEach(other => {
          batch.update(doc(db, 'wines', other.id), prepareFirestoreUpdate({ ...refUpdates, updatedAt: now }));
        });
      }

      await batch.commit();
    } catch (err) {
      // Revert local state on failure
      winesStateRef.current = previousWines;
      setWines(previousWines);
      handleFirestoreError(err, OperationType.UPDATE, `wines/${id}`);
      throw err;
    }
  };

  const deleteWine = async (id: string): Promise<void> => {
    const previousWines = [...winesStateRef.current];

    // Optimistic/immediate local update
    winesStateRef.current = winesStateRef.current.filter(w => w.id !== id);
    setWines(winesStateRef.current);

    if (isDemo || !user) {
      saveLocalData(winesStateRef.current, undefined, undefined);
      return;
    }

    const path = `wines/${id}`;
    try {
      const db = getFirebaseDb();
      await deleteDoc(doc(db, 'wines', id));
    } catch (err) {
      // Revert local state on failure
      winesStateRef.current = previousWines;
      setWines(previousWines);
      handleFirestoreError(err, OperationType.DELETE, path);
      throw err;
    }
  };

  const deleteWinesBatch = async (ids: string[]): Promise<number> => {
    if (!ids || ids.length === 0) return 0;
    const idSet = new Set(ids);
    const previousWines = [...winesStateRef.current];

    // Optimistic local update
    const remainingWines = winesStateRef.current.filter(w => !idSet.has(w.id));
    winesStateRef.current = remainingWines;
    setWines(remainingWines);

    if (isDemo || !user) {
      saveLocalData(remainingWines, undefined, undefined);
      return ids.length;
    }

    try {
      const db = getFirebaseDb();
      let i = 0;
      while (i < ids.length) {
        const batch = writeBatch(db);
        const chunk = ids.slice(i, i + 400);
        chunk.forEach(id => {
          batch.delete(doc(db, 'wines', id));
        });
        await batch.commit();
        i += 400;
      }
      return ids.length;
    } catch (err) {
      // Revert local state on failure
      winesStateRef.current = previousWines;
      setWines(previousWines);
      handleFirestoreError(err, OperationType.DELETE, 'wines');
      throw err;
    }
  };

  // --- SITE MUTATIONS ---
  const addSite = async (name: string, description?: string): Promise<string> => {
    const id = `site_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const now = Date.now();
    const newSite: Site = {
      id,
      name,
      description,
      createdAt: now
    };

    if (isDemo || !user) {
      const updatedSites = [...sitesStateRef.current, newSite];
      saveLocalData(undefined, updatedSites, undefined);
      return id;
    }

    const path = `sites/${id}`;
    try {
      const db = getFirebaseDb();
      await setDoc(doc(db, 'sites', id), cleanUndefined(newSite));
      return id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      throw err;
    }
  };

  const updateSite = async (id: string, name: string, description?: string): Promise<void> => {
    if (isDemo || !user) {
      const updatedSites = sitesStateRef.current.map(s => {
        if (s.id === id) {
          return { ...s, name, description };
        }
        return s;
      });
      saveLocalData(undefined, updatedSites, undefined);
      return;
    }

    const path = `sites/${id}`;
    try {
      const db = getFirebaseDb();
      await updateDoc(doc(db, 'sites', id), cleanUndefined({
        name,
        description
      }));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
      throw err;
    }
  };

  const deleteSite = async (id: string): Promise<void> => {
    // Prevent deletion of sites if they currently contain wines
    const containsWines = winesStateRef.current.some(w => w.siteId === id);
    if (containsWines) {
      throw new Error("Impossible de supprimer ce site : des bouteilles de vin y sont actuellement stockées.");
    }

    if (isDemo || !user) {
      const updatedSites = sitesStateRef.current.filter(s => s.id !== id);
      saveLocalData(undefined, updatedSites, undefined);
      return;
    }

    const path = `sites/${id}`;
    try {
      const db = getFirebaseDb();
      await deleteDoc(doc(db, 'sites', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
      throw err;
    }
  };

  const seedDefaultSites = async (): Promise<void> => {
    if (isDemo || !user) {
      const initialSites = DEFAULT_SITES.map(s => ({ ...s, createdAt: Date.now() }));
      saveLocalData(undefined, initialSites, undefined);
      return;
    }
    try {
      const db = getFirebaseDb();
      await bootstrapDefaultSites(db);
    } catch (e) {
      console.error("Error in seedDefaultSites:", e);
      throw e;
    }
  };

  // --- MOVEMENT MUTATIONS ---
  const addMovement = async (movementInput: Omit<Movement, 'id' | 'userId' | 'userName' | 'createdAt'> & { createdAt?: number; userId?: string; userName?: string }): Promise<string> => {
    const id = `mov_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const now = Date.now();
    const currentUser = userRef.current;
    
    if (!currentUser && !isDemoRef.current) {
      throw new Error("L'utilisateur doit être connecté pour enregistrer un mouvement de stock.");
    }

    const newMovement: Movement = {
      ...movementInput,
      id,
      userId: movementInput.userId || currentUser?.uid || 'user_guest',
      userName: movementInput.userName || currentUser?.displayName || currentUser?.email || 'Sommelier',
      createdAt: movementInput.createdAt || now
    };

    if (isDemo) {
      const updatedMovements = [newMovement, ...movementsStateRef.current];
      saveLocalData(undefined, undefined, updatedMovements);
      return id;
    }

    const path = `movements/${id}`;
    try {
      const db = getFirebaseDb();
      await setDoc(doc(db, 'movements', id), cleanUndefined(newMovement));
      return id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      throw err;
    }
  };

  const syncLocalToFirebase = async () => {
    if (isDemo || !user) {
      throw new Error("Vous devez être connecté avec un compte Google pour synchroniser les données.");
    }
    
    try {
      const db = getFirebaseDb();
      
      const storedWines = localStorage.getItem('premnord_wines');
      const storedSites = localStorage.getItem('premnord_sites');
      const storedMovements = localStorage.getItem('premnord_movements');

      if (!storedWines && !storedSites && !storedMovements) {
        console.log("No local data found to sync.");
        return;
      }

      // 1. Sync Sites
      if (storedSites) {
        const localSites: Site[] = JSON.parse(storedSites);
        const batch = writeBatch(db);
        localSites.forEach((site) => {
          const docRef = doc(collection(db, 'sites'), site.id);
          batch.set(docRef, cleanUndefined({
            ...site,
            createdAt: site.createdAt || Date.now()
          }), { merge: true });
        });
        await batch.commit();
      }

      // 2. Sync Wines
      if (storedWines) {
        const localWines: Wine[] = JSON.parse(storedWines);
        const batch = writeBatch(db);
        const remoteWines = winesStateRef.current;

        localWines.forEach((wine) => {
          // See if there is a remote wine with the exact same name, domain, vintage, color, and siteId
          const duplicateInRemote = remoteWines.find(rw => 
            (rw.name || '').trim().toLowerCase() === (wine.name || '').trim().toLowerCase() &&
            (rw.domain || '').trim().toLowerCase() === (wine.domain || '').trim().toLowerCase() &&
            (rw.vintage || '').trim().toLowerCase() === (wine.vintage || '').trim().toLowerCase() &&
            (rw.color || '').toLowerCase() === (wine.color || '').toLowerCase() &&
            rw.siteId === wine.siteId
          );

          if (duplicateInRemote) {
            const docRef = doc(collection(db, 'wines'), duplicateInRemote.id);
            batch.set(docRef, cleanUndefined({
              quantity: duplicateInRemote.quantity + wine.quantity,
              updatedAt: Date.now()
            }), { merge: true });
          } else {
            const docRef = doc(collection(db, 'wines'), wine.id);
            batch.set(docRef, cleanUndefined(wine), { merge: true });
          }
        });
        await batch.commit();
      }

      // 3. Sync Movements
      if (storedMovements) {
        const localMovements: Movement[] = JSON.parse(storedMovements);
        const batch = writeBatch(db);
        localMovements.forEach((mov) => {
          const docRef = doc(collection(db, 'movements'), mov.id);
          batch.set(docRef, cleanUndefined(mov), { merge: true });
        });
        await batch.commit();
      }

      // Clear local storage keys
      localStorage.removeItem('premnord_wines');
      localStorage.removeItem('premnord_sites');
      localStorage.removeItem('premnord_movements');
      
      setIsDemo(false);
      setError(null);
      
      console.log("Local data successfully synchronized to Firestore.");
    } catch (err) {
      console.error("Error during local-to-cloud sync:", err);
      throw err;
    }
  };

  /**
   * Cleans up empty residual wine records (quantity === 0) for any wine reference
   * that already has actual physical stock (quantity > 0) on other sites.
   * This prevents ghost sites with 0 stock from cluttering multi-site references.
   * Full historical tracking is safely preserved in the movements collection.
   */
  const cleanZeroStockResiduals = async (): Promise<number> => {
    const allWines = [...winesStateRef.current];
    const refGroups = new Map<string, Wine[]>();

    allWines.forEach(w => {
      const key = getWineReferenceKey(w);
      const list = refGroups.get(key) || [];
      list.push(w);
      refGroups.set(key, list);
    });

    const idsToDelete: string[] = [];

    refGroups.forEach((group) => {
      const hasStockElsewhere = group.some(w => w.quantity > 0);
      if (hasStockElsewhere) {
        group.forEach(w => {
          if (w.quantity === 0) {
            idsToDelete.push(w.id);
          }
        });
      }
    });

    if (idsToDelete.length === 0) return 0;

    const remainingWines = allWines.filter(w => !idsToDelete.includes(w.id));
    winesStateRef.current = remainingWines;
    setWines(remainingWines);

    if (isDemo || !user) {
      saveLocalData(remainingWines, undefined, undefined);
      return idsToDelete.length;
    }

    try {
      const db = getFirebaseDb();
      let i = 0;
      while (i < idsToDelete.length) {
        const batch = writeBatch(db);
        const chunk = idsToDelete.slice(i, i + 400);
        chunk.forEach(id => {
          batch.delete(doc(db, 'wines', id));
        });
        await batch.commit();
        i += 400;
      }
    } catch (err) {
      console.error("Error during cleanZeroStockResiduals:", err);
      winesStateRef.current = allWines;
      setWines(allWines);
      throw err;
    }

    return idsToDelete.length;
  };

  const deduplicateCellar = async (
    selectedKeys?: string[],
    customOverrides?: Record<string, Partial<Wine>>
  ): Promise<number> => {
    // Group all wines by unified reference key (domain, cuvee, vintage, color, format) and siteId
    const allWines = [...winesStateRef.current];
    const groups: { [key: string]: Wine[] } = {};

    allWines.forEach(wine => {
      // Domaine Prieuré-Roch is protected from automatic deduplication
      const isProtected = normalizeWineString(wine.domain || '').includes('prieureroch');
      const refKey = isProtected ? `${getWineReferenceKey(wine)}__${wine.id}` : getWineReferenceKey(wine);
      const key = `${refKey}__${wine.siteId}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(wine);
    });

    const isGroupEligible = (key: string) => {
      if (!selectedKeys || selectedKeys.length === 0) return true;
      return selectedKeys.includes(key);
    };

    let mergedCount = 0;

    if (isDemo || !user) {
      // Offline/Demo deduplication
      const newWinesList: Wine[] = [];
      Object.entries(groups).forEach(([key, group]) => {
        if (group.length === 1 || !isGroupEligible(key)) {
          newWinesList.push(...group);
        } else {
          // Merge duplicates
          const master = group[0];
          const totalQty = group.reduce((acc, w) => acc + w.quantity, 0);
          const override = customOverrides?.[key];
          
          // Merge other non-empty fields with optional custom overrides
          const mergedWine: Wine = {
            ...master,
            name: override?.name !== undefined && override.name.trim() ? override.name.trim() : master.name,
            quantity: override?.quantity !== undefined ? override.quantity : totalQty,
            bin: override?.bin !== undefined ? (override.bin.trim() || undefined) : (group.find(w => w.bin)?.bin || master.bin || undefined),
            priceBuy: override?.priceBuy !== undefined ? override.priceBuy : (group.find(w => w.priceBuy !== undefined)?.priceBuy ?? master.priceBuy),
            priceSell: override?.priceSell !== undefined ? override.priceSell : (group.find(w => w.priceSell !== undefined)?.priceSell ?? master.priceSell),
            notes: override?.notes !== undefined ? override.notes : (group.map(w => w.notes).filter(Boolean).join(' | ') || master.notes),
            updatedAt: Date.now()
          };
          newWinesList.push(mergedWine);
          mergedCount += (group.length - 1);
        }
      });
      winesStateRef.current = newWinesList;
      setWines(newWinesList);
      saveLocalData(newWinesList, undefined, undefined);
      return mergedCount;
    }

    // Cloud/Firebase deduplication (high-performance chunked batch commit)
    try {
      const db = getFirebaseDb();
      const duplicateEntries = Object.entries(groups).filter(([key, g]) => g.length > 1 && isGroupEligible(key));

      if (duplicateEntries.length === 0) return 0;

      let opsInBatch = 0;
      let currentBatch = writeBatch(db);
      const updatedMastersMap = new Map<string, Partial<Wine>>();
      const deletedIds = new Set<string>();

      for (const [key, group] of duplicateEntries) {
        const master = group[0];
        const totalQty = group.reduce((acc, w) => acc + w.quantity, 0);
        const override = customOverrides?.[key];

        const mergedFields: Partial<Wine> = {
          name: override?.name !== undefined && override.name.trim() ? override.name.trim() : master.name,
          quantity: override?.quantity !== undefined ? override.quantity : totalQty,
          bin: override?.bin !== undefined ? (override.bin.trim() || undefined) : (group.find(w => w.bin)?.bin || master.bin || undefined),
          priceBuy: override?.priceBuy !== undefined ? override.priceBuy : (group.find(w => w.priceBuy !== undefined)?.priceBuy ?? master.priceBuy),
          priceSell: override?.priceSell !== undefined ? override.priceSell : (group.find(w => w.priceSell !== undefined)?.priceSell ?? master.priceSell),
          notes: override?.notes !== undefined ? override.notes : (group.map(w => w.notes).filter(Boolean).join(' | ') || master.notes),
          updatedAt: Date.now()
        };

        updatedMastersMap.set(master.id, mergedFields);

        const masterRef = doc(db, 'wines', master.id);
        currentBatch.set(masterRef, cleanUndefined(mergedFields), { merge: true });
        opsInBatch++;

        for (let i = 1; i < group.length; i++) {
          const dupRef = doc(db, 'wines', group[i].id);
          deletedIds.add(group[i].id);
          currentBatch.delete(dupRef);
          opsInBatch++;

          if (opsInBatch >= 400) {
            await currentBatch.commit();
            currentBatch = writeBatch(db);
            opsInBatch = 0;
          }
        }

        mergedCount += (group.length - 1);
      }

      if (opsInBatch > 0) {
        await currentBatch.commit();
      }

      // Optimistically update local wines state
      const nextWines = winesStateRef.current
        .filter(w => !deletedIds.has(w.id))
        .map(w => {
          if (updatedMastersMap.has(w.id)) {
            return { ...w, ...updatedMastersMap.get(w.id) };
          }
          return w;
        });
      winesStateRef.current = nextWines;
      setWines(nextWines);

      return mergedCount;
    } catch (err) {
      console.error("Error during cloud deduplication:", err);
      throw err;
    }
  };

  const repairWinesData = async (): Promise<number> => {
    const allWines = [...winesStateRef.current];
    let repairedCount = 0;

    const normalizeText = (str: string): string => {
      if (!str) return '';
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
    };

    const updatedWines = [...allWines];
    const modifications: Array<{ id: string; updates: Partial<Wine> }> = [];

    allWines.forEach((w, idx) => {
      let changed = false;
      const updates: Partial<Wine> = {};

      const text = normalizeText(w.region);
      const dom = normalizeText(w.domain);
      const appell = normalizeText(w.appellation || '');

      // 1. Repair Chilean wines with missing or default regions
      if (
        text.startsWith('valle d') || 
        text === 'valle' ||
        text === 'val de' ||
        ((text === '' || text === 'bt') && (dom.includes('henriquez') || dom.includes('henríquez'))) ||
        ((text === 'valle d' || text === '' || text === 'bt') && (appell.includes('biobio') || appell.includes('bio bio') || appell.includes('itata')))
      ) {
        updates.region = 'Chili';
        changed = true;
      }

      // 2. Repair incorrectly imported Domaine Prieuré-Roch (DPR) wines
      // In the broken import, the domain was set to a 4-digit vintage year (e.g., "2021") and the region is "Bourgogne"
      const isYear = /^\d{4}$/.test(w.domain || '');
      const isDprBroken = normalizeText(w.region) === 'bourgogne' && isYear && w.domain === w.vintage;

      if (isDprBroken) {
        updates.domain = 'Domaine Prieuré-Roch';
        changed = true;

        let newName = w.name;
        // If the cuvee is set to a bin code (like "13A2", "12D1") and the name ends with " - cuvee", strip it
        if (w.cuvee && w.name.endsWith(` - ${w.cuvee}`)) {
          newName = w.name.substring(0, w.name.length - ` - ${w.cuvee}`.length);
          updates.cuvee = '';
        } else if (w.cuvee) {
          // If cuvee looks like a bin code (letters and digits, e.g. "13A2"), clear it
          if (/^[0-9]+[a-zA-Z0-9]+$/.test(w.cuvee)) {
            updates.cuvee = '';
          }
        }

        // Even if cuvee field wasn't set, if the name ends with " - bin-code" (e.g., " - 13A2"), strip it
        if (!w.cuvee || w.cuvee === '') {
          const match = w.name.match(/ - ([0-9]+[a-zA-Z0-9\/]+)$/);
          if (match) {
            const potentialBin = match[1];
            if (potentialBin.length <= 12 && /[0-9]/.test(potentialBin)) {
              newName = w.name.substring(0, w.name.length - ` - ${potentialBin}`.length);
            }
          }
        }

        if (newName !== w.name) {
          updates.name = newName;
        }
      }

      // 3. Ensure every wine has its country populated
      if (!w.country || !w.country.trim()) {
        const country = inferWineCountry(w);
        if (country) {
          updates.country = country;
          changed = true;
        }
      }

      if (changed) {
        repairedCount++;
        updates.updatedAt = Date.now();
        updatedWines[idx] = { ...w, ...updates };
        modifications.push({ id: w.id, updates });
      }
    });

    if (repairedCount > 0) {
      if (isDemo || !user) {
        saveLocalData(updatedWines, undefined, undefined);
        winesStateRef.current = updatedWines;
        setWines(updatedWines);
      } else {
        const db = getFirebaseDb();
        const batch = writeBatch(db);
        modifications.forEach(({ id, updates }) => {
          const docRef = doc(db, 'wines', id);
          batch.set(docRef, updates, { merge: true });
        });
        await batch.commit();
        winesStateRef.current = updatedWines;
        setWines(updatedWines);
      }
    }

    return repairedCount;
  };

  const apply3TierPricingToAllWines = async (): Promise<number> => {
    const currentList = [...winesStateRef.current];
    if (currentList.length === 0) return 0;

    let updatedCount = 0;
    const now = Date.now();
    const updatedWines = [...currentList];
    const modifications: Array<{ id: string; updates: Partial<Wine> }> = [];

    currentList.forEach((w, idx) => {
      const buyPrice = w.priceBuy !== undefined && w.priceBuy > 0 
        ? w.priceBuy 
        : (w.priceBuyHt !== undefined && w.priceBuyHt > 0 ? w.priceBuyHt + (w.shippingCost || 0) : undefined);

      if (buyPrice !== undefined && buyPrice > 0) {
        const expectedSellPrice = calculateSellingPrice(buyPrice);
        if (w.priceSell !== expectedSellPrice) {
          updatedCount++;
          const updates: Partial<Wine> = {
            priceSell: expectedSellPrice,
            updatedAt: now
          };
          updatedWines[idx] = { ...w, ...updates };
          modifications.push({ id: w.id, updates });
        }
      }
    });

    if (updatedCount > 0) {
      if (isDemo || !user) {
        saveLocalData(updatedWines, undefined, undefined);
        winesStateRef.current = updatedWines;
        setWines(updatedWines);
      } else {
        const db = getFirebaseDb();
        let i = 0;
        while (i < modifications.length) {
          const batch = writeBatch(db);
          const chunk = modifications.slice(i, i + 400);
          chunk.forEach(({ id, updates }) => {
            const docRef = doc(db, 'wines', id);
            batch.update(docRef, cleanUndefined(updates));
          });
          await batch.commit();
          i += 400;
        }
        winesStateRef.current = updatedWines;
        setWines(updatedWines);
      }
    }

    return updatedCount;
  };

  const resetAllStocks = async (): Promise<number> => {
    const currentList = [...winesStateRef.current];
    if (currentList.length === 0) return 0;

    const now = Date.now();
    const updatedWines = currentList.map(w => ({
      ...w,
      quantity: 0,
      bin: '',
      updatedAt: now
    }));

    if (isDemo || !user) {
      localStorage.setItem('premnord_wines', JSON.stringify(updatedWines));
      winesStateRef.current = updatedWines;
      setWines(updatedWines);
    } else {
      const db = getFirebaseDb();
      let i = 0;
      while (i < updatedWines.length) {
        const batch = writeBatch(db);
        const chunk = updatedWines.slice(i, i + 400);
        chunk.forEach(w => {
          const docRef = doc(db, 'wines', w.id);
          batch.update(docRef, { quantity: 0, bin: '', updatedAt: now });
        });
        await batch.commit();
        i += 400;
      }
      winesStateRef.current = updatedWines;
      setWines(updatedWines);
    }

    return currentList.length;
  };

  const updateAppLogo = async (logo: string | null): Promise<void> => {
    setAppLogo(logo);
    if (isDemo || !user) {
      if (logo) {
        localStorage.setItem('premnord_custom_logo', logo);
      } else {
        localStorage.removeItem('premnord_custom_logo');
      }
    } else {
      try {
        const db = getFirebaseDb();
        const brandingDocRef = doc(db, 'settings', 'branding');
        await setDoc(brandingDocRef, { logo, updatedAt: Date.now() }, { merge: true });
      } catch (err) {
        console.error("Error saving branding logo to Firestore:", err);
        // Fallback to local storage if needed
        if (logo) {
          localStorage.setItem('premnord_custom_logo', logo);
        } else {
          localStorage.removeItem('premnord_custom_logo');
        }
      }
    }
  };

  const updateWatermarkLogo = async (watermark: string | null): Promise<void> => {
    setWatermarkLogo(watermark);
    if (isDemo || !user) {
      if (watermark) {
        localStorage.setItem('premnord_watermark_logo', watermark);
      } else {
        localStorage.removeItem('premnord_watermark_logo');
      }
    } else {
      try {
        const db = getFirebaseDb();
        const brandingDocRef = doc(db, 'settings', 'branding');
        await setDoc(brandingDocRef, { watermark, updatedAt: Date.now() }, { merge: true });
      } catch (err) {
        console.error("Error saving watermark logo to Firestore:", err);
        // Fallback to local storage if needed
        if (watermark) {
          localStorage.setItem('premnord_watermark_logo', watermark);
        } else {
          localStorage.removeItem('premnord_watermark_logo');
        }
      }
    }
  };

  const clearMovementsHistory = async (): Promise<number> => {
    let deletedCount = 0;
    if (isDemo || !user) {
      deletedCount = movementsStateRef.current.length;
      localStorage.removeItem('premnord_movements');
      movementsStateRef.current = [];
      setMovements([]);
    } else {
      const db = getFirebaseDb();
      let movementsSnap;
      try {
        movementsSnap = await getDocs(collection(db, 'movements'));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'movements');
        throw err;
      }

      if (movementsSnap && movementsSnap.docs.length > 0) {
        deletedCount = movementsSnap.docs.length;
        let i = 0;
        const docs = movementsSnap.docs;
        while (i < docs.length) {
          const batch = writeBatch(db);
          const chunk = docs.slice(i, i + 400);
          chunk.forEach((d) => {
            batch.delete(doc(db, 'movements', d.id));
          });
          try {
            await batch.commit();
          } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, 'movements');
            throw err;
          }
          i += 400;
        }
      }

      localStorage.removeItem('premnord_movements');
      movementsStateRef.current = [];
      setMovements([]);
    }
    return deletedCount;
  };

  const clearDatabase = async (): Promise<void> => {
    if (isDemo || !user) {
      localStorage.removeItem('premnord_wines');
      localStorage.removeItem('premnord_movements');
      
      winesStateRef.current = [];
      movementsStateRef.current = [];
      
      setWines([]);
      setMovements([]);
    } else {
      const db = getFirebaseDb();
      
      let winesSnap;
      try {
        winesSnap = await getDocs(collection(db, 'wines'));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'wines');
        throw err;
      }
      
      let movementsSnap;
      try {
        movementsSnap = await getDocs(collection(db, 'movements'));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'movements');
        throw err;
      }
      
      const deleteDocsInBatches = async (docs: any[], path: string) => {
        let i = 0;
        while (i < docs.length) {
          const batch = writeBatch(db);
          const chunk = docs.slice(i, i + 400);
          chunk.forEach((d) => {
            batch.delete(doc(db, path, d.id));
          });
          try {
            await batch.commit();
          } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, path);
            throw err;
          }
          i += 400;
        }
      };
      
      if (winesSnap && winesSnap.docs.length > 0) {
        await deleteDocsInBatches(winesSnap.docs, 'wines');
      }
      if (movementsSnap && movementsSnap.docs.length > 0) {
        await deleteDocsInBatches(movementsSnap.docs, 'movements');
      }
      
      localStorage.removeItem('premnord_wines');
      localStorage.removeItem('premnord_movements');
      
      winesStateRef.current = [];
      movementsStateRef.current = [];
      setWines([]);
      setMovements([]);
    }
  };

  // --- Wine Regions Master Data Actions ---
  const addRegion = async (regionInput: Omit<WineRegion, 'id'>): Promise<string> => {
    const trimmedName = regionInput.name.trim();
    if (!trimmedName) throw new Error("Le nom de la région est obligatoire");

    const newId = generateRegionId(trimmedName, regionInput.country);
    const currentList = [...regionsStateRef.current];
    if (currentList.some(r => r.name.toLowerCase().trim() === trimmedName.toLowerCase())) {
      throw new Error(`La région "${trimmedName}" existe déjà dans le référentiel.`);
    }

    const newRegion: WineRegion = {
      ...regionInput,
      name: trimmedName,
      id: currentList.some(r => r.id === newId) ? `${newId}-${Date.now().toString(36)}` : newId,
      subRegions: Array.isArray(regionInput.subRegions) ? regionInput.subRegions : [],
      orderIndex: regionInput.orderIndex || (currentList.length + 1)
    };

    const updatedRegions = [...currentList, newRegion];
    let updatedGroups = [...regionGroupsStateRef.current];
    if (newRegion.group && !updatedGroups.includes(newRegion.group)) {
      updatedGroups = [...updatedGroups, newRegion.group];
    }

    setRegions(updatedRegions);
    regionsStateRef.current = updatedRegions;
    setRegionGroups(updatedGroups);
    regionGroupsStateRef.current = updatedGroups;
    saveLocalRegions(updatedRegions, updatedGroups);

    if (!isDemo && user) {
      try {
        const db = getFirebaseDb();
        await setDoc(doc(db, 'settings', 'regions'), {
          regions: updatedRegions,
          groups: updatedGroups,
          updatedAt: Date.now()
        });
      } catch (err) {
        console.error("Error saving new region to Firestore:", err);
      }
    }

    return newRegion.id;
  };

  const updateRegion = async (
    id: string, 
    updates: Partial<WineRegion>, 
    options?: { propagateRenameToWines?: boolean; oldName?: string }
  ): Promise<{ success: boolean; winesUpdatedCount: number }> => {
    const currentList = [...regionsStateRef.current];
    const targetIdx = currentList.findIndex(r => r.id === id);
    if (targetIdx === -1) {
      throw new Error("Région introuvable");
    }

    const currentRegion = currentList[targetIdx];
    const updatedRegion: WineRegion = {
      ...currentRegion,
      ...updates,
      name: updates.name ? updates.name.trim() : currentRegion.name,
      subRegions: updates.subRegions !== undefined ? updates.subRegions : currentRegion.subRegions
    };

    currentList[targetIdx] = updatedRegion;

    let updatedGroups = [...regionGroupsStateRef.current];
    if (updatedRegion.group && !updatedGroups.includes(updatedRegion.group)) {
      updatedGroups = [...updatedGroups, updatedRegion.group];
    }

    setRegions(currentList);
    regionsStateRef.current = currentList;
    setRegionGroups(updatedGroups);
    regionGroupsStateRef.current = updatedGroups;
    saveLocalRegions(currentList, updatedGroups);

    let winesUpdatedCount = 0;

    const oldName = (options?.oldName || currentRegion.name).trim();
    const newName = updatedRegion.name.trim();

    if (options?.propagateRenameToWines && oldName && newName && oldName !== newName) {
      const matchingWines = winesStateRef.current.filter(w => (w.region || '').trim() === oldName);
      if (matchingWines.length > 0) {
        const now = Date.now();
        winesStateRef.current = winesStateRef.current.map(w => {
          if ((w.region || '').trim() === oldName) {
            return { ...w, region: newName, updatedAt: now };
          }
          return w;
        });
        setWines([...winesStateRef.current]);
        saveLocalData(winesStateRef.current, undefined, undefined);

        if (!isDemo && user) {
          try {
            const db = getFirebaseDb();
            for (let i = 0; i < matchingWines.length; i += 400) {
              const chunk = matchingWines.slice(i, i + 400);
              const batch = writeBatch(db);
              chunk.forEach(w => {
                batch.update(doc(db, 'wines', w.id), { region: newName, updatedAt: now });
              });
              await batch.commit();
            }
          } catch (err) {
            console.error("Error propagating region rename to Firestore wines:", err);
          }
        }
        winesUpdatedCount = matchingWines.length;
      }
    }

    if (!isDemo && user) {
      try {
        const db = getFirebaseDb();
        await setDoc(doc(db, 'settings', 'regions'), {
          regions: currentList,
          groups: updatedGroups,
          updatedAt: Date.now()
        });
      } catch (err) {
        console.error("Error saving updated region to Firestore:", err);
      }
    }

    return { success: true, winesUpdatedCount };
  };

  const deleteRegion = async (
    id: string, 
    options?: { reassignWinesToRegion?: string }
  ): Promise<{ success: boolean; winesReassignedCount: number }> => {
    const currentList = [...regionsStateRef.current];
    const regionToDelete = currentList.find(r => r.id === id);
    if (!regionToDelete) {
      return { success: false, winesReassignedCount: 0 };
    }

    const filtered = currentList.filter(r => r.id !== id);
    setRegions(filtered);
    regionsStateRef.current = filtered;
    saveLocalRegions(filtered);

    let winesReassignedCount = 0;
    if (options?.reassignWinesToRegion) {
      const targetRegion = options.reassignWinesToRegion.trim();
      const oldRegionName = regionToDelete.name.trim();
      const matchingWines = winesStateRef.current.filter(w => (w.region || '').trim() === oldRegionName);

      if (matchingWines.length > 0) {
        const now = Date.now();
        winesStateRef.current = winesStateRef.current.map(w => {
          if ((w.region || '').trim() === oldRegionName) {
            return { ...w, region: targetRegion, updatedAt: now };
          }
          return w;
        });
        setWines([...winesStateRef.current]);
        saveLocalData(winesStateRef.current, undefined, undefined);

        if (!isDemo && user) {
          try {
            const db = getFirebaseDb();
            for (let i = 0; i < matchingWines.length; i += 400) {
              const chunk = matchingWines.slice(i, i + 400);
              const batch = writeBatch(db);
              chunk.forEach(w => {
                batch.update(doc(db, 'wines', w.id), { region: targetRegion, updatedAt: now });
              });
              await batch.commit();
            }
          } catch (err) {
            console.error("Error reassigning wines in Firestore:", err);
          }
        }
        winesReassignedCount = matchingWines.length;
      }
    }

    if (!isDemo && user) {
      try {
        const db = getFirebaseDb();
        await setDoc(doc(db, 'settings', 'regions'), {
          regions: filtered,
          groups: regionGroupsStateRef.current,
          updatedAt: Date.now()
        });
      } catch (err) {
        console.error("Error deleting region in Firestore:", err);
      }
    }

    return { success: true, winesReassignedCount };
  };

  const reorderRegions = async (newOrderedRegions: WineRegion[]): Promise<void> => {
    const orderedWithIndex = newOrderedRegions.map((r, idx) => ({
      ...r,
      orderIndex: idx + 1
    }));
    setRegions(orderedWithIndex);
    regionsStateRef.current = orderedWithIndex;
    saveLocalRegions(orderedWithIndex);

    if (!isDemo && user) {
      try {
        const db = getFirebaseDb();
        await setDoc(doc(db, 'settings', 'regions'), {
          regions: orderedWithIndex,
          groups: regionGroupsStateRef.current,
          updatedAt: Date.now()
        });
      } catch (err) {
        console.error("Error reordering regions in Firestore:", err);
      }
    }
  };

  const resetRegionsToDefault = async (): Promise<void> => {
    setRegions(DEFAULT_WINE_REGIONS);
    regionsStateRef.current = DEFAULT_WINE_REGIONS;
    setRegionGroups(DEFAULT_REGION_GROUPS);
    regionGroupsStateRef.current = DEFAULT_REGION_GROUPS;
    saveLocalRegions(DEFAULT_WINE_REGIONS, DEFAULT_REGION_GROUPS);

    if (!isDemo && user) {
      try {
        const db = getFirebaseDb();
        await setDoc(doc(db, 'settings', 'regions'), {
          regions: DEFAULT_WINE_REGIONS,
          groups: DEFAULT_REGION_GROUPS,
          updatedAt: Date.now()
        });
      } catch (err) {
        console.error("Error resetting regions in Firestore:", err);
      }
    }
  };

  return (
    <FirebaseContext.Provider value={{
      user,
      loading,
      isDemo,
      error,
      wines,
      sites,
      movements,
      loginWithGoogle,
      loginAsGuest,
      logout,
      addWine,
      updateWine,
      deleteWine,
      deleteWinesBatch,
      addSite,
      updateSite,
      deleteSite,
      seedDefaultSites,
      regions,
      regionGroups,
      addRegion,
      updateRegion,
      deleteRegion,
      reorderRegions,
      resetRegionsToDefault,
      addMovement,
      syncLocalToFirebase,
      cleanZeroStockResiduals,
      deduplicateCellar,
      repairWinesData,
      apply3TierPricingToAllWines,
      resetAllStocks,
      clearMovementsHistory,
      clearDatabase,
      appLogo,
      updateAppLogo,
      watermarkLogo,
      updateWatermarkLogo
    }}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};
