import { db } from "../lib/firebase";
import { collection, query, getDocs, orderBy, limit, where } from "firebase/firestore";
import { postToServerFunction } from "../lib/serverApi";

export interface NewsletterInputData {
  upcomingWeekId: string;
  upcomingWeekRange: string;
  recentUpdates: Array<{
    title: string;
    message: string;
    type: string;
    targetAudience: string;
    startDate: string;
  }>;
  propertiesList: Array<{
    title: string;
    location: string;
    country: string; // e.g. "🇳🇱 Netherlands" or "🇧🇪 Belgium"
    price: string;
    imageUrl: string;
    isWorkReadyBadge: boolean;
    goal?: string;
    type?: string;
  }>;
  highlightedPropertiesList: Array<{
    title: string;
    location: string;
    country: string;
    price: string;
    imageUrl: string;
    isWorkReadyBadge: boolean;
    goal?: string;
    type?: string;
  }>;
}

export async function fetchNewsletterData(): Promise<NewsletterInputData> {
  const recentUpdates: NewsletterInputData['recentUpdates'] = [];
  const propertiesList: NewsletterInputData['propertiesList'] = [];
  const highlightedPropertiesList: NewsletterInputData['highlightedPropertiesList'] = [];

  // Calculate upcoming week Monday ID and range string (e.g. "1 June - 7 June 2026")
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff + 7)); // Next week Monday
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  const upcomingWeekId = `${yyyy}-${mm}-${dd}`;

  const monthsEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const startDay = monday.getDate();
  const startMonth = monthsEn[monday.getMonth()];
  const endDay = sunday.getDate();
  const endMonth = monthsEn[sunday.getMonth()];
  const endYear = sunday.getFullYear();

  let upcomingWeekRange = "";
  if (monday.getMonth() === sunday.getMonth()) {
    upcomingWeekRange = `${startDay} - ${endDay} ${startMonth} ${endYear}`;
  } else {
    upcomingWeekRange = `${startDay} ${startMonth} - ${endDay} ${endMonth} ${endYear}`;
  }

  try {
    // 1. Fetch gifts/updates
    const giftsRef = collection(db, "gifts");
    const giftsQuery = query(giftsRef, orderBy("startDate", "desc"));
    const giftsSnap = await getDocs(giftsQuery);
    
    const sevenDaysAgoStr = new Date();
    sevenDaysAgoStr.setDate(sevenDaysAgoStr.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgoStr.toISOString();

    const allGifts = giftsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        title: data.title || "",
        message: data.message || "",
        type: data.type || "new",
        targetAudience: data.targetAudience || "all",
        startDate: data.startDate || ""
      };
    });

    // Strictly filter to updates in the last 7 days so no unexpected historical objects are pulled
    const filteredGifts = allGifts.filter(g => g.startDate >= sevenDaysAgoISO);
    recentUpdates.push(...filteredGifts);

  } catch (err) {
    console.error("Error fetching gifts for newsletter:", err);
  }

  try {
    // 2. Fetch properties (newest 10 active)
    const propertiesRef = collection(db, "properties");
    const activePropsQuery = query(
      propertiesRef, 
      where("status", "==", "available")
    );
    const propsSnap = await getDocs(activePropsQuery);

    const allProps = propsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || "Woning",
        location: data.location || data.city || "Onbekend",
        country: data.country || "",
        price: data.priceType === "tbd" 
          ? "N.o.t.b." 
          : data.priceType === "range"
            ? `€ ${data.minPrice || 0} - € ${data.maxPrice || 0}/mnd`
            : `€ ${data.price || 0}/mnd`,
        images: data.images || [],
        teaserImageId: data.teaserImageId || "",
        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : "") : "",
        isWorkReadyBadge: !!(data.features?.work_workspace || data.features?.desk || data.features?.high_speed_wifi),
        highlightWeeks: data.highlightWeeks || [],
        goal: data.features?.goal || "",
        type: data.features?.type || ""
      };
    });

    // Extract ones highlighted for upcoming week
    const upcomingHighlights = allProps.filter(p => p.highlightWeeks && p.highlightWeeks.includes(upcomingWeekId));

    // Sort standard props by createdAt desc
    allProps.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    const newestTen = allProps.slice(0, 10);

    const helperMapProp = (prop: any) => {
      let imageUrl = "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&auto=format&fit=crop&q=80"; // standard fallback
      const teaserImage = prop.images.find((img: any) => img.id === prop.teaserImageId) || prop.images[0];
      if (teaserImage && teaserImage.url) {
        imageUrl = teaserImage.url;
      }
      
      // Ensure WebP formatting or dynamic size hints for performance
      if (imageUrl.includes("unsplash.com")) {
        imageUrl += "&fm=webp&w=300&q=70";
      }

      // Automatically determine nice country name & emoji flag
      const lowerCity = prop.location.toLowerCase();
      const lowerCountry = prop.country.toLowerCase();
      let countryEmoji = "🇳🇱";
      let countryName = "Netherlands";
      if (lowerCountry.includes("be") || lowerCountry.includes("belgi") || lowerCity.includes("gent") || lowerCity.includes("antwerpen") || lowerCity.includes("brussel") || lowerCity.includes("leuven") || lowerCity.includes("brugge")) {
        countryEmoji = "🇧🇪";
        countryName = "Belgium";
      } else if (lowerCountry.includes("de") || lowerCountry.includes("duits") || lowerCity.includes("berlin") || lowerCity.includes("münchen") || lowerCity.includes("köln")) {
        countryEmoji = "🇩🇪";
        countryName = "Germany";
      } else if (lowerCountry.includes("fr") || lowerCountry.includes("frank") || lowerCity.includes("paris") || lowerCity.includes("lille") || lowerCity.includes("gaspé")) {
        countryEmoji = "🇫🇷";
        countryName = "France";
      } else if (lowerCountry.includes("es") || lowerCountry.includes("span") || lowerCity.includes("madrid") || lowerCity.includes("barcelona") || lowerCity.includes("valencia")) {
        countryEmoji = "🇪🇸";
        countryName = "Spain";
      }

      return {
        title: prop.title,
        location: prop.location,
        country: `${countryEmoji} ${countryName}`,
        price: prop.price,
        imageUrl: imageUrl,
        isWorkReadyBadge: prop.isWorkReadyBadge,
        goal: prop.goal,
        type: prop.type
      };
    };

    // Populate newest 10 properties list
    for (const prop of newestTen) {
      propertiesList.push(helperMapProp(prop));
    }

    // Populate highlighted properties list
    for (const prop of upcomingHighlights) {
      highlightedPropertiesList.push(helperMapProp(prop));
    }

  } catch (err) {
    console.error("Error fetching properties for newsletter:", err);
  }

  return { upcomingWeekId, upcomingWeekRange, recentUpdates, propertiesList, highlightedPropertiesList };
}

export async function generateNewsletterHTML(data: NewsletterInputData, siteUrl: string): Promise<string> {
  const { html } = await postToServerFunction<{ html: string }>('ai-newsletter-html', {
    data,
    siteUrl
  });
  return html;
}
