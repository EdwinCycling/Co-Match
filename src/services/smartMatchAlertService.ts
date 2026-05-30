import { db } from "../lib/firebase";
import { collection, doc, getDoc, getDocs, setDoc, query, where, updateDoc, arrayUnion } from "firebase/firestore";
import { calculateCHAScore } from "../components/CoHarmonyAnalysis";
import { escapeHtml, sanitizeUrl } from "../lib/sanitize";

// Helper to extract clean first name (roepnaam/voornaam) for anonymity and prevent showing emails or full name signatures
export function getCleanFirstName(fullName: string | null | undefined, fallback: string): string {
  if (!fullName) return fallback;
  const trimmed = fullName.trim();
  // If the display name is an email address, strip the part before the @ and clean it
  if (trimmed.includes('@')) {
    const part = trimmed.split('@')[0];
    if (part) {
      // Remove numbers, replace underscores/dots/hyphens with space
      const cleanPart = part.replace(/[0-9]/g, '').replace(/[._-]/g, ' ').trim();
      const firstWord = cleanPart.split(/\s+/)[0];
      if (firstWord && firstWord.length > 1) {
        return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
      }
    }
    return fallback;
  }
  
  // Extract the first word of the name
  const firstWord = trimmed.split(/\s+/)[0];
  if (!firstWord) return fallback;
  
  // If first word itself looks like an email or is junk, return fallback
  if (firstWord.includes('@')) return fallback;
  
  // Capitalize first letter properly
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
}

// Helper to calculate distance between coordinates
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 1. Uniformly distribute the hour check dynamically based on existing active alerts
export async function assignDistributedMatchAlertHour(userId: string): Promise<number> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('smartMatchAlertEnabled', '==', true));
    const snap = await getDocs(q);
    
    // Frequency map of hours 0 to 23
    const hourCounts: Record<number, number> = {};
    for (let h = 0; h < 24; h++) {
      hourCounts[h] = 0;
    }
    
    snap.forEach((d) => {
      const userData = d.data();
      if (userData.smartMatchAlertHour !== undefined && userData.smartMatchAlertHour !== null) {
        const h = Number(userData.smartMatchAlertHour);
        if (h >= 0 && h < 24) {
          hourCounts[h] = hourCounts[h] + 1;
        }
      }
    });
    
    // Find the hour(s) with the minimum count
    let minCount = Infinity;
    let bestHours: number[] = [];
    
    for (let h = 0; h < 24; h++) {
      if (hourCounts[h] < minCount) {
        minCount = hourCounts[h];
        bestHours = [h];
      } else if (hourCounts[h] === minCount) {
        bestHours.push(h);
      }
    }
    
    // Pick randomly among the tied best hours to distribute
    const chosenHour = bestHours[Math.floor(Math.random() * bestHours.length)];
    return chosenHour;
  } catch (err) {
    console.error("Error distributing alert hour:", err);
    // Fallback to purely random hour if db fails
    return Math.floor(Math.random() * 24);
  }
}

// 2. Exact Match Score Calculation for Background Matching (supporting hard filters and CHA fallback)
export function calculateMatchScoreForAlert(seekerProfile: any, p: any): number {
  if (!seekerProfile || !p) return 0;

  // Use Co-Harmony Analysis score if the user has completed it
  if (seekerProfile.has_completed_cha && seekerProfile.harmony_answers) {
    return calculateCHAScore(seekerProfile.harmony_answers, p);
  }

  let score = 0;
  let totalWeight = 0;

  // Goal match (High weight)
  if (p.features?.goal && seekerProfile.goal?.includes(p.features.goal)) {
    score += 40;
  }
  totalWeight += 40;

  // Location/City/Radius Match
  if (
    p.displayLat &&
    p.displayLng &&
    seekerProfile.lat &&
    seekerProfile.lng
  ) {
    const distance = calculateDistance(
      seekerProfile.lat,
      seekerProfile.lng,
      p.displayLat,
      p.displayLng
    );
    const radius = seekerProfile.radius || 10;
    if (distance <= radius) {
      score += 25;
    } else if (distance <= radius * 1.5) {
      score += 15;
    } else if (distance <= radius * 2) {
      score += 5;
    }
  } else if (p.city && seekerProfile.city) {
    if (
      p.city.trim().toLowerCase() === seekerProfile.city.trim().toLowerCase()
    ) {
      score += 25;
    } else if (
      p.country &&
      seekerProfile.country &&
      p.country.trim().toLowerCase() === seekerProfile.country.trim().toLowerCase()
    ) {
      score += 10;
    }
  }
  totalWeight += 25;

  // Price match
  const seekerBudget = seekerProfile.budget_max || seekerProfile.budget;
  const pPrice = p.price || p.minPrice || 0;
  if (pPrice && seekerBudget) {
    if (pPrice <= seekerBudget) score += 20;
    else if (pPrice <= seekerBudget * 1.2) score += 10;
  }
  totalWeight += 20;

  // Property type match
  if (
    p.features?.type &&
    seekerProfile.property_type?.includes(p.features.type)
  ) {
    score += 15;
  }
  totalWeight += 15;

  // Normalize to 100
  const finalScore = totalWeight > 0 ? Math.min(100, Math.round((score / totalWeight) * 100)) : 0;

  // Add slight consistent variation based on property id to avoid sterile numbers
  const propId = p.id || "";
  const addedVariety = propId ? (propId.charCodeAt(0) % 5) : 0;

  return finalScore > 0 ? Math.min(100, finalScore + addedVariety) : 0;
}

