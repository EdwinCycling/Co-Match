import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { 
  fetchNewsletterData, 
  generateNewsletterHTML, 
  NewsletterInputData 
} from '../services/newsletterService';
import { 
  Mail, Sparkles, RefreshCw, Copy, Check, X, FileText, 
  Settings, Loader2, Home, Gift, Eye, ExternalLink, Calendar
} from 'lucide-react';

export default function AdminNewsletterStudio() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [inputData, setInputData] = useState<NewsletterInputData | null>(null);
  const [generatedHtml, setGeneratedHtml] = useState<string>('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  // Staggered generation progress messages
  const [progressMsg, setProgressMsg] = useState('');

  const loadDatabaseStatus = async () => {
    setDataLoading(true);
    try {
      const dbData = await fetchNewsletterData();
      setInputData(dbData);
    } catch (err) {
      console.error("Error loading database counts:", err);
      toast.error("Fout bij het laden van database-statistieken.");
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    loadDatabaseStatus();
  }, []);

  const handleGenerateNewsletter = async () => {
    setLoading(true);
    setProgressMsg("Database gegevens ophalen van afgelopen 7 dagen...");
    
    try {
      // 1. Fetch fresh data
      const dbData = await fetchNewsletterData();
      setInputData(dbData);
      
      await new Promise(r => setTimeout(r, 600));
      setProgressMsg("Samenstellen van prompts voor Gemini Flash...");
      
      await new Promise(r => setTimeout(r, 500));
      setProgressMsg("Gemini intelligentie configureren en email compileren...");

      const currentSiteUrl = window.location.origin;

      // 2. Query Gemini API
      const htmlResult = await generateNewsletterHTML(dbData, currentSiteUrl);
      setGeneratedHtml(htmlResult);
      setShowPreviewModal(true);
      toast.success("AI Nieuwsbrief succesvol gegenereerd!");
    } catch (error: any) {
      console.error("Gemini Newsletter generation error:", error);
      toast.error(`Genereren mislukt: ${error.message || "Onbekende fout"}`);
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  const handleCopyToClipboard = () => {
    if (!generatedHtml) return;
    navigator.clipboard.writeText(generatedHtml)
      .then(() => {
        setIsCopied(true);
        toast.success("E-mail HTML gekopieerd naar klembord!");
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch((err) => {
        console.error("Clipboard copy error:", err);
        toast.error("Kon e-mail HTML niet kopiëren.");
      });
  };

  return (
    <div id="newsletter-studio-wrapper" className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      
      {/* Introduction Banner Card */}
      <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
        <div className="flex gap-4 items-start">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shrink-0">
            <Mail size={24} />
          </div>
          <div>
            <h3 className="text-lg font-display font-black text-on-surface mb-2">Newsletter Studio</h3>
            <p className="text-sm font-medium text-on-surface-variant leading-relaxed max-w-2xl">
              {t('admin.newsletter.intro_desc', 'Genereer een wekelijkse e-mailnieuwsbrief gebaseerd op de nieuwste functies en de 10 meest recent toegevoegde woningen op Co-Match. De AI (Gemini Flash) schrijft de introductie, structureert de functies per doelgroep en ontwerpt een kant-en-klaar responsive HTML-mailbericht.')}
            </p>
          </div>
        </div>

        <button
          onClick={handleGenerateNewsletter}
          disabled={loading || dataLoading}
          className="bg-primary text-white hover:bg-primary-hover font-black text-xs uppercase tracking-widest px-6 py-4 rounded-2xl transition-all shadow-md flex items-center gap-2 shrink-0 select-none cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {t('admin.newsletter.generate_btn', 'Genereer Nieuwsbrief [Preview]')}
        </button>
      </div>

      {/* Date Range Target Banner */}
      {!dataLoading && inputData && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-amber-900 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/20 rounded-2xl text-amber-700 shrink-0">
              <Calendar size={22} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-amber-800">{t('admin.newsletter.target_period', 'Doelperiode wekelijkse digest (Komende Week)')}</p>
              <p className="text-sm font-bold">{t('admin.newsletter.week_days', 'Week van maandag t/m zondag')}: <span className="underline font-black">{inputData.upcomingWeekRange}</span></p>
            </div>
          </div>
          <span className="text-[11px] font-black uppercase tracking-wider bg-amber-500/20 px-3 py-1.5 rounded-full text-amber-800 shrink-0">
            {t('admin.newsletter.next_week', 'Volgende week')} ({inputData.upcomingWeekId})
          </span>
        </div>
      )}

      {/* Grid: Previewing what data is going into the newsletter */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Recent Updates Feature Section */}
        <div className="bg-white border border-outline/50 rounded-3xl p-6 shadow-sm flex flex-col h-[520px]">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <Gift size={20} className="text-primary" />
              <h4 className="font-display font-black text-sm uppercase tracking-wider text-on-surface">
                Updates &amp; Gifts (7 dagen)
              </h4>
            </div>
            {dataLoading && <Loader2 size={16} className="animate-spin text-outline-variant" />}
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-4 no-scrollbar">
            {dataLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-outline-variant">
                <Loader2 size={32} className="animate-spin mb-2" />
                <p className="text-xs">Updates aan het ophalen...</p>
              </div>
            ) : !inputData || inputData.recentUpdates.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-on-surface-variant text-center p-6 border-2 border-dashed border-outline-variant/50 rounded-3xl">
                <Calendar size={36} className="text-outline-variant mb-3" />
                <p className="font-bold text-sm">Geen updates gevonden</p>
                <p className="text-xs text-outline-variant mt-1 leading-relaxed">
                  Er zijn de afgelopen 7 dagen geen updates handmatig toegevoegd. De AI schrijft een sfeervolle introductie om de nieuwsbrief warm in te luiden!
                </p>
              </div>
            ) : (
              inputData.recentUpdates.map((item, idx) => (
                <div key={idx} className="bg-surface-container-low border border-outline/30 rounded-2xl p-4 space-y-2 hover:border-primary/20 transition-all">
                  <div className="flex justify-between items-start gap-4">
                    <span className="font-extrabold text-xs text-on-surface leading-snug">{item.title}</span>
                    <span className="text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                      Target: {item.targetAudience}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">{item.message}</p>
                  <div className="text-[10px] text-outline-variant font-mono">
                    Gepland op: {new Date(item.startDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Highlighted Properties Column */}
        <div className="bg-white border border-outline/50 rounded-3xl p-6 shadow-sm flex flex-col h-[520px]">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-amber-500" />
              <h4 className="font-display font-black text-sm uppercase tracking-wider text-on-surface">
                Highlights (Komende Week)
              </h4>
            </div>
            {dataLoading && <Loader2 size={16} className="animate-spin text-outline-variant" />}
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-4 no-scrollbar">
            {dataLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-outline-variant">
                <Loader2 size={32} className="animate-spin mb-2" />
                <p className="text-xs">Highlights aan het laden...</p>
              </div>
            ) : !inputData || !inputData.highlightedPropertiesList || inputData.highlightedPropertiesList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-on-surface-variant text-center p-6 border-2 border-dashed border-outline-variant/30 rounded-3xl bg-amber-500/5">
                <Sparkles size={36} className="text-amber-500/40 mb-3" />
                <p className="font-bold text-sm text-amber-800">Geen woningen gehighlight</p>
                <p className="text-xs text-outline-variant mt-1 leading-relaxed">
                  Er zijn voor de week van {inputData?.upcomingWeekRange || 'komende week'} nog geen woningen gehighlight door aanbieders. De highlight-sectie wordt automatisch verborgen in de e-mail.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 font-bold text-xs p-3 rounded-2xl flex gap-1.5 items-center">
                  <Sparkles size={14} className="shrink-0 text-amber-600 animate-pulse" />
                  <span>{inputData.highlightedPropertiesList.length} highlight woningen actief voor deze week!</span>
                </div>
                {inputData.highlightedPropertiesList.map((prop, idx) => (
                  <div key={idx} className="bg-amber-500/5 border border-amber-500/25 rounded-2xl p-3 flex gap-3.5 hover:border-amber-500/45 transition-all items-center">
                    <img 
                      src={prop.imageUrl} 
                      alt="" 
                      className="w-14 h-14 rounded-xl object-cover border border-amber-500/10 shrink-0 bg-surface-container-high shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-semibold text-xs text-amber-950 truncate leading-tight block">{prop.title}</span>
                        <span className="text-[10px] font-mono text-amber-800 shrink-0 font-bold">{prop.price}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-on-surface-variant truncate">{prop.location}</span>
                        {prop.isWorkReadyBadge && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">
                            💼 Work-Ready
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 10 Newest Listings Panel */}
        <div className="bg-white border border-outline/50 rounded-3xl p-6 shadow-sm flex flex-col h-[520px]">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <Home size={20} className="text-primary" />
              <h4 className="font-display font-black text-sm uppercase tracking-wider text-on-surface">
                10 Nieuwste Woningen
              </h4>
            </div>
            {dataLoading && <Loader2 size={16} className="animate-spin text-outline-variant" />}
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-4 no-scrollbar">
            {dataLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-outline-variant">
                <Loader2 size={32} className="animate-spin mb-2" />
                <p className="text-xs">Woningen aan het laden...</p>
              </div>
            ) : !inputData || inputData.propertiesList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-on-surface-variant text-center p-6 border-2 border-dashed border-outline-variant/50 rounded-3xl">
                <Home size={36} className="text-outline-variant mb-3" />
                <p className="font-bold text-sm">Geen actieve woningen gevonden</p>
                <p className="text-xs text-outline-variant mt-1">Er zijn momenteel geen actieve beschikbare woningen in de database.</p>
              </div>
            ) : (
              inputData.propertiesList.map((prop, idx) => (
                <div key={idx} className="bg-surface-container-low border border-outline/30 rounded-2xl p-3 flex gap-4 hover:border-primary/20 transition-all items-center">
                  <img 
                    src={prop.imageUrl} 
                    alt="" 
                    className="w-14 h-14 rounded-xl object-cover border border-outline/30 shrink-0 bg-surface-container-high"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-extrabold text-xs text-on-surface truncate leading-tight block">{prop.title}</span>
                      <span className="text-[10px] font-mono text-outline-variant shrink-0">{prop.price}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-on-surface-variant/80 truncate">{prop.location}</span>
                      {prop.isWorkReadyBadge && (
                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">
                          💼 Work-Ready
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Staggered loader overlay during generation */}
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] border border-outline/50 p-8 md:p-12 max-w-md w-full text-center space-y-6 shadow-2xl"
            >
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-pulse" />
                <Loader2 className="w-20 h-20 text-primary animate-spin" strokeWidth={1.5} />
                <Sparkles className="w-8 h-8 text-primary absolute inset-0 m-auto animate-bounce" />
              </div>
              <div className="space-y-2">
                <h4 className="font-display font-black text-xl text-on-surface text-balance uppercase tracking-wider">AI Opmaken & Verwerken</h4>
                <p className="text-xs font-semibold text-primary">{progressMsg}</p>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed max-w-sm mx-auto">
                Onze e-mail compiler ontwerpt momenteel de HTML layout met de Gemini Flash-modelleerlaag. Dit duurt gewoonlijk 5 tot 15 seconden. Dank voor je geduld!
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Styled Email Client Inbox Modal (Preview) */}
      <AnimatePresence>
        {showPreviewModal && (
          <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-gray-100 rounded-[2rem] border border-white/20 w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            >
              
              {/* Inbox Client Header Panel */}
              <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 shadow-sm">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                    <span className="font-mono text-[10px] text-gray-500 uppercase tracking-widest font-black">AI Generated Email Preview</span>
                  </div>
                  <h3 className="font-display font-black text-md text-gray-950 uppercase tracking-wide">
                    Weekly Digest
                  </h3>
                </div>

                {/* Main Client Actions */}
                <div className="flex items-center gap-2 w-full md:w-auto self-stretch md:self-auto justify-end">
                  <button
                    onClick={handleCopyToClipboard}
                    className="flex-1 md:flex-none justify-center bg-gray-900 text-white hover:bg-gray-850 font-black text-xs uppercase tracking-widest px-5 py-3 rounded-xl transition-all shadow flex items-center gap-2 cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check size={14} className="text-emerald-400" />
                        Gekopieerd!
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        Kopieer HTML Code
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleGenerateNewsletter}
                    className="p-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl border border-gray-200 transition-all hover:scale-105"
                    title="Nieuwe AI-versie genereren"
                  >
                    <RefreshCw size={14} />
                  </button>

                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="p-3 text-gray-400 hover:text-gray-900 bg-gray-150 hover:bg-gray-200 rounded-xl transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* simulated Inbox envelop information */}
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 text-xs text-gray-600 font-medium space-y-1 shrink-0">
                <div className="flex gap-2">
                  <span className="w-16 font-semibold text-gray-400">Van:</span>
                  <span className="text-gray-800 font-semibold">Co-Match Digest &lt;news@co-match.nl&gt;</span>
                </div>
                <div className="flex gap-2">
                  <span className="w-16 font-semibold text-gray-400">Aan:</span>
                  <span className="text-gray-800">Co-Match Cohousing Community (Al onze leden)</span>
                </div>
                <div className="flex gap-2">
                  <span className="w-16 font-semibold text-gray-400">Onderwerp:</span>
                  <span className="text-gray-950 font-bold">✨ Co-Match Weekly Digest: What's new in the community? 🏡</span>
                </div>
              </div>

              {/* Rendered iFrame mail body */}
              <div className="flex-1 p-6 overflow-y-auto bg-gray-200/50 flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow-md w-full h-full max-w-4xl overflow-hidden border border-gray-200 flex flex-col">
                  {generatedHtml ? (
                    <iframe
                      srcDoc={generatedHtml}
                      title="Email Preview Frame"
                      className="w-full h-full border-0 flex-1 bg-white"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6">
                      <FileText size={48} className="mb-4 text-gray-300 animate-pulse" />
                      <p className="font-extrabold">Geen email preview gegenereerd.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Simulated client envelope status footer */}
              <div className="bg-white border-t border-gray-200 py-3 px-6 text-center text-[10px] text-gray-400 shrink-0 font-medium font-mono uppercase tracking-wider">
                💡 TIP: Kopieer de HTML code naar je favoriete e-mail verzendtool (Mailchimp, SendGrid of Brevo) om direct te verzenden!
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
