import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { DEFAULT_EXCHANGE_RATES } from '../constants';

const RATES_DOC_PATH = 'settings/currency_rates';

export async function getExchangeRates(): Promise<Record<string, number>> {
  try {
    const docRef = doc(db, RATES_DOC_PATH);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data().rates;
    } else {
      // Initialize with defaults if not exists
      try {
        await setDoc(docRef, { rates: DEFAULT_EXCHANGE_RATES });
      } catch (e) {
        // Only log if it fails, might be a non-admin user
        console.warn("Could not initialize rates, probably not an admin");
      }
      return DEFAULT_EXCHANGE_RATES;
    }
  } catch (error) {
    // If it's a permission error, we just return defaults silently to avoid crashing the UI
    return DEFAULT_EXCHANGE_RATES;
  }
}

export async function updateExchangeRates(rates: Record<string, number>) {
  const docRef = doc(db, RATES_DOC_PATH);
  try {
    await setDoc(docRef, { rates, updatedAt: new Date() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, RATES_DOC_PATH);
  }
}

export function subscribeToExchangeRates(callback: (rates: Record<string, number>) => void) {
  const docRef = doc(db, RATES_DOC_PATH);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data().rates);
    } else {
      callback(DEFAULT_EXCHANGE_RATES);
    }
  }, (error: any) => {
    // If it's a permission error, we just return defaults silently to avoid crashing the entire React app
    if (error.code === 'permission-denied') {
      console.warn("Permission denied for exchange rates subscription, using defaults.");
      callback(DEFAULT_EXCHANGE_RATES);
    } else {
      handleFirestoreError(error, OperationType.GET, RATES_DOC_PATH);
    }
  });
}
