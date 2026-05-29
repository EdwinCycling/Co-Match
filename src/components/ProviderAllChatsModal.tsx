import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { 
  X, 
  MessageSquare, 
  User, 
  MapPin, 
  Home, 
  Clock, 
  Calendar, 
  ArrowRight,
  ShieldCheck,
  Mic,
  Send,
  MessageCircle
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc,
  orderBy
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useSettings } from '../contexts/SettingsContext';
import { formatDate, formatDateShort } from '../lib/formatters';

interface ProviderAllChatsModalProps {
  onClose: () => void;
}

export default function ProviderAllChatsModal({ onClose }: ProviderAllChatsModalProps) {
  const { t, i18n } = useTranslation();
  const { dateFormat } = useSettings();
  const [chats, setChats] = useState<any[]>([]);
  const [properties, setProperties] = useState<Record<string, any>>({});
  const [seekers, setSeekers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'chats'),
      where('providerId', '==', auth.currentUser.uid),
      where('status', '==', 'active'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      const chatsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setChats(chatsData);

      // Fetch missing properties and seekers
      const propertyIds = Array.from(new Set(chatsData.map((c: any) => c.propertyId)));
      const seekerIds = Array.from(new Set(chatsData.map((c: any) => c.seekerId)));

      for (const pId of propertyIds) {
        if (!properties[pId]) {
          getDoc(doc(db, 'properties', pId)).then(s => {
            if (s.exists()) setProperties(prev => ({ ...prev, [pId]: { id: s.id, ...s.data() } }));
          });
        }
      }

      for (const sId of seekerIds) {
        if (!seekers[sId]) {
          getDoc(doc(db, 'seeker_profiles', sId)).then(s => {
            if (s.exists()) setSeekers(prev => ({ ...prev, [sId]: { id: s.id, ...s.data() } }));
          });
        }
      }
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  const getChatStats = (chat: any) => {
    const msgs = chat.messages || [];
    const firstMsg = msgs[0];
    const providerMsgs = msgs.filter((m: any) => m.senderId === auth.currentUser?.uid);
    const seekerMsgs = msgs.filter((m: any) => m.senderId === chat.seekerId);
    
    // Who sent the last message?
    const lastSent = providerMsgs[providerMsgs.length - 1];
    const lastReceived = seekerMsgs[seekerMsgs.length - 1];
    
    return {
      firstDate: firstMsg?.createdAt?.seconds ? new Date(firstMsg.createdAt.seconds * 1000) : null,
      lastSentDate: lastSent?.createdAt?.seconds ? new Date(lastSent.createdAt.seconds * 1000) : null,
      lastReceivedDate: lastReceived?.createdAt?.seconds ? new Date(lastReceived.createdAt.seconds * 1000) : null,
      totalCount: msgs.length,
      latestSeekerText: lastReceived?.text || null
    };
  };

  const handleOpenChat = (propertyId: string, chatId: string) => {
    // Open chat for provider. The provider views property chats through the provider dashboard.
    // ProviderDashboard listens for this event. 
    window.dispatchEvent(new CustomEvent('open-provider-chat', { detail: { propertyId, chatId, isAlreadyUnlocked: true } }));
    onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-2 md:p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-background rounded-[2.5rem] w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-outline/20"
      >
        <div className="p-6 md:p-8 border-b border-outline flex justify-between items-center bg-white">
          <div>
            <h2 className="text-2xl font-display font-black text-on-background flex items-center gap-3">
              <MessageCircle className="text-primary" size={28} />
              {t('providerChatsModal.title', 'Berichtenoverzicht')}
            </h2>
            <p className="text-xs font-bold text-on-surface-variant opacity-60 uppercase tracking-widest mt-1">{t('providerChatsModal.subtitle', 'Lijst van actieve gesprekken met kandidaten')}</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-3 hover:bg-surface-container rounded-full transition-all text-on-surface-variant hover:text-on-surface active:scale-95 border border-transparent hover:border-outline"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-surface-container-lowest">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
              <p className="font-bold text-sm text-on-surface-variant">{t('providerChatsModal.loading', 'Gesprekken laden...')}</p>
            </div>
          ) : chats.length === 0 ? (
            <div className="text-center py-20 px-6 opacity-60">
              <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageSquare size={40} className="text-outline" />
              </div>
              <h3 className="text-xl font-display font-black text-on-background mb-2">{t('providerChatsModal.emptyTitle', 'Nog geen gesprekken')}</h3>
              <p className="font-medium max-w-xs mx-auto">{t('providerChatsModal.emptyDesc', 'Bekijk je woningen via de woning overzicht en reageer op kandidaten om te starten met chatten.')}</p>
            </div>
          ) : (
            chats.map(chat => {
              const prop = properties[chat.propertyId];
              const seekerData = seekers[chat.seekerId];
              const stats = getChatStats(chat);
              
              const firstName = seekerData?.firstName || seekerData?.nickname || t('common.candidate', 'Kandidaat');
              const photoUrl = seekerData?.photo_url || seekerData?.photoUrl || seekerData?.photoURL;

              return (
                <motion.div
                  key={chat.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-3xl border border-outline shadow-sm hover:shadow-xl transition-all group overflow-hidden"
                >
                  <div className="flex flex-col md:flex-row">
                    {/* Visual Section - The Business Card Header */}
                    <div className="md:w-72 p-6 bg-surface-container-low border-b md:border-b-0 md:border-r border-outline flex flex-col items-center text-center">
                      <div className="w-20 h-20 rounded-2xl bg-white shadow-md flex items-center justify-center overflow-hidden border border-outline mb-4 group-hover:scale-105 transition-transform">
                        {photoUrl ? (
                          <img src={photoUrl} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                        ) : (
                          <User size={32} className="text-primary/40" />
                        )}
                      </div>
                      <h4 className="text-xl font-display font-black text-on-background mb-1">{firstName}</h4>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-primary mb-3">
                        <Home size={14} />
                        <span className="truncate max-w-[180px]">{prop?.title || t('common.loading', 'Laden...')}</span>
                      </div>
                      <div className="flex flex-wrap justify-center gap-2 mt-auto">
                        <span className="px-2.5 py-1 bg-white border border-outline rounded-full text-[10px] font-bold text-on-surface-variant flex items-center gap-1">
                          <MapPin size={10} /> {prop?.city || t('common.location', 'Locatie')}
                        </span>
                      </div>
                    </div>

                    {/* Content Section - Summary & Stats */}
                    <div className="flex-grow p-6 flex flex-col justify-between">
                      <div className="space-y-4">
                        {/* Latest Message Preview */}
                        <div className="bg-surface-container/30 rounded-2xl p-4 border border-outline/50 relative">
                           <div className="absolute -top-2.5 left-4 px-2 bg-white text-[9px] font-black uppercase tracking-widest text-primary border border-outline rounded">{t('providerChatsModal.latestFrom', 'Nieuwste van')} {firstName}</div>
                           <div className="text-sm font-medium text-on-surface-variant italic line-clamp-2 min-h-[2.5rem]">
                             {stats.latestSeekerText ? `"${stats.latestSeekerText}"` : t('chat.no_messages_received', 'Nog geen reactie ontvangen...')}
                           </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">{t('providerChatsModal.firstChat', 'Eerste gesprek')}</p>
                            <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                              <Calendar size={12} className="text-primary" />
                              {stats.firstDate ? formatDate(stats.firstDate, dateFormat) : '-'}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">{t('providerChatsModal.lastSent', 'Laatst verzonden door jou')}</p>
                            <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                              <Send size={12} className="text-primary" />
                              {stats.lastSentDate ? formatDateShort(stats.lastSentDate, i18n.language) : '-'}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">{t('providerChatsModal.lastReceived', 'Laatste ontvangen')}</p>
                            <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                              <Clock size={12} className="text-primary" />
                              {stats.lastReceivedDate ? formatDateShort(stats.lastReceivedDate, i18n.language) : '-'}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">{t('providerChatsModal.totalMessages', 'Totaal berichten')}</p>
                            <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                              <MessageSquare size={12} className="text-primary" />
                              {stats.totalCount} {t('common.pieces', 'stuks')}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="mt-6 flex justify-end">
                        <button
                          onClick={() => handleOpenChat(chat.propertyId, chat.id)}
                          className="px-8 py-4 bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-3 shadow-lg shadow-primary/20 hover:bg-primary/95 hover:scale-105 active:scale-95 transition-all group/btn"
                        >
                          {t('common.open_chat', 'Open chat')}
                          <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
