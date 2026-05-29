import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Read firebase-applet-config.json
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const configJson = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(configJson);
const db = getFirestore(app);

async function addCredits() {
  console.log('Fetching seeker_profiles...');
  const seekersRef = collection(db, 'seeker_profiles');
  const seekersSnap = await getDocs(seekersRef);
  
  for (const seekerDoc of seekersSnap.docs) {
    const data = seekerDoc.data();
    const currentCredits = data.credits || 0;
    const randomAdd = Math.floor(Math.random() * (500 - 100 + 1)) + 100;
    const newCredits = currentCredits + randomAdd;
    
    await updateDoc(doc(db, 'seeker_profiles', seekerDoc.id), {
      credits: newCredits
    });
    console.log(`Seeker ${seekerDoc.id}: Added ${randomAdd} -> New total: ${newCredits}`);
  }
  
  console.log('Fetching providers...');
  const providersRef = collection(db, 'providers');
  const providersSnap = await getDocs(providersRef);
  
  for (const providerDoc of providersSnap.docs) {
    const data = providerDoc.data();
    const currentCredits = data.credits || 0;
    const randomAdd = Math.floor(Math.random() * (500 - 100 + 1)) + 100;
    const newCredits = currentCredits + randomAdd;
    
    await updateDoc(doc(db, 'providers', providerDoc.id), {
      credits: newCredits
    });
    console.log(`Provider ${providerDoc.id}: Added ${randomAdd} -> New total: ${newCredits}`);
  }
  
  console.log('Done!');
  process.exit(0);
}

addCredits().catch(console.error);
