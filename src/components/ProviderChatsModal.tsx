import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { X, MessageSquare, ShieldAlert, ShieldCheck, CheckCheck, Check, FileText, User, Play, Mic, ArrowUpDown, Filter, Clock, Calendar, ChevronLeft, ChevronRight, Maximize2, Minimize2, Send, AlertCircle, Linkedin, ExternalLink, Info, Video, Sparkles, Ban, ArrowLeft } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, arrayUnion, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useSettings } from '../contexts/SettingsContext';
import { useCurrencyConverter } from '../hooks/useCurrencyConverter';
import { formatTime, formatDate, timeSince } from '../lib/formatters';
import { getExistingMatch, translateMatchReport } from '../services/matchService';
import ReactMarkdown from 'react-markdown';
import { MeetingPlaceSuggester } from './MeetingPlaceSuggester';
import { ExpertHub } from './ExpertHub';
import MatchReportModal from './MatchReportModal';
import { toast } from 'react-hot-toast';
import VideoMeetingBanner from './VideoMeetingBanner';
import { sendChatMessageEmailNotification } from '../services/smartMatchAlertService';

const renderTextWithLinks = (text: string) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 transition-opacity text-primary-dark font-medium break-all">{part}</a>;
    }
    return <span key={i}>{part}</span>;
  });
};

interface ProviderChatsModalProps {
  property: any;
  onClose: () => void;
}

