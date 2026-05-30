import { createGeminiClient, ensurePost, getDb, handleOptions, json, parseBody, requireUser, withErrorHandling } from './_shared.mjs';

export const handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  const postResponse = ensurePost(event);
  if (postResponse) return postResponse;

  return withErrorHandling(async () => {
    const user = await requireUser(event);
    const { seekerId, propertyId, language = 'nl' } = parseBody(event);

    if (!seekerId || seekerId !== user.uid) {
      return json(403, { error: 'Error: You can only generate reports for your own account.' });
    }

    if (!propertyId || typeof propertyId !== 'string' || propertyId.length > 128) {
      return json(400, { error: 'Error: Missing report property id.' });
    }

    const db = getDb();
    const [aiSettingsSnap, seekerSnap, propertySnap] = await Promise.all([
      db.collection('ai_settings').doc('matching').get(),
      db.collection('seeker_profiles').doc(seekerId).get(),
      db.collection('properties').doc(propertyId).get(),
    ]);

    if (!seekerSnap.exists || !propertySnap.exists) {
      return json(404, { error: 'Error: Missing report source data.' });
    }

    const aiSettings = aiSettingsSnap.exists ? aiSettingsSnap.data() || {} : {};
    const rawSeekerData = seekerSnap.data() || {};
    const propertyData = propertySnap.data() || {};
    const seekerData = {
      ...rawSeekerData,
      displayName: undefined,
      email: undefined,
      lastName: undefined,
      name: undefined,
      firstName: rawSeekerData.firstName || 'De zoeker',
    };

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

    const roleInstruction = aiSettings.role_instruction || 'Je bent een matchmaker en wooncoach.';
    const matchInstruction = aiSettings.match_instruction || 'Vergelijk de gegevens van de aanbieder en zoeker en schrijf een rapport.';
    const ai = createGeminiClient();
    const currentDate = new Date().toISOString().split('T')[0];
    const prompt = `
${matchInstruction || 'Vergelijk de gegevens van de aanbieder en zoeker en schrijf een rapport.'}

HUIDIGE DATUM: ${currentDate}
TAAL VAN HET RAPPORT: Genereer het volledige rapport uitsluitend in de volgende taal: ${language}

BELANGRIJKE STRICTE REGELS VOOR DE ANALYSE:
1. GEBRUIK UITSLUITEND DE VERSTREKTE DATA. Verzin absoluut geen details die niet in de JSON staan.
2. Als een veld in de profielen ontbreekt (null, undefined of leeg), negeer dit dan volledig in je rapportage. Noem het niet en doe geen aannames.
3. Als er te weinig informatie is voor een specifiek onderdeel, sla dat onderdeel dan over in je rapport.
4. Lieg nooit over eigenschappen van de woning of de persoon. Wees eerlijk over wat we NIET weten.
5. Als de woning een "vakantie_onderhuur" is (doel/goal) vergelijk dan de gevraagde periode van de zoeker met de beschikbare maanden (monthlyAvailability) waarbij 'free' beschikbaar betekent en 'occupied' onbeschikbaar.
6. ALTIJD ALS DE WONING EEN VAKANTIEWONING IS (goal === "vakantie_onderhuur"):
   Schrijf verplicht een APARTE, DUIDELIJKE PARAGRAAF genaamd "Vakantie & Recreatie Match" in het match-rapport.
   Vergelijk hierin de specifieke Vakantie voorkeuren van de zoeker (zoals: zwembad, buitenkeuken, verblijf op een vakantiepark, sauna, maximale remafstanden tot strand en vliegveld, plus diner/ontbijt/lunch maaltijdopties) met de daadwerkelijke vakantiefaciliteiten van de woningaanbieder. Benoem matches en eventuele afwijkingen heel concreet en praktisch.

BELANGRIJKE OPMAAK REGELS VOOR DE OUTPUT:
- Gebruik Markdown, maar laat tussen elk hoofdstuk of paragraaf altijd EEN DUIDELIJKE LEGE REGEL (double linebreak).
- Als je scores per onderdeel geeft (bijv. 8/10), start dan ELKE score op een NIEUWE EIGEN REGEL. Zet deze netjes onder elkaar (als een lijst met opsommingstekens of linebreaks).

DATA VOOR ANALYSE:
1. De Aanbieder & Woning:
Woning details (inclusief Huidige Bewoners/Composition):
${JSON.stringify(propertyData, null, 2)}
Aanbieder details:
${JSON.stringify(providerData || {}, null, 2)}

SPECIFIEKE OPDRACHT VOOR SAMENSTELLING (Composition):
Let goed op de 'composition_residents' (de huidige bewoners). Als er bewoners zijn (bijv. een eigenaar, mannen, vrouwen, kinderen), vergelijk dit dan met de 'composition_looking_for' (wat de aanbieder zoekt) en de gegevens van de zoeker. Beantwoord of de zoeker goed zou passen in de huidige groep bewoners. Als de aanbieder zelf in de woning woont (type: 'owner'), noem dit dan expliciet als een belangrijk sociaal aspect.

2. De Zoeker:
${JSON.stringify(seekerData, null, 2)}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: roleInstruction || 'Je bent een matchmaker en wooncoach.',
        temperature: 0.8,
      },
    });

    return json(200, {
      report: response.text || 'Er kon geen rapport worden gegenereerd.',
    });
  });
};
