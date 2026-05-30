import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CREDIT_COSTS } from '../constants';
import { toast } from 'react-hot-toast';
import i18n from '../i18n';
import { postToServerFunction } from '../lib/serverApi';

export async function deductCredits(amount: number, reason: string): Promise<boolean> {
  if (!auth.currentUser) return false;
  
  try {
    await postToServerFunction('user-credits', {
      action: 'deduct',
      amount,
      reason,
    });

    console.log(`Deducted ${amount} credits for: ${reason}`);
    return true;
  } catch (error) {
    console.error('Error deducting credits:', error);
    if (error instanceof Error && error.message.includes('Insufficient credits')) {
      toast.error(i18n.t('credit.insufficient_for_action', {
        defaultValue: `Onvoldoende credits! Je hebt ${amount} credits nodig voor deze actie.`,
        amount
      }));
      return false;
    }

    return false;
  }
}

export async function addCredits(amount: number, reason: string): Promise<boolean> {
  console.warn('addCredits is deprecated on the client:', amount, reason);
  return false;
}

export async function hasEnoughCredits(amount: number): Promise<boolean> {
  if (!auth.currentUser) return false;
  const userRef = doc(db, 'users', auth.currentUser.uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return false;
  return (userSnap.data().credits || 0) >= amount;
}

export async function buyExtraPropertyLimitBundle(): Promise<boolean> {
  if (!auth.currentUser) return false;
  const cost = CREDIT_COSTS.EXTRA_PROPERTIES_BUNDLE || 25;

  try {
    await postToServerFunction('user-credits', {
      action: 'buy-property-bundle',
    });

    console.log(`Deducted ${cost} credits and added 3 to max_properties`);
    toast.success(i18n.t('dashboard.provider.bundle.success_toast', { 
      defaultValue: `Succesvol 3 extra woningen geactiveerd!` 
    }));
    return true;
  } catch (error) {
    console.error('Error purchasing extra property bundle:', error);
    if (error instanceof Error && error.message.includes('Insufficient credits')) {
      toast.error(i18n.t('dashboard.provider.bundle.insufficient_toast', {
        defaultValue: `Onvoldoende credits! Je hebt ${cost} credits nodig om 3 extra woningen te kopen.`,
        cost
      }));
    }

    return false;
  }
}
