import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { postToServerFunction } from "../lib/serverApi";

// NIVEAU 2: LinkedIn Check
export async function verifyLinkedIn(userId: string, linkedinUrl: string, providerName: string): Promise<any> {
    const prompt = `Je bent een fraude-detectiesysteem voor een woningplatform. Analyseer dit LinkedIn profiel: ${linkedinUrl}.
De naam van onze gebruiker is: "${providerName}".

Voer de volgende checks uit:
1) NAAM MATCH: Komt de naam op LinkedIn (ongeveer) overeen met "${providerName}"? (Hoofdletterongevoelig, let op variaties).
2) ECHTHEID: Bekijk de samenvatting, werkervaring en connecties. Oogt het een 'echt', professioneel profiel? (Geen spam, geen lege velden, logische tijdlijn).

Retouneer EXACT en ALLEEN valid JSON in dit formaat:
{
  "score": number (1-100),
  "status": "APPROVED" | "REJECTED",
  "reason": "Korte uitleg van je oordeel",
  "name_match": boolean,
  "profile_credibility": "LOW" | "MEDIUM" | "HIGH",
  "summary_check": "kort verslag",
  "experience_check": "kort verslag"
}
Status APPROVED alleen bij score > 70 en goede naam match.`;
    
    try {
        const result = await postToServerFunction<any>('ai-verify-linkedin', {
            linkedinUrl,
            providerName
        });
        
        let resultData;
        try {
            resultData = result;
        } catch(e) {
            console.error("Parse error", result);
            resultData = { score: 0, status: 'REJECTED', reason: 'AI Response error' };
        }
        
        // Publicly update the level
        const publicUpdate: any = {
           "verificationStatus.level2.aiResultStatus": resultData.status,
           "verificationStatus.level2.score": resultData.score,
           "verificationLevel": resultData.status === 'APPROVED' ? 2 : 1,
           "updatedAt": serverTimestamp()
        };
        
        await updateDoc(doc(db, 'users', userId), publicUpdate);

        // Privately store the LinkedIn details (Secured by rules)
        const settingsRef = doc(db, 'users', userId, 'settings', 'verification');
        await setDoc(settingsRef, {
            linkedinUrl: linkedinUrl, 
            level2: {
                aiResult: resultData,
                verifiedAt: serverTimestamp()
            },
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        return resultData;
    } catch(err) {
        console.error('LinkedIn verify error', err);
        throw err;
    }
}

// NIVEAU 3: Address Live-Check
export async function verifyAddressLive(userId: string, imageDataUrl: string, expectedAddress: string, expectedName: string): Promise<any> {
    const systemInstruction = `SYSTEM INSTRUCTION: IMAGE FRAUD DETECTION
You are an expert fraud investigator. You will receive an image captured live via the app's camera.

YOUR ANALYSIS STEPS:
1. SCREEN-DETECTION (Anti-Fake): Scan the image for Moiré patterns, scan lines, or pixels that indicate the image is a photo of a screen/monitor. If detected -> Reject as 'Suspicious'.
2. PHYSICAL DOCUMENT CHECK: Check if the document (energy bill/tax letter) has physical depth (shadows, slight curves, corners visible). 
3. ENVIRONMENT VALIDATION: Verify the document is placed on a recognizable surface (e.g., a real wooden table, a desk, a kitchen counter). If the document is floating in a void or the background looks 'generated' or 'AI-smoothed' -> Reject as 'Suspicious'.
4. DATA EXTRACTION: Extract Name and Address. Compare this with the registered user's profile and the property address.
5. FINAL RULING: Return JSON: 
   {
     "status": "APPROVED" | "REJECTED" | "PENDING_MANUAL",
     "confidence": 0-100,
     "reason": "Clear explanation of why it was rejected (e.g., 'Document appears to be a digital screenshot')",
     "extracted_data": { "name": "...", "address": "..." }
   }`;

    try {
        let resultData;
        try {
            resultData = await postToServerFunction<any>('ai-verify-address-live', {
                imageDataUrl,
                expectedAddress,
                expectedName
            });
            if (resultData.confidence >= 50 && resultData.confidence <= 70 && resultData.status !== 'APPROVED') {
                resultData.status = 'PENDING_MANUAL';
            }
        } catch(e) {
            resultData = { status: 'REJECTED', confidence: 0, reason: 'Parse error', extracted_data: {} };
        }
        
        const updateData: any = {
           "verificationStatus.level3.status": resultData.status,
           "verificationStatus.level3.confidence": resultData.confidence,
           "verificationStatus.level3.reason": resultData.reason,
           "verificationStatus.level3.extractedData": resultData.extracted_data || {},
           "verificationStatus.level3.lastAttemptDate": new Date().toISOString()
        };
        
        if (resultData.status === 'PENDING_MANUAL') {
            updateData["verificationStatus.level3.manualReviewImage"] = imageDataUrl;
        } else {
            updateData["verificationStatus.level3.manualReviewImage"] = null;
        }
        
        if (resultData.status === 'APPROVED') {
           updateData['verificationLevel'] = 3;
        }

        updateData['updatedAt'] = serverTimestamp();

        // We only update if there's no failure? The prompt wants state saved. Let's save the attempt regardless.
        await updateDoc(doc(db, 'users', userId), updateData);
        
        return resultData;
    } catch(err) {
        console.error('Address verify error', err);
        throw err;
    }
}
