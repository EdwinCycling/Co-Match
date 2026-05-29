import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, increment, getDoc, serverTimestamp } from 'firebase/firestore';
import { CREDIT_COSTS } from '../constants';
import { toast } from 'react-hot-toast';
import i18n from '../i18n';

export async function deductCredits(amount: number, reason: string): Promise<boolean> {
  if (!auth.currentUser) return false;

  const userRef = doc(db, 'users', auth.currentUser.uid);
  
  try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return false;
    
    const currentCredits = userSnap.data().credits || 0;
    
    if (currentCredits < amount) {
      toast.error(i18n.t('credit.insufficient_for_action', { 
        defaultValue: `Onvoldoende credits! Je hebt ${amount} credits nodig voor deze actie.`, 
        amount 
      }));
      return false;
    }

    await updateDoc(userRef, {
      credits: increment(-amount),
      lastDeductionReason: reason,
      lastDeductionAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log(`Deducted ${amount} credits for: ${reason}`);
    return true;
  } catch (error) {
    console.error("Error deducting credits:", error);
    handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    return false;
  }
}

export async function addCredits(amount: number, reason: string): Promise<boolean> {
  if (!auth.currentUser) return false;

  const userRef = doc(db, 'users', auth.currentUser.uid);
  
  try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return false;
    
    await updateDoc(userRef, {
      credits: increment(amount),
      lastAdditionReason: reason,
      lastAdditionAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log(`Added ${amount} credits for: ${reason}`);
    return true;
  } catch (error) {
    console.error("Error adding credits:", error);
    handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    return false;
  }
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

  const userRef = doc(db, 'users', auth.currentUser.uid);
  const cost = CREDIT_COSTS.EXTRA_PROPERTIES_BUNDLE || 25;

  try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return false;

    const currentCredits = userSnap.data().credits || 0;

    if (currentCredits < cost) {
      toast.error(i18n.t('dashboard.provider.bundle.insufficient_toast', { 
        defaultValue: `Onvoldoende credits! Je hebt ${cost} credits nodig om 3 extra woningen te kopen.`, 
        cost 
      }));
      return false;
    }

    await updateDoc(userRef, {
      credits: increment(-cost),
      max_properties: increment(3),
      lastDeductionReason: `Purchased 3 extra properties bundle`,
      lastDeductionAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log(`Deducted ${cost} credits and added 3 to max_properties`);
    toast.success(i18n.t('dashboard.provider.bundle.success_toast', { 
      defaultValue: `Succesvol 3 extra woningen geactiveerd!` 
    }));
    return true;
  } catch (error) {
    console.error("Error purchasing extra property bundle:", error);
    handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    return false;
  }
}
