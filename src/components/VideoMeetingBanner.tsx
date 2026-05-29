import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, Video, Check, X, Mic, ShieldCheck } from 'lucide-react';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

function HardwareTestModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(s => {
        activeStream = s;
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      })
      .catch(err => {
        toast.error(t('meeting.hardware_error', "Kan hardware niet laden. Controleer permissies."));
        console.error(err);
      });

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-zinc-900 border border-white/20 p-6 rounded-[2rem] shadow-2xl max-w-md w-full"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-bold text-lg flex items-center gap-2"><Video size={20}/> {t('meeting.hardware_test', 'Hardware Test')}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-2"><X size={20}/></button>
        </div>
        <div className="aspect-video bg-black rounded-xl overflow-hidden relative border border-white/10 mb-4">
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline 
            className="w-full h-full object-cover -scale-x-100" 
          />
          {!stream && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-zinc-500 font-bold uppercase tracking-widest text-xs">{t('common.loading', 'Laden...')}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 bg-zinc-800 p-4 rounded-xl border border-white/5">
           <Mic className="text-emerald-500" />
           <p className="text-xs text-zinc-300 font-medium">{t('meeting.hardware_tip', 'Tip: Praat om te testen of het groene icoon knippert (microfoon actief).')}</p>
        </div>
      </motion.div>
    </div>
  );
}

interface VideoMeetingBannerProps {
  chat: any;
  isSeeker: boolean;
}

