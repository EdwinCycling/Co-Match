import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { checkRateLimit } from "../lib/rateLimit";
import { postToServerFunction } from "../lib/serverApi";

export async function getExistingMatch(seekerId: string, propertyId: string) {
  try {
    const matchId = `${seekerId}_${propertyId}`;
    const docRef = doc(db, 'matches', matchId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'matches');
    return null;
  }
}

export async function generateMatchReport(seekerId: string, propertyId: string, language: string = 'nl') {
  try {
    const matchId = `${seekerId}_${propertyId}`;
    
    // First check if it already exists to prevent duplicate generation
    const existing = await getExistingMatch(seekerId, propertyId);
    if (existing) {
      return existing;
    }
    if (!checkRateLimit('generate_report', 5, 24 * 60 * 60 * 1000)) {
      throw new Error("Je hebt het maximum aantal AI-rapporten voor vandaag bereikt (max 5 per dag). Probeer het morgen weer.");
    }
    
    // 1. Fetch AI Instructions
    const aiSettingsRef = doc(db, 'ai_settings', 'matching');
    const aiSettingsSnap = await getDoc(aiSettingsRef);
    
    // Default instructions if not set
    let roleInstruction = "Je bent een matchmaker en wooncoach.";
    let matchInstruction = "Vergelijk de gegevens van de aanbieder en zoeker en schrijf een rapport.";
    
    if (aiSettingsSnap.exists()) {
      const data = aiSettingsSnap.data();
      roleInstruction = data.role_instruction || roleInstruction;
      matchInstruction = data.match_instruction || matchInstruction;
    }

    // 2. Fetch Data
    const seekerRef = doc(db, 'seeker_profiles', seekerId);
    const propertyRef = doc(db, 'properties', propertyId);
    
    const [seekerSnap, propertySnap] = await Promise.all([
      getDoc(seekerRef),
      getDoc(propertyRef)
    ]);

    if (!seekerSnap.exists() || !propertySnap.exists()) {
      throw new Error("Profiel of woning gegevens ontbreken.");
    }

    const rawSeekerData = seekerSnap.data();
    const seekerData = {
      ...rawSeekerData,
      displayName: undefined,
      email: undefined,
      lastName: undefined,
      name: undefined,
      firstName: rawSeekerData.firstName || 'De zoeker'
    };
    const propertyData = propertySnap.data();
    
    let providerData: any = {};
    if (propertyData.ownerId) {
      const providerRef = doc(db, 'users', propertyData.ownerId);
      const providerSnap = await getDoc(providerRef);
      if (providerSnap.exists()) {
        const fullData = providerSnap.data();
        providerData = {
          ...fullData,
          displayName: undefined,
          email: undefined,
          lastName: undefined,
          name: undefined,
          firstName: fullData.firstName || 'De aanbieder'
        };
      }
    }

    const { report } = await postToServerFunction<{ report: string }>('ai-match-report', {
      seekerId,
      propertyId,
      language,
      roleInstruction,
      matchInstruction,
      propertyData,
      providerData,
      seekerData
    });

    const reportText = report || "Er kon geen rapport worden gegenereerd.";

    // 5. Save Match result
    const matchData = {
      seekerId,
      propertyId,
      providerId: propertyData.ownerId,
      report: reportText,
      language: language,
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'matches', matchId), matchData);
    
    return {
      id: matchId,
      ...matchData
    };

  } catch (error) {
    console.error("Match generation error:", error);
    throw error;
  }
}

export async function translateMatchReport(existingMatch: any, targetLanguage: string) {
  try {
    if (!existingMatch.report) return null;
    if (existingMatch.language === targetLanguage || (existingMatch.translations && existingMatch.translations[targetLanguage])) {
      return existingMatch.translations ? existingMatch.translations[targetLanguage] : existingMatch.report;
    }

    const { translatedText } = await postToServerFunction<{ translatedText: string }>('ai-translate-report', {
      report: existingMatch.report,
      targetLanguage
    });
    if (!translatedText) throw new Error("Translation failed");

    // Save translation
    const matchRef = doc(db, 'matches', existingMatch.id);
    await setDoc(matchRef, {
      translations: {
        [targetLanguage]: translatedText
      }
    }, { merge: true });

    return translatedText;
  } catch (err) {
    console.error("Error translating report:", err);
    throw err;
  }
}

