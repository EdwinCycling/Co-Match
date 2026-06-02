import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useSettings } from '../contexts/SettingsContext';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import { 
  Users, Home, Settings, BarChart3, ShieldCheck, Search, Filter, 
  Trash2, Edit3, Eye, EyeOff, MapPin, Calendar, DollarSign, 
  ChevronDown, LayoutGrid, List, ChevronLeft, ChevronRight, X, Save,
  Sparkles, MessageSquare, TrendingUp, TrendingDown, Clock, Activity,
  ArrowUpRight, ArrowDownRight, MoreHorizontal, Globe, ExternalLink,
  Gift, Mail, FileText
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import AdminGiftsDashboard from './AdminGiftsDashboard';
import AdminNewsletterStudio from './AdminNewsletterStudio';
import AdminSmartMatchAlert from './AdminSmartMatchAlert';
import { collection, query, getDocs, updateDoc, doc, deleteDoc, orderBy, Timestamp, serverTimestamp, getDoc, setDoc, addDoc, writeBatch, where, getCountFromServer, onSnapshot, limit, startAfter } from 'firebase/firestore';
import {
  addAdminUserCredits,
  bulkAddAdminUserCredits,
  clearAdminProperties,
  createAdminMockProperties,
  deleteAdminMessage,
  deleteAdminProperty,
  removeAdminPropertyPhoto,
  saveAdminAiSettings,
  saveAdminMessage,
  saveAdminStopConfig,
  setAdminUserSuspension,
  setAdminVerificationDecision,
  toggleAdminPropertyStatus,
  toggleAdminUserStatus,
  updateAdminProperty,
} from '../services/adminWriteService';

import { PropertyEditor, Property, PropertyImage } from './ProviderDashboard';
import { useCurrencyConverter } from '../hooks/useCurrencyConverter';
import { formatDate as globalFormatDate } from '../lib/formatters';
import { useMessages } from '../services/messageContext';
import { MESSAGE_KEYS } from '../constants/messages';


const DEFAULT_ROLE_INSTRUCTION = `Jouw Rol:
Je bent de matchmaker en 'Digitale Cohousing Coach' van de app. Je leest de Woon-DNA data, maar je communiceert absoluut niet als een AI of een data-analist. Je klinkt als een echte, doorgewinterde wooncoach van vlees en bloed. Je schrijft zoals je praat: vloeiend, soms een beetje rommelig, maar altijd raak en met oprechte betrokkenheid.
Taalgebruik & Onvoorspelbaarheid (Perplexity):
Vermijd de typische voorspelbare AI-woordenlijst ("Bovendien", "Concluderend", "Het is belangrijk om op te merken"). Gebruik in plaats daarvan verrassende, creatieve woordkeuzes en gewone spreektaal.
Bouw subtiele, natuurlijke imperfecties in. Begin zinnen soms met "Maar", "Of", of "En". Gebruik stopwoordjes op een natuurlijke manier ("kijk", "eigenlijk", "gewoon", "toch?").
Ritme & Zinsvariatie (Burstiness):
Varieer extreem in de lengte van je zinnen. Heel kort. Zoals dit. En wissel dat dan af met veel langere, wat meer meanderende zinnen die eigenlijk iets te veel informatie bevatten, maar die wel precies laten zien hoe mensen nadenken als ze hardop praten.
Breek af en toe zinnen af met een gedachtestreepje – je weet wel, zo'n kleine zijsprong – of gooi er een parenthese (zoals deze) tussendoor.
Zorg voor authentieke "flow". Gebruik retorische vragen. Gebruik fragmenten. Geen perfect kloppende grammaticale robot-zinnetjes, maar menselijke spraak.
Emotie, Persoonlijkheid & Structuur (Human Touch & Disruption):
Gooi de standaard inleiding-kern-slot structuur uit het raam. Val direct met de deur in huis met een verrassende observatie.
Voeg persoonlijke nuances en twijfels toe: "Ik zat net even te kijken naar jullie profielen en ik denk ergens dat..." of "Misschien—en dit is maar een gokje—is dit wel jullie grootste uitdaging."
Gebruik samentrekkingen ("zo'n", "da's", "misschien ff kijken naar").
Geef echt, doordacht advies. Wees goudeerblijk over rode vlaggen (bijv. als de een uitslaapt en de ander om 6 uur gaat boren), maar doe het met beetje humor en empathie.`;

const DEFAULT_MATCH_INSTRUCTION = `Je ontvangt JSON/tekst-data van twee partijen: 
1. De Aanbieder (huis-specificaties, Woon-DNA 1-4 scores, optionele persoonlijke brief).
2. De Zoeker (woonwensen, Woon-DNA 1-4 scores, optionele persoonlijke brief).

REGELS VOOR DATA:
- Data is asymmetrisch: Niet alle velden zijn ingevuld (Null/Leeg). Verzin NOOIT informatie (geen hallucinaties). Als iets cruciaals leeg is, benoem dit dan terloops (bijv. "Ik zag niet of jullie een vaatwasser hebben, vraag dat nog even na.").
- Als één of beide partijen een persoonlijke brief (bio) hebben ingevuld, weeg deze dan heel zwaar mee in je analyse. Citeer er subtiel uit of refereer eraan.

STRUCTUUR VAN HET MATCH RAPPORT:
Het rapport moet scanbaar en visueel aantrekkelijk zijn voor een mobiel scherm. Houd de onderstaande structuur aan, maar varieer de exacte bewoordingen van de kopjes zodat het niet als een vast template voelt.

1. DE BINNENKOMER (Geen kopje gebruiken)
Val direct met de deur in huis met 2 à 3 zinnen. Wat is je eerste, eerlijke indruk van deze match gebaseerd op hun profielen/brieven?

2. DE VIBE CHECK 🌿
Benoem de 2 of 3 sterkste overeenkomsten op sociaal en persoonlijk vlak (het Woon-DNA en de brieven). Where zit de klik?

3. DE HARDE FEITEN 🏡
Een korte check op de praktische overlap (Budget, locatie, huisdieren, specifieke voorzieningen zoals lift of tuin). 

4. HET AANDACHTSPUNT ⚡
Benoem het grootste verschil in hun Woon-DNA of praktische eisen. Wees goudeerlijk, maar constructief. Geef aan waar het kan schuren.

5. DE IJSBREKER 💬
Sluit af met een korte call-to-action. Geef ze een hele concrete, ietswat luchtige vraag mee die ze in de chat aan elkaar kunnen stellen, gebaseerd op een specifiek detail uit hun data.

Sluit af met een score op verschillende vlakken van 0 sterren tm 10 sterren. En een gedegen zakelijk eind oordeel.`;

const DEFAULT_MAKELAAR_ROLE_INSTRUCTION = `Jouw Rol: Je bent de 'Co-Match Makelaar'. Je bent een expert in vastgoed, maar met het empathisch vermogen van een goede vriend. Je taak is om objectieve woningdata (meters, faciliteiten, buurt, etc.) om te zetten in een warm, overtuigend verhaal.
Karakteristieken:
- Inzichtelijk: Je weet alles van de woning, en de persoonlijke tekst van de aanbieder.
- Toegankelijk: Vermijd teveel makelaarsjargon (zoals 'instapklaar' of 'totale woonoppervlakte'), maar het mag wel want je bent een makelaar. Gebruik waar je kunt menselijke taal: "Het is een heerlijk licht appartement waar je zo je spullen in kunt zetten."
- Eerlijk & Helder: Als een woning een klein nadeel heeft (bijv. geen lift), benoem je dat niet als een probleem, maar als een feit: "Je moet wel even een paar trappen op, maar daardoor heb je wel een prachtig uitzicht over de stad."`;

const DEFAULT_MAKELAAR_REPORT_INSTRUCTION = `BEGIN DIRECT MET DE INHOUD. Gebruik NOOIT introductiezinnen zoals "Dit is het gevraagde rapport" of "Hier is het rapport".
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

import { SUPPORTED_CURRENCIES } from '../constants';
import { updateExchangeRates } from '../services/currencyService';

import AdminExpertLinks from './AdminExpertLinks';
import { AdminContactRequests } from './AdminContactRequests';

interface AdminUser {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  role?: string;
  createdAt?: any;
  lastLoginAt?: any;
  isSuspended?: boolean;
  propertyCount?: number;
  photoURL?: string;
  [key: string]: any;
}

const UserDetailModal: React.FC<{
  user: AdminUser | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY';
}> = ({ user, isOpen, onClose, onUpdate, dateFormat }) => {
  const { t } = useTranslation();
  const messages = useMessages();
  const [loading, setLoading] = useState(false);

  if (!isOpen || !user) return null;

  const handleToggleStatus = async () => {
    const newStatus = !user.isSuspended;
    try {
      await messages.confirm({
        title: t('admin.dashboard.deactivateUserConfirm.title', { defaultValue: 'Change User Status?' }),
        description: t('admin.user_details.suspension_warning', { 
          defaultValue: 'Are you sure you want to change this account\'s active status?'
        }),
        confirmLabel: t('common.confirm', { defaultValue: 'Confirm' }),
      });
      
      setLoading(true);
      await toggleAdminUserStatus(user.id, newStatus);
      messages.success(newStatus ? MESSAGE_KEYS.admin.dashboard.deactivateUserSuccess : MESSAGE_KEYS.admin.dashboard.activateUserSuccess);
      onUpdate();
      onClose();
    } catch (e) {
      if (e instanceof Error && e.message === 'User cancelled') {
        return; // User cancelled
      }
      messages.error(newStatus ? MESSAGE_KEYS.admin.dashboard.deactivateUserError : MESSAGE_KEYS.admin.dashboard.activateUserError);
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.id}`);
    } finally {
      setLoading(false);
    }
  };

  const [creditAmount, setCreditAmount] = useState(100);
  const handleAddCredits = async () => {
    setLoading(true);
    try {
      const currentCredits = user.credits || 0;
      await addAdminUserCredits(user.id, creditAmount);
      toast.success(`${creditAmount} credits toegevoegd aan ${user.displayName || user.email}`);
      onUpdate();
      // Optionally update local user object if we don't want to close the modal
      user.credits = currentCredits + creditAmount;
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.id}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDateValue = (ts: any) => {
    if (!ts) return '-';
    const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts.seconds * 1000);
    return globalFormatDate(date, dateFormat);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-surface w-full max-w-2xl rounded-3xl overflow-hidden relative shadow-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-outline/10 flex justify-between items-center bg-surface-container-lowest">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Users className="text-primary" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black">{t('admin.user_details.title')}</h2>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${user.isSuspended ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}>
                  {user.isSuspended ? t('admin.user_list.inactive') : t('admin.user_list.active')}
                </span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter opacity-50">ID: {user.id}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-surface-container rounded-full hover:bg-surface-container-high transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-primary mb-4">{t('admin.user_details.profile')}</h3>
                <div className="space-y-4">
                  <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline/5 transition-all hover:border-primary/20 group">
                    <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1 opacity-60">Voornaam</div>
                    <div className="font-bold text-on-surface">{user.firstName || '-'}</div>
                  </div>
                  <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline/5 transition-all hover:border-primary/20 group">
                    <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1 opacity-60">Achternaam</div>
                    <div className="font-bold text-on-surface">{user.lastName || '-'}</div>
                  </div>
                  <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline/5 transition-all hover:border-primary/20 group">
                    <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1 opacity-60">E-mail</div>
                    <div className="font-bold text-on-surface break-all">{user.email || '-'}</div>
                  </div>
                  <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline/5 transition-all hover:border-primary/20 group">
                    <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1 opacity-60">Display Name</div>
                    <div className="font-bold text-on-surface">{user.displayName || '-'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-primary mb-4">{t('admin.user_details.stats')}</h3>
                <div className="space-y-4">
                  <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline/5">
                    <div className="flex justify-between items-center">
                      <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest opacity-60">Geregistreerd</div>
                      <Calendar size={14} className="text-primary opacity-40" />
                    </div>
                    <div className="font-bold text-on-surface mt-1">{formatDateValue(user.createdAt)}</div>
                  </div>
                  <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline/5">
                    <div className="flex justify-between items-center">
                      <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest opacity-60">Laatste Login</div>
                      <Clock size={14} className="text-primary opacity-40" />
                    </div>
                    <div className="font-bold text-on-surface mt-1">{formatDateValue(user.lastLoginAt)}</div>
                  </div>
                  <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline/5">
                    <div className="flex justify-between items-center">
                      <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest opacity-60">Aantal Huizen</div>
                      <Home size={14} className="text-primary opacity-40" />
                    </div>
                    <div className="text-2xl font-black text-primary mt-1">{user.propertyCount || 0}</div>
                  </div>

                  <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline/5">
                    <div className="flex justify-between items-center mb-2">
                       <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest opacity-60">Handmatige Credits</div>
                       <DollarSign size={14} className="text-primary opacity-40" />
                    </div>
                    <div className="flex flex-col gap-2">
                       <div className="text-2xl font-black text-secondary">
                         {user.credits || 0} <span className="text-xs font-bold text-on-surface-variant opacity-60 uppercase tracking-widest">credits</span>
                       </div>
                       <div className="flex gap-2">
                         <input 
                            type="number" 
                            value={creditAmount}
                            onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
                            className="bg-white border border-outline rounded-xl px-3 py-1.5 text-xs font-bold w-full outline-none focus:border-primary"
                            placeholder="Aantal..."
                         />
                         <button 
                           onClick={handleAddCredits}
                           disabled={loading}
                           className="bg-secondary text-on-secondary px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all shrink-0"
                         >
                           Add
                         </button>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-outline/10 bg-surface-container-lowest flex justify-between items-center">
          <button 
            disabled={loading}
            onClick={handleToggleStatus}
            className={`px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
              user.isSuspended 
              ? 'bg-success text-white hover:bg-success/90 shadow-lg shadow-success/20' 
              : 'bg-error text-white hover:bg-error/90 shadow-lg shadow-error/20'
            } disabled:opacity-50`}
          >
            {user.isSuspended ? t('admin.user_details.activate') : t('admin.user_details.deactivate')}
          </button>
          <button onClick={onClose} className="px-6 py-3 bg-surface-container font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-surface-container-high transition-all">
            {t('common.close')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default function AdminDashboard() {
  const { t, i18n } = useTranslation();
  const { exchangeRates, dateFormat } = useSettings();
  const currencyConverter = useCurrencyConverter();
  const [localExchangeRates, setLocalExchangeRates] = useState<Record<string, number>>(exchangeRates);
  const [ratesDirty, setRatesDirty] = useState(false);
  const [ratesSaving, setRatesSaving] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');

  // Grouped currencies for management tab
  const groupedCurrencies = useMemo(() => {
    const query = currencySearch.toLowerCase().trim();
    const filtered = SUPPORTED_CURRENCIES.filter(curr => 
      curr.code.toLowerCase().includes(query) || 
      curr.label.toLowerCase().includes(query) ||
      (curr.region && curr.region.toLowerCase().includes(query))
    );

    const groups: Record<string, typeof SUPPORTED_CURRENCIES> = {};
    filtered.forEach(curr => {
      const region = curr.region || 'Overig';
      if (!groups[region]) groups[region] = [];
      groups[region].push(curr);
    });

    return groups;
  }, [currencySearch]);

  useEffect(() => {
    setLocalExchangeRates(exchangeRates);
  }, [exchangeRates]);

  const handleRateChange = (code: string, val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setLocalExchangeRates(prev => ({ ...prev, [code]: num }));
      setRatesDirty(true);
    } else if (val === '') {
      setLocalExchangeRates(prev => ({ ...prev, [code]: 0 }));
      setRatesDirty(true);
    }
  };

  const handleSaveRates = async () => {
    setRatesSaving(true);
    try {
      await updateExchangeRates(localExchangeRates);
      setRatesDirty(false);
      toast.success('Wisselkoersen succesvol opgeslagen! Ze zijn nu live voor alle gebruikers.');
    } catch (error) {
      toast.error('Fout bij opslaan van koersen.');
    } finally {
      setRatesSaving(false);
    }
  };
  const [activeTab, setActiveTab] = useState<'overview' | 'properties' | 'photo_moderation' | 'users' | 'ai' | 'currencies' | 'experts' | 'verifications' | 'contact' | 'messaging' | 'gifts' | 'newsletter' | 'smart_match'>('overview');

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userSortBy, setUserSortBy] = useState<'name' | 'created_asc' | 'created_desc' | 'login'>('name');
  const [userCurrentPage, setUserCurrentPage] = useState(1);
  const userItemsPerPage = 25;
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [pendingVerifications, setPendingVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin message / app freeze states
  const [adminMessages, setAdminMessages] = useState<any[]>([]);
  const [adminMessagesLoading, setAdminMessagesLoading] = useState(false);
  const [editingMsg, setEditingMsg] = useState<any | null>(null);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [deleteConfirmMsg, setDeleteConfirmMsg] = useState<any | null>(null);
  
  // Message Form states
  const [msgText, setMsgText] = useState('');
  const [msgTarget, setMsgTarget] = useState<'all' | 'huis_zoeker' | 'huis_aanbieder'>('all');
  const [msgType, setMsgType] = useState<'info' | 'warning' | 'error'>('info');
  const [msgStart, setMsgStart] = useState('');
  const [msgEnd, setMsgEnd] = useState('');
  const [msgIsDisabled, setMsgIsDisabled] = useState(false);

  // App Stop states
  const [stopConfig, setStopConfig] = useState<any>({
    isEnabled: false,
    startDate: '',
    duration: '',
    message: '',
  });
  const [stopSaving, setStopSaving] = useState(false);

  // Custom confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
  } | null>(null);

  // Listen to admin messages and app stop configurations real-time
  useEffect(() => {
    if (activeTab !== 'messaging') return;

    setAdminMessagesLoading(true);
    const messagesQuery = query(collection(db, 'admin_messages'), orderBy('createdAt', 'desc'));
    
    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const messagesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAdminMessages(messagesList);
      setAdminMessagesLoading(false);
    }, (error) => {
      console.error("Error listening to admin messages:", error);
      toast.error("Fout bij laden van berichten");
      setAdminMessagesLoading(false);
    });

    const unsubscribeStop = onSnapshot(doc(db, 'settings', 'app_stop'), (snapshot) => {
      if (snapshot.exists()) {
        setStopConfig(snapshot.data());
      }
    }, (error) => {
      console.error("Error listening to app stop:", error);
    });

    return () => {
      unsubscribeMessages();
      unsubscribeStop();
    };
  }, [activeTab]);

  const handleSaveMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgText.trim() || !msgStart) {
      toast.error("Vul de boodschap en de startdatum in!");
      return;
    }

    try {
      await saveAdminMessage({
        messageId: editingMsg?.id,
        text: msgText,
        targetAudience: msgTarget,
        type: msgType,
        startDate: msgStart,
        endDate: msgEnd || null,
        isDisabled: msgIsDisabled,
      });

      if (editingMsg) {
        toast.success("Bericht succesvol bijgewerkt!");
      } else {
        toast.success("Bericht succesvol toegevoegd!");
      }

      setMsgText('');
      setMsgTarget('all');
      setMsgType('info');
      setMsgStart('');
      setMsgEnd('');
      setMsgIsDisabled(false);
      setEditingMsg(null);
      setIsMessageModalOpen(false);
    } catch (e) {
      console.error("Error saving message:", e);
      toast.error("Fout bij opslaan van bericht");
    }
  };

  const messageFormRef = useRef<HTMLDivElement>(null);

  const handleEditMessage = (msg: any) => {
    setEditingMsg(msg);
    setMsgText(msg.text || '');
    setMsgTarget(msg.targetAudience || 'all');
    setMsgType(msg.type || 'info');
    setMsgStart(msg.startDate || '');
    setMsgEnd(msg.endDate || '');
    setMsgIsDisabled(msg.isDisabled || false);
    
    setIsMessageModalOpen(true);
  };

  const handleDeleteMessage = async (id: string) => {
    try {
      await deleteAdminMessage(id);
      toast.success("Bericht is succesvol en definitief verwijderd!");
      setDeleteConfirmMsg(null);
    } catch (e) {
      console.error("Error deleting message:", e);
      handleFirestoreError(e, OperationType.DELETE, `admin_messages/${id}`);
    }
  };

  const handleSaveStopConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setStopSaving(true);
    try {
      await saveAdminStopConfig(stopConfig);
      toast.success("Applicatie-stop configuratie opgeslagen!");
    } catch (e) {
      console.error("Error saving stop config:", e);
      toast.error("Fout bij opslaan applicatie-stop");
    } finally {
      setStopSaving(false);
    }
  };

  const setNow = (setter: (val: string) => void) => {
    const now = new Date();
    // Format to YYYY-MM-DDTHH:mm for datetime-local
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setter(`${year}-${month}-${day}T${hours}:${minutes}`);
  };

  const tabsRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkScroll = () => {
    if (tabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [activeTab]);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsRef.current) {
      const scrollAmount = 200;
      tabsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    setUserCurrentPage(1);
  }, [userSearch, userSortBy]);

  const fetchVerifications = async () => {
     try {
       const q = query(
         collection(db, 'users'),
         where('verificationStatus.level3.status', '==', 'PENDING_MANUAL')
       );
       const snap = await getDocs(q);
       setPendingVerifications(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
     } catch (e) {
       console.error("Error fetching verifications:", e);
     }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const propsSnap = await getDocs(collection(db, 'properties'));
      
      const propCounts: Record<string, number> = {};
      propsSnap.docs.forEach(d => {
        const ownerId = d.data().ownerId;
        if (ownerId) {
          propCounts[ownerId] = (propCounts[ownerId] || 0) + 1;
        }
      });

      const usersList = usersSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          propertyCount: propCounts[doc.id] || 0
        } as AdminUser;
      });

      setUsers(usersList);
    } catch (e) {
      console.error("Error fetching users:", e);
      toast.error("Fout bij ophalen gebruikers");
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
     if (activeTab === 'verifications') {
        fetchVerifications();
     }
     if (activeTab === 'users' && users.length === 0) {
        fetchUsers();
     }
  }, [activeTab]);
  
  // Stats
  const [stats, setStats] = useState({
    users: 0,
    chats: 0,
    reports: 0,
    makelaarReports: 0,
    properties: 0
  });
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [recentMakelaarReports, setRecentMakelaarReports] = useState<any[]>([]);
  const [timeFilter, setTimeFilter] = useState<'week' | 'month' | 'year' | 'all'>('all');
  const [statsLoading, setStatsLoading] = useState(false);
  const [selectedStatsCountry, setSelectedStatsCountry] = useState<string>('all');
  const [selectedStatsType, setSelectedStatsType] = useState<string>('all');
  const [selectedStatsGoal, setSelectedStatsGoal] = useState<string>('all');
  
  const [aiSettings, setAiSettings] = useState({
    role_instruction: DEFAULT_ROLE_INSTRUCTION,
    match_instruction: DEFAULT_MATCH_INSTRUCTION,
    makelaar_role_instruction: DEFAULT_MAKELAAR_ROLE_INSTRUCTION,
    makelaar_report_instruction: DEFAULT_MAKELAAR_REPORT_INSTRUCTION,
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSaveLoading, setAiSaveLoading] = useState(false);

  // Filtering and Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkCreditAmount, setBulkCreditAmount] = useState(100);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'price_desc' | 'price_asc' | 'city'>('date_desc');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = viewMode === 'list' ? 25 : 6;

  const handleBulkAddCredits = async () => {
    if (selectedUserIds.length === 0) return;
    setBulkLoading(true);
    try {
      await bulkAddAdminUserCredits(selectedUserIds, bulkCreditAmount);
      toast.success(`${bulkCreditAmount} credits toegevoegd aan ${selectedUserIds.length} gebruikers`);
      setSelectedUserIds([]);
      fetchUsers();
    } catch (e) {
      console.error("Bulk add failed", e);
      toast.error("Fout bij bulk toevoegen credits");
    } finally {
      setBulkLoading(false);
    }
  };

  // Editing
  const [editingProp, setEditingProp] = useState<Property | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!auth.currentUser) {
        setLoading(false);
        return;
      }
      
      try {
        console.log("Checking admin status for:", auth.currentUser.uid);
        const tokenResult = await auth.currentUser.getIdTokenResult();
        const claims = tokenResult.claims || {};
        const isAdminUser =
          claims.admin === true ||
          claims.role === 'admin' ||
          (Array.isArray(claims.roles) && claims.roles.includes('admin'));
        
        console.log("Is Admin:", isAdminUser);
        if (isAdminUser) {
          // Fire them concurrently but don't await so the UI renders immediately with a beautiful loading state
          fetchProperties();
          fetchAiSettings();
          fetchStats();
          setTimeout(() => {
            fetchUsers();
          }, 1500);
        } else {
          toast.error("Toegang geweigerd: Je hebt geen admin rechten.");
        }
      } catch (err: any) {
        console.error("Admin check failed:", err);
        if (err.message?.includes('permission-denied') || err.code === 'permission-denied') {
          toast.error("Geen toestemming om admin gegevens op te halen.");
        }
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, []);

  const fetchStats = async () => {
    if (!auth.currentUser) return;
    setStatsLoading(true);
    try {
      let usersQ = query(collection(db, 'users'));
      let chatsQ = query(collection(db, 'chats'));
      let reportsQ = query(collection(db, 'matches'));
      let makelaarReportsQ = query(collection(db, 'makelaar_reports'));
      let propertiesQ = query(collection(db, 'properties'));
      
      if (timeFilter !== 'all') {
        const now = new Date();
        let startTime = new Date();
        
        if (timeFilter === 'week') {
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1);
          startTime.setDate(diff);
          startTime.setHours(0, 0, 0, 0);
        } else if (timeFilter === 'month') {
          startTime.setDate(1);
          startTime.setHours(0, 0, 0, 0);
        } else if (timeFilter === 'year') {
          startTime.setMonth(0, 1);
          startTime.setHours(0, 0, 0, 0);
        }
        
        const timestamp = Timestamp.fromDate(startTime);
        usersQ = query(collection(db, 'users'), where('createdAt', '>=', timestamp));
        chatsQ = query(collection(db, 'chats'), where('createdAt', '>=', timestamp));
        reportsQ = query(collection(db, 'matches'), where('createdAt', '>=', timestamp));
        makelaarReportsQ = query(collection(db, 'makelaar_reports'), where('createdAt', '>=', timestamp));
        propertiesQ = query(collection(db, 'properties'), where('createdAt', '>=', timestamp));
      }

      // Special fetch for recent activity to populate graphs
      let daysToFetch = 7;
      if (timeFilter === 'month') {
        daysToFetch = 30;
      } else if (timeFilter === 'year' || timeFilter === 'all') {
        daysToFetch = 365;
      }
      const activityStartDate = new Date();
      activityStartDate.setDate(activityStartDate.getDate() - daysToFetch);
      const activityTs = Timestamp.fromDate(activityStartDate);
      
      const [recentChatsSnap, recentMatchesSnap, recentMakelaarReportsSnap] = await Promise.all([
        getDocs(query(collection(db, 'chats'), where('createdAt', '>=', activityTs))),
        getDocs(query(collection(db, 'matches'), where('createdAt', '>=', activityTs))),
        getDocs(query(collection(db, 'makelaar_reports'), where('createdAt', '>=', activityTs)))
      ]);

      setRecentChats(recentChatsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setRecentMatches(recentMatchesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setRecentMakelaarReports(recentMakelaarReportsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      try {
        const usersSnap = await getCountFromServer(usersQ);
        setStats(prev => ({ ...prev, users: usersSnap.data().count }));
      } catch (e) {
        console.warn("Could not count users:", e);
      }

      try {
        const chatsSnap = await getCountFromServer(chatsQ);
        setStats(prev => ({ ...prev, chats: chatsSnap.data().count }));
      } catch (e) {
        console.warn("Could not count chats:", e);
      }

      try {
        const reportsSnap = await getCountFromServer(reportsQ);
        const makelaarReportsSnap = await getCountFromServer(makelaarReportsQ);
        setStats(prev => ({ 
          ...prev, 
          reports: reportsSnap.data().count,
          makelaarReports: makelaarReportsSnap.data().count
        }));
      } catch (e) {
        console.warn("Could not count matches/makelaar_reports:", e);
      }
      
      try {
        const propertiesSnap = await getCountFromServer(propertiesQ);
        setStats(prev => ({ ...prev, properties: propertiesSnap.data().count }));
      } catch (e) {
        console.warn("Could not count properties:", e);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
    setStatsLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, [timeFilter]);

  const chartData = useMemo(() => {
    let points = 7;
    if (timeFilter === 'month') {
      points = 30;
    } else if (timeFilter === 'year' || timeFilter === 'all') {
      points = 12; // 12 maanden trend voor jaars- en totaalweergaven
    }
    
    const data = [];
    
    // Group users by day or month
    const usersByPeriod: Record<string, number> = {};
    users.forEach(u => {
       if (u.createdAt) {
          const d = u.createdAt instanceof Timestamp ? u.createdAt.toDate() : new Date(u.createdAt.seconds ? u.createdAt.seconds * 1000 : u.createdAt);
          const key = (timeFilter === 'year' || timeFilter === 'all')
            ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            : d.toISOString().split('T')[0];
          usersByPeriod[key] = (usersByPeriod[key] || 0) + 1;
       }
    });

    // Group properties by day or month
    const propertiesByPeriod: Record<string, number> = {};
    properties.forEach(p => {
       if (p.createdAt) {
          const d = p.createdAt instanceof Timestamp ? p.createdAt.toDate() : new Date(p.createdAt.seconds ? p.createdAt.seconds * 1000 : p.createdAt);
          const key = (timeFilter === 'year' || timeFilter === 'all')
            ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            : d.toISOString().split('T')[0];
          propertiesByPeriod[key] = (propertiesByPeriod[key] || 0) + 1;
       }
    });

    // Group chats by day or month
    const chatsByPeriod: Record<string, number> = {};
    recentChats.forEach(c => {
       if (c.createdAt) {
          const d = c.createdAt instanceof Timestamp ? c.createdAt.toDate() : new Date(c.createdAt.seconds ? c.createdAt.seconds * 1000 : c.createdAt);
          const key = (timeFilter === 'year' || timeFilter === 'all')
            ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            : d.toISOString().split('T')[0];
          chatsByPeriod[key] = (chatsByPeriod[key] || 0) + 1;
       }
    });

    // Group reports by day or month
    const reportsByPeriod: Record<string, number> = {};
    recentMatches.forEach(m => {
       if (m.createdAt) {
          const d = m.createdAt instanceof Timestamp ? m.createdAt.toDate() : new Date(m.createdAt.seconds ? m.createdAt.seconds * 1000 : m.createdAt);
          const key = (timeFilter === 'year' || timeFilter === 'all')
            ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            : d.toISOString().split('T')[0];
          reportsByPeriod[key] = (reportsByPeriod[key] || 0) + 1;
       }
    });

    // Group makelaar reports by day or month
    const makelaarReportsByPeriod: Record<string, number> = {};
    recentMakelaarReports.forEach(m => {
       if (m.createdAt) {
          const d = m.createdAt instanceof Timestamp ? m.createdAt.toDate() : new Date(m.createdAt.seconds ? m.createdAt.seconds * 1000 : m.createdAt);
          const key = (timeFilter === 'year' || timeFilter === 'all')
            ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            : d.toISOString().split('T')[0];
          makelaarReportsByPeriod[key] = (makelaarReportsByPeriod[key] || 0) + 1;
       }
    });

    if (timeFilter === 'year' || timeFilter === 'all') {
      for (let i = 0; i < points; i++) {
        const month = new Date();
        month.setMonth(month.getMonth() - (points - 1 - i));
        const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
        data.push({
          name: month.toLocaleDateString(i18n.language, { month: 'short', year: '2-digit' }),
          users: usersByPeriod[key] || 0,
          properties: propertiesByPeriod[key] || 0,
          chats: chatsByPeriod[key] || 0,
          reports: reportsByPeriod[key] || 0,
          makelaarReports: makelaarReportsByPeriod[key] || 0
        });
      }
    } else {
      for (let i = 0; i < points; i++) {
        const day = new Date();
        day.setDate(day.getDate() - (points - 1 - i));
        const key = day.toISOString().split('T')[0];
        data.push({
          name: points > 7 
            ? day.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })
            : day.toLocaleDateString(i18n.language, { weekday: 'short' }),
          users: usersByPeriod[key] || 0,
          properties: propertiesByPeriod[key] || 0,
          chats: chatsByPeriod[key] || 0,
          reports: reportsByPeriod[key] || 0,
          makelaarReports: makelaarReportsByPeriod[key] || 0
        });
      }
    }
    return data;
  }, [users, properties, recentChats, recentMatches, recentMakelaarReports, timeFilter, i18n.language]);

  const propertyTypesData = useMemo(() => {
     const typesCount: Record<string, number> = {};
     properties.forEach(p => {
        const type = p.features?.type || 'Onbekend';
        let friendlyType = type;
        if (type === 'kamer') friendlyType = t('admin.props.type_room', 'Kamer');
        else if (type === 'studio') friendlyType = 'Studio';
        else if (type === 'appartement') friendlyType = 'Appartement';
        else if (type === 'woning') friendlyType = t('admin.props.type_woning', 'Woning');
        typesCount[friendlyType] = (typesCount[friendlyType] || 0) + 1;
     });
     return Object.entries(typesCount).map(([name, count]) => ({
        name,
        count
     })).sort((a, b) => b.count - a.count);
  }, [properties]);

  const propertyGoalsData = useMemo(() => {
     const goalsCount: Record<string, number> = {};
     properties.forEach(p => {
        const g = p.features?.goal || 'Onbekend';
        let label = g;
        if (g === 'cohousing') label = 'Huis delen';
        else if (g === 'hospita') label = 'Hospita';
        else if (g === 'vakantie_onderhuur') label = 'Vakantie onderhuur';
        else if (g === 'huisbewaring_expat') label = 'Huisbewaring';
        else if (g === 'vrije_verhuur') label = 'Vrije verhuur';
        goalsCount[label] = (goalsCount[label] || 0) + 1;
     });
     return Object.entries(goalsCount).map(([name, count]) => ({
        name,
        count
     })).sort((a, b) => b.count - a.count);
  }, [properties]);

  const propertyStatusData = useMemo(() => {
     const statusCount = {
       active: properties.filter(p => p.isActive && p.status === 'available').length,
       paused: properties.filter(p => p.status === 'paused').length,
       inactive: properties.filter(p => !p.isActive).length
     };
     return [
       { name: t('admin.status.active', 'Active'), count: statusCount.active, fill: '#10b981' },
       { name: t('admin.status.paused', 'Paused'), count: statusCount.paused, fill: '#f59e0b' },
       { name: t('admin.status.inactive', 'Draft/Inactive'), count: statusCount.inactive, fill: '#ef4444' }
     ];
  }, [properties]);

  const landAantalWoningen = useMemo(() => {
     const counts: Record<string, { count: number, flag: string, dutchName: string }> = {};
     properties.forEach(p => {
        const isBelgium = p.city?.toLowerCase().includes('antwerpen') || p.city?.toLowerCase().includes('gent') || p.city?.toLowerCase().includes('brussel') || p.city?.toLowerCase().includes('leuven');
        const countryKey = isBelgium ? 'Belgium' : 'Netherlands';
        if (!counts[countryKey]) {
           counts[countryKey] = {
              count: 0,
              flag: isBelgium ? '🇧🇪' : '🇳🇱',
              dutchName: isBelgium ? 'België' : 'Nederland'
           };
        }
        counts[countryKey].count++;
     });

     return Object.entries(counts)
        .map(([name, data]) => ({
           name,
           ...data
        }))
        .sort((a, b) => b.count - a.count);
  }, [properties]);

  const priceDistributionData = useMemo(() => {
     const filtered = properties.filter(p => {
        if (!p.price || p.priceType === 'tbd') return false;
        
        // Filter op Land
        if (selectedStatsCountry !== 'all') {
           const country = p.city?.toLowerCase().includes('antwerpen') || p.city?.toLowerCase().includes('gent') || p.city?.toLowerCase().includes('brussel') || p.city?.toLowerCase().includes('leuven') ? 'BE' : 'NL';
           const configCountry = selectedStatsCountry === 'Belgium' ? 'BE' : 'NL';
           if (country !== configCountry) return false;
        }
        
        // Filter op Type
        if (selectedStatsType !== 'all') {
           const type = p.features?.type || '';
           if (type.toLowerCase() !== selectedStatsType.toLowerCase()) return false;
        }
        
        // Filter op Doel
        if (selectedStatsGoal !== 'all') {
           const goal = p.features?.goal || '';
           if (goal.toLowerCase() !== selectedStatsGoal.toLowerCase()) return false;
        }
        
        return true;
     });

     const buckets = [
        { name: '€0 - €500', min: 0, max: 500, count: 0 },
        { name: '€500 - €750', min: 500, max: 750, count: 0 },
        { name: '€750 - €1000', min: 750, max: 1000, count: 0 },
        { name: '€1000 - €1500', min: 1000, max: 1500, count: 0 },
        { name: '€1500 - €2500', min: 1500, max: 2500, count: 0 },
        { name: '€2500+', min: 2500, max: 9999999, count: 0 }
     ];

     filtered.forEach(p => {
        const price = p.price || 0;
        const bucket = buckets.find(b => price >= b.min && price < b.max);
        if (bucket) bucket.count++;
     });

     return buckets;
  }, [properties, selectedStatsCountry, selectedStatsType, selectedStatsGoal]);

  const landFilteredTotals = useMemo(() => {
     let filteredProperties = properties;
     let filteredUsers = users;
     let filteredRecentChats = recentChats;
     let filteredRecentMatches = recentMatches;

     const getPropertyCountry = (p: any) => {
        return p.city?.toLowerCase().includes('antwerpen') || p.city?.toLowerCase().includes('gent') || p.city?.toLowerCase().includes('brussel') || p.city?.toLowerCase().includes('leuven') ? 'Belgium' : 'Netherlands';
     };

     if (selectedStatsCountry !== 'all') {
        filteredProperties = properties.filter(p => getPropertyCountry(p).toLowerCase() === selectedStatsCountry.toLowerCase());
        
        const propertyCountryMap = new Map<string, string>();
        properties.forEach(p => {
           propertyCountryMap.set(p.id, getPropertyCountry(p));
        });

        filteredRecentChats = recentChats.filter(c => {
           const country = propertyCountryMap.get(c.propertyId);
           return country?.toLowerCase() === selectedStatsCountry.toLowerCase();
        });

        filteredRecentMatches = recentMatches.filter(m => {
           const country = propertyCountryMap.get(m.propertyId);
           return country?.toLowerCase() === selectedStatsCountry.toLowerCase();
        });

        filteredUsers = users.filter(u => {
           const uCountry = u.country || u.profile?.country;
           if (uCountry) {
              const standard = uCountry.toLowerCase().includes('belg') ? 'Belgium' : 'Netherlands';
              return standard.toLowerCase() === selectedStatsCountry.toLowerCase();
           }
           const playsBelgian = properties.some(p => p.ownerId === u.id && getPropertyCountry(p) === 'Belgium');
           const playsDutch = properties.some(p => p.ownerId === u.id && getPropertyCountry(p) === 'Netherlands');
           if (selectedStatsCountry.toLowerCase() === 'belgium') return playsBelgian;
           return playsDutch || !playsBelgian;
        });
     }

     return {
        users: filteredUsers.length,
        properties: filteredProperties.length,
        chats: timeFilter === 'all' 
          ? (selectedStatsCountry === 'all' ? stats.chats : filteredRecentChats.length)
          : filteredRecentChats.length,
        reports: timeFilter === 'all'
          ? (selectedStatsCountry === 'all' ? stats.reports : filteredRecentMatches.length)
          : filteredRecentMatches.length,
        makelaarReports: timeFilter === 'all'
          ? (selectedStatsCountry === 'all' ? stats.makelaarReports : recentMakelaarReports.length)
          : recentMakelaarReports.length
     };
  }, [properties, users, recentChats, recentMatches, recentMakelaarReports, selectedStatsCountry, timeFilter, stats.chats, stats.reports, stats.makelaarReports]);

  const countryStatsData = useMemo(() => {
     const countries: Record<string, number> = {};
     properties.forEach(p => {
        const country = p.city?.toLowerCase().includes('antwerpen') || p.city?.toLowerCase().includes('gent') || p.city?.toLowerCase().includes('brussel') || p.city?.toLowerCase().includes('leuven') ? 'Belgium' : 'Netherlands';
        countries[country] = (countries[country] || 0) + 1;
     });
     
     return Object.entries(countries)
       .map(([name, count]) => ({
          name,
          count,
          flag: name === 'Belgium' ? '🇧🇪' : '🇳🇱'
       }))
       .sort((a, b) => b.count - a.count);
  }, [properties]);

  const fetchAiSettings = async () => {
    setAiLoading(true);
    try {
      const docRef = doc(db, 'ai_settings', 'matching');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAiSettings({
          role_instruction: data.role_instruction || DEFAULT_ROLE_INSTRUCTION,
          match_instruction: data.match_instruction || DEFAULT_MATCH_INSTRUCTION,
          makelaar_role_instruction: data.makelaar_role_instruction || DEFAULT_MAKELAAR_ROLE_INSTRUCTION,
          makelaar_report_instruction: data.makelaar_report_instruction || DEFAULT_MAKELAAR_REPORT_INSTRUCTION,
        });
      }
    } catch (error) {
      console.error("Error fetching AI settings:", error);
    }
    setAiLoading(false);
  };

  const handleSaveAiSettings = async () => {
    setAiSaveLoading(true);
    try {
      await saveAdminAiSettings(aiSettings);
      toast.success('AI Instellingen opgeslagen!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'ai_settings/matching');
    }
    setAiSaveLoading(false);
  };

  // Reset page when settings change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortBy, viewMode]);

  // Photo Moderation state and paginated fetch logic
  const [moderationPhotos, setModerationPhotos] = useState<any[]>([]);
  const [photosLastVisible, setPhotosLastVisible] = useState<any>(null);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photosHasMore, setPhotosHasMore] = useState(true);

  const loadModerationPhotos = async (loadMore = false) => {
    if (photosLoading) return;
    setPhotosLoading(true);
    try {
      let currentLastVisible = loadMore ? photosLastVisible : null;
      let photoList: any[] = [];
      let fetchedDocsCount = 0;
      let hasMore = true;

      // Keep fetching until we find at least some photos or we hit the end
      while (photoList.length < 5 && hasMore) {
        let q = query(
          collection(db, 'properties'),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        
        if (currentLastVisible) {
          q = query(
            collection(db, 'properties'),
            orderBy('createdAt', 'desc'),
            startAfter(currentLastVisible),
            limit(10)
          );
        }
        
        const snap = await getDocs(q);
        fetchedDocsCount = snap.docs.length;
        
        if (snap.empty) {
          hasMore = false;
          break;
        }
        
        currentLastVisible = snap.docs[snap.docs.length - 1];
        
        snap.docs.forEach(docSnap => {
          const p = { id: docSnap.id, ...docSnap.data() } as any;
          if (p.images && p.images.length > 0) {
            p.images.forEach((img: any) => {
              photoList.push({
                id: img.id,
                url: img.url,
                category: img.category || 'Algemeen',
                propertyId: p.id,
                propertyTitle: p.title,
                city: p.city || 'Onbekend',
                ownerId: p.ownerId,
                propertyCreatedAt: p.createdAt,
                ownerSuspended: !!p.ownerSuspended
              });
            });
          }
        });

        if (fetchedDocsCount < 10) {
          hasMore = false;
        }
      }
      
      setPhotosLastVisible(currentLastVisible);
      setPhotosHasMore(hasMore);
      setModerationPhotos(prev => loadMore ? [...prev, ...photoList] : photoList);
      
    } catch (err) {
      console.error(err);
      toast.error("Kan foto's niet laden.");
    }
    setPhotosLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'photo_moderation' && moderationPhotos.length === 0 && photosHasMore) {
      loadModerationPhotos();
    }
  }, [activeTab]);

  const getOwnerInfo = (ownerId: string) => {
    const o = users.find(u => u.id === ownerId);
    if (!o) return { name: 'Onbekende eigenaar', email: 'Geen e-mail', isSuspended: false };
    return {
      name: o.displayName || `${o.firstName || ''} ${o.lastName || ''}`.trim() || 'Geef naam',
      email: o.email || 'Geen e-mail',
      isSuspended: !!o.isSuspended
    };
  };

  const formatHhMmAgo = (createdAt: any) => {
    if (!createdAt) return 'onbekend';
    let date: Date;
    if (createdAt instanceof Timestamp) {
      date = createdAt.toDate();
    } else if (createdAt && typeof createdAt.toDate === 'function') {
      date = createdAt.toDate();
    } else if (createdAt.seconds) {
      date = new Date(createdAt.seconds * 1000);
    } else {
      date = new Date(createdAt);
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'Zojuist';
    
    const totalMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;

    const formattedHours = String(hours).padStart(2, '0');
    const formattedMins = String(mins).padStart(2, '0');

    const absTimeStr = date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    
    if (hours < 24) {
      return `${absTimeStr} (${formattedHours}:${formattedMins} geleden)`;
    } else {
      const days = Math.floor(hours / 24);
      return `${date.toLocaleDateString('nl-NL')} (${days}d geleden)`;
    }
  };

  const handleDeletePhoto = async (propertyId: string, photoId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Foto Verwijderen',
      message: 'Weet je zeker dat je deze foto wilt verwijderen uit de woning? Deze actie kan niet ongedaan worden gemaakt.',
      confirmText: 'Verwijder Foto',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const propRef = doc(db, 'properties', propertyId);
          const propSnap = await getDoc(propRef);
          if (propSnap.exists()) {
            const propData = propSnap.data();
            const currentImages = propData.images || [];
            const updatedImages = currentImages.filter((img: any) => img.id !== photoId);
            
            const updateData: any = {
              images: updatedImages,
              updatedAt: serverTimestamp()
            };
            
            if (propData.teaserImageId === photoId) {
              updateData.teaserImageId = updatedImages.length > 0 ? updatedImages[0].id : '';
            }
            
            await removeAdminPropertyPhoto(propertyId, photoId);
            toast.success("Foto succesvol verwijderd!");
            
            setProperties(prev => prev.map(p => {
              if (p.id === propertyId) {
                return {
                  ...p,
                  images: updatedImages,
                  teaserImageId: propData.teaserImageId === photoId ? (updatedImages.length > 0 ? updatedImages[0].id : '') : p.teaserImageId
                };
              }
              return p;
            }));
            
            setModerationPhotos(prev => prev.filter(photo => photo.id !== photoId));
          }
        } catch (error) {
          console.error("Fout bij verwijderen foto:", error);
          toast.error("Kan foto niet verwijderen.");
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const handleToggleUserSuspension = async (userId: string, currentSuspended: boolean) => {
    const newSuspended = !currentSuspended;
    const actionText = newSuspended ? "deactiveren (blokkeren)" : "activeren (deblokkeren)";
    const confirmMsg = `Weet je zeker dat je deze gebruiker wilt ${actionText}? ` +
      (newSuspended 
        ? "Al zijn data en woningen zullen onmiddellijk onzichtbaar worden voor anderen en de gebruiker zal worden uitgesloten van de app."
        : "De gebruiker krijgt weer toegang en zijn woningen worden weer zichtbaar.");
        
    setConfirmDialog({
      isOpen: true,
      title: newSuspended ? 'Gebruiker Blokkeren' : 'Gebruiker Activeren',
      message: confirmMsg,
      confirmText: newSuspended ? 'Ja, Blokkeer Gebruiker' : 'Ja, Activeer Gebruiker',
      isDestructive: newSuspended,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await setAdminUserSuspension(userId, newSuspended);

          toast.success(newSuspended ? "Gebruiker met succes gedeactiveerd!" : "Gebruiker met succes geactiveerd!");

          setUsers(prev => prev.map(u => {
            if (u.id === userId) return { ...u, isSuspended: newSuspended };
            return u;
          }));

          setProperties(prev => prev.map(p => {
            if (p.ownerId === userId) return { ...p, ownerSuspended: newSuspended };
            return p;
          }));

          setModerationPhotos(prev => prev.map(photo => {
            if (photo.ownerId === userId) return { ...photo, ownerSuspended: newSuspended };
            return photo;
          }));

        } catch (error) {
          console.error("Fout bij wijzigen status gebruiker:", error);
          toast.error("Status van gebruiker kon niet worden gewijzigd.");
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'properties'));
      const snapshot = await getDocs(q);
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
      setProperties(fetched);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'properties');
    }
    setLoading(false);
  };

  const executeMockProperties = async () => {
    setSaveLoading(true);
    try {
      await createAdminMockProperties();
      toast.success('100 woningen succesvol aangemaakt!');
      fetchProperties();
    } catch (e: any) {
      console.error(e);
      toast.error('Er is een fout opgetreden: ' + (e.message || String(e)));
    }
    setSaveLoading(false);
  };

  const handleMockProperties = async () => {
    toast((toastObj) => (
      <div className="flex flex-col gap-3">
        <span className="font-bold">Zeker weten dat je 100 mock woningen in Gent/Antwerpen wilt genereren? Dit kan even duren.</span>
        <div className="flex gap-2">
          <button 
            onClick={() => { toast.dismiss(toastObj.id); executeMockProperties(); }}
            className="bg-primary text-white px-4 py-2 rounded-lg font-bold"
          >
            Ja, genereren
          </button>
          <button 
            onClick={() => toast.dismiss(toastObj.id)}
            className="bg-surface-container text-on-surface px-4 py-2 rounded-lg font-bold"
          >
            Annuleren
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const executeClearProperties = async () => {
    setSaveLoading(true);
    try {
      const q = collection(db, 'properties');
      const snap = await getDocs(q);
      await clearAdminProperties();
      toast.success(`Succesvol ${snap.docs.length} woningen verwijderd!`);
      fetchProperties();
    } catch (e: any) {
      console.error(e);
      toast.error('Er is een fout opgetreden: ' + (e.message || String(e)));
    }
    setSaveLoading(false);
  };

  const handleClearProperties = async () => {
    toast((toastObj) => (
      <div className="flex flex-col gap-3">
        <span className="font-bold text-error">WEET JE ZEKER dat je ALLE woningen wilt verwijderen? Dit kan niet ongedaan worden gemaakt!</span>
        <div className="flex gap-2">
          <button 
            onClick={() => { toast.dismiss(toastObj.id); executeClearProperties(); }}
            className="bg-error text-white px-4 py-2 rounded-lg font-bold"
          >
            Verwijderen
          </button>
          <button 
            onClick={() => toast.dismiss(toastObj.id)}
            className="bg-surface-container text-on-surface px-4 py-2 rounded-lg font-bold"
          >
            Annuleren
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };


  const handleUpdateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProp) return;
    setSaveLoading(true);
    try {
      const { id, ...data } = editingProp;
      await updateAdminProperty(id, data as Record<string, unknown>);
      setProperties(prev => prev.map(p => p.id === id ? editingProp : p));
      setEditingProp(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `properties/${editingProp.id}`);
    }
    setSaveLoading(false);
  };

  const togglePropertyStatus = async (id: string, currentStatus: boolean | undefined, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening edit modal
    try {
      await toggleAdminPropertyStatus(id, !currentStatus);
      setProperties(prev => prev.map(p => p.id === id ? { ...p, isActive: !currentStatus } : p));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `properties/${id}`);
    }
  };

  const deleteProperty = async (id: string) => {
    toast((toastObj) => (
      <div className="flex flex-col gap-3">
        <span className="font-bold">Weet je zeker dat je deze woning wilt verwijderen of deactiveren?</span>
        <div className="flex gap-2">
          <button 
            onClick={async () => { 
               toast.dismiss(toastObj.id);
               setSaveLoading(true);
               try {
                 const result = await deleteAdminProperty(id);
                 if (result.deleted === false) {
                   toast.error("Kan woning niet verwijderen omdat deze gekoppeld is aan actieve zoekers. De woning wordt in plaats daarvan op inactief gezet.");
                   setProperties(prev => prev.map(p => p.id === id ? { ...p, isActive: false } : p));
                 } else {
                   setProperties(prev => prev.filter(p => p.id !== id));
                   toast.success(t('admin.props.msg_deleted', 'Woning verwijderd.'));
                 }
                 setEditingProp(null);
               } catch (error) {
                 handleFirestoreError(error, OperationType.DELETE, `properties/${id}`);
               }
               setSaveLoading(false);
            }} 
            className="bg-error text-white px-4 py-2 rounded-lg font-bold text-sm"
          >
            Ja, verwijderen
          </button>
          <button 
            onClick={() => toast.dismiss(toastObj.id)}
            className="bg-surface-container text-on-surface px-4 py-2 rounded-lg font-bold text-sm"
          >
            Annuleren
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  // Filter & Sort
  const filteredProperties = properties.filter(p => {
    if (statusFilter === 'active' && (!p.isActive || p.status !== 'available')) return false;
    if (statusFilter === 'paused' && p.status !== 'paused') return false;
    if (statusFilter === 'inactive' && p.isActive) return false;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (p.title || '').toLowerCase().includes(term) ||
             (p.city || '').toLowerCase().includes(term) ||
             (p.id || '').toLowerCase().includes(term) ||
             (p.ownerId || '').toLowerCase().includes(term);
    }
    return true;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'price_desc': return b.price - a.price;
      case 'price_asc': return a.price - b.price;
      case 'city': return (a.city || '').localeCompare(b.city || '');
      case 'date_asc': 
        return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
      case 'date_desc':
      default:
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    }
  });

  const filteredUsers = users.filter(u => {
    if (userSearch) {
      const term = userSearch.toLowerCase();
      return (u.email || '').toLowerCase().includes(term) ||
             (u.displayName || '').toLowerCase().includes(term) ||
             (u.firstName || '').toLowerCase().includes(term) ||
             (u.lastName || '').toLowerCase().includes(term);
    }
    return true;
  }).sort((a, b) => {
    switch (userSortBy) {
      case 'created_asc': return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
      case 'created_desc': return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      case 'login': return (b.lastLoginAt?.seconds || 0) - (a.lastLoginAt?.seconds || 0);
      case 'name':
      default:
        const nameA = `${a.firstName || ''} ${a.lastName || ''} ${a.displayName || ''}`.trim().toLowerCase();
        const nameB = `${b.firstName || ''} ${b.lastName || ''} ${b.displayName || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
    }
  });

  const userTotalPages = Math.ceil(filteredUsers.length / userItemsPerPage);
  const currentUserItems = filteredUsers.slice(
    (userCurrentPage - 1) * userItemsPerPage,
    userCurrentPage * userItemsPerPage
  );

  // Pagination Logic
  const totalPages = Math.ceil(filteredProperties.length / itemsPerPage);
  const currentItems = filteredProperties.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <main className="flex-grow bg-background py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest mb-2">
              <ShieldCheck size={14} />
              {t('admin.role_badge', 'Beheerder')}
            </div>
            <h1 className="text-4xl font-display font-bold text-on-background tracking-tight">{t('admin.dashboard_title', 'Admin Dashboard')}</h1>
          </div>
          <div className="flex gap-4">
             {activeTab === 'properties' && (
               <div className="flex bg-white border border-outline p-1 rounded-xl shadow-sm">
                  <button 
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                  >
                    <List size={20} />
                  </button>
                  <button 
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                  >
                    <LayoutGrid size={20} />
                  </button>
               </div>
             )}
          </div>
        </header>

        {/* Tabs */}
        <div className="relative mb-8 bg-white/50 backdrop-blur-sm rounded-2xl p-1 border border-outline/50 sticky top-4 z-20 shadow-sm group/tabs">
          <AnimatePresence>
            {showLeftArrow && (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onClick={() => scrollTabs('left')}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-30 p-2 bg-white rounded-full shadow-lg border border-outline text-primary hover:bg-primary hover:text-white transition-all shadow-primary/10"
              >
                <ChevronLeft size={16} />
              </motion.button>
            )}
          </AnimatePresence>

          <div 
            ref={tabsRef}
            onScroll={checkScroll}
            className="flex gap-1 overflow-x-auto no-scrollbar scroll-smooth px-1"
          >
            <button 
              onClick={() => setActiveTab('overview')}
              className={`px-5 py-3 font-bold text-xs uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'overview' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <LayoutGrid size={14} />
              {t('admin.tabs.overview', 'Overzicht')}
            </button>
            <button 
              onClick={() => setActiveTab('properties')}
              className={`px-5 py-3 font-bold text-xs uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'properties' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <Home size={14} />
              {t('admin.tabs.properties', 'Woningen')} 
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'properties' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                {properties.length}
              </span>
            </button>
            <button 
              onClick={() => setActiveTab('photo_moderation')}
              className={`px-5 py-3 font-bold text-xs uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'photo_moderation' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <Eye size={14} />
              Controle foto's
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'photo_moderation' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                {moderationPhotos.length}
              </span>
            </button>
            <button 
              onClick={() => setActiveTab('users')}
              className={`px-5 py-3 font-bold text-xs uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'users' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <Users size={14} />
              {t('admin.tabs.users', 'Gebruikers')}
            </button>
            <button 
              onClick={() => setActiveTab('ai')}
              className={`px-5 py-3 font-bold text-xs uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'ai' ? 'border-primary bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <Sparkles size={14} />
              {t('admin.tabs.ai', 'AI Settings')}
            </button>
            <button 
              onClick={() => setActiveTab('currencies')}
              className={`px-5 py-3 font-bold text-xs uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'currencies' ? 'border-primary bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <Globe size={14} />
              {t('admin.tabs.currencies', 'Valuta & Koersen')}
            </button>
            <button 
              onClick={() => setActiveTab('experts')}
              className={`px-5 py-3 font-bold text-xs uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'experts' ? 'border-primary bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <ExternalLink size={14} />
              {t('admin.tabs.experts', 'Partner Links')}
            </button>
            <button 
              onClick={() => setActiveTab('verifications')}
              className={`px-5 py-3 font-bold text-xs uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'verifications' ? 'border-primary bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <ShieldCheck size={14} />
              {t('admin.tabs.verifications', 'Verificaties')}
              {pendingVerifications.length > 0 && (
                 <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeTab === 'verifications' ? 'bg-orange-600 text-white' : 'bg-orange-500 text-white'}`}>
                   {pendingVerifications.length}
                 </span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('contact')}
              className={`px-5 py-3 font-bold text-xs uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'contact' ? 'border-primary bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <MessageSquare size={14} />
              {t('admin.tabs.contact', 'Contact Berichten')}
            </button>
            <button 
              onClick={() => setActiveTab('messaging')}
              className={`px-5 py-3 font-bold text-xs uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'messaging' ? 'border-primary bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <MessageSquare size={14} />
              {t('admin.tabs.messaging', 'Berichten & App Stop')}
            </button>
            <button 
              onClick={() => setActiveTab('gifts')}
              className={`px-5 py-3 font-bold text-xs uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'gifts' ? 'border-primary bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <Gift size={14} />
              {t('admin.tabs.gifts', 'Feature Gifts (Cadeautjes)')}
            </button>
            <button 
              onClick={() => setActiveTab('newsletter')}
              className={`px-5 py-3 font-bold text-xs uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'newsletter' ? 'border-primary bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <Mail size={14} />
              {t('admin.tabs.newsletter', 'Newsletter Studio')}
            </button>
            <button 
              onClick={() => setActiveTab('smart_match')}
              className={`px-5 py-3 font-bold text-xs uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'smart_match' ? 'border-primary bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <Sparkles size={14} />
              {t('admin.tabs.smart_match', 'Smart Match Alerts')}
            </button>
          </div>

          <AnimatePresence>
            {showRightArrow && (
              <motion.button
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onClick={() => scrollTabs('right')}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-30 p-2 bg-white rounded-full shadow-lg border border-outline text-primary hover:bg-primary hover:text-white transition-all shadow-primary/10"
              >
                <ChevronRight size={16} />
              </motion.button>
            )}
          </AnimatePresence>
          
          {/* Gradient indicators - now dynamic based on scroll */}
          <div className={`absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent pointer-events-none rounded-r-2xl transition-opacity duration-300 ${showRightArrow ? 'opacity-100' : 'opacity-0'}`} />
          <div className={`absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white to-transparent pointer-events-none rounded-l-2xl transition-opacity duration-300 ${showLeftArrow ? 'opacity-100' : 'opacity-0'}`} />
        </div>

        {activeTab === 'ai' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white rounded-[2.5rem] border border-outline shadow-sm overflow-hidden p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-inner">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-black text-on-surface">AI Matchmaker Configuraties</h2>
                  <p className="text-on-surface-variant text-sm font-medium">Beheer hoe de AI communiceert en de matches analyseert.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Section 1: Matchmaker Settings */}
                <div className="space-y-8">
                  <div className="border-b border-outline pb-4">
                    <h3 className="text-lg font-bold text-on-surface flex items-center gap-2 font-display uppercase tracking-tight">
                      <Sparkles className="text-primary" size={18} />
                      AI Matchmaker Prompts
                    </h3>
                    <p className="text-xs text-on-surface-variant font-medium">Instellingen voor de AI Matchmaker van de cohousing match rapporten.</p>
                  </div>

                  {/* Role Instruction */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest px-2">
                      <ShieldCheck size={14} />
                      1e: Rol van AI Matchmaker
                    </div>
                    <div className="relative group">
                      <textarea 
                        value={aiSettings.role_instruction || ''}
                        onChange={e => setAiSettings(prev => ({ ...prev, role_instruction: e.target.value }))}
                        placeholder="Voer de AI rol instructie in..."
                        className="w-full h-80 bg-surface-container-lowest border-2 border-outline rounded-[2rem] p-6 text-sm font-medium leading-relaxed outline-none focus:border-primary transition-all resize-none shadow-inner animate-fade-in"
                      />
                      <div className="absolute top-4 right-4 text-on-surface-variant/30 group-focus-within:text-primary/30 transition-colors">
                        <MessageSquare size={20} />
                      </div>
                    </div>
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider px-2">Bepaalt de persoonlijkheid, stem en toon van de AI matching coach.</p>
                  </div>

                  {/* Match Instruction */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest px-2">
                      <BarChart3 size={14} />
                      2e: Match / Rapport Instructie voor matching rapport
                    </div>
                    <div className="relative group">
                      <textarea 
                        value={aiSettings.match_instruction || ''}
                        onChange={e => setAiSettings(prev => ({ ...prev, match_instruction: e.target.value }))}
                        placeholder="Voer de match rapport instructie in..."
                        className="w-full h-80 bg-surface-container-lowest border-2 border-outline rounded-[2rem] p-6 text-sm font-medium leading-relaxed outline-none focus:border-primary transition-all resize-none shadow-inner"
                      />
                      <div className="absolute top-4 right-4 text-on-surface-variant/30 group-focus-within:text-primary/30 transition-colors">
                        <MessageSquare size={20} />
                      </div>
                    </div>
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider px-2">Bepaalt de analyse-regels, datastructuur en sfeercheck-oververgelijking.</p>
                  </div>
                </div>

                {/* Section 2: Makelaar Settings */}
                <div className="space-y-8">
                  <div className="border-b border-outline pb-4">
                    <h3 className="text-lg font-bold text-on-surface flex items-center gap-2 font-display uppercase tracking-tight">
                      <Home className="text-primary" size={18} />
                      Co-Match Makelaar Prompts
                    </h3>
                    <p className="text-xs text-on-surface-variant font-medium">Instellingen voor de Co-Match Makelaar-rapportage van woningen.</p>
                  </div>

                  {/* Makelaar Role Instruction */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest px-2">
                      <ShieldCheck size={14} />
                      Co-Match makelaar instructie
                    </div>
                    <div className="relative group">
                      <textarea 
                        value={aiSettings.makelaar_role_instruction || ''}
                        onChange={e => setAiSettings(prev => ({ ...prev, makelaar_role_instruction: e.target.value }))}
                        placeholder="Voer de makelaar rol instructie in..."
                        className="w-full h-80 bg-surface-container-lowest border-2 border-outline rounded-[2rem] p-6 text-sm font-medium leading-relaxed outline-none focus:border-primary transition-all resize-none shadow-inner"
                      />
                      <div className="absolute top-4 right-4 text-on-surface-variant/30 group-focus-within:text-primary/30 transition-colors">
                        <MessageSquare size={20} />
                      </div>
                    </div>
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider px-2">Bepaalt de makelaarsrol en het inlevingsvermogen van de vastgoedcoach.</p>
                  </div>

                  {/* Makelaar Report Instruction */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest px-2">
                      <BarChart3 size={14} />
                      Co-Match makelaar rapport instructie
                    </div>
                    <div className="relative group">
                      <textarea 
                        value={aiSettings.makelaar_report_instruction || ''}
                        onChange={e => setAiSettings(prev => ({ ...prev, makelaar_report_instruction: e.target.value }))}
                        placeholder="Voer de makelaar rapport-opbouw instructie in..."
                        className="w-full h-80 bg-surface-container-lowest border-2 border-outline rounded-[2rem] p-6 text-sm font-medium leading-relaxed outline-none focus:border-primary transition-all resize-none shadow-inner"
                      />
                      <div className="absolute top-4 right-4 text-on-surface-variant/30 group-focus-within:text-primary/30 transition-colors">
                        <MessageSquare size={20} />
                      </div>
                    </div>
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider px-2">Bepaalt de rapport-structuur, sfeertour, en schrijfstijl van het makelaarsrapport.</p>
                  </div>
                </div>
              </div>

              <div className="mt-12 pt-8 border-t border-outline flex justify-end">
                <button 
                  onClick={handleSaveAiSettings}
                  disabled={aiSaveLoading}
                  className="bg-primary text-on-primary px-10 py-4 rounded-2xl font-black text-sm shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {aiSaveLoading ? (
                    <div className="w-5 h-5 border-2 border-on-primary/20 border-t-on-primary rounded-full animate-spin" />
                  ) : (
                    <Save size={20} />
                  )}
                  {aiSaveLoading ? 'Opslaan...' : 'AI Instellingen Opslaan'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            
            {/* Geconsolideerd Totalen Overzicht Venster met Land Filter */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-outline shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                  <h3 className="font-display font-black text-2xl text-on-surface">Platform Totalen Overzicht</h3>
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Gefilterd op het geselecteerde land</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black uppercase tracking-widest text-[#6B7280]">Kies Land:</span>
                  <select
                    value={selectedStatsCountry}
                    onChange={(e) => setSelectedStatsCountry(e.target.value)}
                    className="text-xs font-black uppercase tracking-wider bg-surface-container-low border-2 border-outline rounded-xl px-4 py-2 outline-none cursor-pointer hover:bg-surface-container transition-all"
                  >
                    <option value="all">Alle Landen 🌍</option>
                    <option value="Netherlands">Nederland 🇳🇱</option>
                    <option value="Belgium">België 🇧🇪</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-6">
                {[
                  { label: "Geregistreerde Gebruikers", value: landFilteredTotals.users, icon: Users, bg: "bg-blue-50 text-blue-600", border: "border-blue-100" },
                  { label: "Gestarte Chats & Gesprekken", value: landFilteredTotals.chats, icon: MessageSquare, bg: "bg-purple-50 text-purple-600", border: "border-purple-100" },
                  { label: "AI Match Rapporten", value: landFilteredTotals.reports, icon: BarChart3, bg: "bg-rose-50 text-rose-600", border: "border-rose-100" },
                  { label: "Makelaar Rapporten", value: landFilteredTotals.makelaarReports || 0, icon: FileText, bg: "bg-orange-50 text-orange-600", border: "border-orange-100" },
                  { label: "Platform Woningen", value: landFilteredTotals.properties, icon: Home, bg: "bg-emerald-50 text-emerald-600", border: "border-emerald-100" }
                ].map((item, idx) => (
                  <div key={idx} className={`p-6 bg-slate-50 border ${item.border} rounded-3xl flex items-center gap-4 hover:shadow-md transition-all duration-300`}>
                    <div className={`p-4 rounded-2xl ${item.bg}`}>
                      <item.icon size={24} />
                    </div>
                    <div>
                      <div className="text-2xl font-display font-black text-on-surface">
                        {item.value.toLocaleString()}
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#6B7280]">{item.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* De 5 detail trend-grafieken bovenin */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
              {[
                { label: t('admin.stats.registered_users', 'Geregistreerde Gebruikers'), value: stats.users, icon: Users, color: 'text-blue-600', stroke: '#3b82f6', defId: 'grad-users', dataKey: 'users' },
                { label: 'Gestarte Chats & Gesprekken', value: stats.chats, icon: MessageSquare, color: 'text-purple-600', stroke: '#8b5cf6', defId: 'grad-chats', dataKey: 'chats' },
                { label: 'AI Match Rapporten', value: stats.reports, icon: BarChart3, color: 'text-rose-600', stroke: '#f43f5e', defId: 'grad-reports', dataKey: 'reports' },
                { label: 'Makelaar Rapporten', value: stats.makelaarReports, icon: FileText, color: 'text-orange-600', stroke: '#f97316', defId: 'grad-makelaar', dataKey: 'makelaarReports' },
                { label: t('admin.stats.platform_props', 'Platform Woningen'), value: stats.properties, icon: Home, color: 'text-emerald-600', stroke: '#10b981', defId: 'grad-props', dataKey: 'properties' },
              ].map((stat, i) => (
                <motion.div 
                   key={i}
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: i * 0.1 }}
                   className="bg-white rounded-3xl border border-outline shadow-sm overflow-hidden flex flex-col h-full group"
                >
                  <div className="p-6 pb-2">
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-2 bg-slate-50 border border-outline rounded-xl ${stat.color}`}>
                        <stat.icon size={20} />
                      </div>
                      <select 
                        value={timeFilter}
                        onChange={(e) => setTimeFilter(e.target.value as any)}
                        className="text-[10px] font-black uppercase tracking-wider bg-surface-container-low border border-outline rounded-lg px-2 py-1 outline-none cursor-pointer hover:bg-surface-container transition-colors"
                      >
                        <option value="week">Week</option>
                        <option value="month">Maand</option>
                        <option value="year">Jaar</option>
                        <option value="all">Sinds Altijd</option>
                      </select>
                    </div>
                    
                    <div className="flex items-baseline gap-2">
                      <div className="text-3xl font-display font-black text-on-background">
                        {stat.value.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mt-1">{stat.label}</div>
                  </div>

                  <div className="h-24 w-full mt-auto pt-4 rounded-b-3xl overflow-hidden">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id={stat.defId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={stat.stroke} stopOpacity={0.15}/>
                            <stop offset="95%" stopColor={stat.stroke} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area 
                          type="monotone" 
                          dataKey={stat.dataKey} 
                          stroke={stat.stroke} 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill={`url(#${stat.defId})`} 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              ))}
            </div>
            
            {/* Het Bento-Grid met alle visualisaties */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               
               {/* Grafiek 1: Platform Activiteit Trend */}
               <div className="bg-white p-8 rounded-3xl border border-outline shadow-sm">
                  <div className="flex justify-between items-center mb-8">
                     <div>
                        <h3 className="font-display font-black text-xl text-on-surface">Trend Platform Activiteit</h3>
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                          {timeFilter === 'all' ? 'Verloop over de afgelopen 12 maanden' : `Trendgegevens per geselecteerde filter: ${timeFilter}`}
                        </p>
                     </div>
                     <div className="flex gap-4">
                        <div className="flex items-center gap-2 text-xs font-bold">
                           <div className="w-3 h-3 bg-blue-500 rounded-full" />
                           Gebruikers
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold">
                           <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                           Woningen
                        </div>
                     </div>
                  </div>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#6B7280' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#6B7280' }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                          itemStyle={{ fontSize: '12px', fontWeight: 800 }}
                        />
                        <Area type="monotone" dataKey="users" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.05} strokeWidth={3} />
                        <Area type="monotone" dataKey="properties" stroke="#10b981" fill="#10b981" fillOpacity={0.05} strokeWidth={3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
               </div>

               {/* Grafiek 2: Actieve Landen (Vlag, Naam, Horizontale bar en aantal) */}
               <div className="bg-white p-8 rounded-3xl border border-outline shadow-sm flex flex-col justify-between">
                  <div>
                     <h3 className="font-display font-black text-xl text-on-surface mb-1">Actieve Landen Overzicht</h3>
                     <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-8">Gesorteerd op aantal woningen</p>
                     
                     <div className="space-y-6">
                        {landAantalWoningen.map((land, idx) => {
                           const maxCount = Math.max(...landAantalWoningen.map(l => l.count)) || 1;
                           const percentage = (land.count / maxCount) * 100;
                           return (
                             <div key={land.name} className="flex items-center gap-4">
                               <div className="w-32 flex items-center gap-2 font-bold text-sm text-on-surface shrink-0">
                                 <span className="text-2xl">{land.flag}</span>
                                 <span className="truncate">{land.dutchName}</span>
                               </div>
                               <div className="flex-grow bg-slate-100 rounded-full h-4 overflow-hidden relative">
                                 <motion.div 
                                   initial={{ width: 0 }}
                                   animate={{ width: `${percentage}%` }}
                                   transition={{ duration: 0.8, ease: "easeOut" }}
                                   className="bg-emerald-500 h-full rounded-full"
                                 />
                               </div>
                               <div className="w-20 text-right font-black text-xs text-on-surface-variant shrink-0">
                                 {land.count} {land.count === 1 ? 'woning' : 'woningen'}
                               </div>
                             </div>
                           );
                        })}
                        {landAantalWoningen.length === 0 && (
                           <p className="text-xs text-on-surface-variant italic font-medium">Geen woningen gevonden.</p>
                        )}
                     </div>
                  </div>
               </div>

               {/* Grafiek 3: Woningen per Type */}
               <div className="bg-white p-8 rounded-3xl border border-outline shadow-sm">
                  <div className="flex justify-between items-center mb-8">
                     <div>
                        <h3 className="font-display font-black text-xl text-on-surface">{t('admin.stats.props_by_type', 'Woningen per Type')}</h3>
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Actueel aanbod verdeeld over types</p>
                     </div>
                  </div>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={propertyTypesData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#6B7280' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#6B7280' }} allowDecimals={false} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                          cursor={{ fill: '#f3f4f6' }}
                        />
                        <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>

               {/* Grafiek 4: Woningen per Doel */}
               <div className="bg-white p-8 rounded-3xl border border-outline shadow-sm">
                  <div className="flex justify-between items-center mb-8">
                     <div>
                        <h3 className="font-display font-black text-xl text-on-surface">{t('admin.stats.props_by_purpose', 'Woningen per Doel')}</h3>
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Actueel aanbod verdeeld op basis van doeleinden</p>
                     </div>
                  </div>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={propertyGoalsData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#6B7280' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#6B7280' }} allowDecimals={false} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                          cursor={{ fill: '#f3f4f6' }}
                        />
                        <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>

               {/* Grafiek 5: Statusoverzicht (Actief, Pauze, Inactief) */}
               <div className="bg-white p-8 rounded-3xl border border-outline shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                     <div>
                        <h3 className="font-display font-black text-xl text-on-surface">{t('admin.stats.props_status', 'Woningstatus Overzicht')}</h3>
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Aantal actieve, gepauzeerde en inactieve woningen</p>
                     </div>
                  </div>
                  <div className="h-80 w-full pt-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={propertyStatusData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#6B7280' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#6B7280' }} allowDecimals={false} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                          cursor={{ fill: '#f3f4f6' }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                           {
                             propertyStatusData.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={entry.fill} />
                             ))
                           }
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>

               {/* Grafiek 6: Prijsverdeling met filters op Land, Type en Doel */}
               <div className="bg-white p-8 rounded-3xl border border-outline shadow-sm flex flex-col justify-between">
                  <div>
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div>
                           <h3 className="font-display font-black text-xl text-on-surface">Prijsbereik Distributie</h3>
                           <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Aantal woningen binnen prijsklasse</p>
                        </div>
                     </div>
                     
                     {/* Filters voor prijsklasse grafiek */}
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-6 bg-slate-50 p-4 rounded-2xl border border-outline">
                        <div>
                           <label className="block text-[9px] font-black uppercase tracking-wider text-on-surface-variant mb-1">Landfilter</label>
                           <select
                              value={selectedStatsCountry}
                              onChange={(e) => setSelectedStatsCountry(e.target.value)}
                              className="w-full text-xs font-bold bg-white border border-outline rounded-lg p-2 outline-none cursor-pointer"
                           >
                              <option value="all">Alle Landen</option>
                              <option value="Netherlands">Nederland</option>
                              <option value="Belgium">België</option>
                           </select>
                        </div>
                        <div>
                           <label className="block text-[9px] font-black uppercase tracking-wider text-on-surface-variant mb-1">{t('admin.props.filter_type', 'Woningtype')}</label>
                           <select
                              value={selectedStatsType}
                              onChange={(e) => setSelectedStatsType(e.target.value)}
                              className="w-full text-xs font-bold bg-white border border-outline rounded-lg p-2 outline-none cursor-pointer"
                           >
                              <option value="all">Alle Types</option>
                              <option value="kamer">Kamer</option>
                              <option value="studio">Studio</option>
                              <option value="appartement">Appartement</option>
                              <option value="woning">{t('admin.props.type_woning', 'Woning')}</option>
                           </select>
                        </div>
                        <div>
                           <label className="block text-[9px] font-black uppercase tracking-wider text-on-surface-variant mb-1">{t('admin.props.filter_purpose', 'Woningdoel')}</label>
                           <select
                              value={selectedStatsGoal}
                              onChange={(e) => setSelectedStatsGoal(e.target.value)}
                              className="w-full text-xs font-bold bg-white border border-outline rounded-lg p-2 outline-none cursor-pointer"
                           >
                              <option value="all">Alle Doelen</option>
                              <option value="cohousing">Huis delen</option>
                              <option value="hospita">Hospita</option>
                              <option value="vakantie_onderhuur">Vakantie onderhuur</option>
                              <option value="huisbewaring_expat">Huisbewaring</option>
                              <option value="vrije_verhuur">Vrije verhuur</option>
                           </select>
                        </div>
                     </div>

                     <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={priceDistributionData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#6B7280' }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#6B7280' }} allowDecimals={false} />
                              <Tooltip 
                                 contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                 cursor={{ fill: '#f3f4f6' }}
                              />
                              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                           </BarChart>
                        </ResponsiveContainer>
                     </div>
                  </div>
               </div>

            </div>
          </div>
        )}

        {activeTab === 'currencies' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white rounded-[2.5rem] border border-outline shadow-sm overflow-hidden p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-inner">
                    <DollarSign size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-black text-on-surface">{t('admin.currencies.title', 'Valuta & Wisselkoersen')}</h2>
                    <p className="text-on-surface-variant text-sm font-medium">{t('admin.currencies.subtitle', 'Basisvaluta is altijd 1 Euro (€1.00).')}</p>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={16} />
                    <input 
                      type="text"
                      value={currencySearch}
                      onChange={e => setCurrencySearch(e.target.value)}
                      placeholder={t('admin.currencies.search_placeholder', 'Zoek valuta...')}
                      className="w-full bg-surface-container-lowest border-2 border-outline rounded-2xl py-3 pl-10 pr-4 text-xs font-bold outline-none focus:border-primary transition-all shadow-sm"
                    />
                  </div>

                  {ratesDirty && (
                    <button 
                      onClick={handleSaveRates}
                      disabled={ratesSaving}
                      className="bg-primary text-on-primary px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3 disabled:opacity-50"
                    >
                      {ratesSaving ? (
                        <div className="w-4 h-4 border-2 border-on-primary/20 border-t-on-primary rounded-full animate-spin" />
                      ) : (
                        <Save size={18} />
                      )}
                      Opslaan
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-12">
                {Object.keys(groupedCurrencies).length > 0 ? (
                  Object.entries(groupedCurrencies).map(([region, currs]) => (
                    <div key={region} className="space-y-4">
                      <div className="flex items-center gap-3 mb-2">
                         <div className="h-px bg-outline flex-grow" />
                         <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary bg-primary/5 px-6 py-2 rounded-full border border-primary/10">
                           {region}
                         </h3>
                         <div className="h-px bg-outline flex-grow" />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {currs.map(curr => (
                          <div key={curr.code} className={`bg-white border rounded-[2rem] p-6 group transition-all relative ${curr.code === 'EUR' ? 'border-primary/40 bg-primary/5' : 'border-outline hover:border-primary/30 hover:shadow-lg'}`}>
                            <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-surface-container-lowest border border-outline flex items-center justify-center font-display font-black text-xl text-primary shadow-inner">
                                  {curr.symbol}
                                </div>
                                <div>
                                  <div className="text-xs font-black text-on-surface uppercase tracking-widest leading-none mb-1">{curr.code}</div>
                                  <div className="text-[10px] font-bold text-on-surface-variant opacity-60 uppercase">{curr.label}</div>
                                </div>
                              </div>
                              {curr.code === 'EUR' && (
                                <div className="bg-primary text-on-primary text-[8px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest shadow-md">
                                  Basis
                                </div>
                              )}
                            </div>
                            
                            <div className="relative">
                              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 ml-2 mb-1 block">
                                Waarde t.o.v €1.00
                              </label>
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <div className="flex items-center justify-between gap-1.5 px-3 py-2.5 bg-surface-container-low rounded-xl border border-outline/30 min-w-0">
                                   <div className="flex items-center gap-1.5 overflow-hidden">
                                     <span className="text-[9px] font-black text-primary/60 uppercase shrink-0">{curr.code}</span>
                                     <span className="text-xs font-black text-primary truncate">{curr.symbol} 1.00</span>
                                   </div>
                                   <span className="text-[10px] font-bold text-on-surface-variant px-1 shrink-0">=</span>
                                   <span className="text-xs font-black text-on-surface shrink-0">€</span>
                                </div>
                                <input 
                                  type="number" 
                                  step="0.0001"
                                  disabled={curr.code === 'EUR'}
                                  value={localExchangeRates[curr.code] || 0}
                                  onChange={e => handleRateChange(curr.code, e.target.value)}
                                  className={`flex-grow min-w-0 bg-white border border-outline/50 rounded-xl px-4 py-2.5 text-sm font-black outline-none focus:border-primary transition-all shadow-sm ${curr.code === 'EUR' ? 'opacity-30 cursor-not-allowed grayscale' : ''}`}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center flex flex-col items-center gap-4 bg-surface-container-lowest rounded-[3rem] border border-dashed border-outline">
                    <div className="w-16 h-16 bg-surface-container rounded-2xl flex items-center justify-center text-on-surface-variant/30">
                      <Search size={32} />
                    </div>
                    <div>
                      <p className="text-on-surface font-black">Geen valuta's gevonden</p>
                      <p className="text-on-surface-variant text-xs font-medium">Pas je zoekopdracht "{currencySearch}" aan.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-surface-container-low border border-outline rounded-[2rem] p-8 text-on-surface-variant flex gap-6 items-start shadow-inner">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-primary shrink-0">
                <Activity size={24} />
              </div>
              <div>
                <h4 className="font-black text-on-surface text-sm uppercase tracking-widest mb-1">Impact van Koerswijzigingen</h4>
                <p className="text-xs leading-relaxed font-bold opacity-80">
                  Deze koersen worden direct doorgevoerd in de hele applicatie. Gebruikers zien huurprijzen en budgetten omgerekend op basis van deze waarden. Het is aan te raden deze koersen af en toe te controleren tegenover de laatste marktgegevens om matches accuraat te houden.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'experts' && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white rounded-[2.5rem] border border-outline shadow-sm overflow-hidden p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-inner">
                  <Globe size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-black text-on-surface">{t('admin.experts.title', 'Partner Netwerk')}</h2>
                  <p className="text-on-surface-variant text-sm font-medium">{t('admin.experts.subtitle', 'Beheer externe expert links (Juristen, Notarissen, etc.) per land.')}</p>
                </div>
              </div>
              <AdminExpertLinks />
            </div>
          </div>
        )}

        {activeTab === 'properties' && (
          <div className="space-y-6">
            <div className="bg-white rounded-[2.5rem] border border-outline shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
              {/* Filters bar */}
              <div className="p-6 border-b border-outline bg-surface-container-lowest flex flex-wrap gap-4 items-center">
                <div className="flex items-center flex-grow min-w-[280px] bg-white border border-outline rounded-xl px-4 h-11 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                   <Search size={18} className="text-on-surface-variant mr-3" />
                   <input 
                     type="text" 
                     value={searchTerm}
                     onChange={e => setSearchTerm(e.target.value)}
                     placeholder={t('admin.search_placeholder', 'Search property, city, UID...')}
                     className="bg-transparent border-none outline-none text-sm font-medium w-full"
                   />
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    <select 
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value as any)}
                      className="bg-white border border-outline rounded-xl px-4 h-11 text-sm font-bold shadow-sm outline-none cursor-pointer hover:bg-surface-container-low transition-colors"
                    >
                      <option value="all">{t('admin.status.all', 'All Statuses')}</option>
                      <option value="active">{t('admin.status.active', 'Active')}</option>
                      <option value="paused">{t('admin.status.paused', 'Pause')}</option>
                      <option value="inactive">{t('admin.status.inactive', 'Draft/Inactive')}</option>
                    </select>

                  <select 
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                    className="bg-white border border-outline rounded-xl px-4 h-11 text-sm font-bold shadow-sm outline-none cursor-pointer hover:bg-surface-container-low transition-colors"
                  >
                    <option value="date_desc">{t('admin.sort.date_desc', 'Most recent')}</option>
                    <option value="date_asc">{t('admin.sort.date_asc', 'Oldest')}</option>
                    <option value="price_desc">{t('admin.sort.price_desc', 'Price high-low')}</option>
                    <option value="price_asc">{t('admin.sort.price_asc', 'Price low-high')}</option>
                    <option value="city">{t('admin.sort.city', 'City A-Z')}</option>
                  </select>

                  <button 
                    onClick={handleMockProperties}
                    disabled={saveLoading}
                    className="bg-tertiary text-on-tertiary px-6 h-11 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
                  >
                    <Sparkles size={16} />
                    {saveLoading ? t('common.loading', 'Wait...') : t('admin.btn.mock', '100 Test Properties')}
                  </button>

                  <button 
                    onClick={handleClearProperties}
                    disabled={saveLoading}
                    className="bg-error/10 text-error px-6 h-11 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-error/20 active:scale-95 transition-all disabled:opacity-50 border border-error/20"
                  >
                    <Trash2 size={16} />
                    {saveLoading ? t('common.loading', 'Wait...') : t('admin.btn.clear', 'Clear Data')}
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="p-20 text-center text-on-surface-variant font-bold flex flex-col items-center gap-4">
                  <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  Laden...
                </div>
              ) : filteredProperties.length === 0 ? (
                <div className="p-20 text-center text-on-surface-variant font-bold">Geen woningen gevonden.</div>
              ) : viewMode === 'list' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-lowest border-b border-outline text-xs uppercase tracking-widest text-on-surface-variant">
                        <th className="p-4 font-black">Status</th>
                        <th className="p-4 font-black">{t('admin.props.col_info', 'Woning Info')}</th>
                        <th className="p-4 font-black">Locatie</th>
                        <th className="p-4 font-black">Prijs/mnd</th>
                        <th className="p-4 font-black text-right shrink-0">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map(prop => (
                        <tr 
                          key={prop.id} 
                          onClick={() => setEditingProp(prop)}
                          className="border-b border-outline last:border-0 hover:bg-surface-container-low transition-all group cursor-pointer"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                prop.status === 'available' && prop.isActive ? 'bg-success/20 text-success' :
                                prop.status === 'paused' ? 'bg-orange-500/20 text-orange-600' :
                                'bg-on-surface-variant/20 text-on-surface-variant'
                              }`}>
                                {prop.status === 'available' && prop.isActive ? t('admin.status.active', 'Active') : 
                                 prop.status === 'paused' ? t('admin.status.paused', 'Paused') : t('admin.status.inactive', 'Draft/Inactive')}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-sm text-on-surface max-w-[200px] truncate">{prop.title || 'Naamloos'}</div>
                            <div className="text-[10px] text-on-surface-variant font-bold mt-1 uppercase tracking-widest opacity-60">ID: {prop.id.substring(0, 10)}...</div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm font-bold text-on-surface">{prop.city || 'Onbekend'}</div>
                            <div className="text-xs text-on-surface-variant">{prop.neighborhood || 'Geen wijk'}</div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm font-black text-primary">
                              {prop.priceType === 'tbd' ? t('prop.money.tbd', 'Nader te bepalen') : currencyConverter.formatEur(prop.price)}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                             <ChevronRight size={18} className="ml-auto text-on-surface-variant group-hover:translate-x-1 group-hover:text-primary transition-all" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {currentItems.map(prop => (
                    <motion.div 
                      key={prop.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => setEditingProp(prop)}
                      className="bg-white border border-outline rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all cursor-pointer group flex flex-col h-full"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${prop.isActive ? 'bg-success/10 text-success' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                          {prop.isActive ? t('admin.status.active', 'Active') : t('admin.status.inactive', 'Draft/Inactive')}
                        </div>
                        <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter opacity-50"># {prop.id.substring(0, 8)}</div>
                      </div>
                      <h3 className="text-lg font-display font-black text-on-surface mb-2 leading-tight line-clamp-2">{prop.title || 'Naamloos'}</h3>
                      <div className="flex items-center gap-2 text-sm font-bold text-on-surface-variant mb-auto">
                        <MapPin size={14} className="text-primary" />
                        {prop.city}{prop.neighborhood ? `, ${prop.neighborhood}` : ''}
                      </div>
                      <div className="mt-8 pt-6 border-t border-outline flex justify-between items-center">
                        <div className="text-xl font-black text-primary">
                          {prop.priceType === 'tbd' ? t('prop.money.tbd', 'Nader te bepalen') : 
                           prop.priceType === 'range' ? `${currencyConverter.formatEur(prop.minPrice)} - ${currencyConverter.formatEur(prop.maxPrice)}` :
                           currencyConverter.formatEur(prop.price)}
                          {prop.priceType !== 'tbd' && <span className="text-xs font-bold text-on-surface-variant ml-1 opacity-60">/mnd</span>}
                        </div>
                        <div className="w-10 h-10 bg-surface-container text-on-surface-variant rounded-xl flex items-center justify-center group-hover:bg-primary group-hover:text-on-primary transition-all shadow-inner">
                          <Edit3 size={18} />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
              
              {/* Pagination bar */}
              {totalPages > 1 && (
                <div className="p-6 border-t border-outline bg-surface-container-lowest flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                     {filteredProperties.length} woningen gevonden • Pagina {currentPage} van {totalPages}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      disabled={currentPage === 1}
                      onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => prev - 1); }}
                      className="p-3 border border-outline rounded-xl hover:bg-surface-container-low transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-on-surface-variant"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    {[...Array(totalPages)].map((_, i) => (
                      <button 
                        key={i + 1}
                        onClick={(e) => { e.stopPropagation(); setCurrentPage(i + 1); }}
                        className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${currentPage === i+1 ? 'bg-primary text-on-primary shadow-lg' : 'hover:bg-surface-container'}`}
                      >
                        {i + 1}
                      </button>
                    )).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))}
                    <button 
                      disabled={currentPage === totalPages}
                      onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => prev + 1); }}
                      className="p-3 border border-outline rounded-xl hover:bg-surface-container-low transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-on-surface-variant"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'photo_moderation' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white rounded-[2.5rem] border border-outline shadow-sm overflow-hidden p-8">
              <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-on-surface">Foto Moderatie Center</h2>
                  <p className="text-sm font-medium text-on-surface-variant mt-1">
                    Controleer hier snel de recent geüploade foto's om er zeker van te zijn dat ze voldoen aan de community richtlijnen (geen fake foto's, portretten, overbevolking of ongeschikte inhoud).
                  </p>
                </div>
                <div className="bg-primary/5 text-primary border border-primary/10 px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider h-fit shrink-0">
                  {moderationPhotos.length} Geladen Foto's
                </div>
              </div>

              {photosLoading && moderationPhotos.length === 0 ? (
                <div className="text-center p-20 text-on-surface-variant font-bold bg-surface-container-lowest rounded-3xl border border-dashed border-outline/30 flex flex-col items-center justify-center">
                  <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
                  Foto's laden...
                </div>
              ) : moderationPhotos.length === 0 ? (
                <div className="text-center p-20 text-on-surface-variant font-bold bg-surface-container-lowest rounded-3xl border border-dashed border-outline/30 flex flex-col items-center justify-center">
                  <EyeOff size={48} className="text-primary opacity-40 mb-4" />
                  Er zijn momenteel geen woningfoto's om te controleren.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {moderationPhotos.map((photo) => {
                    const owner = getOwnerInfo(photo.ownerId);
                    return (
                      <div 
                        key={`${photo.propertyId}-${photo.id}`}
                        className="bg-surface-container-lowest border border-outline rounded-[2rem] overflow-hidden flex flex-col h-full hover:shadow-xl transition-all"
                      >
                        {/* Photo Display */}
                        <div className="relative aspect-video bg-black/5 flex items-center justify-center overflow-hidden group">
                          <img 
                            src={photo.url} 
                            alt={photo.propertyTitle} 
                            className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white font-bold text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full">
                            {photo.category}
                          </div>
                          
                          {owner.isSuspended && (
                            <div className="absolute inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center">
                              <span className="bg-error/20 border border-error/40 text-error-container text-xs font-black uppercase tracking-widest px-4 py-2 rounded-2xl">
                                EIGENAAR GEBLOKKEERD
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Details and Metadata */}
                        <div className="p-6 flex-grow flex flex-col justify-between">
                          <div className="space-y-4">
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-widest text-primary">
                                {photo.city}
                              </div>
                              <h3 className="font-display font-black text-on-surface text-base line-clamp-1 mt-0.5" title={photo.propertyTitle}>
                                {photo.propertyTitle}
                              </h3>
                              <div className="text-[10px] font-mono font-bold text-on-surface-variant opacity-60 mt-0.5 flex items-center gap-1">
                                <Clock size={10} />
                                Toegevoegd: {formatHhMmAgo(photo.propertyCreatedAt)}
                              </div>
                            </div>

                            {/* Owner Info block */}
                            <div className="bg-surface-container p-4 rounded-2xl border border-outline/5 space-y-1">
                              <div className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">Eigenaar details</div>
                              <div className="font-bold text-xs text-on-surface line-clamp-1">
                                {owner.name}
                              </div>
                              <div className="text-[10px] font-medium text-on-surface-variant line-clamp-1 pr-1 select-all hover:text-primary">
                                {owner.email}
                              </div>
                            </div>
                          </div>

                          {/* Quick Action buttons */}
                          <div className="grid grid-cols-2 gap-3 mt-6">
                            <button
                              onClick={() => handleDeletePhoto(photo.propertyId, photo.id)}
                              className="px-4 py-3 bg-error/10 text-error border border-error/15 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-error hover:text-white transition-all flex items-center justify-center gap-1.5 active:scale-95"
                              title="Foto direct verwijderen uit deze advertentie"
                            >
                              <Trash2 size={13} />
                              Verwijder Foto
                            </button>

                            {owner.isSuspended ? (
                              <button
                                onClick={() => handleToggleUserSuspension(photo.ownerId, true)}
                                className="px-4 py-3 bg-success/10 text-success border border-success/15 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-success hover:text-white transition-all flex items-center justify-center gap-1.5 active:scale-95"
                                title="Deblokkeer gebruiker en herstel al zijn woningen"
                              >
                                <ShieldCheck size={13} />
                                Activeren
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleUserSuspension(photo.ownerId, false)}
                                className="px-4 py-3 bg-error/5 text-error border border-error/10 hover:border-error hover:bg-error hover:text-white rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95"
                                title="Blokkeer gebruiker, sluit hem uit, en verberg al zijn woningen"
                              >
                                <EyeOff size={13} />
                                Blokkeren
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {photosHasMore && moderationPhotos.length > 0 && (
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={() => loadModerationPhotos(true)}
                    disabled={photosLoading}
                    className="px-6 py-3 bg-surface-container-low border border-outline hover:bg-surface-container transition-colors rounded-xl font-bold text-sm text-on-surface flex items-center gap-2 disabled:opacity-50"
                  >
                    {photosLoading ? (
                      <div className="w-5 h-5 border-2 border-on-surface-variant border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <ChevronRight size={18} />
                    )}
                    Laad meer foto's
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="bg-white rounded-[2.5rem] border border-outline shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
              <div className="p-6 border-b border-outline bg-surface-container-lowest flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-4">
                  <div className="flex items-center flex-grow min-w-[280px] bg-white border border-outline rounded-xl px-4 h-11 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                     <Search size={18} className="text-on-surface-variant mr-3" />
                     <input 
                       type="text" 
                       value={userSearch}
                       onChange={e => setUserSearch(e.target.value)}
                       placeholder={t('admin.user_list.search_placeholder')}
                       className="bg-transparent border-none outline-none text-sm font-medium w-full"
                     />
                  </div>
                  
                  {selectedUserIds.length > 0 && (
                     <div className="flex items-center gap-2 bg-surface-container-high rounded-xl p-1 shadow-sm">
                       <input 
                          type="number" 
                          className="bg-white rounded-lg px-3 py-2 text-xs font-bold border border-outline w-24 outline-none"
                          value={bulkCreditAmount}
                          onChange={(e) => setBulkCreditAmount(parseInt(e.target.value) || 0)}
                       />
                       <button 
                          onClick={handleBulkAddCredits}
                          disabled={bulkLoading}
                          className="bg-primary text-on-primary px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest disabled:opacity-50"
                       >
                         {bulkLoading ? '...' : `Voeg toe (${selectedUserIds.length})`}
                       </button>
                     </div>
                  )}

                  <div className="flex items-center gap-2">
                    <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mr-2 flex items-center gap-1">
                      <Filter size={14} /> {t('common.sort_by', 'Sorteren')}:
                    </div>
                    <select 
                      value={userSortBy}
                      onChange={(e) => setUserSortBy(e.target.value as any)}
                      className="bg-white border border-outline rounded-xl px-4 h-11 text-sm font-bold shadow-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer"
                    >
                      <option value="name">{t('admin.user_list.name')}</option>
                      <option value="created_desc">{t('admin.user_list.created_desc')}</option>
                      <option value="created_asc">{t('admin.user_list.created_asc')}</option>
                      <option value="login">{t('admin.user_list.last_login')}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-lowest border-b border-outline">
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                     <input type="checkbox" checked={selectedUserIds.length === currentUserItems.length && currentUserItems.length > 0} onChange={() => {
                        if (selectedUserIds.length === currentUserItems.length) setSelectedUserIds([]);
                        else setSelectedUserIds(currentUserItems.map(u => u.id));
                     }} />
                   </th>
                   <th className="p-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('admin.user_list.name')}</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('admin.user_list.email')}</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('admin.user_list.properties')}</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('admin.user_list.created')}</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('admin.user_list.last_login')}</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('admin.user_list.status')}</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-right">{t('admin.user_list.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersLoading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i} className="animate-pulse border-b border-outline/5">
                          <td colSpan={7} className="p-8"><div className="h-4 bg-surface-container rounded-full w-3/4 mx-auto"></div></td>
                        </tr>
                      ))
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-on-surface-variant font-bold">Geen gebruikers gevonden.</td>
                      </tr>
                    ) : (
                      currentUserItems.map(user => (
                        <tr 
                          key={user.id} 
                          onClick={() => { setSelectedUser(user); setIsUserModalOpen(true); }}
                          className="border-b border-outline last:border-0 hover:bg-surface-container-low transition-all group cursor-pointer"
                        >
                          <td className="p-4" onClick={(e) => e.stopPropagation()}>
                             <input type="checkbox" checked={selectedUserIds.includes(user.id)} onChange={() => {
                               if (selectedUserIds.includes(user.id)) setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                               else setSelectedUserIds([...selectedUserIds, user.id]);
                             }} />
                           </td>
                          <td className="p-4 cursor-pointer" onClick={() => { setSelectedUser(user); setIsUserModalOpen(true); }}>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
                                {user.photoURL ? (
                                  <img src={user.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                  (user.firstName?.[0] || user.displayName?.[0] || 'U').toUpperCase()
                                )}
                              </div>
                              <div className="font-bold text-sm text-on-surface truncate">
                                {user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : (user.displayName || 'Onbekend')}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="text-xs font-medium text-on-surface-variant truncate max-w-[150px]">{user.email}</div>
                          </td>
                          <td className="p-4">
                            <div className="inline-flex items-center justify-center bg-primary/5 text-primary text-xs font-black min-w-[24px] h-6 px-1.5 rounded-lg border border-primary/10">
                              {user.propertyCount || 0}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="text-[10px] font-medium text-on-surface-variant">
                              {user.createdAt ? globalFormatDate(user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt.seconds * 1000), dateFormat) : '-'}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="text-[10px] font-medium text-on-surface-variant">
                              {user.lastLoginAt ? globalFormatDate(user.lastLoginAt.toDate ? user.lastLoginAt.toDate() : new Date(user.lastLoginAt.seconds * 1000), dateFormat) : '-'}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${user.isSuspended ? 'bg-error/20 text-error' : 'bg-success/20 text-success'}`}>
                              {user.isSuspended ? t('admin.user_list.inactive') : t('admin.user_list.active')}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                             <ChevronRight size={18} className="ml-auto text-on-surface-variant group-hover:translate-x-1 group-hover:text-primary transition-all" />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* User Pagination */}
              {userTotalPages > 1 && (
                <div className="p-6 border-t border-outline bg-surface-container-lowest flex items-center justify-between">
                  <div className="text-xs font-bold text-on-surface-variant">
                    {t('common.page', 'Pagina')} {userCurrentPage} van {userTotalPages} 
                    <span className="ml-2 opacity-50">({filteredUsers.length} {t('admin.tabs.users')})</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setUserCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={userCurrentPage === 1}
                      className="p-2 border border-outline rounded-lg text-on-surface-variant hover:text-primary hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      onClick={() => setUserCurrentPage(prev => Math.min(userTotalPages, prev + 1))}
                      disabled={userCurrentPage === userTotalPages}
                      className="p-2 border border-outline rounded-lg text-on-surface-variant hover:text-primary hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'verifications' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-2xl font-black mb-4">{t('admin.verif.manual_control', 'Handmatige Controle (AI Twijfel)')}</h2>
            {pendingVerifications.length === 0 ? (
               <div className="p-12 text-center bg-surface-container rounded-3xl border border-outline/20">
                  <ShieldCheck size={48} className="mx-auto text-green-500 mb-4 opacity-50" />
                  <p className="font-bold text-on-surface-variant">{t('admin.verif.no_queue', 'Er staan geen verificaties in de wachtrij.')}</p>
               </div>
            ) : (
               <div className="space-y-6">
                 {pendingVerifications.map(user => (
                    <div key={user.id} className="bg-white p-6 rounded-3xl border border-outline/20 shadow-sm flex flex-col md:flex-row gap-6">
                       {user.verificationStatus?.level3?.manualReviewImage ? (
                          <div className="w-full md:w-1/3 aspect-[4/3] bg-black rounded-2xl overflow-hidden relative">
                             <img src={user.verificationStatus.level3.manualReviewImage} className="w-full h-full object-cover" />
                          </div>
                       ) : (
                          <div className="w-full md:w-1/3 aspect-[4/3] bg-surface-container rounded-2xl flex items-center justify-center text-sm font-bold text-on-surface-variant">{t('admin.verif.no_image', 'Geen afbeelding opgeslagen')}</div>
                       )}
                       <div className="flex-1 space-y-4">
                          <div>
                             <h4 className="font-black text-xl">{user.displayName || user.email}</h4>
                             <p className="text-sm font-bold text-on-surface-variant">{t('admin.verif.ai_result', 'AI Resultaat:')} PENDING_MANUAL ({user.verificationStatus?.level3?.confidence || 0}%)</p>
                             <p className="text-sm mt-2">{user.verificationStatus?.level3?.reason}</p>
                          </div>
                          
                          <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 text-sm">
                             <b>{t('admin.verif.ai_extract', 'AI Extractie:')}</b><br/>
                             {t('admin.verif.name', 'Naam:')} {user.verificationStatus?.level3?.extractedData?.name || t('common.unknown', 'Onbekend')}<br/>
                             Adres: {user.verificationStatus?.level3?.extractedData?.address || 'Onbekend'}
                          </div>

                          <div className="flex gap-4">
                             <button
                               onClick={async () => {
                                  try {
                                     await setAdminVerificationDecision(user.id, 'APPROVED');
                                     setPendingVerifications(prev => prev.filter(p => p.id !== user.id));
                                     toast.success("Goedgekeurd!");
                                  } catch (e) {
                                     toast.error("Fout bij opslaan");
                                  }
                               }}
                               className="bg-green-500 text-white font-bold py-2 px-6 rounded-xl hover:bg-green-600 transition-colors"
                             >Goedgekeuren (Level 3)</button>
                             <button
                               onClick={async () => {
                                  try {
                                     await setAdminVerificationDecision(user.id, 'REJECTED');
                                     setPendingVerifications(prev => prev.filter(p => p.id !== user.id));
                                     toast.success("Afgewezen");
                                  } catch (e) {
                                     toast.error("Fout bij opslaan");
                                  }
                               }}
                               className="bg-error text-white font-bold py-2 px-6 rounded-xl hover:bg-error/90 transition-colors"
                             >{t('admin.verif.reject', 'Afwijzen')}</button>
                          </div>
                       </div>
                    </div>
                 ))}
               </div>
            )}
          </div>
        )}
        
        {activeTab === 'contact' && (
          <AdminContactRequests />
        )}

        {activeTab === 'messaging' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            
            <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 md:p-8 flex items-start gap-4 shadow-sm">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shrink-0">
                <MessageSquare size={24} />
              </div>
              <div>
                <h3 className="text-lg font-display font-black text-on-surface mb-2">{t('admin.msg.header_title', 'Systeem Aankondigingen & App Freeze')}</h3>
                <p className="text-sm font-medium text-on-surface-variant leading-relaxed">
                  {t('admin.msg.header_desc', 'Beheer hier de messageboxen die bovenaan het scherm van de gebruikers verschijnen of zet de applicatie in de Freeze status. Alle tijden worden ingevoerd in CET.')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              <div className="lg:col-span-7 bg-white rounded-[2.5rem] border border-outline shadow-sm p-8 space-y-6 flex flex-col justify-start">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                  <div>
                    <h2 className="text-xl font-display font-black text-on-surface mb-1">{t('admin.msg.management', 'MessageBox Beheer')}</h2>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest text-primary">{t('admin.msg.announcement_desc', 'Aankondigingen voor specifieke doelgroepen')}</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingMsg(null);
                      setMsgText('');
                      setMsgTarget('all');
                      setMsgType('info');
                      setMsgStart('');
                      setMsgEnd('');
                      setMsgIsDisabled(false);
                      setIsMessageModalOpen(true);
                    }}
                    className="self-start sm:self-auto bg-primary text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5"
                  >
                    <MessageSquare size={14} />
                    {t('admin.msg.new_message_btn', 'Nieuw Bericht')}
                  </button>
                </div>

                <div className="space-y-4">
                  <h3 className="font-display font-black text-lg text-on-surface pb-2 border-b border-outline">{t('admin.msg.current_announcements', 'Huidige Aankondigingen')}</h3>
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 no-scrollbar">
                    {adminMessagesLoading ? (
                      <p className="text-xs text-on-surface-variant font-medium italic">{t('common.loading', 'Laden...')}</p>
                    ) : adminMessages.length === 0 ? (
                      <p className="text-xs text-on-surface-variant italic font-medium font-mono bg-slate-50 border border-dashed border-outline/50 p-6 rounded-2xl text-center">{t('admin.msg.no_announcements', 'Er zijn nog geen aankondigingen gemaakt.')}</p>
                    ) : (
                      adminMessages.map((msg) => (
                        <div key={msg.id} className="bg-slate-50 border border-outline/60 rounded-2xl p-5 hover:border-primary/20 hover:shadow-md transition-all space-y-3 relative group">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              msg.type === 'error' ? 'bg-error/10 text-error' :
                              msg.type === 'warning' ? 'bg-orange-500/10 text-orange-600' :
                              'bg-primary/10 text-primary'
                            }`}>
                              {msg.type === 'error' ? t('admin.msg.attention', 'Let op') : msg.type === 'warning' ? t('admin.msg.warning', 'Waarschuwing') : t('admin.msg.info', 'Bericht')}
                            </span>
                            
                            <span className="px-2 py-0.5 bg-slate-100 rounded-full text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
                              {t('admin.msg.target_label', 'Doel')}: {msg.targetAudience === 'all' ? t('admin.msg.all', 'Alle') : msg.targetAudience === 'huis_zoeker' ? t('admin.msg.seeker', 'Zoeker') : t('admin.msg.provider', 'Aanbieder')}
                            </span>

                            {msg.isDisabled && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[9px] font-black uppercase tracking-widest">
                                DISABLED
                              </span>
                            )}
                          </div>

                          <p className="text-sm font-bold text-on-surface leading-normal break-words whitespace-pre-wrap">{msg.text}</p>

                          <div className="flex flex-col text-[10px] font-bold text-on-surface-variant gap-1">
                            <div>{t('admin.msg.start', 'Start')}: <span className="font-black text-on-surface">{msg.startDate?.replace('T', ' ')} CET</span></div>
                            {msg.endDate && <div>{t('admin.msg.end', 'Eind')}: <span className="font-black text-on-surface">{msg.endDate?.replace('T', ' ')} CET</span></div>}
                          </div>

                          <div className="flex gap-2 justify-end pt-3 border-t border-outline/30">
                            <button
                              onClick={() => handleEditMessage(msg)}
                              className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-all flex items-center gap-1 font-bold text-[10px] uppercase tracking-wider"
                              title={t('common.edit', 'Bewerken')}
                            >
                              <Edit3 size={12} />
                              {t('common.edit_btn', 'WIJZIGEN')}
                            </button>
                            <button
                              onClick={() => setDeleteConfirmMsg(msg)}
                              className="px-3 py-1.5 bg-error/10 text-error hover:bg-error/20 hover:text-red-700 rounded-lg transition-all flex items-center gap-1 font-bold text-[10px] uppercase tracking-wider"
                              title={t('common.delete', 'Verwijderen')}
                            >
                              <Trash2 size={12} />
                              {t('common.delete_btn', 'VERWIJDER')}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 bg-white rounded-[2.5rem] border border-outline shadow-sm p-8 space-y-8 flex flex-col justify-start">
                <div>
                  <h2 className="text-xl font-display font-black text-on-surface mb-1">{t('admin.freeze.title', 'Applicatie Stoppen (Freeze)')}</h2>
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-mono text-red-600">{t('admin.freeze.subtitle', 'Totale blokkade van de applicatie')}</p>
                </div>

                <form onSubmit={handleSaveStopConfig} className="space-y-6 bg-red-50/50 p-6 rounded-3xl border border-red-200">
                  {(() => {
                    if (!stopConfig.isEnabled || !stopConfig.startDate) return null;
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    const hours = String(now.getHours()).padStart(2, '0');
                    const minutes = String(now.getMinutes()).padStart(2, '0');
                    const currentStr = `${year}-${month}-${day}T${hours}:${minutes}`;

                    const isStarted = currentStr >= stopConfig.startDate;
                    let isEnded = false;
                    if (stopConfig.duration) {
                      const parts = stopConfig.duration.split(':').map(Number);
                      if (parts.length === 2) {
                        const start = new Date(stopConfig.startDate);
                        const end = new Date(start.getTime() + (parts[0] * 60 + parts[1]) * 60 * 1050);
                        if (now > end) isEnded = true;
                      }
                    }

                    if (isStarted && !isEnded) {
                      return (
                        <div className="bg-red-600 text-white px-8 py-6 rounded-[2.5rem] text-sm font-black uppercase tracking-widest flex flex-col items-center gap-3 animate-pulse mb-8 shadow-[0_20px_50px_rgba(239,68,68,0.4)] border-4 border-white/20">
                          <div className="flex items-center gap-4">
                            <div className="w-4 h-4 bg-white rounded-full animate-ping"></div>
                            <span className="text-xl">{t('admin.freeze.live', 'FREEZE IS MOMENTEEL LIVE')}</span>
                          </div>
                          <span className="text-xs opacity-90 normal-case font-bold mt-1 tracking-tight bg-black/20 px-4 py-1 rounded-full">
                            {t('admin.freeze.live_desc', 'De applicatie is geblokkeerd voor alle reguliere gebruikers.')}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-widest text-red-700">{t('admin.freeze.status', 'Freeze Status')}</span>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={stopConfig.isEnabled || false}
                        onChange={(e) => setStopConfig({ ...stopConfig, isEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                      <span className="ml-3 text-xs font-black text-red-700 uppercase tracking-wider">
                        {stopConfig.isEnabled ? t('admin.freeze.active_status', 'ACTIEF') : t('admin.freeze.inactive_status', 'INACTIEF')}
                      </span>
                    </label>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('admin.freeze.start_time', 'Start Datum & Tijd (CET)')}</label>
                      <button 
                        type="button"
                        onClick={() => setNow((val) => setStopConfig({ ...stopConfig, startDate: val }))}
                        className="text-[9px] font-black text-red-600 hover:underline uppercase"
                      >
                        {t('admin.freeze.now', 'Nu')}
                      </button>
                    </div>
                    <input
                      type="datetime-local"
                      value={stopConfig.startDate || ''}
                      onChange={(e) => setStopConfig({ ...stopConfig, startDate: e.target.value })}
                      className="w-full bg-white border border-outline rounded-xl p-3 text-xs font-bold shadow-sm outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">{t('admin.freeze.duration', 'Duur (Uren:Minuten) (Optioneel)')}</label>
                    <p className="text-[10px] text-on-surface-variant font-medium mb-2 leading-relaxed italic">
                      {t('admin.freeze.duration_desc', 'Laat leeg om de applicatie onbeperkt te bevriezen. Gebruik het formaat "UU:MM" (bijvoorbeeld: \'02:30\' of \'24:00\').')}
                    </p>
                    <input
                      type="text"
                      value={stopConfig.duration || ''}
                      onChange={(e) => setStopConfig({ ...stopConfig, duration: e.target.value })}
                      placeholder="01:30"
                      className="w-full bg-white border border-outline rounded-xl p-3 text-xs font-bold shadow-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 font-mono">{t('admin.freeze.message', 'Freeze Bericht')}</label>
                    <textarea
                      value={stopConfig.message || ''}
                      onChange={(e) => setStopConfig({ ...stopConfig, message: e.target.value })}
                      placeholder={t('admin.freeze.placeholder', 'De website is tijdelijk offline voor gepland onderhoud. We zijn snel weer terug!')}
                      className="w-full min-h-[120px] bg-white border border-outline rounded-2xl p-4 text-sm font-medium outline-none focus:border-red-500 transition-all shadow-sm"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={stopSaving}
                    className="w-full bg-red-600 text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 shadow-md shadow-red-200 flex items-center justify-center gap-2"
                  >
                    {stopSaving ? t('common.saving', 'Bezig met opslaan...') : t('admin.freeze.save_btn', 'Freeze Config Opslaan')}
                  </button>
                </form>

                <div className="p-5 bg-red-50 text-red-800 rounded-3xl border border-red-100 flex gap-4 items-start text-xs leading-relaxed font-bold">
                  <div>🚨</div>
                  <div>
                    {t('admin.freeze.warning_desc', 'Zodra deze Freeze actief is en de starttijd is bereikt/overschreden, kunnen gebruikers de app niet meer bedienen. Er verschijnt direct een blur overlay over het hele scherm die niet kan worden weggeklikt. Dit geldt ook voor actieve sessies die de gebruiker al open heeft staan.')}
                  </div>
                </div>
              </div>

            </div>

            {/* MessageBox Form Creator/Editor Modal */}
            <AnimatePresence>
              {isMessageModalOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    className="bg-white rounded-[2.5rem] w-full max-w-2xl border border-outline shadow-2xl p-8 relative flex flex-col my-8 max-h-[85vh] overflow-y-auto no-scrollbar"
                  >
                    {/* Close button */}
                    <button
                      onClick={() => {
                        setEditingMsg(null);
                        setMsgText('');
                        setMsgTarget('all');
                        setMsgType('info');
                        setMsgStart('');
                        setMsgEnd('');
                        setMsgIsDisabled(false);
                        setIsMessageModalOpen(false);
                      }}
                      className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-100 hover:bg-slate-200 transition-colors text-slate-500"
                    >
                      <X size={20} />
                    </button>

                    <div>
                      <h2 className="text-xl font-display font-black text-on-surface mb-1">
                        {editingMsg ? t('admin.msg.edit_msg', 'Bericht Bewerken') : t('admin.msg.new_msg', 'Nieuw Bericht Aanmaken')}
                      </h2>
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest text-primary">
                        {t('admin.msg.system_announcements', 'Systeem Aankondigingen voor specifieke doelgroepen')}
                      </p>
                    </div>

                    <form onSubmit={handleSaveMessage} className="space-y-6 pt-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 font-mono">{t('admin.msg.message_text', 'Bericht Tekst')}</label>
                        <textarea
                          value={msgText}
                          onChange={(e) => setMsgText(e.target.value)}
                          placeholder={t('admin.msg.placeholder', 'Typ hier de tekst voor de messagebox...')}
                          className="w-full min-h-[120px] bg-white border border-outline rounded-2xl p-4 text-xs font-bold shadow-sm outline-none focus:border-primary transition-all leading-normal"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 font-mono">{t('admin.msg.target_audience', 'Doelgroep')}</label>
                          <select
                            value={msgTarget}
                            onChange={(e) => setMsgTarget(e.target.value as any)}
                            className="w-full bg-white border border-outline rounded-xl p-3.5 text-xs font-bold shadow-sm outline-none cursor-pointer"
                          >
                            <option value="all">{t('admin.msg.target_all', 'Alle gebruikers (Iedereen)')}</option>
                            <option value="huis_zoeker">{t('admin.msg.target_seekers', 'Woningzoekers (Seekers)')}</option>
                            <option value="huis_aanbieder">{t('admin.msg.target_providers', 'Woningaanbieders (Providers)')}</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 font-mono">{t('admin.msg.msg_type', 'Type Bericht')}</label>
                          <select
                            value={msgType}
                            onChange={(e) => setMsgType(e.target.value as any)}
                            className="w-full bg-white border border-outline rounded-xl p-3.5 text-xs font-bold shadow-sm outline-none cursor-pointer"
                          >
                            <option value="info">{t('admin.msg.type_info', 'Bericht (Blauw)')}</option>
                            <option value="warning">{t('admin.msg.type_warning', 'Waarschuwing (Oranje)')}</option>
                            <option value="error">{t('admin.msg.type_error', 'Let op (Rood)')}</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant font-mono">{t('admin.msg.start_date', 'Start Datum & Tijd (CET)')}</label>
                            <button 
                              type="button"
                              onClick={() => setNow((val) => setMsgStart(val))}
                              className="text-[9px] font-black text-primary hover:underline uppercase"
                            >
                              {t('common.now', 'Nu')}
                            </button>
                          </div>
                          <input
                            type="datetime-local"
                            value={msgStart}
                            onChange={(e) => setMsgStart(e.target.value)}
                            className="w-full bg-white border border-outline rounded-xl p-3.5 text-xs font-bold shadow-sm outline-none focus:border-primary"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 font-mono">{t('admin.msg.end_date', 'Eind Datum & Tijd (CET) (Optioneel)')}</label>
                          <input
                            type="datetime-local"
                            value={msgEnd}
                            onChange={(e) => setMsgEnd(e.target.value)}
                            className="w-full bg-white border border-outline rounded-xl p-3.5 text-xs font-bold shadow-sm outline-none focus:border-primary"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="msgIsDisabled"
                          checked={msgIsDisabled}
                          onChange={(e) => setMsgIsDisabled(e.target.checked)}
                          className="w-4 h-4 text-primary bg-white border-outline rounded focus:ring-primary cursor-pointer"
                        />
                        <label htmlFor="msgIsDisabled" className="text-xs font-black uppercase tracking-widest text-on-surface-variant select-none cursor-pointer">
                          {t('admin.msg.disable', 'Tijdelijk uitschakelen (Overrulen / Disable)')}
                        </label>
                      </div>

                      <div className="flex gap-3 pt-4 border-t border-slate-100">
                        <button
                          type="submit"
                          className="flex-1 bg-primary text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
                        >
                          <Save size={16} />
                          {editingMsg ? t('admin.msg.update_btn', 'Bericht Bijwerken') : t('admin.msg.save_btn', 'Bericht Opslaan')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMsg(null);
                            setMsgText('');
                            setMsgTarget('all');
                            setMsgType('info');
                            setMsgStart('');
                            setMsgEnd('');
                            setMsgIsDisabled(false);
                            setIsMessageModalOpen(false);
                          }}
                          className="px-6 py-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-on-surface text-xs font-black uppercase tracking-widest transition-all font-mono"
                        >
                          {t('common.cancel', 'Annuleren')}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Custom Confirmation Popup to delete a Message securely */}
            <AnimatePresence>
              {deleteConfirmMsg && (
                <div 
                  className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/85 backdrop-blur-md"
                  onClick={() => setDeleteConfirmMsg(null)}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={e => e.stopPropagation()}
                    className="bg-white rounded-3xl w-full max-w-md p-6 border border-outline shadow-2xl space-y-4"
                  >
                    <h3 className="font-display font-black text-lg text-on-surface">{t('admin.msg.delete_confirm', 'Bericht definitief verwijderen?')}</h3>
                    <p className="text-xs font-medium text-on-surface-variant leading-relaxed">
                      {t('admin.msg.delete_confirm_desc', 'Weet je heel zeker dat je het bericht:')} <strong className="break-words font-black">"{deleteConfirmMsg.text && deleteConfirmMsg.text.substring(0, 80)}{deleteConfirmMsg.text && deleteConfirmMsg.text.length > 80 ? '...' : ''}"</strong> {t('admin.msg.delete_confirm_desc2', 'definitief wilt verwijderen? Dit kan niet ongedaan worden gemaakt en het bericht verdwijnt direct bij alle gebruikers.')}
                    </p>
                    <div className="flex gap-3 justify-end pt-2">
                      <button
                        onClick={() => setDeleteConfirmMsg(null)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase cursor-pointer"
                      >
                        {t('common.cancel', 'Annuleren')}
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(deleteConfirmMsg.id)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase cursor-pointer"
                      >
                        {t('common.yes_delete', 'Ja, Verwijder')}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

          </div>
        )}

        {activeTab === 'gifts' && (
          <AdminGiftsDashboard />
        )}

        {activeTab === 'newsletter' && (
          <AdminNewsletterStudio />
        )}

        {activeTab === 'smart_match' && (
          <AdminSmartMatchAlert />
        )}
      </div>

      {/* Modals outside main flow for clean AnimatePresence handling */}
      <AnimatePresence mode="wait">
        {editingProp && (
          <PropertyEditor 
            key={`editor-${editingProp.id}`}
            prop={editingProp as any} 
            isAdmin={true}
            onClose={() => {
              setEditingProp(null);
              fetchProperties();
            }} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {isUserModalOpen && selectedUser && (
          <UserDetailModal 
            key={`user-modal-${selectedUser.id}`}
            user={selectedUser}
            isOpen={isUserModalOpen}
            onClose={() => {
              setIsUserModalOpen(false);
              setSelectedUser(null);
            }}
            onUpdate={fetchUsers}
            dateFormat={dateFormat}
          />
        )}
      </AnimatePresence>

      {/* Global generic Confirmation Dialog */}
      <AnimatePresence mode="wait">
        {confirmDialog && confirmDialog.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl relative flex flex-col items-center text-center space-y-4"
            >
              <div dangerouslySetInnerHTML={{ __html: confirmDialog.isDestructive ? '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="lucide lucide-alert-triangle mb-2 opactiy-80"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="lucide lucide-info mb-2 opacity-80"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>' }} />
              
              <h3 className="font-display font-black text-2xl text-on-surface leading-tight">
                {confirmDialog.title}
              </h3>
              <p className="text-sm font-medium text-on-surface-variant leading-relaxed">
                {confirmDialog.message}
              </p>
              
              <div className="w-full flex flex-col gap-3 pt-6">
                <button
                  onClick={confirmDialog.onConfirm}
                  className={`w-full py-4 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 ${confirmDialog.isDestructive ? 'bg-[#ef4444] shadow-[#ef4444]/20 hover:bg-[#dc2626]' : 'bg-[#3b82f6] shadow-[#3b82f6]/20 hover:bg-[#2563eb]'}`}
                >
                  {confirmDialog.confirmText || 'Bevestigen'}
                </button>
                <button
                  onClick={confirmDialog.onCancel}
                  className="w-full py-4 bg-surface-container-low text-on-surface font-black text-xs uppercase tracking-widest rounded-xl hover:bg-surface-container transition-all active:scale-95"
                >
                  {confirmDialog.cancelText || 'Annuleren'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
