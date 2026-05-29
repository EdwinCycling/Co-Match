import { createGeminiClient, ensurePost, handleOptions, json, parseBody, requireUser, withErrorHandling } from './_shared.mjs';

export const handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  const postResponse = ensurePost(event);
  if (postResponse) return postResponse;

  return withErrorHandling(async () => {
    await requireUser(event);
    const { linkedinUrl, providerName } = parseBody(event);

    if (!linkedinUrl || !providerName) {
      return json(400, { error: 'Error: Missing LinkedIn verification input.' });
    }

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

    const ai = createGeminiClient();
    const result = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    return json(200, JSON.parse(result.text || '{}'));
  });
};
