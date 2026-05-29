import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const props = await getDocs(collection(db, 'properties'));
  props.docs.forEach(d => {
    if (d.data().title.includes("Copy")) {
       console.log("Copy ID: ", d.id);
    }
  });

  const chats = await getDocs(collection(db, 'chats'));
  let i = 0;
  chats.docs.forEach(d => {
    i++;
    console.log("Chat:", d.id, "PropID:", d.data().propertyId);
  });
  console.log("Total chats: ", i)
}
check().catch(console.error);
setTimeout(() => process.exit(0), 5000);
