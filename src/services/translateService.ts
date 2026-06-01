import { auth } from "../lib/firebase";
import { postToServerFunction } from "../lib/serverApi";

export function isTranslationAvailable(): boolean {
  return !!auth.currentUser;
}

/**
 * Translates text using Gemini AI as a default robust translator.
 * If a DeepL key is provided in the future, we can easily swap or add it here.
 */
export async function translateText(text: string, targetLang: string): Promise<string> {
  if (!auth.currentUser) {
    console.warn("No authenticated user available for translation. Falling back to original text.");
    return text;
  }

  try {
    const trimmedText = text.trim();
    if (!trimmedText) {
      return text;
    }

    // #region debug-point C:translate-request-payload
    fetch("http://127.0.0.1:7777/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "seeker-inspiration-empty",
        runId: "pre-fix",
        hypothesisId: "C",
        location: "translateService.ts:translateText",
        msg: "[DEBUG] Translate request payload prepared",
        data: {
          hasAuthenticatedUser: !!auth.currentUser,
          originalLength: text.length,
          trimmedLength: trimmedText.length,
          targetLang,
          hasMatchId: false,
          payloadKeys: ["report", "targetLanguage"],
        },
        ts: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    const response = await postToServerFunction<{ translatedText: string }>('ai-translate-report', {
      report: trimmedText,
      targetLanguage: targetLang
    });
    return response.translatedText ? response.translatedText.trim() : text;
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
}
