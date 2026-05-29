import { createGeminiClient, ensurePost, handleOptions, json, parseBody, requireUser, withErrorHandling } from './_shared.mjs';

export const handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  const postResponse = ensurePost(event);
  if (postResponse) return postResponse;

  return withErrorHandling(async () => {
    await requireUser(event);
    const { report, targetLanguage } = parseBody(event);

    if (!report || !targetLanguage) {
      return json(400, { error: 'Error: Missing translation input.' });
    }

    const ai = createGeminiClient();
    const prompt = `Translate the following AI match report to the language specified.
TARGET LANGUAGE: ${targetLanguage}

REPORT (MARKDOWN FORMAT):
${report}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: 'You are a professional translator. Only return the translated text in markdown. Keep formatting the same.',
        temperature: 0.1,
      },
    });

    const translatedText = response.text?.trim();
    if (!translatedText) {
      return json(500, { error: 'Error: Translation failed.' });
    }

    return json(200, { translatedText });
  });
};
