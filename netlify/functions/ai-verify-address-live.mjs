import { createGeminiClient, ensurePost, getDb, handleOptions, json, parseBody, requireUser, serverTimestamp, withErrorHandling } from './_shared.mjs';

export const handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  const postResponse = ensurePost(event);
  if (postResponse) return postResponse;

  return withErrorHandling(async () => {
    const user = await requireUser(event);
    const { imageDataUrl, expectedAddress, expectedName } = parseBody(event);

    if (!imageDataUrl || !expectedAddress || !expectedName) {
      return json(400, { error: 'Error: Missing address verification input.' });
    }

    if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/') || imageDataUrl.length > 8_000_000) {
      return json(400, { error: 'Error: Invalid verification image payload.' });
    }

    if (typeof expectedAddress !== 'string' || expectedAddress.trim().length === 0 || expectedAddress.length > 300) {
      return json(400, { error: 'Error: Invalid expected address.' });
    }

    if (typeof expectedName !== 'string' || expectedName.trim().length === 0 || expectedName.length > 200) {
      return json(400, { error: 'Error: Invalid expected name.' });
    }

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

    const base64Data = imageDataUrl.split(',')[1];
    const mimeType = imageDataUrl.split(';')[0].split(':')[1] || 'image/jpeg';
    const prompt = `Expected Name: ${expectedName}
Expected Address: ${expectedAddress}`;

    const ai = createGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        prompt,
        { inlineData: { data: base64Data, mimeType } },
      ],
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const result = JSON.parse(response.text || '{}');
    if (result.confidence >= 50 && result.confidence <= 70 && result.status !== 'APPROVED') {
      result.status = 'PENDING_MANUAL';
    }

    const db = getDb();
    const userUpdate = {
      verificationStatus: {
        level3: {
          status: result.status,
          confidence: Number(result.confidence || 0),
          reason: result.reason || '',
          extractedData: result.extracted_data || {},
          lastAttemptDate: new Date().toISOString(),
          manualReviewImage: result.status === 'PENDING_MANUAL' ? imageDataUrl : null,
        },
      },
      updatedAt: serverTimestamp(),
    };

    if (result.status === 'APPROVED') {
      userUpdate.verificationLevel = 3;
    }

    await db.collection('users').doc(user.uid).set(userUpdate, { merge: true });

    return json(200, result);
  });
};
