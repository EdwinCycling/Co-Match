import { createGeminiClient, enforceRateLimit, ensurePost, getDb, handleOptions, json, parseBody, requireUser, serverTimestamp, withErrorHandling } from './_shared.mjs';

export const handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  const postResponse = ensurePost(event);
  if (postResponse) return postResponse;

  return withErrorHandling(async () => {
    const user = await requireUser(event);
    await enforceRateLimit({
      scope: 'ai-makelaar-report',
      identifier: user.uid,
      maxRequests: 5,
      windowMs: 10 * 60 * 1000,
      errorMessage: 'Error: Too many AI makelaar report requests. Please try again in a few minutes.',
    });
    const { propertyId, language = 'nl' } = parseBody(event);

    if (!propertyId || typeof propertyId !== 'string' || propertyId.length > 128) {
      return json(400, { error: 'Error: Missing property id.' });
    }

    const db = getDb();
    const existingReportSnap = await db.collection('makelaar_reports').doc(propertyId).get();
    if (existingReportSnap.exists) {
      return json(200, {
        reportDocument: {
          id: existingReportSnap.id,
          ...existingReportSnap.data(),
        },
      });
    }

    const [aiSettingsSnap, propertySnap] = await Promise.all([
      db.collection('ai_settings').doc('matching').get(),
      db.collection('properties').doc(propertyId).get(),
    ]);

    if (!propertySnap.exists) {
      return json(404, { error: 'Error: Missing property data.' });
    }

    const aiSettings = aiSettingsSnap.exists ? aiSettingsSnap.data() || {} : {};
    const propertyData = propertySnap.data() || {};
    let providerData = {};
    if (propertyData.ownerId) {
      const providerSnap = await db.collection('users').doc(propertyData.ownerId).get();
      if (providerSnap.exists) {
        const fullData = providerSnap.data() || {};
        providerData = {
          ...fullData,
          displayName: undefined,
          email: undefined,
          lastName: undefined,
          name: undefined,
          firstName: fullData.firstName || 'De aanbieder',
        };
      }
    }

    const roleInstruction = aiSettings.makelaar_role_instruction || 'Je bent de Co-Match Makelaar.';
    const reportInstruction = aiSettings.makelaar_report_instruction || 'Schrijf een makelaarsrapport op basis van de beschikbare woningdata.';
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

    const reportText = response.text || 'Er kon geen makelaarsrapport worden gegenereerd.';
    const reportData = {
      propertyId,
      providerId: propertyData.ownerId || '',
      report: reportText,
      language,
      createdAt: serverTimestamp(),
    };

    await db.collection('makelaar_reports').doc(propertyId).set(reportData, { merge: true });

    return json(200, {
      reportDocument: {
        id: propertyId,
        propertyId,
        providerId: propertyData.ownerId || '',
        report: reportText,
        language,
      },
    });
  });
};
