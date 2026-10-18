import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { 
  getFirestore, 
  Firestore, 
  doc, 
  getDocFromServer,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let isFirebaseInitialized = false;
let initializationError: string | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    try {
      if (!firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey.includes('PLACEHOLDER')) {
        throw new Error("Firebase configuration keys are placeholders. Please configure real API keys.");
      }
      if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
      } else {
        app = getApp();
      }
    } catch (error) {
      initializationError = error instanceof Error ? error.message : String(error);
      console.warn("Firebase lazy init warning:", initializationError);
      throw error;
    }
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    const firebaseApp = getFirebaseApp();
    auth = getAuth(firebaseApp);
  }
  return auth;
}

export function getFirebaseDb(): Firestore {
  if (!db) {
    const firebaseApp = getFirebaseApp();
    const dbId = (firebaseConfig as any).firestoreDatabaseId;
    try {
      db = initializeFirestore(firebaseApp, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      }, dbId);
      console.log("Firestore initialized with persistent local cache (offline enabled).");
    } catch (e) {
      console.warn("Could not initialize Firestore with persistent local cache, falling back to memory:", e);
      db = getFirestore(firebaseApp, dbId);
    }
  }
  return db;
}

// Check if Firebase can be initialized safely
export function checkFirebaseAvailable(): { available: boolean; error: string | null } {
  try {
    getFirebaseApp();
    getFirebaseAuth();
    getFirebaseDb();
    return { available: true, error: null };
  } catch (error) {
    return { available: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// Operation Type Enum for Secure Error Logs
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  let authInstance: Auth | null = null;
  try {
    authInstance = getFirebaseAuth();
  } catch (_) {
    // Auth might not be ready
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: authInstance?.currentUser?.uid || null,
      email: authInstance?.currentUser?.email || null,
      emailVerified: authInstance?.currentUser?.emailVerified || null,
      isAnonymous: authInstance?.currentUser?.isAnonymous || null,
      tenantId: authInstance?.currentUser?.tenantId || null,
      providerInfo: authInstance?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  
  console.error('Firestore Hardened Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test on boot
export async function testConnection() {
  try {
    const firestoreDb = getFirebaseDb();
    await getDocFromServer(doc(firestoreDb, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or connection.");
    }
  }
}

// Execute connection test in background (silent fail)
try {
  if (checkFirebaseAvailable().available) {
    testConnection();
  }
} catch (_) {}
