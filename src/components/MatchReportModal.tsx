import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, MessageSquare, ShieldCheck, Share2, Heart, Send, AlertCircle, CheckCheck, Check, Mic, Play, Linkedin, ExternalLink, Info, Printer, User, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useSettings } from '../contexts/SettingsContext';
import { formatTime, formatDate } from '../lib/formatters';
import { useCurrencyConverter } from '../hooks/useCurrencyConverter';
import { ExpertHub } from './ExpertHub';
import AudioRecorder from './AudioRecorder';
import { TrustBadge, TrustPopup } from './TrustBadge';
import { deductCredits } from '../services/creditService';
import { CREDIT_COSTS } from '../constants';
import VideoMeetingBanner from './VideoMeetingBanner';
import { getExistingMatch } from '../services/matchService';
import { sendProviderChatMessageEmailNotification } from '../services/smartMatchAlertService';

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

interface MatchReportModalProps {
  report: string;
  property: any;
  onClose: () => void;
  initialShowContact?: boolean;
  seekerId?: string;
}

export default function MatchReportModal({ report, property, onClose, initialShowContact = false, seekerId }: MatchReportModalProps) {
  const { t } = useTranslation();
  const currencyConverter = useCurrencyConverter();

  const { dateFormat, timeFormat } = useSettings();
  const [localReport, setLocalReport] = useState(report);
  const [isFavorited, setIsFavorited] = useState(false);

  useEffect(() => {
    setLocalReport(report);
  }, [report]);

  useEffect(() => {
    if (!localReport && property?.id && auth.currentUser) {
      const loadExisting = async () => {
        try {
          const targetSeeker = seekerId || auth.currentUser!.uid;
          const existing = await getExistingMatch(targetSeeker, property.id) as any;
          if (existing && existing.report) {
            setLocalReport(existing.report);
          }
        } catch (err) {
          console.error("Error loading existing match report inside MatchReportModal:", err);
        }
      };
      loadExisting();
    }
  }, [property?.id, localReport, seekerId]);
  const [isSavingFav, setIsSavingFav] = useState(false);
  const [providerProfile, setProviderProfile] = useState<any>(null);
  const [seekerProfile, setSeekerProfile] = useState<any>(null);
  const [showContactModal, setShowContactModal] = useState(initialShowContact);
  const [message, setMessage] = useState('');
  const [chatData, setChatData] = useState<any>(null);
  const [isSending, setIsSending] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [isExpertHubOpen, setIsExpertHubOpen] = useState(false);
  const [showSafetyWarning, setShowSafetyWarning] = useState(true);
  const [showTrustPopup, setShowTrustPopup] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (showContactModal && chatData?.messages) {
      scrollToBottom();
    }
  }, [showContactModal, chatData?.messages?.length]);

  useEffect(() => {
    if (showContactModal) {
      setShowSafetyWarning(true);
      // Small delay to ensure DOM is ready
      setTimeout(() => scrollToBottom('auto'), 100);
    }
  }, [showContactModal]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    // Hide credits button when modal is open
    window.dispatchEvent(new CustomEvent('toggle-credits-visibility', { detail: false }));
    return () => { 
      document.body.style.overflow = 'unset'; 
      document.documentElement.style.overflow = 'unset';
      window.dispatchEvent(new CustomEvent('toggle-credits-visibility', { detail: true }));
    };
  }, []);

  useEffect(() => {
    const fetchProfiles = async () => {
      if (!auth.currentUser) return;
      
      // 1. Check Favorite Status and get Seeker Profile
      try {
        const targetSeeker = seekerId || auth.currentUser.uid;
        const snap = await getDoc(doc(db, 'seeker_profiles', targetSeeker));
        if (snap.exists()) {
          const seekerData = snap.data();
          setSeekerProfile(seekerData);
          if (seekerData.favorites?.includes(property.id) && !seekerId) {
            setIsFavorited(true);
          }
        }
      } catch (e) {}

      // 2. Fetch Provider Profile
      if (property?.ownerId) {
        try {
          const snap = await getDoc(doc(db, 'providers', property.ownerId));
          if (snap.exists()) {
            setProviderProfile(snap.data());
          }
        } catch (e) {}
      }
    };

    fetchProfiles();
  }, [property]);

  // Listen to chat
  useEffect(() => {
    if (!auth.currentUser || !property?.id || !showContactModal) return;

    const chatId = `${auth.currentUser.uid}_${property.id}`;
    const unsubscribe = onSnapshot(doc(db, 'chats', chatId), (doc) => {
      if (doc.exists()) {
        setChatData({ id: doc.id, ...doc.data() });
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `chats/${chatId}`));

    return () => unsubscribe();
  }, [showContactModal, property?.id]);

  const toggleFavorite = async (forceFav = false) => {
    if (!auth.currentUser) return;
    if (forceFav && isFavorited) return; // Already faved

    setIsSavingFav(true);
    try {
      const ref = doc(db, 'seeker_profiles', auth.currentUser.uid);
      if (isFavorited && !forceFav) {
        await updateDoc(ref, { favorites: arrayRemove(property.id) });
        setIsFavorited(false);
      } else {
        await updateDoc(ref, { favorites: arrayUnion(property.id) });
        setIsFavorited(true);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `seeker_profiles/${auth.currentUser.uid}`);
    }
    setIsSavingFav(false);
  };

  const getSeekerConsecutiveCount = () => {
    if (!chatData || !chatData.messages) return 0;
    let count = 0;
    for (let i = chatData.messages.length - 1; i >= 0; i--) {
      if (chatData.messages[i].senderId === auth.currentUser?.uid) {
        count++;
      } else {
        break;
      }
    }
    return count;
  };

  const seekerConsecutiveCount = getSeekerConsecutiveCount();
  const seekerMessagesLeft = Math.max(0, 3 - seekerConsecutiveCount);

  const MAX_MESSAGE_LENGTH = 500;

  const sanitizeMessage = (text: string) => {
    // Dutch and common European characters allowed, basic punctuation, no emojis
    // We allow letters (\p{L}), numbers (\p{N}), spaces (\s), and specific punctuation.
    // Unicode range \u00C0-\u017F covers Latin Extended-A (accents).
    return text
      .replace(/[^\x20-\x7E\s\u00C0-\u017F.,!?;:()'"\-\r\n]/gu, '') 
      .trim();
  };

  const handleSendMessage = async () => {
    if (!auth.currentUser || !message.trim() || isSending) return;

    if (chatData && chatData.messages && chatData.messages.length >= 50) {
      alert("Maximum van 50 berichten bereikt voor deze chatbox.");
      return;
    }

    const sanitizedText = sanitizeMessage(message);
    if (!sanitizedText) {
      alert(t('chat.error_invalid'));
      return;
    }

    if (sanitizedText.length > MAX_MESSAGE_LENGTH) {
      alert(t('chat.error_too_long', { max: MAX_MESSAGE_LENGTH }));
      return;
    }

    // Check limit
    if (seekerMessagesLeft === 0) {
      alert(t('chat.error_limit'));
      return;
    }

    setIsSending(true);
    try {
      const chatId = `${auth.currentUser.uid}_${property.id}`;
      const chatRef = doc(db, 'chats', chatId);
      
      const newMessage = {
        senderId: auth.currentUser.uid,
        text: sanitizedText,
        createdAt: new Date()
      };

      if (!chatData) {
        // Check if property is already full
        const propSnap = await getDoc(doc(db, 'properties', property.id));
        const propData = propSnap.data();
        if (propData) {
           const current = propData.currentInquiries || 0;
           const max = propData.maxInquiries || 10;
           if (current >= max) {
              alert(t('chat.error_property_full', 'Deze woning heeft het maximaal aantal reacties bereikt en is tijdelijk gepauzeerd.'));
              setIsSending(false);
              return;
           }
        }

        await setDoc(chatRef, {
          seekerId: auth.currentUser.uid,
          propertyId: property.id,
          providerId: property.ownerId,
          lastSenderId: auth.currentUser.uid,
          status: 'active',
          messages: [newMessage],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Increment count and auto-pause if needed
        const currentCount = (property.currentInquiries || 0);
        const newCount = currentCount + 1;
        const maxLimit = (property.maxInquiries || 10);
        
        await updateDoc(doc(db, 'properties', property.id), {
          currentInquiries: newCount,
          status: newCount >= maxLimit ? 'paused' : (property.status || 'available')
        });
      } else {
        await updateDoc(chatRef, {
          lastSenderId: auth.currentUser.uid,
          messages: arrayUnion(newMessage),
          updatedAt: serverTimestamp()
        });
      }

      // Automatically add to favorites
      if (!isFavorited) {
        await toggleFavorite(true);
      }
      
      // Send chat message email notification asynchronously, respects settings & 15-minute cooldown
      sendProviderChatMessageEmailNotification(chatId, sanitizedText, auth.currentUser.uid)
        .then((res) => {
          if (res && res.status === 'sent') {
            console.log('[Provider Chat Email Alert] Simulated email queued successfully.');
          }
        })
        .catch((err) => {
          console.error('[Provider Chat Email Alert] Error during simulated send:', err);
        });

      setMessage('');
    } catch (e) {
      handleFirestoreError(e, chatData ? OperationType.UPDATE : OperationType.CREATE, `chats/${auth.currentUser.uid}_${property.id}`);
      alert(t('chat.error_send'));
    }
    setTimeout(() => setIsSending(false), 300);
  };

  const handleSendAudioMessage = async (base64Audio: string, transcript: string) => {
    if (!auth.currentUser || isSending) return;

    if (chatData && chatData.messages && chatData.messages.length >= 50) {
      alert("Maximum van 50 berichten bereikt voor deze chatbox.");
      return;
    }

    if (seekerMessagesLeft === 0) {
      alert(t('chat.error_limit'));
      return;
    }

    setIsSending(true);
    try {
      const success = await deductCredits(CREDIT_COSTS.AUDIO_MESSAGE, `Audio bericht verzonden`);
      if (!success) {
        setIsSending(false);
        window.dispatchEvent(new Event('open-credits-modal'));
        return;
      }

      const chatId = `${auth.currentUser.uid}_${property.id}`;
      const chatRef = doc(db, 'chats', chatId);
      
      const newMessage = {
        senderId: auth.currentUser.uid,
        text: '[Audio]', // the user requested to only use the transcript for checking before sending, not to store it
        audioUrl: base64Audio, // Base64 inline audio data
        hasAudio: true,
        createdAt: new Date()
      };

      if (!chatData) {
        // Check if property is already full
        const propSnap = await getDoc(doc(db, 'properties', property.id));
        const propData = propSnap.data();
        if (propData) {
           const current = propData.currentInquiries || 0;
           const max = propData.maxInquiries || 10;
           if (current >= max) {
              alert(t('chat.error_property_full', 'Deze woning heeft het maximaal aantal reacties bereikt en is tijdelijk gepauzeerd.'));
              setIsSending(false);
              return;
           }
        }

        await setDoc(chatRef, {
          seekerId: auth.currentUser.uid,
          propertyId: property.id,
          providerId: property.ownerId,
          lastSenderId: auth.currentUser.uid,
          status: 'active',
          messages: [newMessage],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Increment count and auto-pause if needed
        const currentCount = (property.currentInquiries || 0);
        const newCount = currentCount + 1;
        const maxLimit = (property.maxInquiries || 10);
        
        await updateDoc(doc(db, 'properties', property.id), {
          currentInquiries: newCount,
          status: newCount >= maxLimit ? 'paused' : (property.status || 'available')
        });
      } else {
        await updateDoc(chatRef, {
          lastSenderId: auth.currentUser.uid,
          messages: arrayUnion(newMessage),
          updatedAt: serverTimestamp()
        });
      }

      if (!isFavorited) {
        await toggleFavorite(true);
      }
      
      // Send chat message email notification asynchronously, respects settings & 15-minute cooldown
      sendProviderChatMessageEmailNotification(chatId, '[Audio bericht]', auth.currentUser.uid)
        .then((res) => {
          if (res && res.status === 'sent') {
            console.log('[Provider Chat Email Alert] Simulated email queued successfully.');
          }
        })
        .catch((err) => {
          console.error('[Provider Chat Email Alert] Error during simulated send:', err);
        });

      setShowAudioRecorder(false);
    } catch (e) {
      console.error("Error sending audio message:", e);
      alert(t('chat.error_send'));
    }
    setTimeout(() => setIsSending(false), 300);
  };

  const handleCloseAll = () => {
    onClose();
  };

  const handleReportClose = () => {
    if (initialShowContact) {
      setShowContactModal(true);
    } else {
      onClose();
    }
  };

  const handleChatClose = () => {
    if (initialShowContact) {
      onClose();
    } else {
      setShowContactModal(false);
    }
  };

  const imageUrlToBase64 = async (url: string): Promise<string> => {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    try {
      const fetchUrl = url.includes('?') ? `${url}&cb=${Date.now()}` : `${url}?cb=${Date.now()}`;
      const response = await fetch(fetchUrl, { mode: 'cors' });
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn("CORS/Fetch error for PDF image:", url, e);
      return url;
    }
  };

  const getHtmlContent = (overrides: { propertyImageBase64?: string } = {}) => {
    const propertyImage = overrides.propertyImageBase64 || property.images?.find((img: any) => img.id === property.teaserImageId)?.url || property.images?.[0]?.url;

    let htmlContent = localReport
      .replace(/^### (.*$)/gim, '<h3 style="font-family: system-ui, -apple-system, sans-serif; color: #1e293b; margin-top: 1.5em; margin-bottom: 0.5em; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.25em;">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 style="font-family: system-ui, -apple-system, sans-serif; color: #0f172a; margin-top: 1.8em; margin-bottom: 0.6em; border-bottom: 2px solid #cbd5e1; padding-bottom: 0.3em;">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 style="font-family: system-ui, -apple-system, sans-serif; color: #0f172a; margin-top: 2em; margin-bottom: 0.8em; text-align: center;">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #0f172a;">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^- (.*$)/gim, '<li style="margin-bottom: 0.5em; line-height: 1.6; font-family: system-ui, -apple-system, sans-serif;">$1</li>')
      .replace(/\n\n/g, '<p style="margin-bottom: 1.25em; line-height: 1.6; color: #334155; font-family: system-ui, -apple-system, sans-serif;"></p>');

    htmlContent = htmlContent.replace(/(<li>.*<\/li>)/g, '<ul style="margin-bottom: 1.25em; padding-left: 1.5em; font-family: system-ui, -apple-system, sans-serif;">$1</ul>');

    const fullHtml = `<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Match Rapport - Co-Match</title>
    <style>
        body { font-family: -apple-system, system-ui, sans-serif; color: #334155; padding: 2rem; margin: 0; background-color: #f8fafc; line-height: 1.6; }
        .container { max-width: 800px; margin: 0 auto; background: #fff; padding: 3rem; border-radius: 1.5em; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
        .header { text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 2rem; margin-bottom: 2rem; }
        .app-title { font-size: 1.2rem; color: #2563eb; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; margin: 0.5rem 0; }
        .meta-info { font-size: 0.85rem; color: #64748b; margin-top: 0.5rem; }
        @media print { 
            body { background: white; padding: 0; }
            .container { box-shadow: none; border: none; padding: 0; max-width: 100%; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="app-title">Co-Match</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: #0f172a; margin-top: 0.5rem; letter-spacing: -0.025em;">AI Match Rapport</div>
            <div class="meta-info">Gegenereerd voor ${property?.title || 'Woning'} op ${new Date().toLocaleDateString('nl-NL')}</div>
        </div>
        ${propertyImage ? `
        <div style="margin-bottom: 2rem; border-radius: 1rem; overflow: hidden; height: 300px;">
          <img src="${propertyImage}" style="width: 100%; height: 100%; object-fit: cover;" crossorigin="anonymous" />
        </div>
        ` : ''}
        ${htmlContent}
    </div>
</body>
</html>`;
    return fullHtml;
  };

  const [isExporting, setIsExporting] = useState(false);

  const generatePDFBlob = async (toastId?: string): Promise<Blob | null> => {
    try {
      // Pre-process images to base64 to avoid CORS issues in canvas
      const propertyImage = property.images?.find((img: any) => img.id === property.teaserImageId)?.url || property.images?.[0]?.url;
      const propertyImageBase64 = propertyImage ? await imageUrlToBase64(propertyImage) : undefined;

      const fullHtml = getHtmlContent({ propertyImageBase64 });
      
      // Create a temporary container
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '800px';
      container.innerHTML = fullHtml;
      document.body.appendChild(container);

      // Give it a moment to render and load images
      await new Promise(resolve => setTimeout(resolve, 1500));

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: false, // Changed to false to avoid issues with tainted canvases
        backgroundColor: '#f8fafc',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      // Handle multi-page
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      const blob = pdf.output('blob');
      document.body.removeChild(container);
      return blob;
    } catch (error) {
      console.error('PDF Generation error:', error);
      if (toastId) toast.error('PDF genereren mislukt.', { id: toastId });
      return null;
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    const toastId = toast.loading('PDF wordt voorbereid...');
    const blob = await generatePDFBlob(toastId);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `MatchRapport_${property?.id || 'Huis'}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('PDF succesvol opgeslagen!', { id: toastId });
    }
    setIsExporting(false);
  };

  const handlePrint = async () => {
    setIsExporting(true);
    const toastId = toast.loading('PDF wordt voorbereid voor afdrukken...');
    const blob = await generatePDFBlob(toastId);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        // Wait for PDF to load then print
        toast.success('Printscherm wordt geopend...', { id: toastId });
        // Many browsers allow direct printing from PDF tabs, but we can't trigger it easily cross-browser.
        // Opening the PDF in a new tab is a solid professional approach.
      } else {
        toast.error('Pop-ups blokkeren de printfunctie.', { id: toastId });
      }
    }
    setIsExporting(false);
  };

  const handleTerminateChat = async () => {
    if (!auth.currentUser || !property?.id || !chatData) return;
    if (chatData.status === 'terminated') return;

    if (!window.confirm(t('chat.terminate_confirm', 'Weet je zeker dat je dit gesprek wilt beëindigen? Je kunt dan niet meer reageren.'))) return;

    try {
      const chatId = `${auth.currentUser.uid}_${property.id}`;
      const chatRef = doc(db, 'chats', chatId);
      const propRef = doc(db, 'properties', property.id);

      // 1. Terminate chat
      await updateDoc(chatRef, {
        status: 'terminated',
        updatedAt: serverTimestamp()
      });

      // 2. Decrement inquiry count
      // We also update property status to 'available' if it was automatically paused? 
      // Maybe not automatically, let the provider decide or maybe yes if it was purely because of max.
      await updateDoc(propRef, {
        currentInquiries: Math.max(0, (property.currentInquiries || 1) - 1)
      });
      
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `chats/${auth.currentUser.uid}_${property.id}`);
    }
  };

  const handleShare = async () => {
    const toastId = toast.loading('PDF wordt voorbereid voor delen...');
    const blob = await generatePDFBlob(toastId);
    if (!blob) return;

    const file = new File([blob], `MatchRapport_${property?.id || 'Huis'}.pdf`, { type: 'application/pdf' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: t('report.share_title'),
          text: t('report.share_text'),
        });
        toast.success('PDF gedeeld!', { id: toastId });
      } catch (e) {
        console.error('Share error:', e);
        toast.dismiss(toastId);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success(t('report.copy_success'), { id: toastId });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `MatchRapport_${property?.id || 'Huis'}.pdf`;
      link.click();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-md flex items-center justify-center p-0 md:p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-background md:rounded-[3rem] w-full max-w-6xl h-[100dvh] md:h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-outline"
      >
        <AnimatePresence mode="wait">
          {showContactModal ? (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col h-full w-full relative"
            >
              <div className="p-3 md:p-4 bg-surface-container-lowest border-b border-outline shrink-0 flex justify-between items-center">
                <div className="flex items-center gap-3 md:gap-4 flex-1">
                   <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                      {providerProfile?.photoUrl ? (
                         <img src={providerProfile.photoUrl} className="w-full h-full object-cover" />
                      ) : (
                         <MessageSquare className="text-primary" size={20} />
                      )}
                   </div>
                   <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm md:text-lg font-display font-black text-on-background truncate">{t('chat.title', { name: providerProfile?.firstName || t('report.provider_profile') })}</h2>
                        <div className="flex items-center gap-1">
                          <TrustBadge 
                            level={providerProfile?.verificationLevel || 1} 
                            onClick={(e) => { e.stopPropagation(); setShowTrustPopup(true); }}
                            className="scale-90 md:scale-100"
                          />
                          <button 
                            onClick={(e) => { e.stopPropagation(); setShowTrustPopup(true); }}
                            className="p-1 text-on-surface-variant hover:text-primary transition-colors"
                          >
                            <Info size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-[9px] md:text-[10px] font-black uppercase text-on-surface-variant">{t('chat.status_available')}</span>
                      </div>
                   </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => setShowContactModal(false)}
                    className="flex items-center gap-1.5 md:gap-2 px-3.5 py-2.5 border border-amber-500/10 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest shadow-md hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer"
                  >
                    <Sparkles size={14} className="fill-current animate-pulse text-white" />
                    <span>Lees AI Match</span>
                  </button>
                  <button 
                    onClick={handleChatClose}
                    className="p-2 md:p-3 bg-surface-container hover:bg-surface-container-high rounded-full transition-all text-on-surface"
                    title={initialShowContact ? t('common.close', 'Sluiten') : t('chat.back_to_report', 'Terug naar rapport')}
                  >
                    <X className="w-[18px] h-[18px] md:w-[20px] md:h-[20px]" />
                  </button>
                </div>
              </div>

              <div className="flex-grow p-2 md:p-3 bg-surface-container-lowest flex flex-col overflow-hidden">
                {/* Unified Info Panel: LinkedIn, Intro & Safety combined or made more compact */}
                <div className="flex flex-col gap-1.5 mb-1.5 shrink-0">
                  {chatData?.meta?.isLinkedInShared && (
                      <div className="p-1.5 bg-blue-50 border border-blue-200 rounded-lg shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 relative z-10 flex gap-2 items-center">
                            <div className="w-5 h-5 bg-blue-600 rounded-md flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/20">
                               <Linkedin size={12} />
                            </div>
                            <div className="flex-1 min-w-0 flex items-center justify-between">
                               <h4 className="font-display font-black text-blue-900 text-[8px] md:text-[9px] uppercase tracking-wider truncate mr-2">{t('chat.linkedin_shared_title')}</h4>
                               <a 
                                 href={chatData.meta.linkedInUrl} 
                                 target="_blank" 
                                 rel="noopener noreferrer" 
                                 className="inline-flex items-center gap-1 text-blue-600 text-[8px] md:text-[9px] font-black uppercase tracking-widest hover:underline transition-all whitespace-nowrap"
                               >
                                 Profiel <ExternalLink size={8} />
                               </a>
                            </div>
                      </div>
                   )}

                  <div className="grid grid-cols-2 gap-1.5 shrink-0">
                    {/* Intro & Counter - Ultra Compact */}
                    <div className="flex items-center justify-between bg-primary/5 p-1.5 rounded-lg border border-primary/10">
                       <div className="flex items-center gap-1.5 min-w-0">
                          <Sparkles className="text-primary w-[10px] h-[10px] shrink-0" />
                          <div className="min-w-0 overflow-hidden">
                            <p className="text-[7px] md:text-[8px] font-bold text-on-surface truncate uppercase tracking-tight">{t('chat.intro_title')}</p>
                            <p className="text-[7px] md:text-[8px] text-on-surface-variant leading-tight truncate">{seekerMessagesLeft} left</p>
                          </div>
                       </div>
                       <div className="flex gap-0.5 shrink-0 ml-1">
                          {[1,2,3].map(i => (
                            <div key={i} className={`w-1.5 h-0.5 rounded-full ${i <= seekerConsecutiveCount ? 'bg-primary' : 'bg-outline/30'}`} />
                          ))}
                       </div>
                    </div>

                    {/* Compact Safety Warning */}
                    <div 
                      className="p-1.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-1.5 cursor-pointer group hover:bg-amber-100 transition-colors"
                      onClick={() => setShowSafetyWarning(!showSafetyWarning)}
                    >
                       <div className="flex items-center gap-1.5 min-w-0">
                          <ShieldCheck className="text-amber-600 w-[10px] h-[10px] shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-amber-900 truncate">{t('chat.safety_title', 'Veiligheid')}</p>
                            <p className="text-[7px] md:text-[8px] text-amber-800 font-medium truncate italic">Tips</p>
                          </div>
                       </div>
                       <div className="bg-amber-200/30 p-0.5 rounded-md group-hover:bg-amber-200 transition-colors shrink-0">
                          {showSafetyWarning ? <X size={8} className="text-amber-700" /> : <Info size={8} className="text-amber-700" />}
                       </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {showSafetyWarning && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-2 bg-amber-50/50 border border-amber-200/50 rounded-lg text-[8px] md:text-[9px] leading-tight text-amber-800 font-medium mt-0.5 relative">
                           <button onClick={() => setShowSafetyWarning(false)} className="absolute top-1 right-1 opacity-40 hover:opacity-100"><X size={10}/></button>
                           {t('chat.seeker_safety_premium', 'Privacy: geef geen direct privénummer. Voor hulp, zie ons')} <button onClick={() => setIsExpertHubOpen(true)} className="text-primary font-black hover:underline underline-offset-2">{t('chat.partner_network', 'Partner Netwerk')}</button>.
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex-grow overflow-y-auto space-y-3 mb-1 custom-scrollbar pr-1 min-h-0">

                   <VideoMeetingBanner 
                      chat={chatData} 
                      isSeeker={true} 
                   />
                   
                   {chatData?.status === 'blocked' && (
                     <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center font-bold mb-4">
                       {t('chat.provider_ended')}
                     </div>
                   )}
                   {chatData?.status === 'terminated' && (
                     <div className="bg-orange-50 text-orange-600 p-4 rounded-2xl text-sm text-center font-bold mb-4 border border-orange-100 bg-orange-50/50">
                       <p>{t('chat.ended_status', 'Dit gesprek is beëindigd.')}</p>
                       <p className="text-[10px] font-medium mt-1 opacity-70 italic">{t('chat.ended_status_desc', 'Het gesprek is bevroren en telt niet meer mee voor de reactielimiet.')}</p>
                     </div>
                   )}
                   {chatData?.messages?.map((msg: any, idx: number) => {
                       if (msg.isSystem) {
                         return (
                           <div key={idx} className="flex justify-center my-4">
                             <div className="bg-surface-container/50 px-4 py-1.5 rounded-full border border-outline/30">
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
                   <div ref={messagesEndRef} className="h-4" />
                   {(!chatData || chatData.messages.length === 0) && (
                      <div className="text-center py-12 text-on-surface-variant space-y-4">
                         <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-4">
                            <MessageSquare className="opacity-30" />
                         </div>
                         <p className="text-sm font-bold">{t('chat.no_messages')}</p>
                         <p className="text-xs max-w-xs mx-auto opacity-70">{t('chat.no_messages_desc')}</p>
                      </div>
                   )}
                </div>

                <div className="relative shrink-0 p-2 md:p-4 bg-surface-container-lowest border-t border-outline">
                   {chatData?.meta?.isLinkedInShared && (
                     <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-2xl mb-4 gap-4">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg overflow-hidden shrink-0">
                              <Linkedin size={20} />
                           </div>
                           <div className="text-left">
                              <p className="text-[10px] font-black uppercase tracking-widest text-blue-900">{t('chat.provider_linked_shared', 'Aanbieder deelde LinkedIn')}</p>
                              <p className="text-[11px] text-blue-700 font-medium">Je kunt nu het geverifieerde profiel bekijken.</p>
                           </div>
                        </div>
                        <a 
                          href={chatData.meta.linkedInUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-blue-700 transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                          Bekijk Profiel <ExternalLink size={14} />
                        </a>
                     </div>
                   )}

                   {showAudioRecorder ? (
                    <AudioRecorder 
                      onAudioReady={handleSendAudioMessage}
                      onCancel={() => setShowAudioRecorder(false)}
                      maxDurationSeconds={60}
                    />
                  ) : chatData?.status === 'blocked' || chatData?.status === 'terminated' ? (
                     <div className="bg-surface-container py-6 rounded-3xl border border-outline/30 flex items-center justify-center flex-col gap-2 opacity-80 h-[120px]">
                       <X className="text-on-surface-variant opacity-60 mb-1" size={24} />
                       <p className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">{chatData?.status === 'blocked' ? 'Gesprek geblokkeerd' : 'Gesprek beëindigd'}</p>
                       <p className="text-xs text-on-surface-variant opacity-70">Je kunt niet meer reageren in deze chat.</p>
                     </div>
                  ) : (
                    <>
                      <div className="absolute -top-6 right-2 text-[10px] font-bold text-on-surface-variant flex items-center gap-2">
                        <span className={message.length > MAX_MESSAGE_LENGTH ? 'text-error' : ''}>
                          {t('chat.char_limit', { count: message.length, max: MAX_MESSAGE_LENGTH })}
                        </span>
                        {message.length > 0 && (
                          <span className="text-primary/50 text-[8px] uppercase">{t('chat.text_only')}</span>
                        )}
                      </div>
                      
                      {property?.features?.goal === 'vakantie_onderhuur' && property?.monthlyAvailability && (!chatData || chatData?.messages?.length === 0) && (
                        <div className="mb-4">
                          <p className="text-xs font-bold text-on-surface-variant mb-2">Ik heb interesse in de volgende maanden:</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(property.monthlyAvailability)
                              .filter(([_, status]) => (status === 'free' || status === 'available'))
                              .map(([monthKey, _]) => {
                                const d = new Date(`${monthKey}-01`);
                                const monthKeysShort = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                                const monthName = t(`prop.availability.month_${monthKeysShort[d.getMonth()]}`);
                                const year = d.getFullYear();
                                const label = `${monthName} ${year}`;
                                const isSelected = message.includes(label);
                                
                                return (
                                  <button
                                    key={monthKey}
                                    onClick={() => {
                                      if (isSelected) {
                                        setMessage(message.replace(`[Interesse in: ${label}]\n`, ''));
                                      } else {
                                        setMessage(`[Interesse in: ${label}]\n` + message);
                                      }
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                      isSelected 
                                        ? 'bg-primary text-on-primary border-primary' 
                                        : 'bg-surface-container border-outline/30 text-on-surface hover:border-primary/50'
                                    }`}
                                  >
                                    {label}
                                  </button>
                                );
                            })}
                          </div>
                        </div>
                      )}
                      
                      <textarea 
                        value={message}
                        maxLength={500}
                        onChange={(e) => {
                          setMessage(e.target.value);
                          e.target.style.height = 'auto';
                          e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                        }}
                        rows={1}
                        style={{ minHeight: '50px', maxHeight: '100px' }}
                        disabled={seekerMessagesLeft === 0 || isSending || chatData?.status === 'blocked' || chatData?.status === 'terminated'}
                        className={`w-full bg-surface-container p-3 pb-12 md:p-4 md:pb-14 rounded-2xl outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium resize-none shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-outline/30 placeholder:opacity-60 overflow-y-auto ${
                          message.length > MAX_MESSAGE_LENGTH ? 'border-error ring-1 ring-error' : ''
                        }`}
                        placeholder={chatData?.status === 'blocked' || chatData?.status === 'terminated' ? t('chat.locked', 'Gesprek beëindigd\n\n') : seekerMessagesLeft > 0 ? t('chat.placeholder', 'Typ een bericht en stel je voor...') : t('chat.limit_reached_placeholder', 'Reactielimiet bereikt')}
                      />
                      {seekerMessagesLeft > 0 && chatData?.status !== 'blocked' && chatData?.status !== 'terminated' && (
                        <div className="absolute bottom-2.5 md:bottom-3 right-2.5 md:right-3 left-2.5 md:left-3 flex justify-between items-center z-10 pointer-events-none">
                          <div className="pointer-events-auto">
                            {!(chatData?.messages?.some((msg: any) => msg.senderId === auth.currentUser?.uid && msg.hasAudio)) && chatData?.messages?.some((msg: any) => msg.senderId === property.ownerId) && (
                              <button
                                onClick={() => setShowAudioRecorder(true)}
                                disabled={isSending}
                                title={t('chat.audio_tooltip', 'Neem een eenmalig audiobericht op (max 60s)')}
                                className="flex items-center gap-1 bg-primary/10 text-primary hover:bg-primary hover:text-white px-2.5 py-1.5 rounded-lg transition-all shadow-sm font-bold text-[9px] uppercase tracking-wider"
                              >
                                <Mic className="w-[12px] h-[12px]" />
                                <span className="hidden xs:inline">Audio</span>
                              </button>
                            )}
                          </div>
                          
                          <div className="pointer-events-auto">
                            <button 
                              onClick={handleSendMessage}
                              disabled={!message.trim() || isSending || message.length > MAX_MESSAGE_LENGTH}
                              className="bg-primary text-on-primary px-4 py-1.5 rounded-lg shadow-md hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-1.5 font-bold uppercase tracking-widest text-[9px] h-[32px]"
                            >
                              {isSending ? (
                                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                              ) : (
                                <>
                                  {t('chat.send', 'Stuur')}
                                  <Send className="w-[10px] h-[10px]" />
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="p-3 md:p-4 border-t border-outline bg-white flex items-center justify-end shrink-0 gap-3">
                <button 
                  onClick={handleCloseAll}
                  className="px-6 py-3 bg-slate-950 hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] text-white rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all shadow-md"
                >
                  <span>{t('chat.close_all', 'Close')}</span>
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="report"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col h-full w-full"
            >
              {/* Header */}               <div className="p-6 md:p-8 bg-primary text-on-primary shrink-0 relative overflow-hidden">
                <div className="relative z-10 flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white/20 w-fit px-3 py-1 rounded-full">
                      <Sparkles size={14} />
                      {t('report.modal_title')}
                    </div>
                    <h2 className="text-2xl md:text-3xl font-display font-black">{t('report.title')}</h2>
                  </div>
                  <button 
                    onClick={handleReportClose}
                    className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
              </div>


              {/* Content */}
              <div className="flex-grow overflow-y-auto p-6 md:p-10 space-y-8 bg-surface-container-lowest">
                <div className="prose prose-sm md:prose-base max-w-none prose-p:text-on-surface-variant prose-p:leading-relaxed prose-headings:font-display prose-headings:font-black prose-headings:text-on-background prose-headings:mt-8 prose-headings:mb-4 first:prose-headings:mt-0">
                  {localReport ? (
                    <ReactMarkdown>{localReport}</ReactMarkdown>
                  ) : (
                    <div className="py-20 flex flex-col items-center justify-center gap-4 text-primary text-center">
                      <motion.div 
                        animate={{ rotate: 360 }} 
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }} 
                        className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full" 
                      />
                      <div className="space-y-1">
                        <p className="font-display font-black text-xl">{t('report.loading_analysis', 'AI Analyse wordt voorbereid...')}</p>
                        <p className="text-sm text-on-surface-variant font-medium">{t('report.loading_desc', 'Even geduld, we berekenen de perfecte match-score.')}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-12 pt-8 border-t-2 border-outline/50 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Seeker Profile */}
                    {seekerProfile && (
                      <div className="bg-primary/5 p-6 rounded-[2rem] border border-primary/10 flex flex-col gap-4">
                        <div className="flex items-center gap-5">
                          <div className="shrink-0">
                            {(seekerProfile.photo_url || seekerProfile.photoURL) ? (
                              <img src={seekerProfile.photo_url || seekerProfile.photoURL} alt="Profiel" className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-20 h-20 rounded-full bg-primary/20 border-4 border-white flex items-center justify-center text-3xl font-display font-black text-primary shadow-md">
                                {seekerProfile.firstName?.[0] || 'U'}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">
                              {seekerProfile.firstName ? `${t('report.seeker_profile', 'Profiel')} ${seekerProfile.firstName}` : (seekerId ? t('report.seeker_profile', 'Profiel Zoeker') : t('report.your_profile', 'Jouw Profiel'))}
                            </p>
                            <h4 className="font-display font-black text-xl text-on-background">{seekerProfile.firstName} {seekerProfile.lastName}</h4>
                            <p className="text-xs text-on-surface-variant font-semibold mt-0.5">
                              Zoekgebied: {[seekerProfile.city, seekerProfile.country].filter(Boolean).join(', ') || 'Geen voorkeurslocatie'}
                            </p>
                          </div>
                        </div>

                        {/* Profile Summary Elements */}
                        <div className="grid grid-cols-2 gap-3 mt-1 text-xs">
                          {seekerProfile.budget_max > 0 && (
                            <div className="p-3 bg-white/60 rounded-xl border border-primary/5">
                              <span className="block opacity-60 text-[10px] font-bold uppercase tracking-wider mb-0.5">Budget</span>
                              <span className="font-bold text-on-background">
                                {currencyConverter.formatEur(seekerProfile.budget_min || 0)} - {currencyConverter.formatEur(seekerProfile.budget_max)} p/m
                              </span>
                            </div>
                          )}
                          <div className="p-3 bg-white/60 rounded-xl border border-primary/5">
                            <span className="block opacity-60 text-[10px] font-bold uppercase tracking-wider mb-0.5">Huurperiode</span>
                            <span className="font-bold text-on-background">
                              {seekerProfile.is_indefinite ? 'Onbepaalde tijd' : seekerProfile.stay_duration_months ? `${seekerProfile.stay_duration_months} maanden` : 'Niet geselecteerd'}
                            </span>
                          </div>
                          <div className="p-3 bg-white/60 rounded-xl border border-primary/5">
                            <span className="block opacity-60 text-[10px] font-bold uppercase tracking-wider mb-0.5">Bewoning</span>
                            <span className="font-bold text-on-background">
                              {seekerProfile.single_occupancy ? 'Alleen' : `Huisgenoten`}
                            </span>
                          </div>
                          {seekerProfile.available_from && (
                            <div className="p-3 bg-white/60 rounded-xl border border-primary/5">
                              <span className="block opacity-60 text-[10px] font-bold uppercase tracking-wider mb-0.5">Beschikbaar</span>
                              <span className="font-bold text-on-background">
                                {formatDate(new Date(seekerProfile.available_from), dateFormat)}
                              </span>
                            </div>
                          )}
                        </div>

                        {seekerProfile.goal && seekerProfile.goal.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {seekerProfile.goal.map((g: string) => (
                              <span key={g} className="px-2.5 py-1 bg-primary/10 text-primary border border-primary/10 rounded-lg text-[11px] font-bold">
                                {t(`prop.goal.${g}`, g)}
                              </span>
                            ))}
                          </div>
                        )}

                        {seekerProfile.introduction && (
                          <div className="mt-2 p-4 bg-white/80 rounded-2xl border border-primary/10 shadow-sm">
                            <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1.5 flex items-center gap-1">
                              <User size={12} /> Voorstellen
                            </h4>
                            <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">{seekerProfile.introduction}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Provider Profile */}
                    {providerProfile && (
                      <div className="bg-surface-container p-6 rounded-[2rem] border border-outline/50 flex items-center gap-5">
                        <div className="shrink-0">
                          {providerProfile.photoUrl ? (
                            <img src={providerProfile.photoUrl} alt="Aanbieder" className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-20 h-20 rounded-full bg-primary/10 border-4 border-white flex items-center justify-center text-3xl font-display font-black text-primary shadow-md">
                              {providerProfile.firstName?.[0] || '?'}
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">{t('report.provider_profile')}</p>
                          <h4 className="font-display font-black text-xl text-on-background">{providerProfile.firstName}</h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5 mb-3">
                            <TrustBadge 
                              level={providerProfile.verificationLevel || 1}
                              onClick={() => setShowTrustPopup(true)} 
                              size="sm"
                            />
                          </div>
                          
                          {providerProfile.description && (
                            <div className="bg-white/50 p-4 rounded-2xl border border-outline/30 mt-3 shadow-inner">
                              <p className="text-[10px] font-black uppercase tracking-widest text-primary/70 mb-1">{t('provider.label_description', 'Wie ben je?')}</p>
                              <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">{providerProfile.description}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Safety Note for Report View */}
                  <div className="mt-8 p-4 bg-amber-500/5 rounded-2xl border border-amber-500/20 flex items-center gap-3 shadow-inner">
                    <div className="p-2 bg-amber-100 dark:bg-amber-950/40 rounded-lg text-amber-600 font-bold shrink-0">
                       <ShieldCheck size={16} />
                    </div>
                    <p className="text-[10px] md:text-xs text-amber-900 dark:text-amber-100 font-medium leading-relaxed">
                       <strong>Tip:</strong> Dit rapport is met de grootst mogelijke zorgvuldigheid samengesteld. Houd er echter rekening mee dat AI-analyses gebaseerd zijn op data-interpretaties en dat AI incidenteel fouten kan maken of details onnauwkeurig kan inschatten.
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-outline bg-white flex items-center justify-between gap-4 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                <div className="flex gap-2">
                  {/* Linkerkant is nu leeg, de actieve sluitknop is naar de rechterkant verplaatst */}
                </div>

                <div className="flex gap-2 w-full md:w-auto justify-end items-center">
                  {!seekerId && (
                    <button 
                      onClick={() => toggleFavorite()}
                      disabled={isSavingFav}
                      title={isFavorited ? t('report.saved') : t('report.save_property')}
                      className={`p-3 border rounded-xl transition-all flex items-center gap-2 ${isFavorited ? 'bg-error/10 border-error text-error' : 'border-outline text-on-surface-variant hover:bg-surface-container-low'}`}
                    >
                      <Heart size={18} className={isFavorited ? "fill-error" : ""} />
                      <span className="text-xs font-bold hidden sm:block">
                        {isFavorited ? t('report.saved') : t('report.save_property')}
                      </span>
                    </button>
                  )}
                  <button 
                    onClick={handleExportPDF} 
                    disabled={isExporting}
                    title="Exporteer als PDF" 
                    className="flex items-center gap-2 px-4 py-2 border border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:text-white rounded-xl font-bold text-xs transition-all shadow-sm disabled:opacity-50"
                  >
                    {isExporting ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                    ) : (
                      <FileText size={16} />
                    )}
                    <span className="hidden sm:inline">PDF Export</span>
                  </button>
                  <button onClick={handlePrint} title={t('report.print_title', 'Print Rapport')} className="p-3 border border-outline rounded-xl text-on-surface-variant hover:bg-surface-container-low transition-all">
                    <Printer size={18} />
                  </button>
                  {!seekerId && (
                    <button onClick={handleShare} title={t('report.share_btn_title')} className="p-3 border border-outline rounded-xl text-on-surface-variant hover:bg-surface-container-low transition-all">
                      <Share2 size={18} />
                    </button>
                  )}
                  <div className="w-px h-8 bg-outline/30 mx-2 hidden md:block" />
                  <button 
                    onClick={handleReportClose}
                    className="px-8 py-3 bg-slate-950 hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] text-white rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 border border-slate-900 cursor-pointer"
                  >
                    {t('common.close')}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <TrustPopup 
        isOpen={showTrustPopup} 
        onClose={() => setShowTrustPopup(false)} 
        providerLevel={providerProfile?.verificationLevel || 1} 
      />
    </motion.div>
  );
}
