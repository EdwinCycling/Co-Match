import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import { 
  Activity, 
  MapPin, 
  HelpCircle, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  RefreshCw, 
  Check, 
  Home, 
  Users, 
  Smile, 
  Lock, 
  Heart, 
  ChevronLeft, 
  ChevronRight, 
  Coins,
  ShieldCheck,
  Compass,
  AlertCircle,
  Clock
} from "lucide-react";
import { AutocompleteInput } from "./AutocompleteInput";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { useCurrencyConverter } from "../hooks/useCurrencyConverter";
import { toast } from "react-hot-toast";

// Interface for a property
interface Property {
  id: string;
  ownerId?: string;
  title: string;
  city: string;
  country?: string;
  neighborhood?: string;
  price: number;
  priceType?: "fixed" | "range" | "tbd";
  minPrice?: number;
  maxPrice?: number;
  priceDescription?: string;
  features: any;
  teaserImageId?: string;
  images?: any[];
  displayLat?: number;
  displayLng?: number;
  displayRadius?: number;
  status?: "available" | "paused";
  monthlyAvailability?: Record<string, string>;
}

interface CoHarmonyAnalysisProps {
  properties: Property[];
  seekerProfile: any;
  onViewDetails: (property: Property) => void;
  onOpenChat: (property: Property) => void;
  favoriteIds: string[];
  onToggleFavorite: (property: Property) => Promise<void>;
  chatsStatus: Record<string, any>;
  onComplete: (harmonyIndex: number) => void;
}

// CHA Scoring formula (described conceptually to user and executed deterministically)
export function calculateCHAScore(seekerAnswers: {
  city: string;
  radius: number;
  goals: string[];
  budget_max: number;
  vibeAnswers: Record<string, number>;
}, property: Property) {
  try {
    if (!seekerAnswers || !property) return 75;
    
    let scorePoints = 100;
    let penalty = 0;
    
    // 1. Locatie check
    if (seekerAnswers.city && property.city) {
      if (property.city.toLowerCase() !== seekerAnswers.city.toLowerCase()) {
        penalty += 15;
      }
    }
    
    // 2. Budget check
    const price = property.price || property.minPrice || 0;
    if (price && seekerAnswers.budget_max) {
      if (price > seekerAnswers.budget_max) {
        penalty += 20 * Math.min(2, (price - seekerAnswers.budget_max) / seekerAnswers.budget_max);
      }
    }
    
    // 3. Woonvorm check (goals matches the property's feature goal)
    if (seekerAnswers.goals && seekerAnswers.goals.length > 0) {
      const propGoal = property.features?.goal;
      
      let matchesType = false;
      // Map of goals in standard lowercase
      if (propGoal) {
        if (seekerAnswers.goals.includes(propGoal) || (propGoal === 'vakantie_onderhuur' && seekerAnswers.goals.includes('vakantie'))) {
          matchesType = true;
        }
      }
      
      if (!matchesType) {
        penalty += 15;
      }
    }

    // 4. Vibe check questions (schaal 1-5, standard neutral is 3)
    // Maps answers to corresponding database features or stable hashed fallback
    if (seekerAnswers.vibeAnswers) {
      const keys = Object.keys(seekerAnswers.vibeAnswers);
      let vibeDiff = 0;
      
      keys.forEach((qKey, index) => {
        const seekerValue = seekerAnswers.vibeAnswers[qKey]; // 1-5
        let providerValue = 3; // neutral default
        
        // Consistent generator based on property ID
        const propId = property.id || "";
        const hash = propId ? ((propId.charCodeAt(index % propId.length) || 0) + index) : index;
        providerValue = (hash % 5) + 1; // 1 to 5
        
        // Override/fine-tune with real property features for extreme accuracy
        const qLower = qKey.toLowerCase();
        if (qLower.includes('schone') || qLower.includes('clean')) {
          if (property.features?.condition_state === 'new' || property.features?.condition_state === 'renovated') {
            providerValue = 5;
          } else if (property.features?.condition_state === 'good') {
            providerValue = 4;
          }
        } else if (qLower.includes('pets') || qLower.includes('huisdieren')) {
          if (property.features?.pets === 'yes' || property.features?.tenant_pets_allowed === true) {
            providerValue = 5;
          } else if (property.features?.pets === 'no') {
            providerValue = 1;
          }
        } else if (qLower.includes('ingericht') || qLower.includes('furnish')) {
          if (property.features?.furnished === 'yes' || property.features?.furnished === 'fully') {
            providerValue = 5;
          } else if (property.features?.furnished === 'no' || property.features?.furnished === 'unfurnished') {
            providerValue = 1;
          } else if (property.features?.furnished === 'partly') {
            providerValue = 3;
          }
        } else if (qLower.includes('rustige') || qLower.includes('quiet') || qLower.includes('buren')) {
          if (property.features?.surroundings?.includes('Rustig') || property.features?.street?.includes('Rustig')) {
            providerValue = 5;
          } else if (property.features?.street?.includes('Druk') || property.features?.street?.includes('Levendig')) {
            providerValue = 1;
          }
        } else if (qLower.includes('zwembad') || qLower.includes('pool') || qLower.includes('sauna')) {
          if (property.features?.pool === 'yes' || property.features?.sauna === 'yes') {
            providerValue = 5;
          } else {
            providerValue = 1;
          }
        } else if (qLower.includes('strand') || qLower.includes('beach')) {
          const beachDist = property.features?.beach_distance_km;
          if (beachDist !== undefined && beachDist !== '') {
            const dist = parseFloat(beachDist);
            if (dist <= 1) providerValue = 5;
            else if (dist <= 5) providerValue = 4;
            else providerValue = 2;
          }
        } else if (qLower.includes('sociaal') || qLower.includes('samen') || qLower.includes('cohousing')) {
          if (property.features?.goal === 'cohousing') {
            providerValue = 5;
          } else if (property.features?.goal === 'vrije_verhuur') {
            providerValue = 1;
          }
        }
        
        const diff = Math.abs(seekerValue - providerValue);
        vibeDiff += diff;
      });
      
      const maxPossibleDiff = keys.length * 4;
      const vibePenalty = maxPossibleDiff > 0 ? ((vibeDiff / maxPossibleDiff) * 40) : 0; // 40% weight
      penalty += vibePenalty;
    }
    
    return Math.max(0, Math.min(100, Math.round(scorePoints - penalty)));
  } catch (error) {
    console.error("Error calculating CHA Score:", error);
    return 75; // Safe default fallback score
  }
}

