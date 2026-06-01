import { createGeminiClient, enforceRateLimit, ensurePost, handleOptions, json, parseBody, requireAdmin, withErrorHandling } from './_shared.mjs';

// #region debug-point D:reporter
const reportNewsletterDebug = (hypothesisId, location, msg, data = {}) => fetch('http://127.0.0.1:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'admin-save-errors', runId: 'post-fix', hypothesisId, location, msg: `[DEBUG] ${msg}`, data, ts: Date.now() }) }).catch(() => {});
// #endregion

function getNestedErrorStatus(error) {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const directStatus = error.status ?? error.code;
  if (typeof directStatus === 'number') {
    return directStatus;
  }

  if (typeof directStatus === 'string') {
    const parsed = Number(directStatus);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  const nestedStatus = error.error?.status ?? error.error?.code;
  if (typeof nestedStatus === 'number') {
    return nestedStatus;
  }

  if (typeof nestedStatus === 'string') {
    const parsed = Number(nestedStatus);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

function getNestedErrorText(error) {
  if (!error || typeof error !== 'object') {
    return String(error || '');
  }

  const parts = [
    error.message,
    error.status,
    error.code,
    error.error?.message,
    error.error?.status,
    error.error?.code,
  ];

  return parts
    .filter((part) => part !== undefined && part !== null)
    .map((part) => String(part))
    .join(' | ');
}

export const handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  const postResponse = ensurePost(event);
  if (postResponse) return postResponse;

  return withErrorHandling(async () => {
    const admin = await requireAdmin(event);
    // #region debug-point D:admin-entry
    await reportNewsletterDebug('D', 'ai-newsletter-html.mjs:handler', 'Entered ai-newsletter-html handler', { uid: admin.uid, email: admin.email || null, admin: admin.admin === true, role: admin.role || null, roles: Array.isArray(admin.roles) ? admin.roles : null });
    // #endregion
    await enforceRateLimit({
      scope: 'ai-newsletter-html',
      identifier: admin.uid,
      maxRequests: 3,
      windowMs: 10 * 60 * 1000,
      errorMessage: 'Error: Too many AI newsletter requests. Please try again in a few minutes.',
    });
    const { data, siteUrl } = parseBody(event);
    // #region debug-point E:payload-shape
    await reportNewsletterDebug('E', 'ai-newsletter-html.mjs:handler', 'Parsed newsletter payload', { hasData: !!data, hasSiteUrl: !!siteUrl, updates: Array.isArray(data?.recentUpdates) ? data.recentUpdates.length : null, highlighted: Array.isArray(data?.highlightedPropertiesList) ? data.highlightedPropertiesList.length : null, properties: Array.isArray(data?.propertiesList) ? data.propertiesList.length : null });
    // #endregion

    if (!data || !siteUrl) {
      return json(400, { error: 'Error: Missing newsletter input.' });
    }

    const ai = createGeminiClient();
    const systemInstruction = `You are a creative copywriter for Co-Match cohousing and intentional living platform.
Generate an engaging, beautiful HTML newsletter block in English (UK) based on the provided data of recent product features/updates, highlighted properties, and the 10 newest properties.
The digest is being sent for the upcoming week: ${data.upcomingWeekRange} (starting Monday). Please display this date range clearly and elegantly in the header/subheader of the newsletter as "Week of ${data.upcomingWeekRange}".

STRUCTURE TO IMPLEMENT EXACTLY:
Translate the input features and new listings into a single highly responsive HTML document with this exact structure:

<div style="max-width: 600px; margin: auto; font-family: sans-serif; border: 1px solid #ddd; padding: 25px; background-color: #FAF9F6; border-radius: 24px;">
  <header style="text-align: center; padding-bottom: 20px;">
    <img src="https://images.unsplash.com/photo-1513694203232-719a280e022f?w=120&fm=webp" alt="Co-Match Logo Placeholder" style="width: 80px; height: auto; border-radius: 50%;">
    <h1 style="color: #8DAA91; font-family: sans-serif; font-size: 28px; font-weight: 800; margin-top: 10px; text-transform: uppercase;">Weekly Digest</h1>
    <p style="font-size: 14px; color: #555; font-style: italic; margin-top: 4px;">Your weekly digest of co-match magic and product updates</p>
    <p style="font-size: 12px; color: #8da693; font-weight: bold; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.08em; background-color: #8DAA91/10; display: inline-block; padding: 3px 12px; border-radius: 12px;">Week: ${data.upcomingWeekRange}</p>
  </header>

  <div style="text-align: center; margin-bottom: 30px;">
    <a href="${siteUrl}" style="display: inline-block; background-color: #8DAA91; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 16px; font-weight: 900; font-size: 14px; text-transform: uppercase; tracking: 0.05em; box-shadow: 0 4px 12px rgba(141, 170, 145, 0.3);">Open Co-Match and start exploring</a>
  </div>

  <section style="margin-bottom: 30px;">
    <h2 style="border-bottom: 2px solid #8DAA91; color: #333; padding-bottom: 8px; font-size: 18px; text-transform: uppercase; tracking: 0.05em; margin-bottom: 15px;">New Features</h2>
  </section>

  <section>
    <h2 style="border-bottom: 2px solid #8DAA91; color: #333; padding-bottom: 8px; font-size: 18px; text-transform: uppercase; tracking: 0.05em; margin-bottom: 15px;">New on Co-Match</h2>
  </section>
</div>

CRITICAL REQUIREMENTS:
- Keep the language strictly English (UK) with a warm, inspirational, and welcoming tone.
- Do NOT include markdown code blocks. Return ONLY raw valid HTML text.
- If highlightedPropertiesList contains properties, design and fill the Weekly Spotlights section nicely. If highlightedPropertiesList is empty, DO NOT INCLUDE or render the section.
- Format the 10 newest properties into a 2-column layout.
- Display the country clearly inside each property detail.
- Do not use missing variables. Use the exact data supplied below.`;

    const prompt = `Here is the data for the newsletter. Please generate the HTML block:

UPCOMING WEEK DATE RANGE:
${data.upcomingWeekRange}

RECENT UPDATES AND FEATURES:
${JSON.stringify(data.recentUpdates, null, 2)}

WEEKLY SPOTLIGHTED / HIGHLIGHTED PROPERTIES (Render in Weekly Spotlights block if present):
${JSON.stringify(data.highlightedPropertiesList, null, 2)}

10 NEW PROPERTIES (Render in 2-column grid under Section 2):
${JSON.stringify(data.propertiesList, null, 2)}

Generate the raw HTML content now. Remember: no markdown markup around the return value.`;

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });
    } catch (error) {
      // #region debug-point E:gemini-failure
      await reportNewsletterDebug('E', 'ai-newsletter-html.mjs:generateContent', 'Gemini generateContent failed', { error: error instanceof Error ? error.message : String(error) });
      // #endregion
      const status = getNestedErrorStatus(error);
      const message = getNestedErrorText(error);
      if (
        status === 503 ||
        message.includes('UNAVAILABLE') ||
        message.includes('"status":"UNAVAILABLE"') ||
        message.includes('"code":503') ||
        message.includes('503')
      ) {
        return json(503, {
          error: 'Error: Newsletter AI is tijdelijk niet beschikbaar door hoge vraag. Probeer het over een paar minuten opnieuw.',
        });
      }
      throw error;
    }

    let html = response.text?.trim() || '';
    if (html.startsWith('```html')) {
      html = html.slice(7);
    }
    if (html.endsWith('```')) {
      html = html.slice(0, -3);
    }

    return json(200, { html: html.trim() });
  });
};
