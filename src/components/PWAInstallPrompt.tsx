import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Smartphone, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PWAInstallPromptProps {
  user: any;
  userRole: string | null;
}

export default function PWAInstallPrompt({ user, userRole }: PWAInstallPromptProps) {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [seekerTabClicks, setSeekerTabClicks] = useState(0);
  const [providerActionDone, setProviderActionDone] = useState(false);
  const [isAnyChatOpen, setIsAnyChatOpen] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    // Check for iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const triggerHandler = () => {
      setShowPrompt(true);
    };
    
    // Listen for tab clicks (seeker)
    const tabClickHandler = () => {
      if (userRole === 'huis_zoeker') {
        setSeekerTabClicks(prev => prev + 1);
      }
    };

    // Listen for provider actions
    const providerActionHandler = () => {
      if (userRole === 'huis_aanbieder') {
        setProviderActionDone(true);
      }
    };

    // Global chat state tracking
    const chatOpenHandler = () => setIsAnyChatOpen(true);
    const chatCloseHandler = () => setIsAnyChatOpen(false);

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('triggerPWAInstall', triggerHandler);
    window.addEventListener('pwa-tab-click', tabClickHandler);
    window.addEventListener('pwa-provider-action', providerActionHandler);
    window.addEventListener('chat-opened', chatOpenHandler);
    window.addEventListener('chat-closed', chatCloseHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('triggerPWAInstall', triggerHandler);
      window.removeEventListener('pwa-tab-click', tabClickHandler);
      window.removeEventListener('pwa-provider-action', providerActionHandler);
      window.removeEventListener('chat-opened', chatOpenHandler);
      window.removeEventListener('chat-closed', chatCloseHandler);
    };
  }, [userRole]);

  useEffect(() => {
    // PWA Prompt Logic based on user request:
    // - Must be logged in (user exists)
    // - Not on landing page (user exists)
    // - Not in chat window (isAnyChatOpen is false)
    // - Seeker: min 2 tab clicks
    // - Provider: logged in (+ has profile) + action done
    
    if (!user || isAnyChatOpen) {
      setShowPrompt(false);
      return;
    }

    const hasDismissed = sessionStorage.getItem('pwa_dismissed');
    if (hasDismissed) return;

    let shouldShow = false;

    if (userRole === 'huis_zoeker') {
      if (seekerTabClicks >= 2) {
        shouldShow = true;
      }
    } else if (userRole === 'huis_aanbieder') {
      if (providerActionDone) {
        shouldShow = true;
      }
    }

    if (shouldShow) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, userRole, isAnyChatOpen, seekerTabClicks, providerActionDone]);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // If no prompt (like on iOS or already handled), we just show manual steps
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('pwa_dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 left-6 right-6 md:left-auto md:right-8 md:w-96 bg-primary/95 backdrop-blur-3xl border-2 border-white/20 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-[200] p-7 overflow-hidden text-white"
      >
        <div className="absolute top-0 right-0 p-5">
          <button 
            onClick={handleDismiss}
            className="cm-modal-close-button w-8 h-8 bg-surface/20 text-white border-white/25 hover:bg-surface/30"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-start gap-4 pr-8">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0 border border-white/30">
            <Download size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-display font-black text-white leading-tight">
              {t('pwa.install_title')}
            </h3>
            <p className="text-[11px] text-white/80 font-bold leading-relaxed">
              {t('pwa.install_desc')}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="bg-black/20 rounded-[1.5rem] p-5 space-y-3 border border-white/10">
            <div className="flex items-start gap-3">
              <Smartphone size={16} className="text-white shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="text-[9px] uppercase font-black tracking-widest text-white/60 block">Mobile</span>
                <p className="text-[11px] font-bold text-white leading-normal italic">
                  {isIOS ? t('pwa.mobile_ios') : t('pwa.mobile_android')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 pt-3 border-t border-white/10">
              <Monitor size={16} className="text-white shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="text-[9px] uppercase font-black tracking-widest text-white/60 block">Desktop</span>
                <p className="text-[11px] font-bold text-white leading-normal italic">
                  {t('pwa.desktop_tip')}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleDismiss}
              className="flex-1 px-4 py-4 rounded-2xl font-black text-xs text-white/70 hover:bg-white/10 transition-colors"
            >
              {t('pwa.dismiss')}
            </button>
            <button
              onClick={handleInstall}
              className="flex-[1.5] bg-surface text-primary px-4 py-4 rounded-2xl font-black text-xs shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Download size={16} />
              {t('pwa.install_btn')}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