// Translations dictionary matching textfiles for easy multilingual compilation without expensive AI calls
const TRANSLATIONS: Record<string, Record<string, string>> = {
  nl: {
    subject: "Nieuwe match in {{city}}: Past dit bij jou?",
    title: "Jouw Persoonlijke Matchmaker Update 🏡",
    intro: "Hoi {{firstName}}, we hebben weer gekeken voor je. We hebben een aantal nieuwe woningen gevonden die perfect aansluiten bij jouw profiel! Hier zijn de nieuwste matches van de afgelopen 24 uur:",
    view_match_cta: "Bekijk deze match in de app",
    view_all_cta: "Open Co-Match en start met ontdekken",
    footer_text: "Je ontvangt deze e-mail omdat je Smart Match Alerts hebt ingeschakeld in je profielinstellingen.",
    unsubscribe: "Afmelden voor Smart Match Alerts",
    match_badge: "Match! ✨",
    monthly: "/mnd"
  },
  en: {
    subject: "New match in {{city}}: Does this fit you?",
    title: "Your Personal Matchmaker Update 🏡",
    intro: "Hi {{firstName}}, we looked for you again. We found some new properties that fit your profile perfectly! Here are your newest matches from the last 24 hours:",
    view_match_cta: "View this match in the app",
    view_all_cta: "Open Co-Match and start exploring",
    footer_text: "You received this email because you enabled Smart Match Alerts in your profile settings.",
    unsubscribe: "Unsubscribe from Smart Match Alerts",
    match_badge: "Match! ✨",
    monthly: "/mo"
  }
};

// 3. Generates the beautiful, modern, responsive HTML email in user's language
export function generateSmartMatchAlertEmailHTML(
  user: any,
  seekerProfile: any,
  matches: Array<{ property: any; score: number }>,
  siteUrl: string,
  userLang: string = 'nl'
): { subject: string; html: string } {
  const langKey = userLang.startsWith('en') ? 'en' : 'nl';
  const text = TRANSLATIONS[langKey];
  
  const rawFirstName = seekerProfile && seekerProfile.firstName ? seekerProfile.firstName.trim() : "";
  let firstName = "";
  if (rawFirstName) {
    const firstWord = rawFirstName.split(/\s+/)[0];
    firstName = firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
  } else {
    firstName = getCleanFirstName(user?.firstName || user?.displayName || (seekerProfile ? seekerProfile.nickname : ''), "Co-Match Member");
  }
  const seekerCity = seekerProfile ? (seekerProfile.city || "jouw regio") : "jouw regio";
  
  const subject = text.subject.replace('{{city}}', seekerCity);
  const introText = text.intro.replace('{{firstName}}', firstName);

  // Compile match listing cards
  let matchCardsHtml = '';
  matches.forEach(({ property }) => {
    let imageUrl = "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80";
    if (property.images && property.images.length > 0) {
      const teaserImage = property.images.find((img: any) => img.id === property.teaserImageId) || property.images[0];
      if (teaserImage && teaserImage.url) {
        imageUrl = teaserImage.url;
      }
    }
    if (imageUrl.includes("unsplash.com") && !imageUrl.includes("&fm=webp")) {
      imageUrl += "&fm=webp&w=400&q=70";
    }

    const priceText = property.priceType === "tbd" 
      ? "N.o.t.b." 
      : property.priceType === "range"
        ? `€ ${property.minPrice || 0} - € ${property.maxPrice || 0}${text.monthly}`
        : `€ ${property.price || 0}${text.monthly}`;

    const propUrl = sanitizeUrl(`${siteUrl}?propertyId=${property.id}`);
    const safeImageUrl = sanitizeUrl(imageUrl);
    const safeTitle = escapeHtml(property.title || 'Woning');
    const safeLocation = escapeHtml(property.location || property.city || 'Onbekende locatie');
    const safePriceText = escapeHtml(priceText);

    matchCardsHtml += `
      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); overflow: hidden;">
        <div style="position: relative; border-radius: 12px; overflow: hidden; margin-bottom: 14px;">
          <img src="${safeImageUrl}" alt="${safeTitle}" style="width: 100%; height: 180px; object-cover: true; object-fit: cover; border-radius: 12px; display: block;" />
          <div style="position: absolute; top: 12px; right: 12px; background-color: #10b981; color: #ffffff; padding: 4px 10px; font-size: 11px; font-weight: 800; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 2px 4px rgba(16,185,129,0.3);">
            ${text.match_badge}
          </div>
        </div>
        <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 700; color: #1e293b;">${safeTitle}</h3>
        <p style="margin: 0 0 12px 0; font-size: 13px; color: #64748b; font-weight: 500;">📍 ${safeLocation}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 14px; margin-top: 6px;">
          <span style="font-size: 16px; font-weight: 800; color: #10b981;">${safePriceText}</span>
          <a href="${propUrl}" style="background-color: #8DAA91; color: #ffffff; padding: 8px 16px; text-decoration: none; border-radius: 10px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; display: inline-block;">
            ${text.view_match_cta}
          </a>
        </div>
      </div>
    `;
  });

  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 30px auto; padding: 25px; border-radius: 24px; border: 1px solid #e2e8f0; background-color: #FAF9F6; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
    
    <!-- Header -->
    <div style="text-align: center; padding-bottom: 25px; border-bottom: 1px solid #e2e8f0;">
      <div style="width: 56px; height: 56px; background-color: #8DAA91; border-radius: 18px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px; color: white; font-size: 28px; line-height: 56px; text-align: center;">🏡</div>
      <h1 style="color: #6a826e; font-size: 22px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">${text.title}</h1>
      <p style="font-size: 12px; color: #10b981; font-weight: 800; text-transform: uppercase; margin-top: 6px; letter-spacing: 0.05em;">Co-Match Intelligent Agent</p>
    </div>

    <!-- Intro Message -->
    <div style="margin: 25px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      <p style="margin: 0;">${introText}</p>
    </div>

    <!-- Match Cards -->
    <div style="margin-bottom: 25px;">
      ${matchCardsHtml}
    </div>

    <!-- CTA Center Button -->
    <div style="text-align: center; margin: 30px 0 20px 0;">
      <a href="${siteUrl}" style="display: inline-block; background-color: #8DAA91; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 14px; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 4px 6px -1px rgba(141, 170, 145, 0.3);">
        ${text.view_all_cta}
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 11px; color: #64748b; line-height: 1.5;">
      <p style="margin: 0 0 10px 0;">${text.footer_text}</p>
      <p style="margin: 0;">
        <a href="${siteUrl}?unsubscribeAlerts=true" style="color: #64748b; text-decoration: underline; font-weight: 600;">
          ${text.unsubscribe}
        </a>
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();

  return { subject, html: fullHtml };
}

