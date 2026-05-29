import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { 
  runSmartMatchAlertsJob, 
  SmartMatchAlertLog 
} from '../services/smartMatchAlertService';
import { 
  Sparkles, Mail, RefreshCw, Eye, X, Home, Users, CheckCircle, 
  AlertCircle, ChevronRight, Play, Check, ShieldCheck, Heart
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';

export default function AdminSmartMatchAlert() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<SmartMatchAlertLog[]>([]);
  const [previewLog, setPreviewLog] = useState<any | null>(null);
  const [isTestBypass24h, setIsTestBypass24h] = useState(true);

  // Stored histories tab integration
  const [activeTab, setActiveTab] = useState<'simulation' | 'history'>('simulation');
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Stats
  const totalProcessed = logs.length;
  const totalTriggered = logs.filter(l => l.triggered).length;
  const totalSkipped = logs.filter(l => !l.triggered).length;

  const handleRunAlertsJob = async (showToast = true) => {
    setLoading(true);
    try {
      // Manual test: passes isTestBypass24h to bypass the 24-hour limit
      const results = await runSmartMatchAlertsJob(isTestBypass24h);
      setLogs(results);
      if (showToast) {
        toast.success(
          `Smart Match Alerts verwerkt! ${results.filter(r => r.triggered).length} email(s) gesimuleerd.`
        );
      }
    } catch (err: any) {
      console.error(err);
      if (showToast) {
        toast.error(`Verwerking mislukt: ${err.message || 'Onbekende fout'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAllHistoricalEmails = async () => {
    setHistoryLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const allHistories: any[] = [];
      
      const fetchPromises = usersSnap.docs.map(async (userDoc) => {
        const userData = userDoc.data();
        const userId = userDoc.id;
        try {
          const historySnap = await getDoc(doc(db, 'users', userId, 'settings', 'alert_history'));
          if (historySnap.exists()) {
            const historyData = historySnap.data();
            const alerts = historyData.alerts || [];
            alerts.forEach((alert: any) => {
              allHistories.push({
                ...alert,
                userId,
                userName: userData.displayName || 'Onbekende gebruiker',
                userEmail: userData.email || 'Geen email',
                userLanguage: userData.language || 'nl'
              });
            });
          }
        } catch (e) {
          console.error(`Error loading alert history for user ${userId}:`, e);
        }
      });
      
      await Promise.all(fetchPromises);
      
      // Sort by createdAt descending
      allHistories.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      
      setHistoryLogs(allHistories);
    } catch (err: any) {
      console.error('Failed to load email history:', err);
      toast.error('Kon e-mailgeschiedenis niet laden.');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    // Run an initial simulation quietly on mount (no toasts on mounting tab)
    handleRunAlertsJob(false);
  }, [isTestBypass24h]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadAllHistoricalEmails();
    }
  }, [activeTab]);

  return (
    <div id="smart-match-alert-panel-wrapper" className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      
      {/* Introduction Card */}
      <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
        <div className="flex gap-4 items-start">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shrink-0">
            <Sparkles size={24} className="text-primary animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-display font-black text-on-surface mb-2">Smart Match Alert Studio</h3>
            <p className="text-sm font-medium text-on-surface-variant leading-relaxed max-w-2xl">
              {t('admin.smartmatch.desc', 'Beheer en test de intelligente Smart Match Alert-functie en de chat notificatiemails. De cronjob loopt elk uur door alle actieve zoekers, en aanbieders versturen direct e-mails bij chatberichten. Beide soorten mailtjes worden hier opgeslagen in de database.')}
            </p>
          </div>
        </div>

        <div className="flex gap-3 shrink-0">
          <button
            onClick={() => {
              if (activeTab === 'history') {
                loadAllHistoricalEmails();
              } else {
                handleRunAlertsJob(true);
              }
            }}
            disabled={loading || historyLoading}
            className="bg-primary text-white hover:bg-primary-hover font-black text-xs uppercase tracking-widest px-6 py-4 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 select-none cursor-pointer disabled:opacity-50"
          >
            {loading || historyLoading ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            {activeTab === 'history' ? t('admin.smartmatch.refresh_history', 'Ververs e-mailhistorie') : t('admin.smartmatch.simulate_now', 'Simuleer Cron-Job Nu')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline/20 gap-6">
        <button
          onClick={() => setActiveTab('simulation')}
          className={`pb-4 px-1 text-xs sm:text-sm font-black uppercase tracking-wider transition-all relative ${
            activeTab === 'simulation' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span>{t('admin.smartmatch.tab_simulation', 'Cron-Job Matcher Simulatie')}</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-4 px-1 text-xs sm:text-sm font-black uppercase tracking-wider transition-all relative flex items-center gap-2 ${
            activeTab === 'history' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span>{t('admin.smartmatch.tab_history', 'Database E-mail Logboek')} ({historyLogs.length})</span>
          <span className="bg-primary/10 text-primary text-[9px] px-2 py-0.5 rounded-full font-extrabold tracking-normal">LIVE EN CHATS</span>
        </button>
      </div>

      {activeTab === 'simulation' ? (
        <>
          {/* Analytics stats bento row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-outline/40 rounded-2xl p-5 shadow-sm space-y-1">
              <div className="text-[10px] font-black uppercase text-outline-variant tracking-wider">Totaal Verwerkt</div>
              <div className="text-2xl font-black text-on-surface flex items-center gap-2">
                <Users size={20} className="text-blue-500" />
                {totalProcessed}
              </div>
              <div className="text-[10px] text-outline-variant font-medium">Leden in database scan</div>
            </div>

            <div className="bg-white border border-outline/40 rounded-2xl p-5 shadow-sm space-y-1">
              <div className="text-[10px] font-black uppercase text-outline-variant tracking-wider">Simulatie Type</div>
              <div className="text-xl font-black text-on-surface capitalize flex items-center gap-1.5 py-0.5">
                <ShieldCheck size={20} className="text-primary" />
                {isTestBypass24h ? "Testmodus" : "Productie"}
              </div>
              <div className="text-[10px] text-outline-variant font-medium">Bypass 24h filter: {isTestBypass24h ? "AAN (matcht alle huizen)" : "UIT"}</div>
            </div>

            <div className="bg-white border border-outline/40 rounded-2xl p-5 shadow-sm space-y-1">
              <div className="text-[10px] font-black uppercase text-outline-variant tracking-wider">E-mails Triggered</div>
              <div className="text-2xl font-black text-emerald-600 flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                {totalTriggered}
              </div>
              <div className="text-[10px] text-emerald-600/80 font-medium">Perfect matchend (type, doel, budget & radius)</div>
            </div>

            <div className="bg-white border border-outline/40 rounded-2xl p-5 shadow-sm space-y-1">
              <div className="text-[10px] font-black uppercase text-outline-variant tracking-wider">Overgeslagen</div>
              <div className="text-2xl font-black text-on-surface-variant flex items-center gap-2">
                <AlertCircle size={20} className="text-gray-400" />
                {totalSkipped}
              </div>
              <div className="text-[10px] text-outline-variant font-medium">Geen match of ontbrekende criteria</div>
            </div>
          </div>

          {/* Main logs visualizer list */}
          <div className="bg-white border border-outline/50 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div className="space-y-1">
                <h4 className="font-display font-black text-sm uppercase tracking-wider text-on-surface">
                  Simulatie Activiteiten &amp; Resultaten
                </h4>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                  Test en controleer de werking van de matchmaker cronjob.
                </p>
              </div>
              <span className="text-[10px] font-mono text-outline-variant font-bold">
                Verwerkt om CET: {new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-outline/25 text-outline-variant text-[10px] uppercase font-black tracking-widest bg-surface-container-low">
                    <th className="py-4 px-4 rounded-l-2xl">Datum / Tijd</th>
                    <th className="py-4 px-4">Ontvanger (Zoeker)</th>
                    <th className="py-4 px-4">E-mail Onderwerp</th>
                    <th className="py-4 px-4">Matchende Woningen</th>
                    <th className="py-4 px-4 rounded-r-2xl text-right">E-mail preview</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline/10 text-xs text-on-surface">
                  {logs.filter(l => l.triggered).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-on-surface-variant">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <Mail size={36} className="text-outline-variant animate-pulse" />
                          <p className="font-bold">Geen verzonden e-mails in logboek.</p>
                          <p className="text-xs text-outline-variant">Er zijn momenteel geen zoekers met nieuwe woningen die 100% voldoen aan hun criteria.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    logs.filter(l => l.triggered).map((log, idx) => (
                      <tr key={idx} className="hover:bg-surface-container-low transition-colors group">
                        <td className="py-4 px-4 whitespace-nowrap font-mono font-bold text-primary">
                          {new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-extrabold text-on-surface group-hover:text-primary transition-colors">
                            {log.userName}
                          </div>
                          <div className="text-[10px] text-on-surface-variant font-semibold mt-0.5">
                            {log.userEmail} <span className="uppercase font-black text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded ml-1">{log.userLanguage}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 max-w-xs font-semibold truncate text-on-surface-variant" title={log.subject}>
                          {log.subject || "Smart Match Update"}
                        </td>
                        <td className="py-4 px-4 max-w-sm">
                          <div className="space-y-1.5">
                            {log.matches.map((match, mIdx) => (
                              <div key={mIdx} className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-1.5 flex justify-between items-center gap-4 text-[11px]">
                                <span className="font-semibold text-emerald-950 truncate max-w-[200px]">🏡 {match.title}</span>
                                <span className="font-bold text-emerald-700 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">
                                  MATCH! ✨
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => setPreviewLog(log)}
                            className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-all inline-flex items-center gap-1 cursor-pointer font-bold text-xs"
                          >
                            <Eye size={16} />
                            <span>Preview</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Database History Logs Container */
        <div className="bg-white border border-outline/50 rounded-3xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div className="space-y-1">
              <h4 className="font-display font-black text-sm uppercase tracking-wider text-on-surface">
                Geschiedenis van Live Gesimuleerde E-mails
              </h4>
              <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                Alle e-mails die daadwerkelijk zijn opgeslagen in de database (inclusief directe chatberichten notifications).
              </p>
            </div>
            <button
              onClick={loadAllHistoricalEmails}
              disabled={historyLoading}
              className="text-xs bg-surface-container-high hover:bg-outline/25 font-bold uppercase tracking-wider text-on-surface px-4 py-2 rounded-xl border border-outline/30 transition-all flex items-center gap-1.5"
            >
              <RefreshCw size={14} className={historyLoading ? 'animate-spin' : ''} />
              Verversen
            </button>
          </div>

          {historyLoading ? (
            <div className="py-20 text-center text-on-surface-variant">
              <RefreshCw className="animate-spin text-primary mx-auto mb-4" size={32} />
              <p className="font-bold uppercase tracking-wider text-xs">E-mailhistorie laden uit Firestore...</p>
            </div>
          ) : historyLogs.length === 0 ? (
            <div className="py-20 text-center text-on-surface-variant space-y-3">
              <Mail size={40} className="text-outline-variant mx-auto animate-bounce" />
              <p className="font-bold">Nog geen e-mails verzonden of live gesimuleerd in deze database.</p>
              <p className="text-xs text-outline-variant max-w-md mx-auto">
                Tip: stuur een chatbericht als aanbieder naar een zoeker, of maak een matchende woning aan om hier de notificaties te loggen!
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-outline/25 text-outline-variant text-[10px] uppercase font-black tracking-widest bg-surface-container-low">
                    <th className="py-4 px-4 rounded-l-2xl">Datum / Tijd</th>
                    <th className="py-4 px-4">Ontvanger (Gebruiker)</th>
                    <th className="py-4 px-4">Type Alert</th>
                    <th className="py-4 px-4">E-mail Onderwerp</th>
                    <th className="py-4 px-4 rounded-r-2xl text-right">Preview</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline/10 text-xs text-on-surface">
                  {historyLogs.map((log: any, idx: number) => {
                    const formattedDate = log.createdAt 
                      ? new Date(log.createdAt).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' - ' + new Date(log.createdAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
                      : 'Onbekend';
                    return (
                      <tr key={idx} className="hover:bg-surface-container-low transition-colors group">
                        <td className="py-4 px-4 whitespace-nowrap font-mono font-bold text-primary">
                          {formattedDate}
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-extrabold text-on-surface">
                            {log.recipientName || log.userName}
                          </div>
                          <div className="text-[10px] text-on-surface-variant font-semibold mt-0.5">
                            {log.recipientEmail || log.userEmail}
                          </div>
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          {log.isChatAlert ? (
                            log.isProviderAlert ? (
                              <span className="bg-sky-100 text-sky-900 border border-sky-300 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl">
                                💬 Aanbieder Chat
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl">
                                💬 Zoeker Chat
                              </span>
                            )
                          ) : (
                            <span className="bg-emerald-150 text-emerald-900 border border-emerald-300 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl">
                              ✨ Smart Match Alert
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 font-semibold text-on-surface-variant truncate max-w-xs" title={log.subject}>
                          {log.subject}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => setPreviewLog(log)}
                            className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-all inline-flex items-center gap-1 cursor-pointer font-bold text-xs"
                          >
                            <Eye size={16} />
                            <span>Preview</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Structured email lightbox preview popup modal */}
      <AnimatePresence>
        {previewLog && (
          <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-md flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] border border-outline/50 w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            >
              
              {/* Modal Client Header */}
              <div className="bg-white border-b border-outline/10 px-6 py-4 flex justify-between items-center shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/15 rounded-xl flex items-center justify-center text-primary text-md">📬</div>
                  <div>
                    <h3 className="font-display font-black text-sm uppercase tracking-wide text-on-surface">
                      Gesimuleerde Mail Preview
                    </h3>
                    <p className="text-[10px] font-mono text-outline-variant uppercase tracking-widest font-bold">
                      Ontvanger: {previewLog.userName} ({previewLog.userLanguage || 'nl'})
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setPreviewLog(null)}
                  className="p-3 text-on-surface-variant hover:text-on-surface bg-surface-container-high hover:bg-outline/25 rounded-xl transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              {/* simulated Inbox envelop information */}
              <div className="bg-surface-container-low px-6 py-3.5 border-b border-outline/10 text-xs text-on-surface-variant font-medium space-y-1.5 shrink-0">
                <div className="flex gap-2">
                  <span className="w-16 font-extrabold text-outline-variant">Van:</span>
                  <span className="text-on-surface font-extrabold">Co-Match Matchmaker &lt;alerts@co-match.nl&gt;</span>
                </div>
                <div className="flex gap-2">
                  <span className="w-16 font-extrabold text-outline-variant">Aan:</span>
                  <span className="text-on-surface">{previewLog.userName} &lt;{previewLog.userEmail}&gt;</span>
                </div>
                <div className="flex gap-2">
                  <span className="w-16 font-extrabold text-outline-variant">Onderwerp:</span>
                  <span className="text-on-surface font-bold">{previewLog.subject}</span>
                </div>
              </div>

              {/* Rendered iFrame mail body */}
              <div className="flex-1 p-6 bg-slate-100 flex items-center justify-center overflow-hidden">
                <div className="bg-white rounded-2xl shadow-inner w-full h-full max-w-3xl overflow-hidden border border-outline/10 flex flex-col">
                  <iframe
                    srcDoc={previewLog.html || (previewLog.triggered ? previewLog.html : '')}
                    title="Smart Match Email Frame"
                    className="w-full h-full border-0 flex-1 bg-white"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>

              {/* Simulated client status footer */}
              <div className="bg-white border-t border-outline/15 py-3.5 px-6 text-center text-[10px] text-outline-variant shrink-0 font-medium font-mono uppercase tracking-widest">
                {previewLog.isChatAlert 
                  ? "💡 CHAT ALERT LOGICA: Dit is een directe, realtime notificatie-email die wordt getriggerd zodra een aanbieder chat."
                  : "💡 ALERTS LOGICA: Deze e-mail bevat de top matches geselecteerd op basis van de matchmaker cronjob."
                }
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