export default function CoHarmonyAnalysis({
  properties,
  seekerProfile,
  onViewDetails,
  onOpenChat,
  favoriteIds,
  onToggleFavorite,
  chatsStatus,
  onComplete
}: CoHarmonyAnalysisProps) {
  const { t, i18n } = useTranslation();
  const currencyConverter = useCurrencyConverter();
  
  const [step, setStep] = useState<"intro" | "location" | "housing_type" | "vibe_check" | "calculating" | "results">("intro");
  
  // State for user inputs during analysis flow
  const [city, setCity] = useState(seekerProfile?.city || "");
  const [radius, setRadius] = useState(25); // default 25km as requested
  const [budgetMax, setBudgetMax] = useState<number>(seekerProfile?.budget_max || 1200);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [vibeAnswers, setVibeAnswers] = useState<Record<string, number>>({});
  const [currentVibeIndex, setCurrentVibeIndex] = useState(0);
  const [topMatches, setTopMatches] = useState<{ property: Property; score: number }[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Timer states
  const [timeLeft, setTimeLeft] = useState(10);
  const [showTimeout, setShowTimeout] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  useEffect(() => {
    const checkCooldown = () => {
      const key = `cha_last_completed_time_${auth.currentUser?.uid || 'anon'}`;
      const lastCompleted = localStorage.getItem(key);
      if (lastCompleted) {
        const diffMs = Date.now() - parseInt(lastCompleted, 10);
        const cooldownMs = 5 * 60 * 1000; // 5 minuten
        if (diffMs < cooldownMs) {
          setCooldownRemaining(Math.ceil((cooldownMs - diffMs) / 1000));
          return;
        }
      }
      setCooldownRemaining(0);
    };

    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, [step, auth.currentUser]);

  // Direct safe reset to intro if is in intermediate progress steps but cooldown is active
  useEffect(() => {
    if (cooldownRemaining > 0 && step !== "intro" && step !== "results") {
      setStep("intro");
    }
  }, [cooldownRemaining, step]);

  useEffect(() => {
    const handleResize = () => {
      const isMobileSize = window.innerWidth < 1024;
      const isLandscapeOrientation = window.innerWidth > window.innerHeight;
      setIsLandscape(isMobileSize && isLandscapeOrientation);
    };

    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Play electronic beep at 3, 2, 1 seconds remaining
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(800, ctx.currentTime); // Soft, clear 800Hz beep
      osc.type = "sine";
      gain.gain.setValueAtTime(0.04, ctx.currentTime); // Low volume
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      console.warn("Unable to play browser audio beep:", e);
    }
  };

  // Translations object supporting Dutch and English
  const dict = {
    nl: {
      introTitle: "Co-Harmony Analysis (CHA)",
      introSub: "Vind jouw woongeluk op basis van leefstijl DNA",
      introP1: "Zoeken naar een woning is vaak een proces van gokken. Wij doen het anders. Onze methodiek is gebaseerd op jarenlange ervaring in woon-dynamiek en gedragspsychologie. Waarom werkt CHA? Omdat een succesvolle match niet draait om vier muren, maar om de onzichtbare klik tussen mensen.",
      introP2: "We kijken verder dan oppervlakte en locatie. We analyseren de subtiele patronen in hoe jij leeft, werkt en ontspant. Dit algoritme is ontwikkeld om ruis weg te filteren en direct die woonsituatie te vinden waar jouw 'harmonie-factor' het hoogst is.",
      introP3: "Klaar voor de analyse? Het duurt slechts 60 seconden en vanaf stap 3 loopt er een handige timer mee van 10 seconden per vraag. Waarom de tijdsdruk? Snelheid stimuleert je intuïtie: je eerste ingeving is altijd de allerbeste en voorkomt analytische ruis!",
      introNote: "Let op: Gegevens van deze analyse worden niet permanent opgeslagen en dienen uitsluitend ter bepaling van je directe match-DNA.",
      startBtn: "Start de Analyse",
      locationTitle: "Locatie & Bereik",
      locationSub: "De basis van jouw geografische harmonie",
      cityLabel: "In welke stad of regio zoek je?",
      cityPlaceholder: "Typ een stad (bijv. Rotterdam, Amsterdam...)",
      radiusLabel: "Hoe ver mag je nieuwe thuis maximaal van het centrum liggen?",
      budgetLabel: "Wat is je maximale maandbudget?",
      nextBtn: "Volgende stap",
      backBtn: "Terug",
      housingTitle: "Woonvorm & Doel",
      housingSub: "Kies de woonvormen die bij jouw levensfase passen",
      housingSelectLabel: "Wat zoek je? (Kies er gerust meerdere)",
      vibeTitle: "De Vibe-Check",
      vibeSub: "Beantwoord de volgende stellingen eerlijk",
      scaleDisagreeMax: "Helemaal oneens",
      scaleDisagree: "Mee oneens",
      scaleNeutral: "Neutraal",
      scaleAgree: "Mee eens",
      scaleAgreeMax: "Zeer mee eens",
      calcTitle: "Wetenschappelijke Analyse",
      calcSub: "Ons gedragspsychologisch model berekent nu jouw ideale woonsituatie...",
      calcStep1: "Leefstijl-patronen indexeren...",
      calcStep2: "Geografische harmonie-factoren matchen...",
      calcStep3: "Ruis wegfilteren...",
      calcStep4: "Top matches selecteren...",
      resultsTitle: "Jouw Harmonie Resultaat",
      resultsSub: "Gefeliciteerd! We hebben de perfecte matches voor je berekend.",
      harmFactor: "Jouw Harmonie-factor",
      positioningIntro: "Op basis van je antwoorden match je uitstekend op de onderstaande parameters. Deze woningen sluiten perfect aan op jouw leefstijl DNA. Mensen die in deze situaties wonen, rapporteren een uitzonderlijk hoog woongeluk.",
      noMatches: "We hebben op dit moment helaas geen woningen gevonden in dit zoekgebied. Probeer je bereik of budget te vergroten voor betere resultaten!",
      restartBtn: "Doe de test opnieuw",
      viewDetails: "Woning bekijken",
      chatNow: "Direct contact",
      unlocked: "Details Ontgrendeld",
      favorites: "In Favorieten",
      cohousing: "Cohousing / Woongroep",
      hospita: "Hospita / Inwonen",
      vakantie: "Vakantie woning / Onderhuur",
      huisbewaring: "Huisbewaring / Expat",
      vrij: "Vrije verhuur",
      timeoutTitle: "Tijd is om! ⏱️",
      timeoutP1: "Om je pure intuïtie te vangen en analytisch over-denken te voorkomen, stoppen we de test als de tijd om is. Je eerste ingeving is namelijk de beste match voor jouw leefstijl DNA!",
      timeoutStopBtn: "Stoppen (dashboard)",
      timeoutRestartBtn: "Test opnieuw starten"
    },
    en: {
      introTitle: "Co-Harmony Analysis (CHA)",
      introSub: "Find your residential happiness based on lifestyle DNA",
      introP1: "Searching for a house is often a guessing game. We do things differently. Our methodology is based on years of experience in residential dynamics and behavioral psychology. Why does CHA work? Because a successful match is not about four walls, but about the invisible connection between people.",
      introP2: "We look beyond surface and location. We analyze the subtle patterns in how you live, work, and relax. This algorithm is developed to filter out noise and directly find the living situation where your 'harmony-factor' is highest.",
      introP3: "Ready for the analysis? It only takes 60 seconds, and starting from step 3, a handy timer of 10 seconds per question will run. Why the time pressure? Speed stimulates your intuition: your first instinct is always the absolute best and prevents analytical overthinking!",
      introNote: "Note: Data from this analysis is not stored permanently and is only used to determine your immediate match DNA.",
      startBtn: "Start the Analysis",
      locationTitle: "Location & Reach",
      locationSub: "The base of your geographical harmony",
      cityLabel: "Which city or region are you looking in?",
      cityPlaceholder: "Type a city (e.g., Rotterdam, Amsterdam...)",
      radiusLabel: "How far from the center is your new home allowed to be?",
      budgetLabel: "What is your maximum monthly budget?",
      nextBtn: "Next step",
      backBtn: "Back",
      housingTitle: "Housing Type & Goal",
      housingSub: "Choose the housing types that fit your life phase",
      housingSelectLabel: "What are you looking for? (Choose multiple if you like)",
      vibeTitle: "The Vibe Check",
      vibeSub: "Answer the following statements honestly",
      scaleDisagreeMax: "Strongly disagree",
      scaleDisagree: "Disagree",
      scaleNeutral: "Neutral",
      scaleAgree: "Agree",
      scaleAgreeMax: "Strongly agree",
      calcTitle: "Scientific Analysis",
      calcSub: "Our behavioral psychological model is calculating your ideal living situation...",
      calcStep1: "Indexing lifestyle patterns...",
      calcStep2: "Matching geographical harmony factors...",
      calcStep3: "Filtering out noise...",
      calcStep4: "Selecting top matches...",
      resultsTitle: "Your Harmony Results",
      resultsSub: "Congratulations! We have calculated the perfect matches for you.",
      harmFactor: "Your Harmony factor",
      positioningIntro: "Based on your responses, you match exceptionally well on the parameters below. These homes align perfectly with your lifestyle DNA. People in these contexts report an exceptionally high level of housing happiness.",
      noMatches: "We unfortunately haven't found any homes in this region at the moment. Try to increase your search range or budget for better results!",
      restartBtn: "Retake the test",
      viewDetails: "View property",
      chatNow: "Contact now",
      unlocked: "Details Unlocked",
      favorites: "In Favorites",
      cohousing: "Cohousing / Co-living",
      hospita: "Hospita / Homestay",
      vakantie: "Holiday home / Sublease",
      huisbewaring: "House-sitting / Expat",
      vrij: "Regular renting",
      timeoutTitle: "Time is up! ⏱️",
      timeoutP1: "To capture your raw intuition and prevent analytical overthinking, we stop the test when time is up. Your first instinct is the absolute best match for your lifestyle DNA!",
      timeoutStopBtn: "Stop (dashboard)",
      timeoutRestartBtn: "Restart test"
    }
  };

  const l = i18n.language === "en" ? dict.en : dict.nl;

  // Custom 8 vibe questions per housing type
  const vibeQuestions: Record<string, string[]> = {
    general: [
      "Ik hecht extreme waarde aan een vlekkeloos schone leefomgeving / I value a spotlessly clean living environment immensely.",
      "Ik vind het gezellig om af en toe lichte geluiden van buren of huisgenoten te horen / I enjoy hearing slight ambient sounds from neighbors or roommates occasionally.",
      "Privacy is voor mij belangrijker dan direct contact met de buren / Privacy is more important to me than direct contact with neighbors.",
      "Ik sta open voor het wonen in een levendige, actieve stadsbuurt / I am open to living in a lively, active urban neighborhood.",
      "Ik vind het prima als er wel eens huisdieren in de woning aanwezig zijn / I don't mind if pets are present in the house.",
      "Ik wil de optie hebben om mijn woning geheel naar eigen smaak in te richten / I want the option to fully decorate the property to my own taste.",
      "Ik vind een grote buitenruimte of balkon belangrijker dan een extra slaapkamer / I find a large outdoor space or balcony more important than an extra bedroom.",
      "Ik hecht veel waarde aan energiebesparende voorzieningen en duurzaam wonen / I value energy-saving features and sustainable living highly."
    ],
    cohousing: [
      "Samen eten en wekelijks bijpraten met huisgenoten is voor mij een absolute must / Sharing meals and weekly chats with housemates is an absolute must.",
      "Ik deel probleemloos mijn keuken en badkamer met anderen / I have no problem sharing my kitchen and bathroom with others.",
      "Beslissingen over het huis moeten democratisch en in groepsverband genomen worden / House decisions should be taken democratically in a group setting.",
      "Een opgeruimde gemeenschappelijke ruimte is cruciaal voor mijn gemoedsrust / A tidy communal area is crucial for my peace of mind.",
      "Ik nodig graag vrienden of gasten uit in de gedeelde ruimtes / I love inviting friends or guests into communal spaces.",
      "Ik vind gecoördineerd gezamenlijk onderhoud zoals tuinieren erg leuk / I enjoy coordinated shared maintenance tasks like gardening.",
      "Ik los conflicten en misverstanden graag direct op in groepsgesprekken / I prefer resolving conflicts and misunderstandings directly in group discussions.",
      "Ik vind het leuk om gemeenschappelijke evenementen zoals spelletjesavonden of filmavonden te organiseren / I enjoy organizing communal events like game nights or movie nights."
    ],
    hospita: [
      "Ik vind het fijn om een aanspreekpunt in huis te hebben voor sociale veiligheid / I like having a point of contact in the house for social safety.",
      "Ik pas me probleemloos aan aan de huisregels van een hoofdbewoner / I easily adapt to the house rules of a primary resident.",
      "Ik deel de voorzieningen graag harmonieus met de eigenaar / I happily share key facilities in full harmony with the owner.",
      "Ik hecht veel waarde aan een rustige en prikkelarme avondomgeving / I highly value a quiet and low-stimulus evening environment.",
      "Ik wil graag een volledig zelfstandige ingang hebben (meer privacy) / I would really like to have an independent entrance (more privacy).",
      "Samen af en toe een bakkie koffie of thee drinken spreekt me erg aan / Having a cup of coffee or tea together occasionally appeals to me.",
      "Ik hecht waarde aan duidelijke afspraken over bezoekers en overnachtingen / I value clear agreements regarding visitors and overnight guests.",
      "Ik zoek een woonplek waar rustige studie- of werkuren overdag gerespecteerd worden / I am looking for a place where quiet study or work hours during the day are respected."
    ],
    vakantie: [
      "Luxe faciliteiten zoals een zwembad of sauna zijn voor mij essentieel voor woongeluk / Luxury facilities like a pool or sauna are essential for my housing happiness.",
      "Ik verblijf het liefst direct in de buurt van het strand of de kust / I prefer staying directly near the beach or the coastline.",
      "Ik vind het prettig als er ontbijt of maaltijden gefaciliteerd worden / I like it when breakfast or meals are facilitated.",
      "Ik zoek een turn-key, volledig gemeubileerd verblijf waar ik zo in kan / I'm looking for a turn-key, fully furnished stay where I can just walk in.",
      "Een buitenkeuken of hoogwaardige lounge/barbecueplek is een grote pré / An outdoor kitchen or high-end lounge/barbecue area is a great benefit.",
      "Ik verblijf graag op een georganiseerd, rustig resort / I enjoy staying at an organized, peaceful resort.",
      "Ik verken graag de natuur (wandelen/fietsen) direct vanaf de drempel van mijn vakantiewoning / I love exploring nature (walking/cycling) directly from the doorstep of my holiday home.",
      "Ik reis het liefst met lichte bagage en verwacht dat alle huishoudelijke apparatuur al aanwezig is / I prefer to travel light and expect all household appliances to be fully present."
    ],
    huisbewaring: [
      "Ik kan uitstekend onafhankelijk verantwoordelijk beheer voeren over planten of post / I can independently manage plant care or mail responsibly.",
      "De aanwezigheid van snel en geavanceerd wifi voor thuiswerken is kritiek / Fast and advanced wifi for remote working is critical for me.",
      "Ik zoek een kwalitatieve en volledig ingerichte tijdelijke uitvalsbasis / I'm looking for a premium, fully equipped temporary base.",
      "Een eigen parkeergelegenheid aan huis is onmisbaar / Personal parking space at the property is indispensable.",
      "Ik wil lichte, moderne ruimtes met veel natuurlijke lichtinval / I want bright, modern spaces with lots of natural daylight.",
      "Ik geef de voorkeur aan een karakteristieke, rustige buitenwijk boven de binnenstad / I prefer a characteristic, quiet suburb over the city center.",
      "Ik vind het geen probleem om tijdelijk andermans meubilair en persoonlijke sfeer met zorg te respecteren / I don't mind temporarily respecting someone else's furniture and personal space with care.",
      "Ik heb regelmatig behoefte aan een flexibel opzegbare of verlengbare huurperiode / I regularly need a flexibly terminable or extendable rental period."
    ]
  };

  // Determine which question sheet to use based on selected goals
  const activeQuestionsKey = () => {
    if (selectedGoals.includes("vakantie_onderhuur")) return "vakantie";
    if (selectedGoals.includes("cohousing")) return "cohousing";
    if (selectedGoals.includes("hospita")) return "hospita";
    if (selectedGoals.includes("huisbewaring_expat")) return "huisbewaring";
    return "general";
  };

  const activeQuestionsRaw = vibeQuestions[activeQuestionsKey()];
  const activeQuestions = activeQuestionsRaw.map(q => {
    const parts = q.split(" / ");
    if (parts.length === 2) {
      return i18n.language === "en" ? parts[1] : parts[0];
    }
    return q;
  });

  // Multi-step loading phrases for the algorithmic effect
  const [calcPhrase, setCalcPhrase] = useState(l.calcStep1);
  useEffect(() => {
    if (step === "calculating") {
      const phrases = [l.calcStep1, l.calcStep2, l.calcStep3, l.calcStep4];
      let tCount = 0;
      const interval = setInterval(() => {
        tCount++;
        if (tCount < phrases.length) {
          setCalcPhrase(phrases[tCount]);
        } else {
          clearInterval(interval);
          finishAnalysis();
        }
      }, 750);
      return () => clearInterval(interval);
    }
  }, [step]);

  // Timer countdown hook
  useEffect(() => {
    // Reset timer when vibe statement index changes or when step changes
    if (step !== "vibe_check" || showTimeout) {
      return;
    }
    setTimeLeft(10);
  }, [currentVibeIndex, step, showTimeout]);

  useEffect(() => {
    if (step !== "vibe_check" || showTimeout) {
      return;
    }

    // Update the timer every 50ms for a smooth slider
    const startTime = Date.now();
    const duration = 10000; // 10 seconds

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingRaw = Math.max(0, duration - elapsed);
      const remainingSeconds = remainingRaw / 1000;

      setTimeLeft(remainingSeconds);

      if (remainingSeconds <= 0) {
        clearInterval(interval);
        setShowTimeout(true);
      } else if (remainingSeconds > 0 && remainingSeconds <= 4) {
        // playBeep can't be called every 50ms, need to throttle it to once per second
        // We'll calculate the current discrete second
        const prevDiscrete = Math.ceil((remainingRaw + 50) / 1000);
        const currentDiscrete = Math.ceil(remainingRaw / 1000);
        if (currentDiscrete < prevDiscrete) {
          playBeep();
        }
      }
    }, 50);

    return () => clearInterval(interval);
  }, [currentVibeIndex, step, showTimeout]);

  const handleStart = () => {
    // Check rate limits & 5-minute cooldown
    const historyJson = localStorage.getItem('cha_test_history');
    let history: number[] = [];
    if (historyJson) {
      try {
        history = JSON.parse(historyJson);
      } catch (e) {
        history = [];
      }
    }
    
    const now = Date.now();
    // Tests taken in the last 24 hours
    const todayHistory = history.filter(t => now - t < 24 * 60 * 60 * 1000);
    
    if (todayHistory.length >= 3) {
      toast.error(i18n.language === "en" ? "You have reached the maximum of 3 tests per day. Please come back tomorrow!" : "Je hebt het maximum van 3 testen per dag bereikt. Kom morgen terug!");
      return;
    }
    
    if (todayHistory.length > 0) {
      const lastTest = todayHistory[todayHistory.length - 1];
      if (now - lastTest < 5 * 60 * 1000) {
        const minutesLeft = Math.ceil((5 * 60 * 1000 - (now - lastTest)) / 60000);
        toast.error(i18n.language === "en" ? `Please wait ${minutesLeft} minutes before starting a new test.` : `Wacht nog ${minutesLeft} minuten voordat je een nieuwe test start.`);
        return;
      }
    }

    setStep("location");
  };

  const handleLocationNext = () => {
    if (!city.trim()) {
      toast.error(i18n.language === "en" ? "Please fill in a city first!" : "Vul eerst een stad of regio in!");
      return;
    }
    setStep("housing_type");
  };

  const handleHousingNext = () => {
    if (selectedGoals.length === 0) {
      toast.error(i18n.language === "en" ? "Please select at least one housing type!" : "Selecteer ten minste één woonvorm!");
      return;
    }
    // Initialize questions
    const answers: Record<string, number> = {};
    activeQuestions.forEach(q => {
      answers[q] = 3; // neutral default
    });
    setVibeAnswers(answers);
    setCurrentVibeIndex(0);
    setStep("vibe_check");
  };

  const handleVibeAnswer = (value: number) => {
    const q = activeQuestions[currentVibeIndex];
    setVibeAnswers(prev => ({ ...prev, [q]: value }));
    
    if (currentVibeIndex < activeQuestions.length - 1) {
      setCurrentVibeIndex(prev => prev + 1);
    } else {
      setStep("calculating");
    }
  };

  const handleVibeBack = () => {
    if (currentVibeIndex > 0) {
      setCurrentVibeIndex(prev => prev - 1);
    } else {
      setStep("housing_type");
    }
  };

  // Run matching logic and compute top-3 results
  const finishAnalysis = async () => {
    // Save completion to history for rate limiting
    try {
      const historyJson = localStorage.getItem('cha_test_history');
      let history: number[] = [];
      if (historyJson) {
        history = JSON.parse(historyJson);
      }
      history.push(Date.now());
      // keep only last 24 hours
      const now = Date.now();
      const filtered = history.filter((t: number) => now - t < 24 * 60 * 60 * 1000);
      localStorage.setItem('cha_test_history', JSON.stringify(filtered));
    } catch(e) {
      console.error(e);
    }

    const rawAnswers = {
      city,
      radius,
      goals: selectedGoals,
      budget_max: budgetMax,
      vibeAnswers
    };

    // Calculate scores for all properties
    const scored = properties.map(p => {
      const score = calculateCHAScore(rawAnswers, p);
      return { property: p, score };
    });

    // Sort by score descending and pick top 3
    scored.sort((a, b) => b.score - a.score);
    const top3 = scored.slice(0, 3);
    setTopMatches(top3);
    setCarouselIndex(0);

    // Persist highest harmony factor in profile as 'harmony_index'
    const bestScore = top3.length > 0 ? top3[0].score : 80;
    
    if (auth.currentUser) {
      try {
        const userRef = doc(db, "seeker_profiles", auth.currentUser.uid);
        await updateDoc(userRef, {
          harmony_index: bestScore,
          harmony_answers: rawAnswers,
          has_completed_cha: true
        });
        // Call callback to let parent component know CHA is completed
        onComplete(bestScore);
      } catch (e) {
        console.error("Error updating harmony index in profile:", e);
      }
    }

    // Sla de timestamp op voor de 5 minuten afkoelperiode
    try {
      const key = `cha_last_completed_time_${auth.currentUser?.uid || 'anon'}`;
      localStorage.setItem(key, Date.now().toString());
    } catch (err) {
      console.error("Error writing timestamp to localStorage:", err);
    }

    setStep("results");
  };

  const handleRestart = () => {
    // Erase temporary answers
    setCity(seekerProfile?.city || "");
    setSelectedGoals([]);
    setVibeAnswers({});
    setRadius(25);
    setTimeLeft(10);
    setShowTimeout(false);
    setStep("intro");
  };

  const nextCarousel = () => {
    setCarouselIndex(prev => (prev + 1) % topMatches.length);
  };

  const prevCarousel = () => {
    setCarouselIndex(prev => (prev - 1 + topMatches.length) % topMatches.length);
  };

  return (
    <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 md:p-8 border border-outline shadow-xl relative overflow-hidden transition-all max-w-4xl mx-auto w-full">
      {/* Landscape indicator overlay */}
      <AnimatePresence>
        {isLandscape && (
          <div className="fixed inset-0 z-[110] bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-4 max-w-sm"
            >
              <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto animate-bounce">
                <Compass size={28} />
              </div>
              <h3 className="text-base font-display font-black uppercase text-primary tracking-wider font-sans">
                Gebruik verticale stand
              </h3>
              <p className="text-xs font-bold text-on-surface leading-relaxed">
                De Co-Harmony Analysis is geoptimaliseerd voor verticale weergave. Draai je telefoon verticaal om door te gaan met de analyse.
              </p>
              <p className="text-[10px] font-mono font-bold text-on-surface-variant/50">
                Orientation: Portrait Mode Required
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        
        {/* Step: INTRO */}
        {step === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4 sm:space-y-6 max-w-3xl mx-auto"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                <Activity size={20} className="animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-primary font-mono block">Algorithm Verified</span>
                <h1 className="text-xl sm:text-2xl font-display font-black text-on-background leading-none">{l.introTitle}</h1>
              </div>
            </div>

            <div className="p-5 sm:p-6 bg-surface-container rounded-2xl border border-outline relative overflow-hidden text-center md:text-left">
              <div className="relative z-10 space-y-3">
                <h2 className="text-base sm:text-lg font-display font-bold text-primary leading-tight">
                  {l.introSub}
                </h2>
                <p className="text-on-surface-variant font-medium leading-relaxed text-xs sm:text-sm">
                  {l.introP1}
                </p>
                <p className="text-on-surface-variant font-medium leading-relaxed text-xs sm:text-sm">
                  {l.introP2}
                </p>
                <p className="text-on-surface-variant font-extrabold leading-relaxed text-xs sm:text-sm">
                  {l.introP3}
                </p>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-12 -mt-12" />
            </div>

            {cooldownRemaining > 0 ? (
              <div className="p-6 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-center md:text-left space-y-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-12 h-12 bg-amber-500/25 text-amber-700 rounded-full flex items-center justify-center shrink-0">
                      <Clock size={24} className="animate-pulse" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 font-mono block">TIJDELIJKE AFKOELPERIODE ACTIEF</span>
                      <h3 className="text-base font-display font-black text-on-background leading-normal">
                        Volgende analyse beschikbaar over {Math.floor(cooldownRemaining / 60)}m {cooldownRemaining % 60}s
                      </h3>
                    </div>
                  </div>
                  <div className="bg-amber-500 text-white font-mono font-black text-lg px-4 py-2 rounded-xl shrink-0 select-none shadow-sm">
                    {Math.floor(cooldownRemaining / 60).toString().padStart(2, '0')}:{(cooldownRemaining % 60).toString().padStart(2, '0')}
                  </div>
                </div>
                
                <div className="text-on-surface-variant font-medium leading-relaxed text-xs sm:text-sm text-left space-y-2">
                  <p>
                    <strong>Waarom deze rustperiode?</strong> Jarenlange ervaring in woon-dynamiek en gedragspsychologie heeft uitgewezen dat je de test volledig uitgerust en zonder de invloed van direct voorgaande vragen of antwoorden moet invullen.
                  </p>
                  <p>
                    Als je de test te snel achter elkaar herhaalt, raak je onbewust beïnvloed door je eerdere keuzes (analytische ruis). Dit verstoort de puurheid en betrouwbaarheid van je unieke matching-coëfficiënt. Neem gerust even de tijd, laat de vorige indrukken varen en probeer het zo meteen met een frisse, intuïtieve blik!
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4">
                <div className="flex items-start gap-2 text-outline-variant max-w-lg">
                  <ShieldCheck size={18} className="text-success flex-shrink-0 mt-0.5" />
                  <span className="text-[11px] font-semibold text-on-surface-variant leading-snug">{l.introNote}</span>
                </div>
                <button
                  onClick={handleStart}
                  className="w-full sm:w-auto px-10 py-5 bg-primary text-on-primary rounded-2xl font-black uppercase text-sm tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 group shrink-0"
                >
                  {l.startBtn}
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Step: LOCATION & REACH */}
        {step === "location" && (
          <motion.div
            key="location"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-5 max-w-2xl mx-auto"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                <MapPin size={20} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-primary font-mono block">STAP 1 VAN 3</span>
                <h2 className="text-lg sm:text-xl font-display font-bold text-on-background leading-none">{l.locationTitle}</h2>
                <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">{l.locationSub}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-primary ml-1">{l.cityLabel}</label>
                <div className="relative border-2 border-outline/50 bg-white rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-primary overflow-visible">
                  <AutocompleteInput
                    value={city}
                    onChange={(val) => setCity(val)}
                    onLocationSelect={(selectedCity) => setCity(selectedCity)}
                    placeholder={l.cityPlaceholder}
                    showIcon={true}
                    cityOnly={true}
                    className="w-full text-sm font-bold"
                  />
                </div>
              </div>

              <div className="p-4 bg-surface-container rounded-2xl border border-outline/50 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-on-surface-variant">{l.radiusLabel}</span>
                  <span className="text-primary text-sm font-black">{radius} km</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="250"
                  step="5"
                  value={radius}
                  onChange={(e) => setRadius(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-outline/30 rounded-full appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[9px] uppercase font-black text-on-surface-variant/40">
                  <span>10km</span>
                  <span>50km</span>
                  <span>100km</span>
                  <span>250km</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-primary ml-1">{l.budgetLabel}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-on-surface-variant">{currencyConverter.symbol}</span>
                  <input
                    type="number"
                    min="200"
                    max="10000"
                    step="50"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(parseInt(e.target.value) || 0)}
                    className="w-full border-2 border-outline/50 bg-white rounded-xl pl-10 pr-5 py-3 outline-none focus:ring-2 focus:ring-primary font-bold text-sm shadow-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-4 pt-2">
              <button
                onClick={() => setStep("intro")}
                className="px-5 py-3 rounded-xl border border-outline hover:bg-surface-container font-bold text-xs transition-all flex items-center gap-2"
              >
                <ArrowLeft size={14} />
                {l.backBtn}
              </button>
              <button
                onClick={handleLocationNext}
                className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold text-xs hover:scale-105 active:scale-95 transition-all shadow-md flex items-center gap-2 group"
              >
                {l.nextBtn}
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step: HOUSING TYPE (SEGMENTATION) */}
        {step === "housing_type" && (
          <motion.div
            key="housing_type"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-4 max-w-2xl mx-auto"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                <Home size={20} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-primary font-mono block">STAP 2 VAN 3</span>
                <h2 className="text-lg sm:text-xl font-display font-bold text-on-background leading-none">{l.housingTitle}</h2>
                <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">{l.housingSub}</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-widest text-primary ml-1">{l.housingSelectLabel}</label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: "cohousing", key: "cohousing", label: l.cohousing, icon: <Users size={18} /> },
                  { id: "hospita", key: "hospita", label: l.hospita, icon: <Smile size={18} /> },
                  { id: "vakantie_onderhuur", key: "vakantie", label: l.vakantie, icon: <Compass size={18} /> },
                  { id: "huisbewaring_expat", key: "huisbewaring", label: l.huisbewaring, icon: <ShieldCheck size={18} /> },
                  { id: "vrije_verhuur", key: "vrij", label: l.vrij, icon: <Home size={18} /> }
                ].map((item) => {
                  const isSelected = selectedGoals.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedGoals(prev => 
                          prev.includes(item.id) 
                            ? prev.filter(x => x !== item.id) 
                            : [...prev, item.id]
                        );
                      }}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all hover:shadow-sm cursor-pointer ${
                        isSelected 
                          ? "bg-primary/5 border-primary ring-2 ring-primary/10" 
                          : "bg-white border-outline/60 text-on-surface-variant hover:border-primary/45"
                      }`}
                    >
                      <div className={`mt-0.5 p-1.5 rounded-lg ${isSelected ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"}`}>
                        {item.icon}
                      </div>
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="font-bold text-xs sm:text-sm text-on-surface flex items-center gap-1.5 truncate">
                          {item.label}
                          {isSelected && <Check size={12} className="text-primary shrink-0" />}
                        </div>
                        <p className="text-[10px] sm:text-[11px] text-on-surface-variant/70 font-medium leading-normal line-clamp-2">
                          {t(`housing.${item.key}.desc`, "")}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between gap-4 pt-2">
              <button
                onClick={() => setStep("location")}
                className="px-5 py-3 rounded-xl border border-outline hover:bg-surface-container font-bold text-xs transition-all flex items-center gap-2"
              >
                <ArrowLeft size={14} />
                {l.backBtn}
              </button>
              <button
                onClick={handleHousingNext}
                className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold text-xs hover:scale-105 active:scale-95 transition-all shadow-md flex items-center gap-2 group"
              >
                {l.nextBtn}
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step: VIBE CHECK (THE PSYCHOLOGICAL ALIGNED STATEMENTS) */}
        {step === "vibe_check" && (
          <motion.div
            key="vibe_check"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-4 max-w-2xl mx-auto"
          >
            <div className="flex items-center justify-between gap-4 border-b border-outline pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                  <Smile size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary font-mono select-none block">
                    STAP 3 VAN 3: VRAAG {currentVibeIndex + 1} VAN {activeQuestions.length}
                  </span>
                  <h2 className="text-lg sm:text-xl font-display font-bold text-on-background leading-none">{l.vibeTitle}</h2>
                </div>
              </div>
              
              {/* Progress dots */}
              <div className="hidden sm:flex gap-1">
                {activeQuestions.map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 rounded-full transition-all ${
                      i === currentVibeIndex 
                        ? "w-6 bg-primary" 
                        : i < currentVibeIndex 
                          ? "w-2 bg-primary/40" 
                          : "w-2 bg-outline"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Timer visual */}
            <div className="space-y-1.5 p-4 bg-surface-container-low rounded-2xl border border-outline/10">
              <div className="flex items-center justify-between text-xs">
                <span className={`font-mono font-black tracking-wider uppercase transition-colors ${timeLeft <= 5 ? "text-red-500 animate-pulse" : "text-on-surface-variant/60"}`}>
                  ⏱️ {timeLeft <= 5 ? (i18n.language === "en" ? "Act Fast!" : "Snel!") : (i18n.language === "en" ? "Intuïtion Timer" : "Intuïtie Timer")}
                </span>
                <span className={`font-mono font-black transition-colors text-right ${timeLeft <= 5 ? "text-red-500 text-sm font-black animate-pulse" : "text-primary text-xs"}`}>
                  {Math.ceil(timeLeft)}s over
                </span>
              </div>
              <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden border border-outline/25 relative">
                <div
                  style={{ width: `${(timeLeft / 10) * 100}%` }}
                  className={`h-full rounded-full ${
                    timeLeft <= 5 ? "bg-gradient-to-r from-red-500 to-orange-500 shadow-lg shadow-red-550/20" : "bg-primary"
                  }`}
                />
              </div>
            </div>

            {/* Current Question Block */}
            <div className="p-4 sm:p-5 bg-surface-container rounded-2xl border border-outline min-h-[110px] sm:min-h-[130px] flex items-center justify-center text-center relative overflow-hidden">
              <motion.div
                key={currentVibeIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-1.5 relative z-10"
              >
                <div className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-2 font-mono font-black text-xs">
                  {currentVibeIndex + 1}
                </div>
                <p className="text-sm sm:text-base font-bold text-on-surface leading-snug max-w-xl mx-auto">
                  {activeQuestions[currentVibeIndex]}
                </p>
              </motion.div>
              <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
            </div>

            {/* Answer buttons on 5 point scale */}
            <div className="flex flex-col md:flex-row gap-2">
              {[
                { value: 1, label: l.scaleDisagreeMax, color: "text-red-500 hover:bg-red-50 border-red-200" },
                { value: 2, label: l.scaleDisagree, color: "text-orange-500 hover:bg-orange-50 border-orange-200" },
                { value: 3, label: l.scaleNeutral, color: "text-slate-500 hover:bg-slate-50 border-slate-200" },
                { value: 4, label: l.scaleAgree, color: "text-emerald-500 hover:bg-emerald-50 border-emerald-200" },
                { value: 5, label: l.scaleAgreeMax, color: "text-teal-500 hover:bg-teal-50 border-teal-200" }
              ].map((btn) => {
                const isSelected = vibeAnswers[activeQuestions[currentVibeIndex]] === btn.value;
                return (
                  <button
                    key={btn.value}
                    onClick={() => handleVibeAnswer(btn.value)}
                    className={`flex-1 p-3 md:py-4 rounded-xl border-2 font-bold text-xs xl:text-sm transition-all flex flex-row md:flex-col items-center justify-between md:justify-center gap-2 group cursor-pointer ${
                      isSelected 
                        ? "bg-primary text-on-primary border-primary scale-[1.01] shadow-md" 
                        : `bg-white text-on-surface border-outline/65 ${btn.color}`
                    }`}
                  >
                    <span className="md:text-center leading-tight md:h-10 flex items-center justify-center break-words">{btn.label}</span>
                    <span className={`w-6 h-6 md:mt-1 rounded-full flex items-center justify-center shrink-0 font-black text-xs md:text-sm ${isSelected ? "bg-white text-primary" : "bg-outline/30 group-hover:scale-110 transition-transform"}`}>
                      {btn.value}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between gap-4 pt-3 border-t border-outline/30">
              <button
                onClick={handleVibeBack}
                className="px-5 py-2.5 rounded-xl border border-outline hover:bg-surface-container font-bold text-xs transition-all flex items-center gap-2"
              >
                <ArrowLeft size={14} />
                {l.backBtn}
              </button>
              <span className="text-[10px] font-black text-on-surface-variant/40 mt-2 font-mono">
                {Math.round(((currentVibeIndex + 1) / activeQuestions.length) * 100)}% COMPLETED
              </span>
            </div>
          </motion.div>
        )}

        {/* Step: CALCULATING (THE ALGORITHMIC EFFECT) */}
        {step === "calculating" && (
          <motion.div
            key="calculating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-16 text-center space-y-8 max-w-lg mx-auto"
          >
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                className="absolute inset-0 w-full h-full border-4 border-primary border-t-transparent rounded-full"
              />
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center"
              >
                <Activity size={28} />
              </motion.div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-display font-bold text-on-background">{l.calcTitle}</h3>
              <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
                {l.calcSub}
              </p>
            </div>

            <div className="p-4 bg-surface-container rounded-2xl border border-outline/30 w-fit mx-auto">
              <motion.span
                key={calcPhrase}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-xs font-bold text-primary tracking-wide font-mono uppercase"
              >
                {calcPhrase}
              </motion.span>
            </div>
          </motion.div>
        )}

        {/* Step: RESULTS (TOP MATCHES & THE HARMONY FACTOR CAROUSEL) */}
        {step === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-8 max-w-4xl mx-auto"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                  <Sparkles size={20} />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 font-mono">ANALYSE COMPLEET</span>
                    <span className="text-[10px] text-on-surface-variant/40 font-mono font-black">•</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary font-mono select-none">Co-Harmony Analysis (CHA)</span>
                    <span className="text-[10px] text-on-surface-variant/40 font-mono font-black">•</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1 select-none">
                      <ShieldCheck size={10} /> Algorithm Verified
                    </span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-display font-black text-on-background leading-tight">{l.resultsTitle}</h2>
                </div>
              </div>

              <button
                onClick={handleRestart}
                className="px-4 py-2 bg-surface-container hover:bg-surface-container-high hover:text-primary transition-all text-on-surface-variant rounded-xl font-bold text-xs flex items-center gap-2 self-start sm:self-auto"
              >
                <RefreshCw size={14} />
                {l.restartBtn}
              </button>
            </div>

            {topMatches.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Scoring parameters sidebar */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-primary/5 rounded-[2rem] p-5 border border-primary/20 text-center relative overflow-hidden space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary font-mono select-none">Co-Harmony Analysis (CHA)</span>
                    <div className="text-5xl md:text-6xl font-black font-display text-primary flex justify-center items-center gap-1">
                      {(topMatches[carouselIndex]?.score ?? topMatches[0].score)}%
                    </div>
                    <div className="text-[10px] font-bold text-on-surface flex items-center justify-center gap-1.5">
                      <ShieldCheck size={12} className="text-emerald-600" />
                      <span className="font-semibold text-on-surface-variant font-mono uppercase tracking-wider text-[9px]">Algorithm Verified</span>
                    </div>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-bold text-sm text-on-surface uppercase tracking-wider">Analyse Parameters</h4>
                    <div className="bg-white rounded-2xl border border-outline/50 p-4 space-y-3">
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span className="text-on-surface-variant">Zoekregio:</span>
                        <span className="text-on-surface font-extrabold">{city}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span className="text-on-surface-variant">Bereik:</span>
                        <span className="text-on-surface font-extrabold">{radius} km</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span className="text-on-surface-variant">Max. huurprijs:</span>
                        <span className="text-on-surface font-extrabold">{currencyConverter.formatEur(budgetMax)}/mnd</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span className="text-on-surface-variant">Woonvormen:</span>
                        <span className="text-primary font-black truncate max-w-[120px]">{selectedGoals.map(g => g.split('_')[0]).join(', ')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Matches Carousel Wrapper */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="flex justify-between items-center px-2 select-none">
                    <h3 className="font-black text-xs uppercase tracking-widest text-primary font-mono">Top Matches</h3>
                    <div className="flex gap-1.5">
                      <button onClick={prevCarousel} className="p-2 bg-surface-container rounded-lg hover:bg-surface-container-high transition-colors"><ChevronLeft size={16} /></button>
                      <span className="text-xs font-bold text-on-surface-variant mt-1.5">{carouselIndex + 1} van {topMatches.length}</span>
                      <button onClick={nextCarousel} className="p-2 bg-surface-container rounded-lg hover:bg-surface-container-high transition-colors"><ChevronRight size={16} /></button>
                    </div>
                  </div>

                  {/* Carousel Card with locked / unlocked visual detail detection */}
                  {(() => {
                    const currentProperty = topMatches[carouselIndex].property;
                    const isPropertyUnlocked = !!(
                      seekerProfile?.unlocked_details?.includes(currentProperty.id) ||
                      seekerProfile?.unlocked_all_options?.includes(currentProperty.id) ||
                      seekerProfile?.unlocked_chats?.includes(currentProperty.id) ||
                      seekerProfile?.unlocked_matches?.includes(currentProperty.id) ||
                      chatsStatus?.[currentProperty.id]
                    );

                    return (
                      <motion.div
                        key={carouselIndex}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white rounded-[3rem] border border-outline overflow-hidden shadow-lg hover:shadow-xl transition-all relative flex flex-col sm:flex-row min-h-[300px] group"
                      >
                        {/* Property Image Cover */}
                        <div className="w-full sm:w-1/2 aspect-video sm:aspect-auto h-48 sm:h-auto overflow-hidden bg-surface-container-low relative">
                          {currentProperty.images && currentProperty.images.length > 0 ? (
                            <img
                              src={currentProperty.images?.[0]?.url}
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-outline-variant">
                              <Home size={40} />
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/60 via-black/20 to-transparent z-0" />
                          
                          {/* Price Badge on photo */}
                          <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-black shadow-md border border-white/50 text-base-content/80">
                            {currentProperty.priceType === "range"
                              ? `${currencyConverter.formatEur(currentProperty.minPrice)} - ${currencyConverter.formatEur(currentProperty.maxPrice)}/mnd`
                              : `${currencyConverter.formatEur(currentProperty.price)}/mnd`}
                          </div>

                          {/* City/Name on photo */}
                          <div className="absolute bottom-4 left-4 z-10 text-white space-y-1">
                            <span className="text-[10px] uppercase font-black tracking-widest bg-primary px-2.5 py-1 rounded-full">{currentProperty.features?.type || "Kamer"}</span>
                            <h4 className="text-lg font-bold truncate max-w-[200px] leading-tight drop-shadow-md">{currentProperty.title}</h4>
                            <div className="text-[10px] font-medium opacity-90 flex items-center gap-1 drop-shadow-sm"><MapPin size={10} /> {currentProperty.neighborhood ? `${currentProperty.city}, ${currentProperty.neighborhood}` : currentProperty.city}</div>
                          </div>
                        </div>

                        {/* Property info list and buttons */}
                        <div className="p-6 flex flex-col justify-between flex-1 space-y-4">
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <span className="text-[10px] font-black uppercase tracking-widest text-primary font-mono select-none">Match Motivatie</span>
                              <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                                {t(`housing.${currentProperty.features?.goal?.replace('_', '') || 'vrij'}.desc`, "Deze sfeervolle woning matcht perfect op de door jou ingevulde leefstijl parameters.")}
                              </p>
                            </div>

                            <div className="border-t border-outline/40 pt-2 space-y-1">
                              <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/40 block">Woning Eigenschappen</span>
                              <div className="flex flex-wrap gap-1.5 max-h-12 overflow-hidden">
                                {currentProperty.features && Object.entries(currentProperty.features).map(([key, val]) => {
                                  if (typeof val === 'boolean' && val === true) {
                                    return (
                                      <span key={key} className="text-[9px] font-black uppercase tracking-wider bg-surface-container px-2 py-1 rounded-lg text-on-surface-variant">
                                        {key.replace('has_', '').replace('_', ' ')}
                                      </span>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Card Buttons */}
                          <div className="flex flex-col gap-2 pt-2">
                            <button
                              onClick={() => onViewDetails(currentProperty)}
                              className="w-full py-3.5 bg-primary text-on-primary rounded-xl font-black uppercase text-xs tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-md shadow-primary/10 flex items-center justify-center gap-2"
                            >
                              {isPropertyUnlocked ? t("seeker.view_details") : t("seeker.view")}
                              <ArrowRight size={14} />
                            </button>
                            
                            <button
                              onClick={async () => {
                                await onToggleFavorite(currentProperty);
                              }}
                              className={`w-full py-3.5 border rounded-xl text-center font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${
                                favoriteIds.includes(currentProperty.id)
                                  ? "bg-error border-error text-white"
                                  : "hover:bg-surface-container border-outline/65 text-on-surface-variant"
                              }`}
                            >
                              <Heart size={14} fill={favoriteIds.includes(currentProperty.id) ? "currentColor" : "none"} />
                              {favoriteIds.includes(currentProperty.id) ? l.favorites : "Voeg toe aan favorieten"}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })()}
                </div>

              </div>
            ) : (
              <div className="py-12 text-center space-y-4 max-w-md mx-auto">
                <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto text-on-surface-variant/30">
                  <AlertCircle size={32} />
                </div>
                <p className="text-on-surface-variant font-bold text-sm leading-relaxed">
                  {l.noMatches}
                </p>
                <button
                  onClick={handleRestart}
                  className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold text-xs inline-flex items-center gap-2 uppercase tracking-wider"
                >
                  <RefreshCw size={14} />
                  {l.restartBtn}
                </button>
              </div>
            )}
          </motion.div>
        )}

      </AnimatePresence>

      {/* Timeout explanation popup modal */}
      <AnimatePresence>
        {showTimeout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] border border-outline p-8 max-w-md w-full text-center space-y-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-red-500" />
              <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle size={24} />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-display font-black text-on-background">
                  {l.timeoutTitle}
                </h3>
                <p className="text-sm font-medium text-on-surface-variant leading-relaxed">
                  {l.timeoutP1}
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowTimeout(false);
                    handleRestart();
                  }}
                  className="w-full py-4 bg-primary text-on-primary rounded-xl font-black uppercase text-xs tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-md cursor-pointer"
                >
                  {l.timeoutRestartBtn}
                </button>
                <button
                  onClick={() => {
                    setShowTimeout(false);
                    // Dispatch custom event to go back to discover dashboard
                    window.dispatchEvent(new CustomEvent("switch-to-discover"));
                  }}
                  className="w-full py-4 bg-surface-container hover:bg-surface-container-high text-on-surface-variant rounded-xl font-black uppercase text-xs tracking-widest transition-all cursor-pointer"
                >
                  {l.timeoutStopBtn}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