// Interface of matching logs to return to Admin dashboard preview
export interface SmartMatchAlertLog {
  userId: string;
  userEmail: string;
  userName: string;
  userLanguage: string;
  userHour: number;
  matchesCount: number;
  matches: Array<{
    propertyId: string;
    title: string;
    price: string;
    location: string;
    score: number;
  }>;
  subject: string;
  html: string;
  triggered: boolean;
  skippedReason?: string;
}

// Fallback coordinates for common Dutch and Belgian cities to ensure robust location checks
function getFallbackCoordinates(cityName: string): { lat: number; lng: number } | null {
  if (!cityName) return null;
  const c = cityName.trim().toLowerCase();
  const cityMapping: Record<string, { lat: number; lng: number }> = {
    amsterdam: { lat: 52.3676, lng: 4.9041 },
    rotterdam: { lat: 51.9244, lng: 4.4777 },
    utrecht: { lat: 52.0907, lng: 5.1214 },
    'den haag': { lat: 52.0705, lng: 4.3007 },
    'the hague': { lat: 52.0705, lng: 4.3007 },
    eindhoven: { lat: 51.4416, lng: 5.4697 },
    groningen: { lat: 53.2194, lng: 6.5665 },
    tilburg: { lat: 51.5555, lng: 5.0913 },
    almere: { lat: 52.3718, lng: 5.2224 },
    breda: { lat: 51.5895, lng: 4.7743 },
    nijmegen: { lat: 51.8126, lng: 5.8372 },
    haarlem: { lat: 52.3874, lng: 4.6462 },
    arnhem: { lat: 51.9851, lng: 5.8987 },
    amersfoort: { lat: 52.1561, lng: 5.3878 },
    antwerpen: { lat: 51.2194, lng: 4.4025 },
    gent: { lat: 51.0543, lng: 3.7174 },
    brugge: { lat: 51.2093, lng: 3.2247 },
    brussel: { lat: 50.8503, lng: 4.3517 },
    brussels: { lat: 50.8503, lng: 4.3517 }
  };
  return cityMapping[c] || null;
}

// Case-insensitive, Dutch-English equivalent property-type matcher
function matchPropertyType(seekerTypes: string[], propType: string): boolean {
  if (!seekerTypes || seekerTypes.length === 0 || !propType) return false;
  
  const lowerSeeker = seekerTypes.map(t => t.toLowerCase());
  const lowerProp = propType.toLowerCase();

  for (const st of lowerSeeker) {
    if (st === lowerProp) return true;
    
    // Map 'huis' / 'woning' / 'house' interchangeably
    if ((st === 'huis' || st === 'woning' || st === 'house') && 
        (lowerProp === 'huis' || lowerProp === 'woning' || lowerProp === 'house')) {
      return true;
    }
    
    // Map 'room' / 'kamer'
    if ((st === 'room' || st === 'kamer') && 
        (lowerProp === 'room' || lowerProp === 'kamer')) {
      return true;
    }
    
    // Map 'apartment' / 'appartement'
    if ((st === 'apartment' || st === 'appartement') && 
        (lowerProp === 'apartment' || lowerProp === 'appartement')) {
      return true;
    }
  }
  return false;
}

