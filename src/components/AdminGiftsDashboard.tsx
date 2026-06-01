import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { 
  Gift, Trash2, Edit3, Save, Sparkles, Calendar, Target, 
  Image as ImageIcon, Zap, Search, AlertCircle, Clock, Check, X
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-hot-toast';
import { deleteGift, saveGift } from '../services/adminWriteService';

interface GiftItem {
  id: string;
  title: string;
  message: string;
  targetAudience: 'all' | 'huis_zoeker' | 'huis_aanbieder';
  startDate: string;
  isHighPriority: boolean;
  type?: 'new' | 'improvement';
  imageUrl?: string;
  createdAt?: any;
  updatedAt?: any;
}

export default function AdminGiftsDashboard() {
  const { t } = useTranslation();
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals overlay states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGift, setEditingGift] = useState<GiftItem | null>(null);
  const [deleteConfirmGift, setDeleteConfirmGift] = useState<GiftItem | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'new' | 'improvement'>('new');
  const [targetAudience, setTargetAudience] = useState<'all' | 'huis_zoeker' | 'huis_aanbieder'>('all');
  const [startDate, setStartDate] = useState('');
  const [isHighPriority, setIsHighPriority] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Popular emojis for rich messages
  const POPULAR_EMOJIS = ["🎁", "🎉", "🚀", "🔥", "✨", "💡", "💖", "🌟", "🏠", "🔑", "💬", "🌿", "⚡", "🤝", "🌍", "🏆"];

  useEffect(() => {
    const giftsQuery = query(collection(db, 'gifts'), orderBy('startDate', 'desc'));
    
    const unsubscribe = onSnapshot(giftsQuery, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GiftItem));
      setGifts(items);
      setLoading(false);
    }, (error) => {
      console.error("Error loading gifts in admin dashboard:", error);
      toast.error(t('admin_gifts.error_loading', "Fout bij laden van Feature Gifts."));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const setNowTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setStartDate(`${year}-${month}-${day}T${hours}:${minutes}`);
  };

  const handleInsertEmoji = (emoji: string) => {
    setMessage(prev => prev + emoji);
  };

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setType('new');
    setTargetAudience('all');
    setStartDate('');
    setIsHighPriority(false);
    setImageUrl('');
    setEditingGift(null);
  };

  const handleSaveGift = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !message.trim() || !startDate) {
      toast.error(t('admin_gifts.error_required', "SVP alle verplichte velden invullen!"));
      return;
    }

    try {
      await saveGift({
        giftId: editingGift?.id,
        title,
        message,
        type,
        targetAudience,
        startDate,
        isHighPriority,
        imageUrl: imageUrl.trim() || "",
      });

      if (editingGift) {
        toast.success(t('admin_gifts.success_updated', "Cadeautje succesvol bijgewerkt!"));
      } else {
        toast.success(t('admin_gifts.success_created', "Cadeautje succesvol live gezet / ingepland!"));
      }

      resetForm();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Error saving gift:", err);
      toast.error(t('admin_gifts.error_saving', "Fout bij opslaan: ") + err.message);
    }
  };

  const handleEditClick = (gift: GiftItem) => {
    setEditingGift(gift);
    setTitle(gift.title);
    setMessage(gift.message);
    setType(gift.type || 'new');
    setTargetAudience(gift.targetAudience);
    setStartDate(gift.startDate);
    setIsHighPriority(gift.isHighPriority);
    setImageUrl(gift.imageUrl || '');
    setIsModalOpen(true);
  };

  const isGiftLive = (dateStr: string) => {
    return new Date(dateStr) <= new Date();
  };

  const filteredGifts = gifts.filter(gift => {
    const q = searchQuery.toLowerCase();
    return gift.title.toLowerCase().includes(q) || gift.message.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      {/* Intro visual banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 md:p-8 flex items-start gap-4 shadow-sm">
        <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shrink-0">
          <Gift size={24} />
        </div>
        <div>
          <h3 className="text-lg font-display font-black text-on-surface mb-2">{t('admin_gifts.title', 'Feature Gift Box (Beheer)')}</h3>
          <p className="text-sm font-medium text-on-surface-variant leading-relaxed">
            {t('admin_gifts.description', 'Verander traditionele software-updates in een interactieve "unboxing" ervaring. Maak hier premium gift cards met rijke tekst, afbeeldingen/GIFs en drop-tijden om direct op te vallen bij actieve gebruikers!')}
          </p>
        </div>
      </div>

      {/* Main Container - Only List with CTA trigger */}
      <div className="bg-white rounded-[2.5rem] border border-outline shadow-sm p-8 space-y-6 flex flex-col min-h-[500px]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-display font-black text-on-surface mb-1">{t('admin_gifts.active_gifts', 'Actieve Cadeautjes')}</h2>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest text-primary">
              {t('admin_gifts.active_gifts_desc', 'Overzicht van actieve en ingeplande updates voor jouw gebruikers')}
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="self-start md:self-auto bg-primary text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
          >
            <Sparkles size={14} />
            Cadeautje Ontwerpen
          </button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('admin_gifts.search_placeholder', 'Zoek op titel of boodschap...')}
            className="w-full bg-slate-50 border border-outline rounded-xl pl-11 pr-4 py-3 text-xs font-bold outline-none focus:bg-white focus:border-primary transition-all shadow-inner"
          />
        </div>

        {/* Grid display layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full flex justify-center items-center h-48">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredGifts.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center h-48 text-center text-on-surface-variant font-medium text-xs space-y-1.5 italic">
              <AlertCircle size={22} className="text-gray-300" />
              <p>{t('admin_gifts.no_gifts_found', 'Er zijn geen cadeautjes gevonden die aan de zoekterm voldoen.')}</p>
            </div>
          ) : (
            filteredGifts.map((gift) => {
              const live = isGiftLive(gift.startDate);
              
              return (
                <div 
                  key={gift.id} 
                  className="bg-slate-50 rounded-2xl p-5 border hover:border-primary/20 hover:shadow-md transition-all flex flex-col justify-between space-y-4 border-outline/65 group hover:-translate-y-0.5 duration-300"
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Live/Scheduled status badge */}
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${
                        live 
                          ? 'bg-emerald-500/10 text-emerald-600' 
                          : 'bg-slate-200 text-slate-600'
                      }`}>
                        <Clock size={10} />
                        {live ? 'LIVE' : 'INGEPLAND'}
                      </span>

                      {/* Audience */}
                      <span className="px-2 py-0.5 bg-slate-200 rounded-full text-[9px] font-black uppercase tracking-widest text-on-surface-variant font-mono">
                        {gift.targetAudience === 'all' ? t('admin_gifts.audience_all', 'Iedereen') : gift.targetAudience === 'huis_zoeker' ? t('admin_gifts.audience_seeker', 'Zoeker') : t('admin_gifts.audience_provider', 'Aanbieder')}
                      </span>

                      {/* Type update badge */}
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        (gift.type || 'new') === 'new'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {(gift.type || 'new') === 'new' ? t('admin_gifts.type_new', '🎁 NEW') : t('admin_gifts.type_improvement', '🚀 IMPROVEMENT')}
                      </span>

                      {gift.isHighPriority && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-0.5">
                          <Zap size={9} className="fill-red-500" />
                          AUTO-UNBOX
                        </span>
                      )}
                    </div>

                    {/* Content preview */}
                    <div className="space-y-1.5">
                      <h4 className="text-sm font-black text-on-surface leading-tight break-words">{gift.title}</h4>
                      <p className="text-xs text-on-surface-variant font-medium leading-relaxed break-words line-clamp-3 whitespace-pre-wrap">
                        {gift.message}
                      </p>
                    </div>

                    {/* Optional Image Indicator */}
                    {gift.imageUrl && (
                      <div className="text-[10px] font-black uppercase text-primary/60 tracking-widest flex items-center gap-1">
                        <ImageIcon size={11} />
                        Visual gekoppeld
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-200">
                    {/* Scheduling Details */}
                    <div className="text-[10px] font-bold text-on-surface-variant flex items-center gap-1">
                      <Calendar size={11} />
                      Drop: <span className="font-black text-on-surface">{gift.startDate.replace('T', ' ')} CET</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleEditClick(gift)}
                        className="px-3 py-1.5 bg-primary/10 hover:bg-primary hover:text-white transition-all rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center gap-1"
                        title={t('common.edit', 'Wijzigen')}
                      >
                        <Edit3 size={11} />
                        Wijzigen
                      </button>
                      <button
                        onClick={() => setDeleteConfirmGift(gift)}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-500 text-red-600 hover:text-white transition-all rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center gap-1"
                        title={t('common.delete', 'Verwijderen')}
                      >
                        <Trash2 size={11} />
                        Verwijder
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Renders creation/edition form inside Modal popup (with backdrop blur, freeze background) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-white rounded-[2.5rem] w-full max-w-2xl border border-outline shadow-2xl p-8 relative flex flex-col my-8 max-h-[85vh] overflow-y-auto no-scrollbar"
            >
              {/* Close Button X */}
              <button
                onClick={() => {
                  resetForm();
                  setIsModalOpen(false);
                }}
                className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-100 hover:bg-slate-200 transition-colors text-slate-500"
              >
                <X size={20} />
              </button>

              <div>
                <h2 className="text-xl font-display font-black text-on-surface mb-1">
                  {editingGift ? t('admin_gifts.edit_gift', 'Cadeautje Bewerken') : t('admin_gifts.new_gift', 'Nieuw Cadeautje Ontwerpen')}
                </h2>
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest text-primary">
                  {editingGift ? t('admin_gifts.edit_desc', 'Pas de eigenschappen aan van deze update') : t('admin_gifts.new_desc', 'Richt een interactief unboxing kadootje in')}
                </p>
              </div>

              <form onSubmit={handleSaveGift} className="space-y-6 pt-4">
                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 font-mono">
                      {t('admin_gifts.field_title', 'Titel van het Cadeautje *')}
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={t('admin_gifts.placeholder_title', 'Bijv: Live Video Meetings zijn hier! 🎥')}
                      className="w-full bg-white border border-outline rounded-xl p-3.5 text-xs font-bold shadow-sm outline-none focus:border-primary transition-all"
                      required
                      maxLength={200}
                    />
                  </div>

                  {/* Message content */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 font-mono">
                      {t('admin_gifts.field_message', 'Boodschap / Rich Inhoud *')}
                    </label>
                    
                    {/* Emoji Select tool */}
                    <div className="mb-2 p-2 bg-slate-50 border border-slate-100 rounded-xl flex flex-wrap gap-1.5 items-center">
                      <span className="text-[9px] font-black uppercase text-gray-400 mr-1.5 tracking-wider font-mono">{t('admin_gifts.quick_emojis', 'Quick Emojis:')}</span>
                      {POPULAR_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleInsertEmoji(emoji)}
                          className="w-7 h-7 flex items-center justify-center text-sm rounded-lg hover:bg-white hover:shadow-sm active:scale-95 transition-all outline-none"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t('admin_gifts.placeholder_message', 'Geef je gebruikers een leuke en beknopte toelichting over de nieuwe feature. Witregels en emoticons zorgen voor een top styling!')}
                      className="w-full min-h-[140px] bg-white border border-outline rounded-2xl p-4 text-xs font-bold shadow-sm outline-none focus:border-primary transition-all leading-normal"
                      required
                    />
                  </div>

                  {/* Type Switch (🎁 NEW or 🚀 IMPROVEMENT) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 font-mono">
                        {t('admin_gifts.field_type', 'Type Update')}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setType('new')}
                          className={`px-4 py-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                            type === 'new'
                              ? 'bg-primary text-white border-primary shadow-sm font-black'
                              : 'bg-white text-on-surface-variant border-outline hover:bg-slate-50'
                          }`}
                        >
                          🎁 NEW
                        </button>
                        <button
                          type="button"
                          onClick={() => setType('improvement')}
                          className={`px-4 py-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                            type === 'improvement'
                              ? 'bg-primary text-white border-primary shadow-sm font-black'
                              : 'bg-white text-on-surface-variant border-outline hover:bg-slate-50'
                          }`}
                        >
                          🚀 IMPROVEMENT
                        </button>
                      </div>
                    </div>

                    {/* Target Audience */}
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 font-mono">
                        {t('admin_gifts.field_audience', 'Doelgroep (Targeting)')}
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setTargetAudience('all')}
                          className={`px-3 py-3 rounded-xl border text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
                            targetAudience === 'all'
                              ? 'bg-primary text-white border-primary shadow-sm'
                              : 'bg-white text-on-surface-variant border-outline hover:bg-slate-50'
                          }`}
                        >
                          <Target size={12} />
                          Iedereen
                        </button>
                        <button
                          type="button"
                          onClick={() => setTargetAudience('huis_aanbieder')}
                          className={`px-3 py-3 rounded-xl border text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
                            targetAudience === 'huis_aanbieder'
                              ? 'bg-primary text-white border-primary shadow-sm'
                              : 'bg-white text-on-surface-variant border-outline hover:bg-slate-50'
                          }`}
                        >
                          Aanbieder
                        </button>
                        <button
                          type="button"
                          onClick={() => setTargetAudience('huis_zoeker')}
                          className={`px-3 py-3 rounded-xl border text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
                            targetAudience === 'huis_zoeker'
                              ? 'bg-primary text-white border-primary shadow-sm'
                              : 'bg-white text-on-surface-variant border-outline hover:bg-slate-50'
                          }`}
                        >
                          Zoeker
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Date, Time & Drop indicator */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 font-mono">
                      {t('admin_gifts.field_start_date', 'Start Datum & Tijd (CET / Drop-tijd) *')}
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="datetime-local"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full bg-white border border-outline rounded-xl p-3.5 text-xs font-bold shadow-sm outline-none focus:border-primary"
                          required
                        />
                      </div>
                      <button
                        type="button"
                        onClick={setNowTime}
                        className="px-4 py-3.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl border border-primary/20 transition-all flex items-center justify-center gap-1.5 shrink-0"
                        title={t('admin_gifts.use_now', 'Gebruik huidige datum en tijd')}
                      >
                        <Clock size={14} />
                        Nu
                      </button>
                    </div>
                  </div>

                  {/* Optional Visual Image/GIF */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 font-mono flex items-center gap-1.5">
                      <ImageIcon size={14} />
                      Hero Afbeelding or GIF URL (Optioneel)
                    </label>
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder={t('admin_gifts.placeholder_image', 'https://example.com/demo.gif of unsplash link...')}
                      className="w-full bg-white border border-outline rounded-xl p-3.5 text-xs font-bold shadow-sm outline-none focus:border-primary transition-all"
                    />
                    <p className="text-[10px] text-on-surface-variant font-medium mt-1.5 leading-relaxed">
                      {t('admin_gifts.tip_image', 'Tip: Voeg een interactieve schermafbeelding of GIF toe om de werking direct visueel te maken!')}
                    </p>
                  </div>

                  {/* High Priority toggle */}
                  <div className="bg-red-50/50 p-4 rounded-2xl border border-red-100 flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="isHighPriority"
                      checked={isHighPriority}
                      onChange={(e) => setIsHighPriority(e.target.checked)}
                      className="w-4.5 h-4.5 text-red-600 bg-white border-red-300 rounded focus:ring-red-500 mt-0.5 cursor-pointer"
                    />
                    <div className="flex-1">
                      <label 
                        htmlFor="isHighPriority" 
                        className="text-xs font-black uppercase tracking-widest text-red-800 select-none cursor-pointer flex items-center gap-1.5"
                      >
                        <Zap size={13} className="text-red-600 fill-red-500" />
                        {t('admin_gifts.high_priority_toggle', 'Hoge Prioriteit Toggle (Auto-Unbox)')}
                      </label>
                      <p className="text-[11px] text-red-700 font-medium leading-normal mt-1">
                        {t('admin_gifts.high_priority_desc1', 'Slaat de unboxing-animatie automatisch over en laat de Gift-Box')} <strong>{t('admin_gifts.high_priority_desc2', 'direct openspringen')}</strong> {t('admin_gifts.high_priority_desc3', 'bij de volgende login!')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    className="flex-1 bg-primary text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <Save size={16} />
                    {editingGift ? t('admin_gifts.save_changes', 'Wijzigingen Opslaan') : t('admin_gifts.publish_gift', 'Cadeautje Publiceren')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setIsModalOpen(false);
                    }}
                    className="px-6 py-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-on-surface text-xs font-black uppercase tracking-widest transition-all font-mono"
                  >
                    Annuleren
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Renders Custom Confirmation Popup to delete a Gift securely (avoiding window.confirm) */}
      <AnimatePresence>
        {deleteConfirmGift && (
          <div 
            className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md"
            onClick={() => setDeleteConfirmGift(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-md p-6 border border-outline shadow-2xl space-y-4"
            >
              <h3 className="font-display font-black text-lg text-on-surface">{t('admin_gifts.delete_confirm_title', 'Cadeautje definitief verwijderen?')}</h3>
              <p className="text-xs font-medium text-on-surface-variant leading-relaxed">
                {t('admin_gifts.delete_confirm_desc1', 'Weet je heel zeker dat je het kadootje')} <strong>"{deleteConfirmGift.title}"</strong> {t('admin_gifts.delete_confirm_desc2', 'definitief wilt verwijderen? Deze actie is onomkeerbaar.')}
              </p>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setDeleteConfirmGift(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase cursor-pointer"
                >
                  Annuleren
                </button>
                <button
                  onClick={async () => {
                    const id = deleteConfirmGift.id;
                    setDeleteConfirmGift(null);
                    try {
                      await deleteGift(id);
                      toast.success(t('admin_gifts.success_deleted', "Cadeautje succesvol en definitief verwijderd!"));
                      resetForm();
                      setIsModalOpen(false);
                    } catch (err: any) {
                      console.error("Error deleting gift:", err);
                      toast.error(t('admin_gifts.error_deleting', "Fout bij verwijderen: ") + err.message);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase cursor-pointer"
                >
                  Ja, Verwijder
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
