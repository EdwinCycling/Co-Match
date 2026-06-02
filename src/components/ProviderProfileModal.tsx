import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, User, Phone, Mail, FileText, Loader2, ShieldCheck, ChevronRight, Camera, Trash2, ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TrustBadge } from './TrustBadge';
import ModalPopup from './ModalPopup';
import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth } from '../lib/firebase';

const compressImage = (base64: string, maxWidth = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No context');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (err) => reject(err);
  });
};

import { useSettings } from '../contexts/SettingsContext';
import { formatDate, formatTime } from '../lib/formatters';
import { TypeAheadSelect } from './TypeAheadSelect';
import { COUNTRIES, LANGUAGES } from '../lib/data';

interface ProviderProfile {
  firstName: string;
  lastName: string;
  phone: string;
  email2: string;
  description: string;
  country?: string;
  preferredLanguage?: string;
  photoUrl?: string;
}

export function ProviderProfileModal({ 
  onClose, 
  onSave,
  existingProfile,
  createdAt,
  lastLogin,
  userVerificationLevel,
  onOpenVerification
}: { 
  onClose: () => void, 
  onSave: (data: ProviderProfile) => Promise<void>,
  existingProfile?: Partial<ProviderProfile>,
  createdAt?: string | Date | number,
  lastLogin?: string | Date | number,
  userVerificationLevel?: number,
  onOpenVerification?: () => void
}) {
  const { t } = useTranslation();
  const { dateFormat, timeFormat } = useSettings();
  const [formData, setFormData] = useState<ProviderProfile>({
    firstName: existingProfile?.firstName || '',
    lastName: existingProfile?.lastName || '',
    phone: existingProfile?.phone || '',
    email2: existingProfile?.email2 || '',
    description: existingProfile?.description || '',
    country: existingProfile?.country || '',
    preferredLanguage: existingProfile?.preferredLanguage || '',
    photoUrl: existingProfile?.photoUrl || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [systemDialog, setSystemDialog] = useState<{ title?: string; message: React.ReactNode } | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => { 
      document.body.style.overflow = 'unset'; 
      document.documentElement.style.overflow = 'unset';
    };
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64 = event.target?.result as string;
          const compressed = await compressImage(base64, 400, 0.8);
          const storage = getStorage();
          const storageRef = ref(storage, `seeker_photos/${auth.currentUser!.uid}`);
          await uploadString(storageRef, compressed, 'data_url');
          const downloadURL = await getDownloadURL(storageRef);
          setFormData(prev => ({ ...prev, photoUrl: downloadURL }));
        } catch (err) {
          console.error("Error cropping/uploading photo:", err);
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error starting photo upload:", error);
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    if (!auth.currentUser) return;
    setUploading(true);
    try {
      if (formData.photoUrl) {
         const storage = getStorage();
         const storageRef = ref(storage, `seeker_photos/${auth.currentUser.uid}`);
         await deleteObject(storageRef);
      }
    } catch (error) {
      console.error("Error removing photo:", error);
    }
    setFormData(prev => ({ ...prev, photoUrl: '' }));
    setUploading(false);
  };

  const validateText = (text: string) => {
    if (!text) return null;
    const normalized = text.toLowerCase().replace(/[\s\(\)\[\]\-]/g, '');
    const emailObfuscated = normalized.replace(/at|\[at\]|\(at\)/g, '@').replace(/dot|\[dot\]|\(dot\)/g, '.');
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phoneNumbers = normalized.match(/\d{8,}/g);
    if (emailRegex.test(text) || emailRegex.test(emailObfuscated)) return true;
    if (phoneNumbers) return true;
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateText(formData.description)) {
      setSystemDialog({
        title: t('common.modal_title', 'Notice'),
        message: t('provider.profile.invalid_text', 'Your profile text contains invalid text or forbidden characters.'),
      });
      return;
    }
    setSaving(true);
    await onSave(formData);
    setSaving(false);
    onClose();
  };

  return (
    <>
      <ModalPopup
        isOpen={!!systemDialog}
        title={systemDialog?.title}
        message={systemDialog?.message || ''}
        onClose={() => setSystemDialog(null)}
      />
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-background text-on-background w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-outline overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-outline flex justify-between items-center bg-surface-container-lowest">
          <div>
            <h2 className="text-2xl font-display font-black text-on-background">{t('provider.profile_title', 'Your profile')}</h2>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mt-1">{t('provider.profile_subtitle', 'Fill in your details to list properties')}</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant">
            <X size={24} />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-8 pt-6">
          <form id="provider-profile-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Progress Indicator would go here if multi-step, but this is one modal. */}
            {onOpenVerification && (
               <div className="space-y-4 mb-2 p-6 bg-surface-container rounded-3xl border-2 border-outline/10">
                 <div className="flex items-center justify-between">
                    <div>
                       <h3 className="font-black flex items-center gap-2"><ShieldCheck className="text-primary"/> {t('verification.trust_ladder_title', 'The Trust Ladder')}</h3>
                       <p className="text-sm text-on-surface-variant font-medium mt-1">{t('verification.trust_ladder_desc', 'Increase your trust level and get more visibility.')}</p>
                    </div>
                    <TrustBadge level={userVerificationLevel || 1} size="md" />
                 </div>
                 <button type="button" onClick={() => { onClose(); onOpenVerification?.(); }} className="w-full py-3 bg-surface text-on-surface rounded-xl border border-outline/20 font-bold flex items-center justify-between px-4 hover:border-primary/50 text-sm">
                    <span>{t('verification.view_status', 'View verification & status')}</span>
                    <ChevronRight size={16} className="text-on-surface-variant" />
                 </button>
               </div>
            )}

            <div className="flex flex-col sm:flex-row gap-6 items-center border-b border-outline pb-6">
              <div className="relative group">
                <div className="w-24 h-24 rounded-2xl bg-surface-container flex items-center justify-center overflow-hidden border-2 border-outline group-hover:border-primary transition-all shadow-inner">
                  {formData.photoUrl ? (
                    <img src={formData.photoUrl} className="w-full h-full object-cover" alt="Profile" />
                  ) : (
                    <ImageIcon size={32} className="text-on-surface-variant opacity-20" />
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <label className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary text-on-primary rounded-xl flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 active:scale-95 transition-all">
                  <Camera size={14} />
                  <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                </label>
                {formData.photoUrl && !uploading && (
                  <button type="button" onClick={removePhoto} className="absolute -top-2 -right-2 w-7 h-7 bg-error text-white rounded-lg flex items-center justify-center shadow-lg hover:scale-110 transition-all">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <div className="flex-1 text-center sm:text-left">
                 <h4 className="font-bold text-lg">{t('seeker.photo_title', 'Profile photo')}</h4>
                 <p className="text-xs text-on-surface-variant font-medium mt-1">{t('seeker.photo_desc', 'Show who you are. A good photo builds trust and leads to better matches.')}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">{t('provider.label_firstname', 'Voornaam(en) *')}</label>
                <input 
                  required 
                  maxLength={100}
                  value={formData.firstName} 
                  onChange={e => setFormData({...formData, firstName: e.target.value})} 
                  className="w-full bg-surface-container-low border-2 border-outline/50 rounded-2xl p-4 font-bold outline-none focus:border-primary transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">{t('provider.label_lastname', 'Achternaam (optioneel)')}</label>
                <input 
                  value={formData.lastName} 
                  onChange={e => setFormData({...formData, lastName: e.target.value})} 
                  className="w-full bg-surface-container-low border-2 border-outline/50 rounded-2xl p-4 font-bold outline-none focus:border-primary transition-all" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">{t('provider.label_phone', 'Telefoonnummer (optioneel)')}</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-surface-container-low border-2 border-outline/50 rounded-2xl pl-12 p-4 font-bold outline-none focus:border-primary transition-all" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">{t('provider.label_email2', '2e e-mailadres (optioneel)')}</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                <input type="email" value={formData.email2} onChange={e => setFormData({...formData, email2: e.target.value})} className="w-full bg-surface-container-low border-2 border-outline/50 rounded-2xl pl-12 p-4 font-bold outline-none focus:border-primary transition-all" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">{t('provider.label_country', 'Land')}</label>
                <TypeAheadSelect
                  value={formData.country || ''}
                  onChange={val => setFormData({...formData, country: val})}
                  options={COUNTRIES}
                  placeholder={t('provider.placeholder_country', 'Selecteer land')}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">{t('provider.label_language', 'Voorkeurstaal')}</label>
                <TypeAheadSelect
                  value={formData.preferredLanguage || ''}
                  onChange={val => setFormData({...formData, preferredLanguage: val})}
                  options={LANGUAGES}
                  placeholder={t('provider.placeholder_language', 'Selecteer taal')}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">{t('provider.label_description', 'Wie ben je?')}</label>
              <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-surface-container-low border-2 border-outline/50 rounded-2xl p-4 font-bold outline-none focus:border-primary transition-all h-24" />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4 text-[10px] text-on-surface-variant font-bold uppercase tracking-widest border-t border-outline/30 mt-4">
              <div className="flex-1">
                {t('provider.label_created_at', 'Startdatum')}: {createdAt ? `${formatDate(new Date(createdAt), dateFormat)} ${formatTime(new Date(createdAt), timeFormat)}` : '-'}
              </div>
              <div className="flex-1">
                {t('provider.label_last_login', 'Laatst ingelogd')}: {lastLogin ? `${formatDate(new Date(lastLogin), dateFormat)} ${formatTime(new Date(lastLogin), timeFormat)}` : '-'}
              </div>
            </div>
          </form>
        </div>

        <div className="p-8 border-t border-outline bg-surface-container-lowest flex flex-col sm:flex-row gap-4">
          <button 
            type="button"
            id="provider-profile-cancel"
            onClick={onClose}
            className="flex-1 py-4 bg-surface-container text-on-surface border-2 border-outline/35 rounded-2xl font-black hover:bg-surface-container-high hover:scale-[1.01] active:scale-95 transition-all text-center"
          >
            {t('common.cancel', 'Annuleren')}
          </button>
          <button 
            type="submit" 
            id="provider-profile-submit"
            form="provider-profile-form"
            disabled={saving}
            className="flex-1 py-4 bg-primary text-on-primary rounded-2xl font-black shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            {t('provider.btn_save', 'Opslaan')}
          </button>
        </div>
      </motion.div>
    </div>
    </>
  );
}