// 4. Executes the hourly cron-job task for Smart Match Alerts
export async function runSmartMatchAlertsJob(
  manualTest: boolean = false,
  testUserId?: string // Optional specific user to target for isolated admin tests
): Promise<SmartMatchAlertLog[]> {
  const logs: SmartMatchAlertLog[] = [];
  const siteUrl = window.location.origin;

  try {
    // Current European hour
    let currentHour = 12; // default
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Amsterdam",
        hour: "numeric",
        hour12: false
      });
      currentHour = parseInt(formatter.format(new Date()), 10);
    } catch (e) {
      currentHour = (new Date().getUTCHours() + 1) % 24;
    }

    // 1. Fetch properties (status is available)
    const propertiesRef = collection(db, "properties");
    const activePropsQuery = query(propertiesRef, where("status", "==", "available"));
    const propsSnap = await getDocs(activePropsQuery);
    
    const allProperties = propsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data
      } as any;
    });

    if (allProperties.length === 0) {
      console.warn("No active properties found in DB.");
    }

    // 2. Filter properties by newer than 24 hours if running under real scheduled chron
    // "Als de fcuntie nu in de admin tab getest wordt dan niet kijken wanneer woning is toegeveogd... voor de test only !"
    const qualifyingProperties = allProperties.filter(p => {
      if (manualTest) {
        return true; // bypass 24h checks during testing
      }
      
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      let createdMs = 0;
      if (p.createdAt?.seconds) {
        createdMs = p.createdAt.seconds * 1000;
      } else if (p.createdAt) {
        createdMs = new Date(p.createdAt).getTime();
      }
      return createdMs >= oneDayAgo;
    });

    // 3. Fetch all users
    const usersRef = collection(db, "users");
    let usersQuery = query(usersRef);
    
    // If testing a single specific user, run query only for them
    if (manualTest && testUserId) {
      usersQuery = query(usersRef, where("uid", "==", testUserId));
    } else if (!manualTest) {
      // Normal run: only active smart match alert users
      usersQuery = query(usersRef, where("smartMatchAlertEnabled", "==", true));
    }
    
    const usersSnap = await getDocs(usersQuery);
    const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Loop through users who are seekers (huis_zoeker) and qualifies
    for (const user of users) {
      const isSeeker = (user as any).role === "huis_zoeker";
      const alertsEnabled = (user as any).smartMatchAlertEnabled === true;
      const userHour = (user as any).smartMatchAlertHour !== undefined ? Number((user as any).smartMatchAlertHour) : null;
      
      const logEntry: SmartMatchAlertLog = {
        userId: user.id || "",
        userEmail: (user as any).email || "unknown@co-match.nl",
        userName: (user as any).displayName || "Member",
        userLanguage: (user as any).language || "nl",
        userHour: userHour !== null ? userHour : -1,
        matchesCount: 0,
        matches: [],
        subject: "",
        html: "",
        triggered: false
      };

      if (!isSeeker) {
        logEntry.skippedReason = "Gebruiker is geen Huis-Zoeker";
        logs.push(logEntry);
        continue;
      }

      if (!manualTest && !alertsEnabled) {
        logEntry.skippedReason = "Smart Match Alerts staat uit";
        logs.push(logEntry);
        continue;
      }

      // Check hour match if real running job
      if (!manualTest && userHour !== null && userHour !== currentHour) {
        logEntry.skippedReason = `Niet gecorrespondeerd met uur slot (Gebruiker uur slot: ${userHour} CET, Actueel: ${currentHour} CET)`;
        logs.push(logEntry);
        continue;
      }

      // Query their Seeker Profile
      const seekerDocRef = doc(db, "seeker_profiles", user.id);
      const seekerSnap = await getDoc(seekerDocRef);
      if (!seekerSnap.exists()) {
        logEntry.skippedReason = "Geen zoekersprofiel (Criteria selectie missend)";
        logs.push(logEntry);
        continue;
      }

      const seekerProfile = seekerSnap.data();

      // Check matching houses according to exact filters: type, goal, budget & geo-radius
      const matches: Array<{ property: any; score: number }> = [];
      
      // Resolve seeker coordinates or fallback to Dutch city lookup
      let seekerLat = seekerProfile.lat !== undefined && seekerProfile.lat !== null ? Number(seekerProfile.lat) : null;
      let seekerLng = seekerProfile.lng !== undefined && seekerProfile.lng !== null ? Number(seekerProfile.lng) : null;
      if ((seekerLat === null || seekerLng === null) && seekerProfile.city) {
        const fallback = getFallbackCoordinates(seekerProfile.city);
        if (fallback) {
          seekerLat = fallback.lat;
          seekerLng = fallback.lng;
        }
      }

      for (const p of qualifyingProperties) {
        // 1. Budget constraint
        const price = p.price || p.minPrice || 0;
        const maxBudget = seekerProfile.budget_max || seekerProfile.budget || 0;
        if (maxBudget && price > maxBudget) {
          continue; // fails budget hard filter
        }

        // 2. Goal constraint
        const propGoal = p.features?.goal || p.goal;
        if (seekerProfile.goal && seekerProfile.goal.length > 0 && propGoal) {
          const matchedGoal = seekerProfile.goal.includes(propGoal);
          if (!matchedGoal) continue; // fails goal hard filter
        }

        // 3. Type constraint
        const propType = p.features?.type || p.type;
        if (seekerProfile.property_type && seekerProfile.property_type.length > 0 && propType) {
          const matchedType = matchPropertyType(seekerProfile.property_type, propType);
          if (!matchedType) continue; // fails type hard filter
        }

        // 4. Coordinates / Radius distance constraint (strict checking)
        let propLat = p.displayLat !== undefined && p.displayLat !== null ? Number(p.displayLat) : null;
        let propLng = p.displayLng !== undefined && p.displayLng !== null ? Number(p.displayLng) : null;
        if ((propLat === null || propLng === null) && p.city) {
          const fallback = getFallbackCoordinates(p.city);
          if (fallback) {
            propLat = fallback.lat;
            propLng = fallback.lng;
          }
        }

        if (seekerLat === null || seekerLng === null || propLat === null || propLng === null) {
          continue; // fails because we need coordinates to check radius
        }

        const distance = calculateDistance(
          seekerLat,
          seekerLng,
          propLat,
          propLng
        );
        const radius = Number(seekerProfile.radius) || 15; // default 15 km
        if (distance > radius) {
          continue; // fails radius check
        }

        // Compliant Match
        matches.push({ property: p, score: 100 });
      }

      // Keep max 3 matches
      const topMatches = matches.slice(0, 3);

      logEntry.matchesCount = topMatches.length;
      logEntry.matches = topMatches.map(m => {
        const p = m.property;
        const priceText = p.priceType === "tbd" 
          ? "N.o.t.b." 
          : p.priceType === "range"
            ? `€ ${p.minPrice || 0} - € ${p.maxPrice || 0}/mnd`
            : `€ ${p.price || 0}/mnd`;

        return {
          propertyId: p.id,
          title: p.title || "Woning",
          price: priceText,
          location: p.location || p.city || "Onbekend",
          score: m.score
        };
      });

      if (topMatches.length > 0) {
        logEntry.triggered = true;
        
        // Generate hardcoded e-mail values
        const { subject, html } = generateSmartMatchAlertEmailHTML(
          user,
          seekerProfile,
          topMatches,
          siteUrl,
          logEntry.userLanguage
        );

        logEntry.subject = subject;
        logEntry.html = html;

        // If NOT manual test, we simulate email sending by appending it to Firestore alert log history inside seekers preferences/history document
        // This is perfectly compatible with the security rules and doesn't require any modifications
        if (!manualTest) {
          try {
            const historyRef = doc(db, 'users', user.id, 'settings', 'alert_history');
            await setDoc(historyRef, {
              alerts: arrayUnion({
                subject,
                html,
                matchesCount: topMatches.length,
                matches: logEntry.matches,
                createdAt: new Date().toISOString(),
                currentHour
              })
            }, { merge: true });
          } catch (writeErr) {
            console.error(`could not write alert log for user ${user.id}:`, writeErr);
          }
        }
      } else {
        logEntry.skippedReason = manualTest 
          ? "Geen woningen gevonden die voldoen aan type, doel, budget en radius van de zoeker" 
          : "Geen nieuw toegevoegde woningen gevonden die voldoen aan type, doel, budget en radius van de zoeker";
      }

      logs.push(logEntry);
    }

  } catch (err: any) {
    console.error("Critical error inside runSmartMatchAlertsJob:", err);
    throw err;
  }

  return logs;
}

