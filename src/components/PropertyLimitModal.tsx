import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Home, Send, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';

interface PropertyLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PropertyLimitModal: React.FC<PropertyLimitModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSending(true);
    try {
      const user = auth.currentUser;
      await addDoc(collection(db, 'contact_requests'), {
        uid: user?.uid || 'anonymous',
        email: user?.email || 'no-email',
        title: 'Upgrade: Extra Properties Request',
        message: message,
        createdAt: serverTimestamp(),
        status: 'OPEN',
        type: 'limit_upgrade' // Distinguish from general contact requests
      });

      toast.success(t('dashboard.provider.max_properties_success'));
      setMessage('');
      onClose();
    } catch (error) {
      console.error('Error sending request:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop blur effect */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-background text-on-background w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-outline overflow-hidden"
          >
            <button
              onClick={onClose}
              className="cm-modal-close-button absolute top-6 right-6 p-2 z-10"
            >
              <X size={20} />
            </button>

            <div className="p-8 md:p-10">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 text-primary">
                <ShieldAlert size={32} />
              </div>

              <h2 className="text-2xl md:text-3xl font-display font-black text-on-background mb-3">
                {t('dashboard.provider.max_properties_modal_title')}
              </h2>
              
              <p className="text-on-surface-variant font-medium leading-relaxed mb-8">
                {t('dashboard.provider.max_properties_modal_desc')}
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <textarea
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t('dashboard.provider.max_properties_message_placeholder')}
                    rows={4}
                    className="w-full bg-surface-container-low border-2 border-outline/30 rounded-2xl px-5 py-4 text-on-surface placeholder:text-on-surface-variant focus:ring-2 focus:ring-primary outline-none transition-all font-medium resize-none"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-4 rounded-2xl font-bold border-2 border-outline hover:bg-surface-container transition-all"
                  >
                    {t('dashboard.provider.max_properties_cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={sending || !message.trim()}
                    className="flex-1 py-4 bg-primary text-on-primary rounded-2xl font-black shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                  >
                    {sending ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send size={18} />
                        {t('dashboard.provider.max_properties_send')}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PropertyLimitModal;
