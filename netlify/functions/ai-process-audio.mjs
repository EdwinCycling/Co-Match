import { Type } from '@google/genai';
import { createGeminiClient, enforceRateLimit, ensurePost, handleOptions, json, parseBody, requireUser, withErrorHandling } from './_shared.mjs';

export const handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  const postResponse = ensurePost(event);
  if (postResponse) return postResponse;

  return withErrorHandling(async () => {
    const user = await requireUser(event);
    await enforceRateLimit({
      scope: 'ai-process-audio',
      identifier: user.uid,
      maxRequests: 8,
      windowMs: 10 * 60 * 1000,
      errorMessage: 'Error: Too many AI audio requests. Please try again in a few minutes.',
    });
    const { base64Audio, mimeType } = parseBody(event);

    if (!base64Audio || !mimeType) {
      return json(400, { error: 'Error: Missing audio input.' });
    }

    const maxBase64Size = 5 * 1024 * 1024;
    if (base64Audio.length > maxBase64Size) {
      return json(400, { error: 'Error: Audio file too large. Maximum size is 5 MB.' });
    }

    const prompt = `Transcribe the provided audio. Also evaluate if the audio contains any explicit sexual language, severe profanity, or harassment.
Return a JSON object with:
- isAcceptable (boolean): false if there is sexual content, severe profanity, or harassment; true otherwise.
- transcript (string): the full transcribed text.
- reason (string): if isAcceptable is false, briefly explain why in Dutch.`;

    const ai = createGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Audio,
                mimeType,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isAcceptable: { type: Type.BOOLEAN },
            transcript: { type: Type.STRING },
            reason: { type: Type.STRING },
          },
          required: ['isAcceptable', 'transcript'],
        },
      },
    });

    return json(200, JSON.parse(response.text || '{}'));
  });
};