export default function ProviderChatsModal({ property, onClose }: ProviderChatsModalProps) {
  const { t, i18n } = useTranslation();
  const { dateFormat, timeFormat } = useSettings();
  const currencyConverter = useCurrencyConverter();
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [seekers, setSeekers] = useState<Record<string, any>>({});
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showReport, setShowReport] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [translateModalInfo, setTranslateModalInfo] = useState<{ existing: any, targetLang: string } | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showProfile, setShowProfile] = useState<any | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [filterType, setFilterType] = useState<'all' | 'last_seeker' | 'waiting_seeker' | 'terminated'>('all');
  const [showExpandedInput, setShowExpandedInput] = useState(false);
  const [isSidebarCompact, setIsSidebarCompact] = useState(false);
  const [isExpertHubOpen, setIsExpertHubOpen] = useState(false);
  const [chatToTerminate, setChatToTerminate] = useState<string | null>(null);
  const [providerLinkedIn, setProviderLinkedIn] = useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const [showDatePickerForMeeting, setShowDatePickerForMeeting] = useState(false);
  const [pickedMeetingDate, setPickedMeetingDate] = useState('');

  // Fetch provider's own LinkedIn
  useEffect(() => {
    const fetchLinkedIn = async () => {
      if (!auth.currentUser) return;
      try {
        const snap = await getDoc(doc(db, 'users', auth.currentUser.uid, 'settings', 'verification'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.level2?.linkedinUrl) {
            setProviderLinkedIn(data.level2.linkedinUrl);
          }
        }
      } catch (e) {
        console.error("Error fetching LinkedIn settings", e);
      }
    };
    fetchLinkedIn();
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (selectedChat) {
      setTimeout(scrollToBottom, 100);
    }
  }, [selectedChat?.id, selectedChat?.messages?.length]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    window.dispatchEvent(new CustomEvent('toggle-credits-visibility', { detail: false }));
    return () => { 
      document.body.style.overflow = 'unset'; 
      window.dispatchEvent(new CustomEvent('toggle-credits-visibility', { detail: true }));
    };
  }, []);

  useEffect(() => {
    if (!auth.currentUser || !property) return;
    
    // Reset state when property changes to prevent showing old chats while loading
    setChats([]);
    setSelectedChat(null);

    const q = query(
      collection(db, 'chats'),
      where('propertyId', '==', property.id),
      where('providerId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      const chatsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setChats(chatsData);

      // update selected chat if open
      if (selectedChat) {
        const updated = chatsData.find(c => c.id === selectedChat.id);
        if (updated) setSelectedChat(updated);
      }

      // Fetch newly seen seekers
      const newSeekerIds = chatsData.map((c: any) => c.seekerId).filter((id: string) => !seekers[id]);
      if (newSeekerIds.length > 0) {
        const newSeekers = { ...seekers };
        for (const sId of newSeekerIds) {
          const sSnap = await getDoc(doc(db, 'seeker_profiles', sId));
          if (sSnap.exists()) {
            newSeekers[sId] = sSnap.data();
          } else {
            // fallback
            newSeekers[sId] = { nickname: 'Onbekend' };
          }
        }
        setSeekers(newSeekers);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'chats'));

    return () => unsubscribe();
  }, [property]);

  useEffect(() => {
    const handlePreselect = (e: any) => {
      const { chatId } = e.detail;
      if (chatId) {
        // We will try finding it in the currently loaded chats
        const chatToSelect = chats.find(c => c.id === chatId);
        if (chatToSelect) {
          setSelectedChat(chatToSelect);
        } else {
          // If not in chats yet, try fetching it or let the observer handle it
          getDoc(doc(db, 'chats', chatId)).then(snap => {
            if (snap.exists()) {
              setSelectedChat({ id: snap.id, ...snap.data() });
            }
          });
        }
      }
    };
    window.addEventListener('provider-chat-preselect', handlePreselect);
    return () => window.removeEventListener('provider-chat-preselect', handlePreselect);
  }, [chats]);

  // Mark all unread messages as read when a chat is selected
  useEffect(() => {
    if (selectedChat && auth.currentUser) {
      const msgs = selectedChat.messages || [];
      let needsUpdate = false;
      const updatedMessages = msgs.map((m: any) => {
        if (m.senderId !== auth.currentUser?.uid && !m.read) {
          needsUpdate = true;
          return { ...m, read: true };
        }
        return m;
      });

      if (needsUpdate) {
        updateDoc(doc(db, 'chats', selectedChat.id), {
          messages: updatedMessages
        }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `chats/${selectedChat.id}`));
      }
    }
  }, [selectedChat?.messages]);

  const handleSendMessage = async () => {
    if (!auth.currentUser || !selectedChat || !message.trim() || isSending) return;
    
    const textToSend = message.trim();
    if (textToSend.length > 500) {
      alert("Bericht is te lang (maximaal 500 tekens).");
      return;
    }

    if (selectedChat.messages && selectedChat.messages.length >= 50) {
      alert("Maximum van 50 berichten bereikt voor deze chatbox.");
      return;
    }

    setIsSending(true);
    
    // Optimistic update for immediate feedback
    const newMessage = {
      senderId: auth.currentUser.uid,
      text: textToSend,
      createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }, // Mock timestamp
      read: false
    };

    if (selectedChat) {
      setSelectedChat((prev: any) => ({
        ...prev,
        messages: [...(prev.messages || []), newMessage],
        updatedAt: { seconds: Math.floor(Date.now() / 1000) }
      }));
    }

    try {
      await updateDoc(doc(db, 'chats', selectedChat.id), {
        lastSenderId: auth.currentUser.uid,
        messages: arrayUnion({
          senderId: auth.currentUser.uid,
          text: textToSend,
          createdAt: new Date(),
          read: false
        }),
        updatedAt: serverTimestamp()
      });
      setMessage('');
      
      // Send chat message email notification asynchronously, respects settings & 15-minute cooldown
      sendChatMessageEmailNotification(selectedChat.id, textToSend, auth.currentUser.uid)
        .then((res) => {
          if (res && res.status === 'sent') {
            console.log('[Chat Email Alert] Simulated email queued successfully.');
          }
        })
        .catch((err) => {
          console.error('[Chat Email Alert] Error during simulated send:', err);
        });

    } catch (e) {
      console.error(e);
      handleFirestoreError(e, OperationType.UPDATE, `chats/${selectedChat.id}`);
    }
    setIsSending(false);
  };

  const handleBlock = async () => {
    if (!selectedChat) return;
    const confirmBlock = window.confirm("Weet je zeker dat je deze kandidaat wilt blokkeren voor deze woning? Deze kandidaat verdwijnt dan uit je lijst.");
    if (!confirmBlock) return;

    try {
      await updateDoc(doc(db, 'chats', selectedChat.id), {
        status: 'blocked'
      });
      // automatically deselect since it will disappear
      setSelectedChat(null);
    } catch (e) {
      console.error(e);
      alert('Error blocking user');
    }
  };

  const handleToggleLinkedInShare = async () => {
    if (!selectedChat || !auth.currentUser) return;
    const isShared = selectedChat.meta?.isLinkedInShared;
    
    try {
      const chatRef = doc(db, 'chats', selectedChat.id);
      if (isShared) {
        await updateDoc(chatRef, {
          'meta.isLinkedInShared': false,
          'meta.linkedInUrl': null
        });
        toast.success(t('chat.linkedin_unshared', 'LinkedIn delen gestopt'));
      } else {
        if (!providerLinkedIn) {
          toast.error(t('chat.linkedin_not_verified', 'Je hebt nog geen LinkedIn geverifieerd.'));
          return;
        }
        
        await updateDoc(chatRef, {
          'meta.isLinkedInShared': true,
          'meta.linkedInUrl': providerLinkedIn,
          'meta.sharedAt': serverTimestamp(),
          messages: arrayUnion({
            senderId: 'system',
            text: `De aanbieder heeft zijn/haar LinkedIn profiel gedeeld.`,
            createdAt: new Date(),
            isSystem: true
          })
        });
        toast.success(t('chat.linkedin_shared_success', 'LinkedIn succesvol gedeeld in de chat!'));
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `chats/${selectedChat.id}`);
    }
  };

  const handleTerminateChat = (chatId: string) => {
    setChatToTerminate(chatId);
  };

  const confirmTerminateChat = async () => {
    if (!auth.currentUser || !property?.id || !chatToTerminate) return;
    
    const chat = chats.find(c => c.id === chatToTerminate);
    if (!chat || chat.status === 'terminated') {
      setChatToTerminate(null);
      return;
    }

    try {
      const chatRef = doc(db, 'chats', chat.id);
      const propRef = doc(db, 'properties', property.id);

      await updateDoc(chatRef, {
        status: 'terminated',
        updatedAt: serverTimestamp(),
        messages: arrayUnion({
          senderId: 'system',
          text: t('chat.provider_ended', `Dit gesprek is beëindigd door de aanbieder. Je kunt niet meer reageren.`),
          createdAt: new Date(),
          isSystem: true
        })
      });

      await updateDoc(propRef, {
        currentInquiries: Math.max(0, (property.currentInquiries || 1) - 1)
      });
      
      toast.success(t('chat.terminated_success', 'Gesprek succesvol beëindigd.'));
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `chats/${chat.id}`);
    } finally {
      setChatToTerminate(null);
    }
  };

  const handleOpenReport = async () => {
    if (!selectedChat) return;
    setLoadingReport(true);
    try {
      const existing = await getExistingMatch(selectedChat.seekerId, property.id) as any;
      if (existing && existing.report) {
         if (existing.language && existing.language !== (i18n.language || 'nl')) {
           // We have a language mismatch
           const targetLang = i18n.language || 'nl';
           if (existing.translations && existing.translations[targetLang]) {
             // Already translated
             setShowReport(existing.translations[targetLang]);
           } else {
             // Show translation modal
             setTranslateModalInfo({ existing, targetLang });
           }
         } else {
           setShowReport(existing.report);
         }
      } else {
         alert(t("property.no_report", "Geen AI rapport gevonden voor deze match."));
      }
    } catch (e) {
      console.error(e);
      alert(t("property.error_report", "Error loading report."));
    }
    setLoadingReport(false);
  };

  const handleTranslateReport = async () => {
    if (!translateModalInfo) return;
    setIsTranslating(true);
    try {
       const translatedText = await translateMatchReport(translateModalInfo.existing, translateModalInfo.targetLang);
       if (translatedText) {
          setShowReport(translatedText);
       } else {
          setShowReport(translateModalInfo.existing.report);
       }
    } catch (err) {
       console.error("Translation fail:", err);
       toast.error(t('report.translation_failed', 'Vertalen mislukt, we tonen het origineel.'));
       setShowReport(translateModalInfo.existing.report);
    } finally {
       setIsTranslating(false);
       setTranslateModalInfo(null);
    }
  };

  const handleShowOriginalReport = () => {
    if (translateModalInfo) {
      setShowReport(translateModalInfo.existing.report);
      setTranslateModalInfo(null);
    }
  };

  const handleProposeMeeting = async () => {
    if (!selectedChat || !auth.currentUser) return;
    
    if (!showDatePickerForMeeting) {
       setShowDatePickerForMeeting(true);
       return;
    }
    
    if (!pickedMeetingDate) {
       toast.error("Kies een geldige datum/tijd.");
       return;
    }
    
    let parsedDate = new Date(pickedMeetingDate);
    if (isNaN(parsedDate.getTime())) {
      toast.error("Kies een geldige datum/tijd.");
      return;
    }
    
    try {
      await updateDoc(doc(db, 'chats', selectedChat.id), {
        'meta.meeting': {
           status: 'proposed',
           scheduledAt: parsedDate,
           proposerId: auth.currentUser.uid,
           round: 1
        },
        messages: arrayUnion({
          senderId: 'system',
          isSystem: true,
          text: t('chat.meeting_proposed_for', `Videogesprek voorgesteld voor {{date}}.`, { date: parsedDate.toLocaleString('nl-NL') }),
          createdAt: new Date(),
        }),
        updatedAt: serverTimestamp()
      });
      toast.success(t('chat.meeting_proposed_success', "Videogesprek voorgesteld."));
      setShowDatePickerForMeeting(false);
      setPickedMeetingDate('');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || t('chat.meeting_propose_fail', "Starten videogesprek mislukt."));
    }
  };

  const activeChats = chats.filter(c => c.status !== 'blocked');

  // Filter and Sort candidate list
  const processedChats = activeChats
    .filter(chat => {
      const lastMsg = chat.messages?.[chat.messages.length - 1];
      const isLastBySeeker = lastMsg?.senderId === chat.seekerId;
      const isWaitingForSeeker = lastMsg?.senderId === auth.currentUser?.uid;

      if (filterType === 'terminated') return chat.status === 'terminated';
      
      // Hide terminated from all other filters (including 'all')
      if (chat.status === 'terminated') return false;

      if (filterType === 'last_seeker') return isLastBySeeker;
      if (filterType === 'waiting_seeker') return isWaitingForSeeker;
      return true;
    })
    .sort((a, b) => {
      const timeA = a.updatedAt?.seconds || 0;
      const timeB = b.updatedAt?.seconds || 0;
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });

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
        className="bg-background md:rounded-[3rem] w-full max-w-[1600px] h-full md:h-[92vh] flex flex-col md:flex-row shadow-2xl relative border border-outline overflow-hidden"
      >
        {/* Sidebar */}
        <div className={`${isSidebarCompact ? 'md:w-[100px]' : 'md:w-[380px] lg:w-[420px]'} ${selectedChat ? 'hidden md:flex' : 'flex'} w-full bg-surface-container-lowest border-r border-outline flex-col h-full shrink-0 transition-all duration-300`}>
          <div className="p-4 md:p-6 border-b border-outline bg-surface-container-low shrink-0 overflow-hidden">
            <div className={`flex ${isSidebarCompact ? 'flex-col gap-4' : 'justify-between items-center'} mb-4`}>
              {!isSidebarCompact && <h2 className="text-lg md:text-2xl font-display font-black text-on-background">{t('chat.candidates', 'Kandidaten')}</h2>}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsSidebarCompact(!isSidebarCompact)} 
                  className="hidden md:flex p-2 bg-surface hover:bg-surface-container rounded-full shadow-sm transition-colors border border-outline/50"
                  title={isSidebarCompact ? "Breid uit" : "Compacte weergave"}
                >
                  {isSidebarCompact ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
                <button onClick={onClose} className="p-2 bg-surface hover:bg-surface-container rounded-full shadow-sm transition-colors border border-outline/50"><X size={18} /></button>
              </div>
            </div>
            
            {/* Sort and Filter UI - Hidden on small mobile to save space if a chat is selected, or just made more compact */}
            {!isSidebarCompact && (
              <div className={`flex flex-col gap-2 ${selectedChat ? 'hidden sm:flex' : 'flex'}`}>
              <div className="flex bg-surface-container rounded-xl p-1 gap-1">
                <button 
                  onClick={() => setSortOrder('newest')}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 md:py-2 text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${sortOrder === 'newest' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:bg-surface/60'}`}
                >
                  <ArrowUpDown size={10} /> {t('common.newest', 'Nieuwste')}
                </button>
                <button 
                  onClick={() => setSortOrder('oldest')}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 md:py-2 text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${sortOrder === 'oldest' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:bg-surface/60'}`}
                >
                  <ArrowUpDown size={10} className="rotate-180" /> {t('common.oldest', 'Oudste')}
                </button>
              </div>

              <div className="flex bg-surface-container rounded-xl p-1 gap-1 overflow-x-auto no-scrollbar scrollbar-hide">
                <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
                {[
                  { id: 'all', label: t('common.all', 'Alle') },
                  { id: 'last_seeker', label: t('common.reply', 'Reactie') },
                  { id: 'waiting_seeker', label: t('common.waiting', 'Wachten') },
                  { id: 'terminated', label: t('common.terminated', 'Beëindigd') }
                ].map(item => (
                  <button 
                    key={item.id}
                    onClick={() => setFilterType(item.id as any)}
                    className={`shrink-0 px-3 md:px-4 py-1.5 md:py-2 text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${filterType === item.id ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:bg-surface/60'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            )}
          </div>

          {/* Seeker Picker Container */}
          <div className="relative group/nav">
            {/* Horizontal Scroll for Mobile */}
            <div className="md:hidden flex items-center bg-surface-container-lowest border-b border-outline">
              <button 
                onClick={() => {
                  const el = document.getElementById('seeker-carousel');
                  if (el) el.scrollBy({ left: -200, behavior: 'smooth' });
                }}
                className="p-2 text-primary hover:bg-primary/5 transition-colors shrink-0"
              >
                <ChevronLeft size={24} />
              </button>
              
              <div 
                id="seeker-carousel"
                className="flex-grow flex overflow-x-auto no-scrollbar scrollbar-hide py-3 px-2 gap-3 snap-x snap-mandatory"
              >
                {processedChats.map(chat => {
                  const s = seekers[chat.seekerId];
                  const lastMsg = chat.messages?.[chat.messages.length - 1];
                  const isUnread = lastMsg && lastMsg.senderId !== auth.currentUser?.uid && !lastMsg.read;
                  const isSelected = selectedChat?.id === chat.id;

                  return (
                    <button
                      key={chat.id}
                      onClick={() => setSelectedChat(chat)}
                      className={`shrink-0 snap-start flex flex-col items-center gap-1 min-w-[70px] transition-all ${isSelected ? 'scale-110' : 'opacity-70 scale-90'}`}
                    >
                      <div 
                        onClick={(e) => { e.stopPropagation(); if (s) setShowProfile(s); }}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden border-2 transition-all cursor-pointer hover:scale-105 active:scale-95 ${isSelected ? 'border-primary shadow-lg' : 'border-transparent bg-surface-container'}`}
                        title={t('chat.view_profile', 'Bekijk profiel')}
                      >
                        {(s?.photo_url || s?.photoUrl || s?.photoURL) ? (
                          <img src={s?.photo_url || s?.photoUrl || s?.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="text-primary font-black text-lg">{s?.firstName?.[0] || s?.nickname?.[0] || '?'}</span>
                        )}
                        {isUnread && (
                          <div className="absolute top-0 right-0 w-3 h-3 bg-primary rounded-full border-2 border-surface shadow-sm" />
                        )}
                      </div>
                      <span className={`text-[10px] font-black truncate max-w-[64px] ${isSelected ? 'text-primary' : 'text-on-surface-variant'}`}>
                        {s?.firstName || s?.nickname || '...'}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => {
                  const el = document.getElementById('seeker-carousel');
                  if (el) el.scrollBy({ left: 200, behavior: 'smooth' });
                }}
                className="p-2 text-primary hover:bg-primary/5 transition-colors shrink-0"
              >
                <ChevronRight size={24} />
              </button>
            </div>

            {/* Vertical List for Desktop */}
            <div className="hidden md:block overflow-y-auto max-h-[calc(92vh-180px)] p-3 md:p-5 space-y-3 custom-scrollbar bg-surface-container-lowest/50">
              {processedChats.length === 0 ? (
                !isSidebarCompact && (
                  <p className="text-center text-sm font-medium text-on-surface-variant mt-10 px-6 opacity-60">
                    {activeChats.length === 0 ? t('chat.no_messages_received', 'Nog geen berichten ontvangen.') : t('chat.no_candidates_filter', 'Geen kandidaten gevonden met deze filters.')}
                  </p>
                )
              ) : (
                processedChats.map(chat => {
                  const s = seekers[chat.seekerId];
                  const lastMsg = chat.messages?.[chat.messages.length - 1];
                  const isUnread = lastMsg && lastMsg.senderId !== auth.currentUser?.uid && !lastMsg.read;
                  const isWaitingForSeeker = lastMsg?.senderId === auth.currentUser?.uid;
                  
                  const updatedAt = chat.updatedAt?.seconds ? new Date(chat.updatedAt.seconds * 1000) : new Date();

                  if (isSidebarCompact) {
                    return (
                      <button 
                        key={chat.id} 
                        onClick={() => setSelectedChat(chat)}
                        className={`w-full flex flex-col items-center justify-center p-3 rounded-2xl transition-all border relative ${
                          selectedChat?.id === chat.id 
                            ? 'bg-primary/5 border-primary shadow-md' 
                            : 'bg-surface border-outline/40 hover:border-primary/40'
                        }`}
                        title={s?.firstName || s?.nickname}
                      >
                        <div 
                          onClick={(e) => { e.stopPropagation(); if (s) setShowProfile(s); }}
                          className="w-10 h-10 shrink-0 rounded-xl bg-surface-container flex items-center justify-center overflow-hidden border border-outline/30 relative mb-1 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
                          title={t('chat.view_profile', 'Bekijk profiel')}
                        >
                          {(s?.photo_url || s?.photoUrl || s?.photoURL) ? (
                            <img src={s?.photo_url || s?.photoUrl || s?.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="text-primary font-black text-sm">{s?.firstName?.[0] || s?.nickname?.[0] || '?'}</span>
                          )}
                          {isUnread && (
                            <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-primary rounded-full border-2 border-surface" />
                          )}
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-tight text-on-surface-variant truncate w-full text-center">
                          {s?.firstName?.split(' ')[0] || s?.nickname?.split(' ')[0] || '...'}
                        </span>
                      </button>
                    );
                  }

                  const createdAt = chat.createdAt?.seconds ? new Date(chat.createdAt.seconds * 1000) : new Date();

                  return (
                    <button 
                      key={chat.id} 
                      onClick={() => setSelectedChat(chat)}
                      className={`w-full text-left p-4 md:p-5 rounded-3xl transition-all border group relative flex flex-col gap-3 ${
                        selectedChat?.id === chat.id 
                          ? 'bg-surface border-primary shadow-[0_15px_30px_-15px_rgba(0,0,0,0.1)] scale-[1.02] z-10' 
                          : 'bg-surface border-outline/40 hover:border-primary/40 hover:shadow-lg'
                      }`}
                    >
                      <div className="flex gap-4 items-start">
                        <div 
                          onClick={(e) => { e.stopPropagation(); if (s) setShowProfile(s); }}
                          className="w-14 h-14 shrink-0 rounded-2xl bg-surface-container flex items-center justify-center overflow-hidden border border-outline/30 hover:scale-110 active:scale-95 hover:ring-2 hover:ring-primary/50 transition-all shadow-inner cursor-pointer"
                          title={t('chat.view_profile', 'Bekijk profiel')}
                        >
                          {(s?.photo_url || s?.photoUrl || s?.photoURL) ? (
                            <img src={s?.photo_url || s?.photoUrl || s?.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="text-primary font-black text-xl">{s?.firstName?.[0] || s?.nickname?.[0] || '?'}</span>
                          )}
                        </div>
                        <div className="flex-grow overflow-hidden">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="font-black text-on-surface text-base truncate">{s?.firstName || s?.nickname || 'Kandidaat'}</h4>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${isUnread ? 'bg-primary text-on-primary animate-pulse' : 'text-on-surface-variant/40'}`}>
                              {timeSince(updatedAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] text-on-surface-variant font-bold opacity-60 uppercase tracking-tighter">
                            <Calendar size={10} className="shrink-0" />
                            <span>{t('chat.first_contact', '1e contact')}: {formatDate(createdAt, dateFormat)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 mt-1">
                         <div className="flex items-center gap-1.5 overflow-hidden">
                            {isWaitingForSeeker ? (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[9px] font-black uppercase tracking-wider border border-amber-200 shrink-0">
                                 <Clock size={10} /> {t('chat.waiting_reply', 'Wacht op reactie')}
                              </div>
                            ) : isUnread ? (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[9px] font-black uppercase tracking-wider border border-emerald-200 shrink-0">
                                 <MessageSquare size={10} /> {t('chat.reply_received', 'Reactie ontvangen')}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-surface-container text-on-surface-variant rounded-full text-[9px] font-black uppercase tracking-wider border border-outline shrink-0">
                                 <CheckCheck size={10} /> {t('chat.read', 'Gelezen')}
                              </div>
                            )}
                            {isUnread && (
                              <div className="w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--color-primary-rgb),0.5)]" />
                            )}
                         </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className={`flex-grow bg-surface-container-lowest flex-col h-full relative overflow-hidden ${selectedChat ? 'flex' : 'hidden md:flex'}`}>
          {selectedChat ? (
            <>              <div className="p-3 md:p-6 bg-surface border-b border-outline flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 relative overflow-hidden z-40">
                <div className="flex items-center gap-3 min-w-0">
                  <div 
                    onClick={() => { const s = seekers[selectedChat.seekerId]; if (s) setShowProfile(s); }}
                    className="w-10 h-10 md:w-14 md:h-14 shrink-0 rounded-2xl bg-primary/5 flex items-center justify-center overflow-hidden border border-primary/10 shadow-inner cursor-pointer hover:scale-105 hover:ring-2 hover:ring-primary/50 transition-all active:scale-95"
                    title={t('chat.view_profile', 'Bekijk profiel')}
                  >
                    {(seekers[selectedChat.seekerId]?.photo_url || seekers[selectedChat.seekerId]?.photoURL) ? (
                      <img src={seekers[selectedChat.seekerId].photo_url || seekers[selectedChat.seekerId].photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User size={24} className="text-primary/40" />
                    )}
                  </div>
                  <div className="min-w-0 flex flex-col">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-on-surface text-sm md:text-xl leading-tight truncate">{seekers[selectedChat.seekerId]?.firstName || seekers[selectedChat.seekerId]?.nickname || t('chat.candidate', 'Kandidaat')}</h3>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="text-[10px] md:text-xs text-primary font-black uppercase tracking-wider truncate">
                         {property?.title}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[9px] md:text-xs text-on-surface-variant font-bold uppercase tracking-tight truncate">{selectedChat.status === 'active' ? t('chat.active_chat', 'Actief gesprek') : t('chat.closed_chat', 'Gesloten')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:gap-3 shrink-0">
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <button 
                      onClick={() => setShowProfile(seekers[selectedChat.seekerId])} 
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-widest px-3 md:px-4 py-2.5 bg-surface-container rounded-xl hover:bg-surface-container-high transition-all text-on-surface border border-outline/30 shadow-sm whitespace-nowrap active:scale-95"
                    >
                      <User size={14} /> <span className="hidden xl:inline">{t('common.profile', 'Profiel')}</span>
                    </button>
                    <button 
                      onClick={handleOpenReport} 
                      disabled={loadingReport} 
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-widest px-3 md:px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-on-primary rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100 whitespace-nowrap active:scale-95 cursor-pointer"
                    >
                      <Sparkles size={14} className="fill-current animate-pulse text-white" /> <span className="hidden xl:inline">Lees AI Match</span><span className="xl:hidden">AI Match</span>
                    </button>
                    {providerLinkedIn && (
                      <button 
                        onClick={handleToggleLinkedInShare}
                      className={`flex-1 md:flex-none flex items-center justify-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-widest px-3 md:px-4 py-2.5 rounded-xl transition-all shadow-sm whitespace-nowrap active:scale-95 border ${selectedChat.meta?.isLinkedInShared ? 'bg-blue-600 border-blue-700 text-on-primary shadow-blue-500/20' : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'}`}
                      >
                        <Linkedin size={14} /> <span className="hidden xl:inline">{selectedChat.meta?.isLinkedInShared ? t('chat.shared', 'Gedeeld') : t('chat.share_linkedin', 'LinkedIn delen')}</span>
                      </button>
                    )}
                    {selectedChat.status === 'active' && !selectedChat.meta?.meeting && property?.isActive !== false && selectedChat.messages && selectedChat.messages.length > 0 && (
                      <button 
                        onClick={handleProposeMeeting}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-widest px-3 md:px-4 py-2.5 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-all text-emerald-600 border border-emerald-200 shadow-sm whitespace-nowrap active:scale-95"
                      >
                        <Video size={14} /> <span className="inline">Video Call</span>
                      </button>
                    )}
                  </div>
                  <div className="hidden md:block h-8 w-px bg-outline/20 mx-1" />
                  <button 
                    onClick={() => setSelectedChat(null)} 
                    className="md:hidden p-2.5 bg-surface hover:bg-surface-container rounded-xl shadow-sm transition-all border border-outline/50 shrink-0 text-on-surface-variant hover:text-on-surface active:scale-90"
                    title={t('common.back', 'Terug naar lijst')}
                  >
                    <ArrowLeft size={20} />
                  </button>
                </div>
              </div>


              <div className="flex-grow overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar relative">
                <ExpertHub 
                   variant="none" 
                   country={property?.country || 'Nederland'} 
                   openExternally={isExpertHubOpen} 
                   onOpenChange={setIsExpertHubOpen} 
                />

                {/* Safety Warning Message - For Provider, scrollable with chat */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm mb-4">
                   <div className="flex gap-3 items-start text-left">
                      <div className="p-2 bg-amber-100 rounded-xl text-amber-600 shrink-0 border border-amber-200/50">
                         <AlertCircle size={18} />
                      </div>
                      <div className="space-y-1">
                         <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-900 flex items-center gap-2">
                            <ShieldCheck size={12} />
                            {t('chat.safety_title', 'Veiligheid & Privacy')}
                         </h4>
                         <p className="text-[11px] leading-relaxed text-amber-800 font-medium">
                            {t('chat.provider_safety_premium', 'Houd belangrijke communicatie en afspraken binnen dit platform voor een professionele en veilige afhandeling. Wees voorzichtig met het direct delen van privégegevens. Voor ondersteuning bij contracten of beheer, raadpleeg ons')} <button onClick={() => setIsExpertHubOpen(true)} className="text-primary font-black hover:underline underline-offset-2">{t('chat.partner_network', 'Partner Netwerk')}</button>.
                         </p>
                      </div>
                   </div>
                </div>

                <div className="sticky top-0 z-30 flex justify-center pointer-events-none pb-4">
                    <div className="pointer-events-auto w-full max-w-[400px] drop-shadow-md">
                      <MeetingPlaceSuggester 
                        key={selectedChat.id}
                        lon={property.displayLng || 5.1214} 
                        lat={property.displayLat || 52.0907}
                        onSuggest={(text) => setMessage(text)}
                        initialMinimized={true}
                      />
                    </div>
                 </div>

                 <VideoMeetingBanner 
                    chat={selectedChat} 
                    isSeeker={false} 
                 />

                 {selectedChat.messages?.map((msg: any, idx: number) => {
                     if (msg.isSystem) {
                       return (
                         <div key={idx} className="flex justify-center my-4">
                           <div className="bg-surface-container-high/50 px-4 py-1.5 rounded-full border border-outline/30">
                             <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{msg.text}</p>
                           </div>
                         </div>
                       );
                     }
                     const isMe = msg.senderId === auth.currentUser?.uid;
                     const timestamp = msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000) : new Date();
                     const timeStr = formatTime(timestamp, timeFormat);
                     const dateStr = formatDate(timestamp, dateFormat);

                     return (
                        <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-4`}>
                           <div className={`max-w-[85%] md:max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                             <div className={`p-3 md:p-4 rounded-2xl text-[13px] md:text-sm font-medium ${
                                isMe 
                                ? 'bg-primary text-on-primary rounded-tr-none shadow-md' 
                                : 'bg-surface-container text-on-surface rounded-tl-none border border-outline'
                             }`}>
                                {msg.hasAudio && msg.audioUrl && (
                                   <div className="mb-2 bg-black/10 rounded-xl p-2 flex items-center justify-between gap-3 min-w-[220px] max-w-full overflow-hidden">
                                      <audio controls controlsList="nodownload" src={msg.audioUrl} className="w-full h-10 min-w-[180px]" />
                                   </div>
                                )}
                                {msg.text && msg.text !== '[Audio]' && (
                                   <div className="whitespace-pre-wrap word-break">{renderTextWithLinks(msg.text)}</div>
                                )}
                             </div>
                             <div className={`text-[10px] text-on-surface-variant flex items-center md:gap-2 gap-1 mt-1 opacity-70 ${isMe ? 'flex-row-reverse' : ''}`}>
                                <span>{timeStr} • {dateStr}</span>
                                {isMe && (
                                   msg.read ? <CheckCheck size={12} className="text-blue-500" /> : <Check size={12} />
                                )}
                             </div>
                           </div>
                        </div>
                     );
                 })}
                 {selectedChat.status === 'blocked' && (
                    <div className="text-center py-4 text-xs font-bold text-error">
                      {t('chat.you_have_blocked_this_chat', 'Je hebt deze chat vergrendeld. Er kunnen geen nieuwe berichten verzonden worden.')}
                    </div>
                 )}
                 <div ref={messagesEndRef} />
              </div>
              <div className="p-4 md:p-6 bg-surface border-t border-outline relative">
                <div className="flex justify-between items-center mb-3 px-1">
                   <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                     <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-60">{t('chat.compose', 'Bericht opstellen')}</span>
                   </div>
                   <button 
                     onClick={() => setShowExpandedInput(true)}
                     className="px-3 py-1.5 text-primary hover:bg-primary/5 rounded-xl transition-colors flex items-center gap-2 text-[10px] font-black uppercase border border-primary/10"
                   >
                     <Maximize2 size={12} /> {t('chat.large_window', 'Groot venster')}
                   </button>
                </div>
                
                <div className="flex flex-col gap-4">
                  {selectedChat.status !== 'active' ? (
                     <div className="bg-surface-container py-6 rounded-3xl border border-outline/30 flex items-center justify-center flex-col gap-2 opacity-80 h-[120px]">
                       <X className="text-on-surface-variant opacity-60 mb-1" size={24} />
                       <p className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">{selectedChat.status === 'blocked' ? t('chat.chat_blocked', 'Gesprek geblokkeerd') : t('chat.chat_terminated', 'Gesprek beëindigd')}</p>
                       <p className="text-xs text-on-surface-variant opacity-70">{t('chat.cannot_reply', 'Je kunt niet meer reageren in deze chat.')}</p>
                     </div>
                  ) : (
                    <textarea 
                      value={message} 
                      maxLength={500}
                      onChange={e => {
                        setMessage(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 300) + 'px';
                      }} 
                      disabled={isSending}
                      placeholder={t('chat.type_message', 'Typ hier je bericht...')}
                      className="w-full bg-surface-container p-4 md:p-6 rounded-3xl outline-none focus:ring-2 focus:ring-primary/50 text-sm md:text-base resize-none border border-outline/30 placeholder:opacity-60 overflow-y-auto shadow-inner custom-scrollbar transition-all"
                      rows={4}
                      style={{ minHeight: '120px', maxHeight: '300px' }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                  )}
                  
                  {selectedChat.status === 'active' && (
                  <div className="flex gap-4">
                    <button 
                      onClick={() => {
                        handleSendMessage();
                        setTimeout(scrollToBottom, 200);
                      }} 
                      disabled={!message.trim() || isSending || selectedChat.status === 'blocked'}
                      className="flex-grow bg-primary text-on-primary h-[50px] px-8 rounded-2xl font-black disabled:opacity-30 hover:bg-primary-dark transition-all shadow-md uppercase tracking-widest text-xs flex items-center justify-center gap-3 active:scale-[0.98]"
                    >
                      <Send size={16} />
                      {t('chat.send_message', 'Stuur bericht')}
                    </button>
                    <button 
                      onClick={() => setMessage('')} 
                      disabled={!message || isSending}
                      className="px-6 h-[50px] bg-surface-container-high text-on-surface-variant rounded-2xl font-bold hover:bg-surface-container-lowest transition-all border border-outline/30 uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 disabled:opacity-30 shadow-sm"
                      title={t('chat.clear_text', 'Wis tekst')}
                    >
                      <X size={14} /> {t('chat.clear', 'Wis')}
                    </button>
                  </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-grow flex items-center justify-center text-on-surface-variant flex-col gap-4 relative">
               <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-surface-container rounded-full hover:bg-surface-container-high transition-colors shadow-sm"><X size={24} /></button>
               <MessageSquare size={48} className="opacity-20" />
               <p>{t('chat.select_chat', 'Selecteer een chat om te beginnen')}</p>
            </div>
          )}
        </div>

        {/* Modals for Report, Profile and Expanded Input */}
        <AnimatePresence>
          {showExpandedInput && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 z-[300] bg-on-background/60 backdrop-blur-md flex items-center justify-center p-4 md:p-10"
            >
               <motion.div 
                 initial={{ scale: 0.9, y: 30 }}
                 animate={{ scale: 1, y: 0 }}
                 className="bg-background text-on-background w-full max-w-4xl h-[80vh] rounded-[3rem] flex flex-col shadow-2xl border border-outline overflow-hidden"
               >
                 <div className="p-6 border-b border-outline flex justify-between items-center bg-surface-container-low">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                        <Maximize2 size={20} />
                     </div>
                     <h2 className="text-xl font-display font-black text-on-background uppercase tracking-wider">{t('chat.compose', 'Bericht opstellen')}</h2>
                   </div>
                   <button onClick={() => setShowExpandedInput(false)} className="p-3 bg-surface hover:bg-surface-container rounded-full shadow-sm transition-all active:scale-90"><X size={24} /></button>
                 </div>
                 <div className="flex-grow p-8">
                   <textarea 
                     autoFocus maxLength={500}
                     value={message}
                     onChange={e => setMessage(e.target.value)}
                     className="w-full h-full bg-surface-container p-8 rounded-[2rem] outline-none text-base md:text-lg resize-none border border-outline/30 placeholder:opacity-40 custom-scrollbar shadow-inner"
                     placeholder={t('chat.write_message_here', 'Schrijf hier je bericht...')}
                   />
                 </div>
                 <div className="p-8 border-t border-outline flex justify-end gap-4 bg-surface-container-low">
                   <button 
                     onClick={() => setShowExpandedInput(false)}
                     className="px-8 py-4 text-on-surface-variant font-bold hover:bg-surface-container transition-colors rounded-2xl"
                   >
                     {t('chat.back_to_chat', 'Terug naar chat')}
                   </button>
                   <button 
                     onClick={() => {
                        handleSendMessage();
                        setShowExpandedInput(false);
                     }}
                     disabled={!message.trim() || isSending}
                     className="px-12 py-4 bg-primary text-on-primary font-black rounded-2xl flex items-center gap-3 shadow-lg hover:shadow-primary/20 transition-all uppercase tracking-widest disabled:opacity-50"
                   >
                     {t('chat.send', 'Verzenden')} <Send size={20} />
                   </button>
                 </div>
               </motion.div>
            </motion.div>
          )}

          {showReport && (
            <MatchReportModal 
              report={showReport}
              property={property}
              onClose={() => setShowReport(null)}
              seekerId={selectedChat?.seekerId}
              initialShowContact={false}
            />
          )}

          {showProfile && (
            <div 
              className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 md:p-6"
              onClick={() => setShowProfile(false)}
            >
              <motion.div 
                 initial={{ opacity: 0, scale: 0.95, y: 15 }}
                 animate={{ opacity: 1, scale: 1, y: 0 }}
                 exit={{ opacity: 0, scale: 0.95, y: 15 }}
                 onClick={(e) => e.stopPropagation()}
                 className="bg-background max-w-2xl w-full rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-outline max-h-[90vh]"
              >
                {/* Header */}
                <div className="p-6 md:p-8 bg-primary text-on-primary shrink-0 relative overflow-hidden">
                  <div className="relative z-10 flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white/20 w-fit px-3 py-1 rounded-full">
                        <User size={14} />
                        {t('popup.seeker_profile', 'Kandidaat Profiel')}
                      </div>
                      <h2 className="text-2xl md:text-3xl font-display font-black">
                        {t('popup.profile_of', 'Profiel van')} {showProfile.firstName || showProfile.nickname || t('chat.candidate', 'Kandidaat')}
                      </h2>
                    </div>
                    <button 
                      onClick={() => setShowProfile(null)}
                      className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-all"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-6 md:p-8 space-y-6 bg-background custom-scrollbar">
                  {/* Photo & Basic Info card inside container */}
                  <div className="bg-primary/5 p-6 rounded-[2rem] border border-primary/10 flex items-center gap-5">
                    <div className="shrink-0">
                      {(showProfile.photo_url || showProfile.photoURL) ? (
                        <img src={showProfile.photo_url || showProfile.photoURL} alt="Profielomslag" className="w-20 h-20 rounded-full object-cover border-4 border-surface shadow-md" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-primary/20 border-4 border-surface flex items-center justify-center text-3xl font-display font-black text-primary shadow-md">
                          {showProfile.firstName?.[0] || showProfile.nickname?.[0] || 'K'}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-0.5">{t('popup.candidate_contact', 'Contact-Kandidaat')}</p>
                      <h4 className="font-display font-black text-xl text-on-background">{showProfile.firstName || showProfile.nickname} {showProfile.lastName || ''}</h4>
                      <p className="text-xs text-on-surface-variant font-semibold mt-0.5">
                        {t('popup.search_area', 'Zoekgebied')}: {[showProfile.city, showProfile.country].filter(Boolean).join(', ') || t('popup.no_preferred_location', 'Geen voorkeurslocatie')}
                      </p>
                    </div>
                  </div>

                  {/* Profile Summary Elements */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
                    {showProfile.budget_max > 0 && (
                      <div className="p-4 bg-surface rounded-2xl border border-outline/50 shadow-xs">
                        <span className="block opacity-60 text-[10px] font-bold uppercase tracking-wider mb-1">{t('popup.budget', 'Budget')}</span>
                        <span className="font-bold text-sm text-on-background">
                          {currencyConverter.formatEur(showProfile.budget_min || 0)} - {currencyConverter.formatEur(showProfile.budget_max)} {t('popup.per_month', 'p/m')}
                        </span>
                      </div>
                    )}
                    <div className="p-4 bg-surface rounded-2xl border border-outline/50 shadow-xs">
                      <span className="block opacity-60 text-[10px] font-bold uppercase tracking-wider mb-1">{t('popup.rent_period', 'Huurperiode')}</span>
                      <span className="font-bold text-sm text-on-background">
                        {showProfile.is_indefinite ? t('popup.indefinite', 'Onbepaalde tijd') : showProfile.stay_duration_months ? `${showProfile.stay_duration_months} ${t('popup.months', 'maanden')}` : t('popup.not_selected', 'Niet geselecteerd')}
                      </span>
                    </div>
                    <div className="p-4 bg-surface rounded-2xl border border-outline/50 shadow-xs">
                      <span className="block opacity-60 text-[10px] font-bold uppercase tracking-wider mb-1">{t('popup.occupancy', 'Bewoning')}</span>
                      <span className="font-bold text-sm text-on-background">
                        {showProfile.single_occupancy ? t('popup.single', 'Alleen') : `${t('popup.roommates', 'Met huisgenoten')} (${showProfile.min_roommates || 1} - ${showProfile.max_roommates || 2})`}
                      </span>
                    </div>
                    {showProfile.available_from && (
                      <div className="p-4 bg-surface rounded-2xl border border-outline/50 shadow-xs">
                        <span className="block opacity-60 text-[10px] font-bold uppercase tracking-wider mb-1">{t('popup.available_from', 'Beschikbaar per')}</span>
                        <span className="font-bold text-sm text-on-background">
                          {formatDate(new Date(showProfile.available_from), dateFormat)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Introductie met whitespace-pre-wrap */}
                  {showProfile.introduction && (
                    <div className="p-6 bg-surface rounded-[2rem] border border-outline/50 shadow-xs">
                      <h4 className="text-sm font-bold text-on-surface uppercase tracking-widest mb-3 flex items-center gap-2">
                        <User size={16} className="text-primary" /> {t('popup.about_me', 'Over mij / Voorstellen')}
                      </h4>
                      <p className="text-on-surface-variant text-sm whitespace-pre-wrap leading-relaxed">{showProfile.introduction}</p>
                    </div>
                  )}

                  {/* Goals & Property types */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {showProfile.goal && showProfile.goal.length > 0 && (
                      <div className="p-5 bg-surface rounded-[2rem] border border-outline/50 shadow-xs">
                        <h4 className="text-xs font-bold text-on-surface uppercase tracking-widest mb-3">{t('popup.search_goal', 'Zoekdoel')}</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {showProfile.goal.map((g: string) => (
                            <span key={g} className="px-3 py-1 bg-primary/10 text-primary rounded-lg text-xs font-bold">
                              {t(`prop.goal.${g}`, g)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {showProfile.property_type && showProfile.property_type.length > 0 && (
                      <div className="p-5 bg-surface rounded-[2rem] border border-outline/50 shadow-xs">
                        <h4 className="text-xs font-bold text-on-surface uppercase tracking-widest mb-3">{t('popup.property_types', 'Geïnteresseerde woningtypes')}</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {showProfile.property_type.map((type: string) => (
                            <span key={type} className="px-3 py-1 bg-tertiary/10 text-tertiary rounded-lg text-xs font-bold">
                              {t(`prop.type.${type}`, type)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Samenstelling - Corrected Gender matching! */}
                  {showProfile.composition && showProfile.composition.length > 0 && (
                    <div className="p-6 bg-surface rounded-[2rem] border border-outline/50 shadow-xs">
                      <h4 className="text-sm font-bold text-on-surface uppercase tracking-widest mb-3 flex items-center gap-2">
                        <User size={16} className="text-primary" /> {t('popup.household_composition', 'Samenstelling van het huishouden')}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {showProfile.composition.map((c: any, i: number) => {
                          const genderLower = (c.gender || '').toLowerCase();
                          const isMale = genderLower === 'man' || genderLower === 'male';
                          const isFemale = genderLower === 'vrouw' || genderLower === 'female';
                          const isChild = genderLower === 'kind' || genderLower === 'child';
                          
                          const genderLabel = isMale ? t('seeker.gender_male', 'Man') : isFemale ? t('seeker.gender_female', 'Vrouw') : isChild ? t('seeker.gender_child', 'Kind') : t('seeker.gender_other', 'Anders');
                          const dotColor = isMale ? 'bg-blue-500' : isFemale ? 'bg-pink-500' : isChild ? 'bg-amber-500' : 'bg-purple-500';
                          
                          return (
                            <div key={i} className="flex items-center gap-3 text-sm text-on-surface-variant font-semibold p-3 lg:p-4 bg-slate-50 rounded-2xl border border-outline/25 w-fit">
                              <span className={`w-2.5 h-2.5 rounded-full ${dotColor} animate-pulse`}></span>
                              {genderLabel}, {c.age} {t('popup.years', 'jaar')}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Sluitknop */}
                <div className="p-5 border-t border-outline bg-surface flex items-center justify-between shrink-0">
                  {(() => {
                    const profileChat = processedChats.find(c => c.seekerId === showProfile.id);
                    if (profileChat && profileChat.status === 'active') {
                       return (
                          <button
                            onClick={() => { setShowProfile(null); handleTerminateChat(profileChat.id); }}
                            className="px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors border border-red-200 active:scale-95 text-sm font-bold flex items-center gap-2 shadow-sm"
                          >
                            <Ban size={16} /> {t('chat.terminate', 'Beëindig gesprek')}
                          </button>
                       );
                    }
                    return <div />;
                  })()}
                  <button 
                    onClick={() => setShowProfile(null)}
                    className="px-6 py-3 bg-slate-950 hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] text-white rounded-xl font-bold text-sm transition-all shadow-md"
                  >
                    {t('chat.close_all', 'Sluiten')}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
      <AnimatePresence>
        {chatToTerminate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-background text-on-background rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden border border-outline"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-red-100">
                  <AlertCircle size={32} />
                </div>
                <h3 className="text-xl font-display font-black text-on-surface">
                  Gesprek stoppen?
                </h3>
                <p className="text-sm text-on-surface-variant font-medium">
                  Weet je zeker dat je dit gesprek wilt beëindigen? De kandidaat kan dan niet meer reageren en de plek komt weer vrij.
                </p>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setChatToTerminate(null)}
                    className="flex-1 px-4 py-3 rounded-xl font-black uppercase tracking-widest text-on-surface bg-surface-container hover:bg-surface-container-high transition-all"
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={confirmTerminateChat}
                    className="flex-1 px-4 py-3 rounded-xl font-black uppercase tracking-widest text-on-primary bg-red-600 hover:bg-red-700 transition-all shadow-md"
                  >
                    Stoppen
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {translateModalInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-background text-on-background rounded-[2rem] shadow-2xl p-6 lg:p-8 w-full max-w-lg mx-auto border border-outline"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-display font-black text-on-surface">{t('report.translate_title', 'Ontdekte taalafwijking')}</h3>
                <button
                  onClick={() => setTranslateModalInfo(null)}
                  className="p-2 bg-surface-container rounded-full hover:bg-surface-container-high transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-on-surface-variant font-medium mb-8 leading-relaxed">
                {t('report.translate_desc', 'Het AI Match Rapport is gemaakt in ')} <strong>{translateModalInfo.existing.language?.toUpperCase() || 'een andere taal'}</strong>. {t('report.translate_desc_2', 'Wil je het originele rapport bekijken of wil je het vertalen naar jouw voertaal ')} (<strong>{translateModalInfo.targetLang.toUpperCase()}</strong>)?
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleTranslateReport}
                  disabled={isTranslating}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-black uppercase tracking-widest text-on-primary bg-primary hover:bg-primary/95 transition-all shadow-md disabled:opacity-50"
                >
                  {isTranslating ? (
                    <span className="flex items-center gap-2"><Sparkles className="animate-spin" size={20}/> {t('report.translating', 'Vertalen...')}</span>
                  ) : (
                    <span className="flex items-center gap-2"><ArrowUpDown size={20}/> {t('report.translate_btn', 'Vertaal rapport')}</span>
                  )}
                </button>
                <button
                  onClick={handleShowOriginalReport}
                  disabled={isTranslating}
                  className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-on-surface bg-surface-container hover:bg-surface-container-high transition-all outline outline-1 outline-outline"
                >
                  {t('report.show_original_btn', 'Toon Origineel')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDatePickerForMeeting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-background text-on-background rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden p-6 border border-outline"
            >
              <h3 className="text-xl font-display font-black text-on-surface mb-4">
                {t('chat.schedule_meeting', 'Videogesprek inplannen')}
              </h3>
              <p className="text-sm text-on-surface-variant font-medium mb-4">
                {t('chat.schedule_meeting_desc', 'Kies een datum en tijd voor het videogesprek.')}
              </p>
              
              <input 
                type="datetime-local" 
                className="w-full text-sm p-3 border border-outline rounded-xl bg-surface mb-6"
                value={pickedMeetingDate}
                onChange={e => setPickedMeetingDate(e.target.value)}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDatePickerForMeeting(false)}
                  className="flex-1 px-4 py-3 rounded-xl font-black uppercase tracking-widest text-on-surface bg-surface-container hover:bg-surface-container-high transition-all"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleProposeMeeting}
                  className="flex-1 px-4 py-3 rounded-xl font-black uppercase tracking-widest text-on-primary bg-emerald-600 hover:bg-emerald-700 transition-all shadow-md"
                >
                  Voorstellen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