export async function getExistingMakelaarReport(propertyId: string) {
  try {
    const docRef = doc(db, 'makelaar_reports', propertyId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'makelaar_reports');
    return null;
  }
}

export async function generateMakelaarReport(propertyId: string, language: string = 'nl') {
  try {
    // Check if it already exists
    const existing = await getExistingMakelaarReport(propertyId);
    if (existing) {
      return existing;
    }

    if (!checkRateLimit('generate_report', 5, 24 * 60 * 60 * 1000)) {
      throw new Error("Je hebt het maximum aantal AI-rapporten voor vandaag bereikt (max 5 per dag). Probeer het morgen weer.");
    }
    
    const propertyRef = doc(db, 'properties', propertyId);
    const propertySnap = await getDoc(propertyRef);

    if (!propertySnap.exists()) {
      throw new Error("Woning gegevens ontbreken.");
    }

    const propertyData = propertySnap.data();
    
    let providerData: any = {};
    if (propertyData.ownerId) {
      const providerRef = doc(db, 'users', propertyData.ownerId);
      const providerSnap = await getDoc(providerRef);
      if (providerSnap.exists()) {
        const fullData = providerSnap.data();
        providerData = {
          ...fullData,
          displayName: undefined,
          email: undefined,
          lastName: undefined,
          name: undefined,
          firstName: fullData.firstName || 'De aanbieder'
        };
      }
    }

    // Load dynamic AI Settings for Makelaar
    const aiSettingsRef = doc(db, 'ai_settings', 'matching');
    const aiSettingsSnap = await getDoc(aiSettingsRef);

    let roleInstruction = `Jouw Rol: Je bent de 'Co-Match Makelaar'. Je bent een expert in vastgoed, maar met het empathisch vermogen van een goede vriend. Je taak is om objectieve woningdata (meters, faciliteiten, buurt, etc.) om te zetten in een warm, overtuigend verhaal.
Karakteristieken:
- Inzichtelijk: Je weet alles van de woning, en de persoonlijke tekst van de aanbieder.
- Toegankelijk: Vermijd teveel makelaarsjargon (zoals 'instapklaar' of 'totale woonoppervlakte'), maar het mag wel want je bent een makelaar. Gebruik waar je kunt menselijke taal: "Het is een heerlijk licht appartement waar je zo je spullen in kunt zetten."
- Eerlijk & Helder: Als een woning een klein nadeel heeft (bijv. geen lift), benoem je dat niet als een probleem, maar als een feit: "Je moet wel even een paar trappen op, maar daardoor heb je wel een prachtig uitzicht over de stad."
`;

    let reportInstruction = `BEGIN DIRECT MET DE INHOUD. Gebruik NOOIT introductiezinnen zoals "Dit is het gevraagde rapport" of "Hier is het rapport".
Ontleed de data en schrijf een rapport (makelaars stijl) over de woning gebaseerd op de volgende data.
Zorg voor veel korte alinea's en begin elke nieuwe alinea altijd met een duidelijke witregel (door 2 enters of newlines te gebruiken). 

Structuur van het Woning-Rapport (De 'Showcase') die MOET AANGEHOUDEN WORDEN:
- De 'Eerste Blik' (De Hook): Eén pakkende openingszin die de woning typeert. Gebruik de naam van de stad en het specifieke karakter (bijv. "Een oase van rust midden in het bruisende Utrecht").
- Jouw intro verhaal over de woning: Vertel de zoeker direct waarom dit huis zo gaaf is. 
- De 'Sfeer-Tour' (Kenmerken): Beschrijf de woning in 3 korte alinea's: bijvoorbeeld De Ruimte (Keuken, woonkamer, indeling), De Omgeving (Buurt, voorzieningen, OV), en De Extra's (Internet, tuin, wasfaciliteiten).
- De 'Eerlijke Check': Een korte paragraaf met de eventuele aandachtspunten (geen lift, compacte badkamer) om verwachtingen te managen.
- Uitgebreid verhaal over alle specificaties.
- Beschrijving van wat de verhuurder zoekt, vat dit samen in 1 paragraaf.
- Een positieve afsluiting die focust op de levensstijl in deze woning.

**PERPLEXITY & PREDICTABILITY CONTROL:**
- Deliberately choose unexpected, creative word alternatives instead of obvious ones
- Use varied vocabulary - avoid repetitive word patterns that AI typically generates  
- Include some colloquialisms, idioms, and region-specific expressions
- Add subtle imperfections that humans naturally make (minor redundancies, natural speech patterns)

**BURSTINESS & SENTENCE VARIATION:**
- Create dramatic sentence length variation: mix very short sentences (3-5 words) with longer, complex ones (25+ words)
- Alternate between simple, compound, complex, and compound-complex sentence structures
- Start sentences with different elements: adverbs, prepositional phrases, dependent clauses, questions
- Include intentional sentence fragments and run-on sentences where natural
- Use parenthetical asides and em-dashes for authentic human flow

**EMOTIONAL INTELLIGENCE & HUMAN TOUCH:**
- Infuse genuine emotional undertones appropriate to the content
- Add personal opinions, hesitations, or qualifiers ("I believe," "perhaps," "it seems")
- Include conversational elements and rhetorical questions
- Use contractions naturally and vary formal/informal tone within the text
- Add subtle humor, sarcasm, or personality where appropriate

**STRUCTURAL PATTERN DISRUPTION:**
- Avoid AI's typical introduction → body → conclusion structure
- Start with unexpected angles or mid-thought observations
- Include tangential thoughts and natural digressions
- Use irregular paragraph lengths (some very short, others longer)
- Break conventional grammar rules occasionally in natural ways

**CONTEXTUAL AUTHENTICITY:**
- Reference current events, popular culture, or common experiences
- Include specific, concrete details rather than generic statements
- Use metaphors and analogies that feel personally chosen
- Add transitional phrases that feel conversational rather than mechanical

**DETECTION-SPECIFIC COUNTERS:**
- use irregular sentence structures and avoiding formulaic transitions
- Counter syntax analysis by including natural human imperfections and conversational quirks
- Counter emotional tone analysis by adding authentic personal voice and varied emotional expression

**FINAL REQUIREMENTS:**
- Maintain the original meaning and key information
- Ensure the rewrite sounds like it came from a real person with authentic voice
- Make it feel like natural human communication, not polished AI output
- Include at least 2-3 instances of slightly imperfect but natural phrasing
- Aim for high perplexity (unpredictable word choices) and high burstiness (varied sentence structures)

BELANGRIJKE OPMAAK REGELS VOOR DE OUTPUT:
- Gebruik Markdown. Laat altijd EEN DUIDELIJKE LEGE REGEL tussen paragrafen.`;

    if (aiSettingsSnap.exists()) {
      const data = aiSettingsSnap.data();
      roleInstruction = data.makelaar_role_instruction || roleInstruction;
      reportInstruction = data.makelaar_report_instruction || reportInstruction;
    }

    const { report } = await postToServerFunction<{ report: string }>('ai-makelaar-report', {
      propertyId,
      language,
      roleInstruction,
      reportInstruction,
      propertyData,
      providerData
    });

    const reportText = report || "Er kon geen makelaarsrapport worden gegenereerd.";

    const reportData = {
      propertyId,
      providerId: propertyData.ownerId,
      report: reportText,
      language: language,
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'makelaar_reports', propertyId), reportData);
    
    return {
      id: propertyId,
      ...reportData
    };

  } catch (error) {
    console.error("Makelaar report generation error:", error);
    throw error;
  }
}
