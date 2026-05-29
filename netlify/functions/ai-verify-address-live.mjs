import { createGeminiClient, ensurePost, handleOptions, json, parseBody, requireUser, withErrorHandling } from './_shared.mjs';

export const handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  const postResponse = ensurePost(event);
  if (postResponse) return postResponse;

  return withErrorHandling(async () => {
    await requireUser(event);
    const { imageDataUrl, expectedAddress, expectedName } = parseBody(event);

    if (!imageDataUrl || !expectedAddress || !expectedName) {
      return json(400, { error: 'Error: Missing address verification input.' });
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

    return json(200, result);
  });
};
