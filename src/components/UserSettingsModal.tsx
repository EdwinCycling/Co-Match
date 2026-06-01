import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Search, Globe, Download, Smartphone, Monitor } from 'lucide-react';
import { useSettings, ThemeType, UnitType, DateFormatType } from '../contexts/SettingsContext';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_CURRENCIES } from '../constants';
import { APP_LANGUAGE_STORAGE_KEY } from '../config/appLanguages';
import LanguageSelectList from './LanguageSelectList';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
}

export default function UserSettingsModal({ isOpen, onClose, userRole }: Props) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme, unit, setUnit, dateFormat, setDateFormat, timeFormat, setTimeFormat, currency, setCurrency, newsletterEnabled, setNewsletterEnabled, smartMatchAlertEnabled, setSmartMatchAlertEnabled, smartMatchAlertHour, chatMailAlertEnabled, setChatMailAlertEnabled, providerChatMailAlertOption, setProviderChatMailAlertOption, saveSettings } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // Group currencies by region and filter by search
  const groupedCurrencies = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
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
  }, [searchQuery]);

  const THEMES: { id: ThemeType; label: string; desc: string; colors: string[] }[] = [
    { id: 'rustic', label: t('theme.rustic'), desc: t('theme.rustic_desc'), colors: ['#5A5A40', '#8B7E66'] },
    { id: 'nordic', label: t('theme.nordic'), desc: t('theme.nordic_desc'), colors: ['#0f4c81', '#708090'] },
    { id: 'midnight', label: t('theme.midnight'), desc: t('theme.midnight_desc'), colors: ['#bc13fe', '#00ffff'] },
    { id: 'terracotta', label: t('theme.terracotta'), desc: t('theme.terracotta_desc'), colors: ['#cc6b49', '#7d967b'] },
    { id: 'royal', label: t('theme.royal'), desc: t('theme.royal_desc'), colors: ['#000080', '#800020'] },
    { id: 'candy', label: t('theme.candy'), desc: t('theme.candy_desc'), colors: ['#ff69b4', '#98ff98'] },
    { id: 'forest', label: t('theme.forest'), desc: t('theme.forest_desc'), colors: ['#154c40', '#36454f'] },
    { id: 'digital', label: t('theme.digital'), desc: t('theme.digital_desc'), colors: ['#50c878', '#3b3c36'] },
    { id: 'sunset', label: t('theme.sunset'), desc: t('theme.sunset_desc'), colors: ['#ff7f50', '#c8a2c8'] },
    { id: 'industrial', label: t('theme.industrial'), desc: t('theme.industrial_desc'), colors: ['#ffcc00', '#4682b4'] },
    { id: 'vintage', label: t('theme.vintage'), desc: t('theme.vintage_desc'), colors: ['#4a0404', '#111111'] },
  ];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveSettings();
      onClose();
    } catch (error) {
      console.error(error);
      alert('Error saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <React.Fragment>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] cursor-pointer"
          />
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            className="fixed inset-x-0 bottom-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full md:w-[650px] max-h-[90vh] bg-background text-on-background md:rounded-[2.5rem] rounded-t-[2.5rem] shadow-2xl z-[101] flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between p-6 border-b border-outline">
              <h2 className="text-2xl font-display font-black text-on-background">{t('settings.title', 'Instellingen')}</h2>
              <button 
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-12">
              
              {/* Language Settings */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                    <Globe size={18} />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">{t('settings.lang')}</h3>
                </div>
                <div className="bg-surface-container-lowest rounded-3xl border border-outline/30 p-4">
                  <LanguageSelectList
                    selectedCode={i18n.resolvedLanguage || i18n.language || ''}
                    onSelect={(langCode) => {
                      i18n.changeLanguage(langCode);
                      localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, langCode);
                    }}
                    maxHeightClassName="max-h-72"
                  />
                </div>
              </section>

              {/* PWA / App Installation Settings */}
              <section className="space-y-6 pt-4 border-t border-outline/30">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center text-secondary">
                    <Download size={18} />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">{t('nav.install_app', 'App Installeren')}</h3>
                </div>

                <div className="bg-surface-container rounded-3xl p-6 space-y-6">
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-on-surface leading-snug">
                      {t('pwa.install_desc')}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-background rounded-2xl p-4 border border-outline/50 space-y-3 shadow-sm">
                      <div className="flex items-center gap-2 text-primary">
                        <Smartphone size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Mobile</span>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <span className="text-[9px] font-black text-on-surface-variant/60 uppercase">iOS (iPhone/iPad)</span>
                          <p className="text-[11px] font-bold text-on-surface leading-normal italic">{t('pwa.mobile_ios')}</p>
                        </div>
                        <div className="space-y-1 border-t border-outline/30 pt-3">
                          <span className="text-[9px] font-black text-on-surface-variant/60 uppercase">Android</span>
                          <p className="text-[11px] font-bold text-on-surface leading-normal italic">{t('pwa.mobile_android')}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-background rounded-2xl p-4 border border-outline/50 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-secondary">
                          <Monitor size={16} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Desktop</span>
                        </div>
                        <button 
                          onClick={() => window.dispatchEvent(new CustomEvent('triggerPWAInstall'))}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded-lg text-[10px] font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/20"
                        >
                          <Download size={12} />
                          {t('pwa.install_btn', 'Installeren')}
                        </button>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-on-surface-variant/60 uppercase">Windows / Mac / Linux</span>
                        <p className="text-[11px] font-bold text-on-surface leading-normal italic">{t('pwa.desktop_tip')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Theme Settings */}
              <section className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-on-surface px-1">{t('settings.theme', 'Thema')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {THEMES.map(th => (
                    <button
                      key={th.id}
                      onClick={() => setTheme(th.id)}
                      className={`flex items-start gap-4 p-4 rounded-3xl border-2 text-left transition-all ${
                        theme === th.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-outline hover:border-primary/30 bg-surface shadow-sm'
                      }`}
                    >
                      <div className="flex gap-1 shrink-0 mt-1">
                        <div className="w-5 h-5 rounded-full border border-black/5" style={{ backgroundColor: th.colors[0] }} />
                        <div className="w-5 h-5 rounded-full border border-black/5" style={{ backgroundColor: th.colors[1] }} />
                      </div>
                      <div>
                        <div className="font-bold text-on-surface flex items-center gap-2">
                          {th.label}
                          {theme === th.id && <Check size={14} className="text-primary" />}
                        </div>
                        <div className="text-[10px] uppercase font-black tracking-widest text-on-surface-variant/60 mt-1">
                          {th.id}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Newsletter Settings */}
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">{t('settings.newsletter')}</h3>
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">{t('settings.newsletter_desc')}</p>
                  </div>
                  <button
                    onClick={() => setNewsletterEnabled(!newsletterEnabled)}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${
                      newsletterEnabled ? 'bg-primary' : 'bg-surface-container-highest'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        newsletterEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </section>
              {/* Smart Match Alerts Settings */}
              {(userRole === 'huis_zoeker' || userRole === 'admin' || !userRole) && (
                <section className="space-y-4 pt-1 border-t border-outline/30">
                  <div className="flex items-start justify-between px-1 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">
                          {t('settings.smart_match_alert', 'Smart Match Alerts')}
                        </h3>
                        <span className="text-[8px] font-black uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          Zoeker
                        </span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider leading-relaxed">
                        {t('settings.smart_match_alert_desc', 'Ontvang een e-mail update zodra er een nieuwe perfecte match op basis van jouw persoonlijke profiel wordt toegevoegd.')}
                      </p>
                      {smartMatchAlertEnabled && smartMatchAlertHour !== null && (
                        <p className="text-[10px] font-black text-primary uppercase tracking-wider mt-2 bg-primary/10 px-3 py-1.5 rounded-full inline-block">
                          {t('settings.smart_match_alert_hour_hint', 'Jouw matchmaker checkt de database automatisch om {{hour}}:00 CET.', { hour: String(smartMatchAlertHour).padStart(2, '0') })}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setSmartMatchAlertEnabled(!smartMatchAlertEnabled)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
                        smartMatchAlertEnabled ? 'bg-primary' : 'bg-surface-container-highest'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          smartMatchAlertEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </section>
              )}

              {/* Chat Mail Alerts Settings */}
              <section className="space-y-4 pt-1 border-t border-outline/30">
                <div className="flex items-start justify-between px-1 gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">
                      {t('settings.chat_mail_alert', 'Chat e-mailmeldingen')}
                    </h3>
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider leading-relaxed">
                      {t('settings.chat_mail_alert_desc', 'Ontvang direct een vriendelijke e-mail zodra er nieuwe chatberichten binnenkomen van jouw Co-Match woningen.')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setChatMailAlertEnabled(!chatMailAlertEnabled)}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
                      chatMailAlertEnabled ? 'bg-primary' : 'bg-surface-container-highest'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        chatMailAlertEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {chatMailAlertEnabled && (userRole === 'huis_aanbieder' || userRole === 'admin' || !userRole) && (
                  <div className="bg-surface-container-low border border-outline/30 rounded-[2rem] p-6 space-y-4 animate-in fade-in slide-in-from-top-3">
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono text-primary font-bold uppercase tracking-widest bg-primary/10 px-2.5 py-1 rounded-full">
                        {t('settings.provider_config', 'Configuratie voor Woningaanbieder')}
                      </span>
                      <p className="text-xs font-black text-on-surface mt-2">
                        {t('settings.provider_question', 'Wanneer wil je als aanbieder een e-mail ontvangen bij binnenkomende chats?')}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 text-xs">
                      {[
                        { 
                          id: 'only_first_chat_ever', 
                          title: t('settings.opt_only_first_chat_ever_title', '1. Allereerste reactie op je woning'), 
                          desc: t('settings.opt_only_first_chat_ever_desc', 'Alleen een e-mailbericht bij het allereerste chatbericht van een woningzoeker op je woning (eenmalig per woning).') 
                        },
                        { 
                          id: 'each_seeker_first_chat', 
                          title: t('settings.opt_each_seeker_first_chat_title', '2. Eerste reactie van elke nieuwe kandidaat'), 
                          desc: t('settings.opt_each_seeker_first_chat_desc', 'Ontvang een e-mail bij de eerste chat van de eerste, tweede en alle opvolgende unieke woningzoekers.') 
                        },
                        { 
                          id: 'always', 
                          title: t('settings.opt_always_title', '3. Altijd bij elk nieuw chatbericht'), 
                          desc: t('settings.opt_always_desc', 'Ontvang altijd direct een e-mailnotificatie bij elk nieuw chatbericht (beveiligd met 15-minuten filter).') 
                        }
                      ].map((opt) => {
                        const isSelected = providerChatMailAlertOption === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setProviderChatMailAlertOption(opt.id as any)}
                            className={`p-3.5 rounded-2xl border-2 text-left transition-all relative flex flex-col gap-1 select-none active:scale-[0.99] cursor-pointer ${
                              isSelected 
                                ? 'border-primary bg-primary/5 text-primary' 
                                : 'border-outline/40 hover:border-primary/30 text-on-surface-variant'
                            }`}
                          >
                            <div className="flex justify-between items-center w-full">
                              <span className="font-extrabold text-xs text-on-surface">{opt.title}</span>
                              {isSelected && <span className="text-primary text-xs font-black">{t('settings.active_label', '✓ Actief')}</span>}
                            </div>
                            <span className="text-[10px] text-on-surface-variant leading-relaxed font-medium font-sans">
                              {opt.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              {/* Units & Formats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                {/* Units */}
                <section className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">{t('settings.units')}</h3>
                  <div className="flex flex-col gap-2">
                    {['metric', 'imperial'].map(u => (
                      <button
                        key={u}
                        onClick={() => setUnit(u as UnitType)}
                        className={`py-3 px-4 text-xs font-bold rounded-2xl border-2 transition-all text-left flex justify-between items-center ${unit === u ? 'border-primary bg-primary/10 text-primary' : 'border-outline text-on-surface-variant hover:border-primary/30'}`}
                      >
                        {u === 'metric' ? t('settings.unit_metric') : t('settings.unit_imperial')}
                        {unit === u && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Date Format */}
                <section className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">{t('settings.date_format')}</h3>
                  <div className="flex flex-col gap-2">
                    {['DD/MM/YYYY', 'MM/DD/YYYY'].map(f => (
                      <button
                        key={f}
                        onClick={() => setDateFormat(f as DateFormatType)}
                        className={`py-3 px-4 text-xs font-bold rounded-2xl border-2 transition-all text-left flex justify-between items-center ${dateFormat === f ? 'border-primary bg-primary/10 text-primary' : 'border-outline text-on-surface-variant hover:border-primary/30'}`}
                      >
                        {f}
                        {dateFormat === f && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Time Format */}
                <section className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">{t('settings.time_format', 'Tijd Formaat')}</h3>
                  <div className="flex flex-col gap-2">
                    {['24h', '12h'].map(f => (
                      <button
                        key={f}
                        onClick={() => setTimeFormat(f as any)}
                        className={`py-3 px-4 text-xs font-bold rounded-2xl border-2 transition-all text-left flex justify-between items-center ${timeFormat === f ? 'border-primary bg-primary/10 text-primary' : 'border-outline text-on-surface-variant hover:border-primary/30'}`}
                      >
                        {f === '24h' ? '24h (14:30)' : '12h (02:30 PM)'}
                        {timeFormat === f && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              {/* Currency Settings */}
              <section className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 px-1">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">{t('settings.currency', 'Valuta')}</h3>
                    <p className="text-[10px] text-on-surface-variant font-bold mt-1 uppercase tracking-wider">{t('settings.currency_info', 'Prijzen indicatie & Matchings')}</p>
                  </div>
                  
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={16} />
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={t('settings.search_currency', 'Zoek valuta of land...')}
                      className="w-full bg-surface-container-lowest border-2 border-outline rounded-2xl py-3 pl-10 pr-4 text-xs font-bold outline-none focus:border-primary transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar space-y-8">
                  {Object.keys(groupedCurrencies).length > 0 ? (
                    Object.entries(groupedCurrencies).map(([region, currs]) => (
                      <div key={region} className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary bg-primary/5 px-4 py-1.5 rounded-full w-fit">
                          {region}
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {currs.map(curr => (
                            <button
                              key={curr.code}
                              onClick={() => setCurrency(curr.code as any)}
                              className={`flex items-center gap-3 p-3 rounded-2xl transition-all border-2 text-left group ${
                                currency === curr.code
                                  ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                  : 'border-outline hover:border-primary/30 text-on-surface bg-surface-container-lowest shadow-sm hover:shadow-md'
                              }`}
                            >
                              <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center font-display font-black text-lg shadow-inner group-hover:scale-110 transition-transform">
                                {curr.symbol}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[10px] font-black tracking-widest uppercase truncate">{curr.code}</div>
                                <div className="text-[9px] font-bold text-on-surface-variant leading-tight truncate">{curr.label}</div>
                              </div>
                              {currency === curr.code && <Check size={14} className="ml-auto shrink-0" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-on-surface-variant font-medium text-sm italic">
                      Geen resultaten gevonden voor "{searchQuery}"
                    </div>
                  )}
                </div>
              </section>

            </div>

            <div className="p-6 border-t border-outline flex justify-end gap-4 bg-surface-container-lowest mt-auto">
              <button 
                onClick={onClose}
                className="px-8 py-4 rounded-2xl font-black text-xs text-on-surface-variant hover:bg-surface-container transition-all"
                disabled={isSaving}
              >
                {t('common.cancel')}
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center justify-center min-w-[140px] bg-primary text-on-primary px-8 py-4 rounded-2xl font-black text-xs shadow-xl shadow-primary/20 hover:bg-primary/95 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {isSaving ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full" />
                ) : (
                  t('common.save')
                )}
              </button>
            </div>
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}
