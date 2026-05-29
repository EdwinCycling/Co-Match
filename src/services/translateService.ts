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
    const response = await postToServerFunction<{ translatedText: string }>('ai-translate-report', {
      report: text,
      targetLanguage: targetLang
    });
    return response.translatedText ? response.translatedText.trim() : text;
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
}
