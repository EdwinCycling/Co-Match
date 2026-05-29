import { createGeminiClient, ensurePost, handleOptions, json, parseBody, requireUser, withErrorHandling } from './_shared.mjs';

export const handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  const postResponse = ensurePost(event);
  if (postResponse) return postResponse;

  return withErrorHandling(async () => {
    await requireUser(event);
    const { language = 'nl', reportInstruction, roleInstruction, propertyData, providerData } = parseBody(event);

    if (!propertyData) {
      return json(400, { error: 'Error: Missing property data.' });
    }

    const ai = createGeminiClient();
    const prompt = `${reportInstruction}

TAAL VAN HET RAPPORT: Genereer het volledige rapport uitsluitend in de volgende taal: ${language}

DATA VOOR ANALYSE:
Woning details:
${JSON.stringify(propertyData, null, 2)}
Aanbieder details:
${JSON.stringify(providerData || {}, null, 2)}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: roleInstruction,
        temperature: 0.8,
      },
    });

    return json(200, {
      report: response.text || 'Er kon geen makelaarsrapport worden gegenereerd.',
    });
  });
};