// Translation dictionary for chat alerts - 100% static, multilingual support without expensive AI calls
const CHAT_EMAIL_TRANSLATIONS: Record<string, Record<string, string>> = {
  nl: {
    // Seeker receives email from provider
    seeker_subject: "📬 Nieuw chatbericht op Co-Match van {{providerName}}!",
    seeker_title_label: "Direct Bericht Notificatie",
    seeker_greeting: "Beste {{seekerName}},",
    seeker_desc: "Goed nieuws! Woningaanbieder <strong>{{providerName}}</strong> heeft zojuist een nieuw chatbericht gestuurd voor de woning \"<strong>{{propertyTitle}}</strong>\" in {{propertyCity}}.",
    seeker_cta: "Bekijk Chat & Reageer Nu",
    seeker_footer: "Je ontvangt deze e-mail omdat je e-mailmeldingen voor nieuwe chatberichten hebt ingeschakeld op het Co-Match platform.",
    seeker_unsubscribe: "Afmelden voor chat-e-mailmeldingen",
    seeker_reply_urgency: "We raden je aan om zo snel mogelijk te reageren om de kansen op een succesvolle match te maximaliseren en een uitstekend reactieprofiel op te bouwen.",

    // Provider receives email from seeker
    provider_subject: "💬 Nieuwe reactie op je woning \"{{propertyTitle}}\" van {{seekerName}}!",
    provider_title_label: "Direct Bericht Notificatie",
    provider_greeting: "Beste {{providerName}},",
    provider_desc_first_chat_ever: "Gefeliciteerd! Je hebt de allereerst mogelijke reactie ontvangen op je woning \"<strong>{{propertyTitle}}</strong>\" in {{propertyCity}} van kandidaat <strong>{{seekerName}}</strong>.",
    provider_desc_each_seeker_first_chat: "Goed nieuws! Een nieuwe kandidaat <strong>{{seekerName}}</strong> heeft zojuist zijn eerste reactie gestuurd voor je woning \"<strong>{{propertyTitle}}</strong>\" in {{propertyCity}}.",
    provider_desc_always: "Goed nieuws! Kandidaat <strong>{{seekerName}}</strong> heeft zojuist een nieuw chatbericht gestuurd voor je woning \"<strong>{{propertyTitle}}</strong>\" in {{propertyCity}}.",
    provider_cta: "Bekijk Chat & Beantwoord Nu",
    provider_unsubscribe: "Afmelden voor chat-e-mailmeldingen",
    provider_footer: "Je ontvangt deze e-mail omdat je e-mailmeldingen voor nieuwe chatberichten hebt ingeschakeld op het Co-Match platform.",
    provider_reply_urgency: "We raden je aan om snel te reageren om de interesse en voortgang van je kandidaat optimaal warm te houden."
  },
  en: {
    // Seeker receives email from provider
    seeker_subject: "📬 New chat message on Co-Match from {{providerName}}!",
    seeker_title_label: "Direct Message Notification",
    seeker_greeting: "Dear {{seekerName}},",
    seeker_desc: "Good news! Landlord <strong>{{providerName}}</strong> just sent you a new chat message regarding property \"<strong>{{propertyTitle}}</strong>\" in {{propertyCity}}.",
    seeker_cta: "View Chat & Reply Now",
    seeker_footer: "You are receiving this email because you have enabled email notifications for new chat messages on Co-Match.",
    seeker_unsubscribe: "Unsubscribe from chat email notifications",
    seeker_reply_urgency: "We recommend you reply as soon as possible to maximize your chances of a successful match and build an excellent response profile.",

    // Provider receives email from seeker
    provider_subject: "💬 New reaction on your property \"{{propertyTitle}}\" from {{seekerName}}!",
    provider_title_label: "Direct Message Notification",
    provider_greeting: "Dear {{providerName}},",
    provider_desc_first_chat_ever: "Congratulations! You received the very first reaction on your property \"<strong>{{propertyTitle}}</strong>\" in {{propertyCity}} from candidate <strong>{{seekerName}}</strong>.",
    provider_desc_each_seeker_first_chat: "Good news! A new candidate <strong>{{seekerName}}</strong> sent their first reaction for your property \"<strong>{{propertyTitle}}</strong>\" in {{propertyCity}}.",
    provider_desc_always: "Great news! Candidate <strong>{{seekerName}}</strong> has sent a new chat message regarding your property \"<strong>{{propertyTitle}}</strong>\" in {{propertyCity}}.",
    provider_cta: "View Chat & Reply Now",
    provider_unsubscribe: "Unsubscribe from chat email notifications",
    provider_footer: "You are receiving this email because you have enabled email notifications for new chat messages on Co-Match.",
    provider_reply_urgency: "We recommend replying quickly to keep your candidate's interest and progress warm."
  }
};

