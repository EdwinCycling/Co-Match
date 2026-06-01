import { db } from "../lib/firebase";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { calculateCHAScore } from "../components/CoHarmonyAnalysis";
import { escapeHtml, sanitizeUrl } from "../lib/sanitize";
import { recordSmartMatchAlertHistory, sendChatEmailNotification } from "./notificationService";

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
    title: "Jouw Persoonlijke Matchmaker Update ðŸ¡",
    intro: "Hoi {{firstName}}, we hebben weer gekeken voor je. We hebben een aantal nieuwe woningen gevonden die perfect aansluiten bij jouw profiel! Hier zijn de nieuwste matches van de afgelopen 24 uur:",
    view_match_cta: "Bekijk deze match in de app",
    view_all_cta: "Open Co-Match en start met ontdekken",
    footer_text: "Je ontvangt deze e-mail omdat je Smart Match Alerts hebt ingeschakeld in je profielinstellingen.",
    unsubscribe: "Afmelden voor Smart Match Alerts",
    match_badge: "Match! âœ¨",
    monthly: "/mnd"
  },
  en: {
    subject: "New match in {{city}}: Does this fit you?",
    title: "Your Personal Matchmaker Update ðŸ¡",
    intro: "Hi {{firstName}}, we looked for you again. We found some new properties that fit your profile perfectly! Here are your newest matches from the last 24 hours:",
    view_match_cta: "View this match in the app",
    view_all_cta: "Open Co-Match and start exploring",
    footer_text: "You received this email because you enabled Smart Match Alerts in your profile settings.",
    unsubscribe: "Unsubscribe from Smart Match Alerts",
    match_badge: "Match! âœ¨",
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
        ? `â‚¬ ${property.minPrice || 0} - â‚¬ ${property.maxPrice || 0}${text.monthly}`
        : `â‚¬ ${property.price || 0}${text.monthly}`;

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
        <p style="margin: 0 0 12px 0; font-size: 13px; color: #64748b; font-weight: 500;">ðŸ“ ${safeLocation}</p>
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
      <div style="width: 56px; height: 56px; background-color: #8DAA91; border-radius: 18px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px; color: white; font-size: 28px; line-height: 56px; text-align: center;">ðŸ¡</div>
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
            ? `â‚¬ ${p.minPrice || 0} - â‚¬ ${p.maxPrice || 0}/mnd`
            : `â‚¬ ${p.price || 0}/mnd`;

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

        // Persist the simulated mail history through the server so the browser no longer writes alert logs directly.
        if (!manualTest) {
          try {
            await recordSmartMatchAlertHistory({
              userId: user.id,
              subject,
              html,
              matchesCount: topMatches.length,
              matches: logEntry.matches,
              currentHour,
            });
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

// Chat alert e-mail flow runs server-side (notification-writes) so clients never read other users' settings.
export async function sendChatMessageEmailNotification(
  chatId: string,
  messageText: string,
  _senderUid: string
): Promise<{ status: string; reason?: string }> {
  try {
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
    return await sendChatEmailNotification({ chatId, messageText, siteUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    console.error('[Chat Mail] Server notification failed:', err);
    return { status: 'failed', reason: message };
  }
}

export async function sendProviderChatMessageEmailNotification(
  chatId: string,
  messageText: string,
  _seekerId: string
): Promise<{ status: 'sent' | 'skipped' | 'failed'; reason?: string }> {
  try {
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
    const result = await sendChatEmailNotification({ chatId, messageText, siteUrl });
    return {
      status: result.status === 'sent' ? 'sent' : result.status === 'skipped' ? 'skipped' : 'failed',
      reason: result.reason,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    console.error('[Provider Chat Mail] Server notification failed:', err);
    return { status: 'failed', reason: message };
  }
}
