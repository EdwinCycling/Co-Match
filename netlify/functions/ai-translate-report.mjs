import { createGeminiClient, enforceRateLimit, ensurePost, getDb, handleOptions, json, parseBody, requireUser, serverTimestamp, withErrorHandling } from './_shared.mjs';

export const handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  const postResponse = ensurePost(event);
  if (postResponse) return postResponse;

  return withErrorHandling(async () => {
    const user = await requireUser(event);
    await enforceRateLimit({
      scope: 'ai-translate-report',
      identifier: user.uid,
      maxRequests: 10,
      windowMs: 10 * 60 * 1000,
      errorMessage: 'Error: Too many AI translation requests. Please try again in a few minutes.',
    });
    const { report, targetLanguage, matchId } = parseBody(event);

    // #region debug-point C:translate-function-input
    fetch("http://127.0.0.1:7777/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "seeker-inspiration-empty",
        runId: "pre-fix",
        hypothesisId: "C",
        location: "ai-translate-report.mjs:handler",
        msg: "[DEBUG] Translation function input received",
        data: {
          hasReport: typeof report === "string" && report.trim().length > 0,
          reportLength: typeof report === "string" ? report.trim().length : 0,
          targetLanguage,
          hasMatchId: !!matchId,
          userId: user.uid,
        },
        ts: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

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

    if (matchId) {
      const db = getDb();
      const matchSnap = await db.collection('matches').doc(matchId).get();
      if (!matchSnap.exists) {
        return json(404, { error: 'Error: Match report not found.' });
      }

      const matchData = matchSnap.data() || {};
      if (matchData.seekerId !== user.uid && matchData.providerId !== user.uid) {
        return json(403, { error: 'Error: You are not allowed to translate this report.' });
      }

      await matchSnap.ref.set({
        translations: {
          ...(matchData.translations || {}),
          [targetLanguage]: translatedText,
        },
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    return json(200, { translatedText });
  });
};