export default function VideoMeetingBanner({ chat, isSeeker }: VideoMeetingBannerProps) {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language || 'nl';
  const localeStr = currentLanguage.startsWith('en') ? 'en-US' : 'nl-NL';
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickedDate, setPickedDate] = useState('');
  const [showTest, setShowTest] = useState(false);

  if (!chat || !chat.meta?.meeting) return null;

  const meeting = chat.meta.meeting;
  const isMyProposal = meeting.proposerId === auth.currentUser?.uid;
  
  // scheduledAt might be a Firestore Timestamp object or ISO string
  const meetingDate = meeting.scheduledAt?.seconds 
    ? new Date(meeting.scheduledAt.seconds * 1000) 
    : new Date(meeting.scheduledAt);
    
  const now = new Date();
  const diffMs = meetingDate.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / 1000 / 60);

  // Allow joining 5 minutes before
  const canJoin = meeting.status === 'accepted' && diffMinutes <= 5 && diffMinutes > -120; // up to 2 hours after

  const formatCountdown = () => {
    if (diffMs <= 0) return t('meeting.started', "Nu begonnen");
    const h = Math.floor(diffMs / (1000 * 60 * 60));
    const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (h > 24) {
      return t('meeting.in_days', 'Over {{days}} dagen', { days: Math.floor(h / 24) });
    }
    return t('meeting.starts_in', 'Start in {{h}}u {{m}}m', { h, m });
  };

  const handleAction = async (action: 'accept' | 'decline' | 'repropose') => {
    try {
      const chatRef = doc(db, 'chats', chat.id);
      
      if (action === 'accept') {
        await updateDoc(chatRef, {
          'meta.meeting.status': 'accepted',
          messages: arrayUnion({
            senderId: 'system',
            isSystem: true,
            text: t('meeting.accepted_msg', `Videogesprek geaccepteerd! Gepland voor {{date}}. Je kunt nu een Google Meet link aanmaken en delen in deze chat.`, { date: meetingDate.toLocaleString(localeStr, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }),
            createdAt: new Date(),
          }),
          updatedAt: serverTimestamp()
        });
        toast.success(t('meeting.accepted_success', "Videogesprek geaccepteerd!"));
      } 
      else if (action === 'decline') {
        await updateDoc(chatRef, {
          'meta.meeting': null,
          messages: arrayUnion({
            senderId: 'system',
            isSystem: true,
            text: t('meeting.declined_msg', `Videogesprek voorstel geweigerd.`),
            createdAt: new Date(),
          }),
          updatedAt: serverTimestamp()
        });
        toast.success(t('meeting.declined_success', "Videogesprek geweigerd."));
      }
      else if (action === 'repropose') {
        if (!pickedDate) return;
        const round = (meeting.round || 1) + 1;
        if (round > 3) {
          toast.error(t('meeting.max_proposals', "Maximaal aantal voorstellen bereikt."));
          return;
        }
        
        const newDate = new Date(pickedDate);

        await updateDoc(chatRef, {
          'meta.meeting.status': 'proposed',
          'meta.meeting.scheduledAt': newDate,
          'meta.meeting.proposerId': auth.currentUser?.uid,
          'meta.meeting.round': round,
          messages: arrayUnion({
            senderId: 'system',
            isSystem: true,
            text: t('meeting.new_time_msg', `Nieuwe tijd voor videogesprek voorgesteld: {{date}}.`, { date: newDate.toLocaleString(localeStr, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }),
            createdAt: new Date(),
          }),
          updatedAt: serverTimestamp()
        });
        setShowDatePicker(false);
        toast.success(t('meeting.new_time_success', "Nieuwe tijd voorgesteld."));
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Fout tijdens ophalen/opslaan");
    }
  };

  const generateICal = () => {
    // Basic iCal event generator
    const pad = (n: number) => n < 10 ? `0${n}` : n;
    const formatICalDate = (date: Date) => {
      return `${date.getUTCFullYear()}${pad(date.getUTCMonth()+1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`;
    };
    
    // Add 30 mins to meeting
    const end = new Date(meetingDate.getTime() + 30 * 60000); 

    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${formatICalDate(meetingDate)}
DTEND:${formatICalDate(end)}
SUMMARY:Co-Match Videogesprek
DESCRIPTION:Videogesprek in Co-Match. Kom terug naar de app om de call te starten.
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'comatch-meeting.ics';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (meeting.status === 'accepted') {
    return (
      <div className="mx-4 md:mx-6 my-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-sm animate-in fade-in relative z-10 shrink-0">
         <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center flex-wrap gap-4">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-200 shrink-0">
                     <Video size={20} />
                  </div>
                  <div>
                     <h4 className="font-display font-black text-emerald-900 text-sm">{t('meeting.scheduled', 'Videogesprek Gepland')}</h4>
                     <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-widest flex items-center gap-1.5">
                       <Clock size={12} /> {formatCountdown()} ({meetingDate.toLocaleTimeString(localeStr, {hour: '2-digit', minute:'2-digit'})})
                     </p>
                  </div>
               </div>
               
               <div className="flex gap-2">
                  <button 
                     onClick={generateICal}
                     className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-200 transition-colors flex items-center gap-1"
                  >
                    <Calendar size={12} /> {t('meeting.calendar', 'Agenda')}
                  </button>
                  <a 
                     href="https://meet.google.com/landing" 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-600/20 flex items-center gap-2"
                  >
                    <Video size={12} /> {t('meeting.start_meet', 'Start Google Meet')}
                  </a>
               </div>
            </div>

            <div className="bg-surface p-3 rounded-xl border border-emerald-100/50">
               <p className="text-[11px] text-emerald-800 leading-relaxed">
                 <span className="font-black block mb-1">{t('meeting.safe_free_title', 'Veilig & Kosteloos')}</span>
                 {t('meeting.safe_free_desc', 'Start een veilige meeting via de knop hierboven en deel de link in de chat. Dit is volledig gratis en we slaan geen gegevens op van het gesprek.')}
               </p>
            </div>
         </div>
      </div>
    );
  }

  // proposed status
  return (
    <div className="mx-4 md:mx-6 my-4 p-4 bg-primary/5 border border-primary/20 rounded-2xl shadow-sm relative z-10 shrink-0">
      <div className="flex items-start gap-4 flex-col sm:flex-row">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20 shrink-0">
          <Calendar size={20} />
        </div>
        <div className="flex-1 min-w-0">
           <h4 className="font-display font-black text-on-surface text-sm">{t('meeting.proposed_title', 'Videogesprek Voorgesteld')}</h4>
           <p className="text-[11px] text-on-surface-variant font-medium mb-1">
             {t('meeting.for', 'Voor:')} <span className="font-bold text-primary">{meetingDate.toLocaleString(localeStr, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
           </p>
           <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5">
             <ShieldCheck size={12} /> {t('meeting.now_safe', 'Nu volledig gratis & veilig')}
           </p>

           {isMyProposal ? (
             <div className="flex items-center gap-2 text-amber-600 text-[10px] font-bold uppercase tracking-widest bg-amber-50 px-3 py-1.5 rounded-lg w-auto inline-flex border border-amber-200">
               <Clock size={12} className="animate-pulse" /> {t('meeting.waiting_reply', 'Wachten op reactie...')}
             </div>
           ) : (
             <div className="flex flex-col gap-3">
                {showDatePicker ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="datetime-local" 
                      className="text-xs p-2 border border-outline rounded-lg bg-surface flex-1"
                      value={pickedDate}
                      onChange={e => setPickedDate(e.target.value)}
                    />
                    <button onClick={() => handleAction('repropose')} className="px-3 py-2 bg-primary text-on-primary rounded-lg text-[10px] font-black uppercase"><Check size={14}/></button>
                    <button onClick={() => setShowDatePicker(false)} className="px-3 py-2 bg-surface flex-1 text-on-surface-variant rounded-lg border border-outline text-[10px] font-black uppercase"><X size={14}/></button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => handleAction('accept')} 
                      className="px-4 py-2 bg-primary text-on-primary rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-primary-dark transition-colors shadow-sm"
                    >
                      {t('meeting.accept', 'Accepteren')}
                    </button>
                    <button 
                      onClick={() => setShowDatePicker(true)} 
                      className="px-4 py-2 bg-surface text-primary border border-primary/30 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-primary/5 transition-colors"
                    >
                      {t('meeting.new_time', 'Nieuwe tijd')}
                    </button>
                    <button 
                      onClick={() => handleAction('decline')} 
                      className="px-4 py-2 bg-surface text-on-surface-variant border border-outline rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-surface-container transition-colors"
                    >
                      {t('meeting.decline', 'Weigeren')}
                    </button>
                  </div>
                )}
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
