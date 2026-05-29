import { postToServerFunction } from "../lib/serverApi";

export interface AudioAnalysisResult {
  isAcceptable: boolean;
  transcript: string;
  reason?: string;
}

export async function processAudioMessage(
  base64Audio: string, 
  mimeType: string
): Promise<AudioAnalysisResult> {
  try {
    return await postToServerFunction<AudioAnalysisResult>('ai-process-audio', {
      base64Audio,
      mimeType
    });
  } catch (error) {
    console.error("Audio processing error:", error);
    throw new Error("Er ging iets mis bij het analyseren van de audio.");
  }
}
