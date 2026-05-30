import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { checkRateLimit } from "../lib/rateLimit";
import { postToServerFunction } from "../lib/serverApi";

export async function getExistingMatch(seekerId: string, propertyId: string) {
  try {
    const matchId = `${seekerId}_${propertyId}`;
    const docRef = doc(db, 'matches', matchId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'matches');
    return null;
  }
}

export async function generateMatchReport(seekerId: string, propertyId: string, language: string = 'nl') {
  try {
    const matchId = `${seekerId}_${propertyId}`;
    
    // First check if it already exists to prevent duplicate generation
    const existing = await getExistingMatch(seekerId, propertyId);
    if (existing) {
      return existing;
    }
    if (!checkRateLimit('generate_report', 5, 24 * 60 * 60 * 1000)) {
      throw new Error("Je hebt het maximum aantal AI-rapporten voor vandaag bereikt (max 5 per dag). Probeer het morgen weer.");
    }

    const { report } = await postToServerFunction<{ report: string }>('ai-match-report', {
      seekerId,
      propertyId,
      language
    });

    const reportText = report || "Er kon geen rapport worden gegenereerd.";

    const propertySnap = await getDoc(doc(db, 'properties', propertyId));
    if (!propertySnap.exists()) {
      throw new Error("Woning gegevens ontbreken.");
    }
    const propertyData = propertySnap.data();

    // 5. Save Match result
    const matchData = {
      seekerId,
      propertyId,
      providerId: propertyData.ownerId,
      report: reportText,
      language: language,
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'matches', matchId), matchData);
    
    return {
      id: matchId,
      ...matchData
    };

  } catch (error) {
    console.error("Match generation error:", error);
    throw error;
  }
}

export async function translateMatchReport(existingMatch: any, targetLanguage: string) {
  try {
    if (!existingMatch.report) return null;
    if (existingMatch.language === targetLanguage || (existingMatch.translations && existingMatch.translations[targetLanguage])) {
      return existingMatch.translations ? existingMatch.translations[targetLanguage] : existingMatch.report;
    }

    const { translatedText } = await postToServerFunction<{ translatedText: string }>('ai-translate-report', {
      report: existingMatch.report,
      targetLanguage
    });
    if (!translatedText) throw new Error("Translation failed");

    // Save translation
    const matchRef = doc(db, 'matches', existingMatch.id);
    await setDoc(matchRef, {
      translations: {
        [targetLanguage]: translatedText
      }
    }, { merge: true });

    return translatedText;
  } catch (err) {
    console.error("Error translating report:", err);
    throw err;
  }
}

export async function getExistingMakelaarReport(propertyId: string) {
  try {
    const docRef = doc(db, 'makelaar_reports', propertyId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'makelaar_reports');
    return null;
  }
}

export async function generateMakelaarReport(propertyId: string, language: string = 'nl') {
  try {
    // Check if it already exists
    const existing = await getExistingMakelaarReport(propertyId);
    if (existing) {
      return existing;
    }

    if (!checkRateLimit('generate_report', 5, 24 * 60 * 60 * 1000)) {
      throw new Error("Je hebt het maximum aantal AI-rapporten voor vandaag bereikt (max 5 per dag). Probeer het morgen weer.");
    }
    
    const propertyRef = doc(db, 'properties', propertyId);
    const propertySnap = await getDoc(propertyRef);

    if (!propertySnap.exists()) {
      throw new Error("Woning gegevens ontbreken.");
    }

    const { report } = await postToServerFunction<{ report: string }>('ai-makelaar-report', {
      propertyId,
      language
    });

    const reportText = report || "Er kon geen makelaarsrapport worden gegenereerd.";
    const propertyData = propertySnap.data();

    const reportData = {
      propertyId,
      providerId: propertyData.ownerId,
      report: reportText,
      language: language,
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'makelaar_reports', propertyId), reportData);
    
    return {
      id: propertyId,
      ...reportData
    };

  } catch (error) {
    console.error("Makelaar report generation error:", error);
    throw error;
  }
}