// 5. Instantly sends a friendly notification email when a provider chats with a seeker
export async function sendChatMessageEmailNotification(
  chatId: string,
  messageText: string,
  senderUid: string
): Promise<{ status: string; reason?: string }> {
  try {
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) {
      return { status: 'failed', reason: 'chat_does_not_exist' };
    }

    const chatData = chatSnap.data();
    const seekerId = chatData.seekerId;
    const providerId = chatData.providerId;
    const propertyId = chatData.propertyId;

    if (!seekerId || !providerId || !propertyId) {
      return { status: 'failed', reason: 'invalid_chat_references' };
    }

    // Cooldown check: 15 minutes of quiet time from this provider to seeker
    const lastSent = chatData.lastChatMailSentAt;
    if (lastSent) {
      const elapsedMs = Date.now() - new Date(lastSent).getTime();
      if (elapsedMs < 15 * 60 * 1000) {
        console.log(`[Chat Mail] Cooldown active. Skipping email to prevent spam.`);
        return { status: 'skipped', reason: 'cooldown_active' };
      }
    }

    // Check Seeker's preference (defaults to true)
    const prefSnap = await getDoc(doc(db, 'users', seekerId, 'settings', 'preferences'));
    let chatMailAlertEnabled = true;
    let seekerLang = 'nl';
    if (prefSnap.exists()) {
      const prefData = prefSnap.data();
      if (prefData.chatMailAlertEnabled === false) {
        chatMailAlertEnabled = false;
      }
      if (prefData.language) {
        seekerLang = prefData.language;
      }
    }

    if (!chatMailAlertEnabled) {
      console.log(`[Chat Mail] Seeker has disabled email notification in setting.`);
      return { status: 'skipped', reason: 'seeker_disabled_notifications' };
    }

    // Fetch details of property and seeker display name and profiles
    const [propSnap, seekerUserSnap, providerUserSnap, seekerProfileSnap, providerProfileSnap] = await Promise.all([
      getDoc(doc(db, 'properties', propertyId)),
      getDoc(doc(db, 'users', seekerId)),
      getDoc(doc(db, 'users', providerId)),
      getDoc(doc(db, 'seeker_profiles', seekerId)),
      getDoc(doc(db, 'providers', providerId))
    ]);

    const propertyTitle = propSnap.exists() ? (propSnap.data().title || "Woning") : "Woning";
    const propertyCity = propSnap.exists() ? (propSnap.data().city || "de geselecteerde stad") : "de geselecteerde stad";
    
    // Anonymity names: strictly fetch roepnaam (first name) from profile, then fallback
    const seekerProfData = seekerProfileSnap.exists() ? seekerProfileSnap.data() : null;
    const providerProfData = providerProfileSnap.exists() ? providerProfileSnap.data() : null;

    let seekerFirstName = "";
    if (seekerProfData && seekerProfData.firstName) {
      seekerFirstName = seekerProfData.firstName.trim().split(/\s+/)[0];
      seekerFirstName = seekerFirstName.charAt(0).toUpperCase() + seekerFirstName.slice(1).toLowerCase();
    }
    if (!seekerFirstName && seekerUserSnap.exists()) {
      const uData = seekerUserSnap.data();
      if (uData.firstName) {
        seekerFirstName = uData.firstName.trim().split(/\s+/)[0];
        seekerFirstName = seekerFirstName.charAt(0).toUpperCase() + seekerFirstName.slice(1).toLowerCase();
      } else {
        seekerFirstName = getCleanFirstName(uData.displayName, "Woningzoeker");
      }
    }
    if (!seekerFirstName) {
      seekerFirstName = "Woningzoeker";
    }

    let providerFirstName = "";
    if (providerProfData && providerProfData.firstName) {
      providerFirstName = providerProfData.firstName.trim().split(/\s+/)[0];
      providerFirstName = providerFirstName.charAt(0).toUpperCase() + providerFirstName.slice(1).toLowerCase();
    }
    if (!providerFirstName && providerUserSnap.exists()) {
      const uData = providerUserSnap.data();
      if (uData.firstName) {
        providerFirstName = uData.firstName.trim().split(/\s+/)[0];
        providerFirstName = providerFirstName.charAt(0).toUpperCase() + providerFirstName.slice(1).toLowerCase();
      } else {
        providerFirstName = getCleanFirstName(uData.displayName, "Aanbieder");
      }
    }
    if (!providerFirstName) {
      providerFirstName = "Aanbieder";
    }

    const siteUrl = typeof window !== 'undefined' ? window.location.origin : "https://co-match.nl";
    const chatUrl = `${siteUrl}?chatId=${chatId}`;

    // Message sanitization for email preview block
    const sanitizedMsg = messageText && messageText.length > 250 
      ? messageText.substring(0, 250) + "..." 
      : messageText;

    const langKey = seekerLang.startsWith('en') ? 'en' : 'nl';
    const textTrans = CHAT_EMAIL_TRANSLATIONS[langKey];

    const subject = textTrans.seeker_subject.replace('{{providerName}}', providerFirstName);
    const greetingLabel = textTrans.seeker_greeting.replace('{{seekerName}}', seekerFirstName);
    const descriptionText = textTrans.seeker_desc
      .replace('{{providerName}}', providerFirstName)
      .replace('{{propertyTitle}}', propertyTitle)
      .replace('{{propertyCity}}', propertyCity);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 30px auto; padding: 25px; border-radius: 24px; border: 1px solid #e2e8f0; background-color: #FAF9F6; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
    
    <!-- Header -->
    <div style="text-align: center; padding-bottom: 25px; border-bottom: 1px solid #e2e8f0;">
      <div style="width: 56px; height: 56px; background-color: #8DAA91; border-radius: 18px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px; color: white; font-size: 28px; line-height: 56px; text-align: center;">💬</div>
      <h1 style="color: #6a826e; font-size: 20px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">Co-Match Chat</h1>
      <p style="font-size: 11px; color: #10b981; font-weight: 800; text-transform: uppercase; margin-top: 6px; letter-spacing: 0.05em;">${textTrans.seeker_title_label}</p>
    </div>

    <!-- Intro Message -->
    <div style="margin: 25px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      <p style="margin: 0 0 12px 0; font-weight: 700; font-size: 16px; color: #1e293b;">${greetingLabel}</p>
      <p style="margin: 0 0 16px 0;">${descriptionText}</p>
      
      <!-- Content bubble -->
      <div style="background-color: #f1f5f9; border-left: 4px solid #8DAA91; border-radius: 12px; padding: 16px; margin: 20px 0; font-style: italic; color: #1e293b; font-size: 13px; line-height: 1.5; white-space: pre-wrap;">"${sanitizedMsg}"</div>
      
      <p style="margin: 0 0 16px 0;">${textTrans.seeker_reply_urgency}</p>
    </div>

    <!-- CTA Center Button -->
    <div style="text-align: center; margin: 30px 0 25px 0;">
      <a href="${chatUrl}" style="display: inline-block; background-color: #8DAA91; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 14px; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 4px 6px -1px rgba(141, 170, 145, 0.3);">
        ${textTrans.seeker_cta}
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 11px; color: #64748b; line-height: 1.5;">
      <p style="margin: 0 0 10px 0;">${textTrans.seeker_footer}</p>
      <p style="margin: 0;">
        <a href="${siteUrl}?unsubscribeChatAlerts=true" style="color: #64748b; text-decoration: underline; font-weight: 600;">
          ${textTrans.seeker_unsubscribe}
        </a>
      </p>
    </div>

  </div>
</body>
</html>
    `;

    // 1. Simulate sending of this email by saving to the active sender's `alert_history` to follow Firestore security rules
    const historyRef = doc(db, 'users', senderUid, 'settings', 'alert_history');
    await setDoc(historyRef, {
      alerts: arrayUnion({
        subject,
        html,
        matchesCount: 1,
        createdAt: new Date().toISOString(),
        isChatAlert: true,
        chatSenderName: providerFirstName,
        chatText: sanitizedMsg,
        recipientName: seekerFirstName,
        recipientEmail: seekerUserSnap.exists() ? (seekerUserSnap.data().email || 'Geen email') : 'Geen email'
      })
    }, { merge: true });

    // 2. Set the 15-minute quiet period cooldown timestamp on the chat document
    await updateDoc(chatRef, {
      lastChatMailSentAt: new Date().toISOString()
    });

    console.log(`[Chat Mail] Simulated chat mail notification sent successfully to ${seekerId}! Cooldown set.`);
    return { status: 'sent' };

  } catch (err: any) {
    console.error("[Chat Mail] Error sending notification email:", err);
    return { status: 'failed', reason: err.message || 'unknown_error' };
  }
}

export async function sendProviderChatMessageEmailNotification(
  chatId: string,
  messageText: string,
  seekerId: string
): Promise<{ status: 'sent' | 'skipped' | 'failed'; reason?: string }> {
  try {
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) {
      return { status: 'failed', reason: 'chat_not_found' };
    }

    const chatData = chatSnap.data();
    const providerId = chatData.providerId;
    const propertyId = chatData.propertyId;

    if (!providerId || !propertyId) {
      return { status: 'failed', reason: 'missing_ids_in_chat' };
    }

    // 1. Fetch Provider Profile, Seeker Profile, and property details
    const [providerSnap, propertySnap, seekerSnap, providerProfileSnap, seekerProfileSnap] = await Promise.all([
      getDoc(doc(db, 'users', providerId)),
      getDoc(doc(db, 'properties', propertyId)),
      getDoc(doc(db, 'users', seekerId)),
      getDoc(doc(db, 'providers', providerId)),
      getDoc(doc(db, 'seeker_profiles', seekerId))
    ]);

    if (!providerSnap.exists() || !propertySnap.exists()) {
      return { status: 'failed', reason: 'provider_or_property_not_found' };
    }

    const providerData = providerSnap.data();
    const propertyData = propertySnap.data();

    // 2. Fetch Provider's alert preferences from settingsPreferences or root user doc
    const prefSnap = await getDoc(doc(db, 'users', providerId, 'settings', 'preferences'));
    let providerChatMailAlertEnabled = true;
    let providerChatMailAlertOption = 'always';
    let providerLang = 'nl';

    if (prefSnap.exists()) {
      const prefData = prefSnap.data();
      if (prefData.chatMailAlertEnabled === false) {
        providerChatMailAlertEnabled = false;
      }
      if (prefData.providerChatMailAlertOption) {
        providerChatMailAlertOption = prefData.providerChatMailAlertOption;
      }
      if (prefData.language) {
        providerLang = prefData.language;
      }
    } else {
      if (providerData.chatMailAlertEnabled === false) {
        providerChatMailAlertEnabled = false;
      }
      if (providerData.providerChatMailAlertOption) {
        providerChatMailAlertOption = providerData.providerChatMailAlertOption;
      }
    }

    if (!providerChatMailAlertEnabled) {
      console.log(`[Provider Chat Mail] Provider has chat e-mail notifications disabled entirely.`);
      return { status: 'skipped', reason: 'disabled_by_user' };
    }

    // Anonymity firstnames from actual profile collections
    const seekerProfData = seekerProfileSnap.exists() ? seekerProfileSnap.data() : null;
    const providerProfData = providerProfileSnap.exists() ? providerProfileSnap.data() : null;

    let seekerFirstName = "";
    if (seekerProfData && seekerProfData.firstName) {
      seekerFirstName = seekerProfData.firstName.trim().split(/\s+/)[0];
      seekerFirstName = seekerFirstName.charAt(0).toUpperCase() + seekerFirstName.slice(1).toLowerCase();
    }
    if (!seekerFirstName && seekerSnap.exists()) {
      const uData = seekerSnap.data();
      if (uData.firstName) {
        seekerFirstName = uData.firstName.trim().split(/\s+/)[0];
        seekerFirstName = seekerFirstName.charAt(0).toUpperCase() + seekerFirstName.slice(1).toLowerCase();
      } else {
        seekerFirstName = getCleanFirstName(uData.displayName, "Woningzoeker");
      }
    }
    if (!seekerFirstName) {
      seekerFirstName = "Woningzoeker";
    }

    let providerFirstName = "";
    if (providerProfData && providerProfData.firstName) {
      providerFirstName = providerProfData.firstName.trim().split(/\s+/)[0];
      providerFirstName = providerFirstName.charAt(0).toUpperCase() + providerFirstName.slice(1).toLowerCase();
    }
    if (!providerFirstName && providerSnap.exists()) {
      const uData = providerSnap.data();
      if (uData.firstName) {
        providerFirstName = uData.firstName.trim().split(/\s+/)[0];
        providerFirstName = providerFirstName.charAt(0).toUpperCase() + providerFirstName.slice(1).toLowerCase();
      } else {
        providerFirstName = getCleanFirstName(uData.displayName, "Aanbieder");
      }
    }
    if (!providerFirstName) {
      providerFirstName = "Aanbieder";
    }

    // 3. Evaluate selected setting logic
    const messages = chatData.messages || [];
    const messageCount = messages.length;

    if (providerChatMailAlertOption === 'only_first_chat_ever') {
      const chatsQuery = query(collection(db, 'chats'), where('propertyId', '==', propertyId));
      const chatsSnap = await getDocs(chatsQuery);
      const totalChatsForProperty = chatsSnap.size;

      if (totalChatsForProperty > 1 || messageCount > 1) {
        console.log(`[Provider Chat Mail] Skipped because provider settings only allow alerts on the very first chat ever for this property (per property). (Total chats: ${totalChatsForProperty}, current messages: ${messageCount})`);
        return { status: 'skipped', reason: 'not_first_chat_ever' };
      }
    } else if (providerChatMailAlertOption === 'each_seeker_first_chat') {
      if (messageCount > 1) {
        console.log(`[Provider Chat Mail] Skipped because provider settings only allow alerts on the first message from each candidate seeker. (Current messages: ${messageCount})`);
        return { status: 'skipped', reason: 'not_seeker_first_chat' };
      }
    } else {
      // Option: 'always'. Check 15-minute cooldown
      const lastSent = chatData.lastProviderChatMailSentAt;
      if (lastSent) {
        const elapsedMs = Date.now() - new Date(lastSent).getTime();
        if (elapsedMs < 15 * 60 * 1000) {
          console.log(`[Provider Chat Mail] Cooldown is active. Skipping email to prevent spam. (elapsed: ${Math.round(elapsedMs / 1000)} seconds)`);
          return { status: 'skipped', reason: 'cooldown_active' };
        }
      }
    }

    // 4. Generate email HTML and styling
    const propertyTitle = propertyData.title || 'Mijn woning';
    const propertyCity = propertyData.city || 'geselecteerde stad';
    const sanitizedMsg = messageText.replace(/[<>]/g, '');

    const chatUrl = typeof window !== 'undefined' 
      ? `${window.location.protocol}//${window.location.host}/?openChatId=${propertyId}`
      : `https://co-match.nl/?openChatId=${propertyId}`;
      
    const siteUrl = typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}/`
      : `https://co-match.nl/`;

    const langKey = providerLang === 'en' ? 'en' : 'nl';
    const textTrans = CHAT_EMAIL_TRANSLATIONS[langKey];

    const subject = textTrans.provider_subject
      .replace('{{propertyTitle}}', propertyTitle)
      .replace('{{seekerName}}', seekerFirstName);

    const greetingLabel = textTrans.provider_greeting.replace('{{providerName}}', providerFirstName);
    
    let descriptionText = '';
    if (providerChatMailAlertOption === 'only_first_chat_ever') {
      descriptionText = textTrans.provider_desc_first_chat_ever
        .replace('{{propertyTitle}}', propertyTitle)
        .replace('{{propertyCity}}', propertyCity)
        .replace('{{seekerName}}', seekerFirstName);
    } else if (providerChatMailAlertOption === 'each_seeker_first_chat') {
      descriptionText = textTrans.provider_desc_each_seeker_first_chat
        .replace('{{propertyTitle}}', propertyTitle)
        .replace('{{propertyCity}}', propertyCity)
        .replace('{{seekerName}}', seekerFirstName);
    } else {
      descriptionText = textTrans.provider_desc_always
        .replace('{{propertyTitle}}', propertyTitle)
        .replace('{{propertyCity}}', propertyCity)
        .replace('{{seekerName}}', seekerFirstName);
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 30px auto; padding: 25px; border-radius: 24px; border: 1px solid #e2e8f0; background-color: #FAF9F6; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
    
    <!-- Header -->
    <div style="text-align: center; padding-bottom: 25px; border-bottom: 1px solid #e2e8f0;">
      <div style="width: 56px; height: 56px; background-color: #3b82f6; border-radius: 18px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px; color: white; font-size: 28px; line-height: 56px; text-align: center;">💬</div>
      <h1 style="color: #1e3a8a; font-size: 20px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">Co-Match Chat</h1>
      <p style="font-size: 11px; color: #3b82f6; font-weight: 800; text-transform: uppercase; margin-top: 6px; letter-spacing: 0.05em;">${textTrans.provider_title_label}</p>
    </div>

    <!-- Intro Message -->
    <div style="margin: 25px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      <p style="margin: 0 0 12px 0; font-weight: 700; font-size: 16px; color: #1e293b;">${greetingLabel}</p>
      <p style="margin: 0 0 16px 0;">${descriptionText}</p>
      
      <!-- Content bubble -->
      <div style="background-color: #f1f5f9; border-left: 4px solid #3b82f6; border-radius: 12px; padding: 16px; margin: 20px 0; font-style: italic; color: #1e293b; font-size: 13px; line-height: 1.5; white-space: pre-wrap;">"${sanitizedMsg}"</div>
      
      <p style="margin: 0 0 16px 0;">${textTrans.provider_reply_urgency}</p>
    </div>

    <!-- CTA Center Button -->
    <div style="text-align: center; margin: 30px 0 25px 0;">
      <a href="${chatUrl}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 14px; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);">
        ${textTrans.provider_cta}
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 11px; color: #64748b; line-height: 1.5;">
      <p style="margin: 0 0 10px 0;">${textTrans.provider_footer}</p>
      <p style="margin: 0;">
        <a href="${siteUrl}?unsubscribeChatAlerts=true" style="color: #64748b; text-decoration: underline; font-weight: 600;">
          ${textTrans.provider_unsubscribe}
        </a>
      </p>
    </div>

  </div>
</body>
</html>
    `;

    // 5. Store alert_history on the seeker record (the active sender) to bypass Firestore cross-user write security rules
    const historyRef = doc(db, 'users', seekerId, 'settings', 'alert_history');
    await setDoc(historyRef, {
      alerts: arrayUnion({
        subject,
        html,
        matchesCount: 1,
        createdAt: new Date().toISOString(),
        isChatAlert: true,
        isProviderAlert: true,
        chatSenderName: seekerFirstName,
        chatText: sanitizedMsg,
        recipientName: providerFirstName,
        recipientEmail: providerData.email || 'Geen email'
      })
    }, { merge: true });

    // 6. Record lastProviderChatMailSentAt for the 15-minute cooldown
    await updateDoc(chatRef, {
      lastProviderChatMailSentAt: new Date().toISOString()
    });

    console.log(`[Provider Chat Mail] Simulated provider chat mail successfully queued and saved for ${providerId}!`);
    return { status: 'sent' };

  } catch (err: any) {
    console.error("[Provider Chat Mail] Error during simulated provider mail:", err);
    return { status: 'failed', reason: err.message || 'unknown_error' };
  }
}
