import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, MessageSquare, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { postToServerFunction, ServerFunctionError } from '../lib/serverApi';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  uid: string;
}

export const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose, userEmail, uid }) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) {
      toast.error('Vul alle verplichte velden in.');
      return;
    }

    if (title.length > 50) {
      toast.error('Titel mag maximaal 50 karakters zijn.');
      return;
    }

    setIsSubmitting(true);
    try {
      await postToServerFunction<{ ok: boolean }>('contact-requests', {
        requestType: 'general',
        title,
        message,
      });
      
      toast.success('Bericht succesvol verzonden!');
      setTitle('');
      setMessage('');
      onClose();
    } catch (error: any) {
      console.error('Error sending contact request:', error);

      if (error instanceof ServerFunctionError && error.status === 400) {
        toast.error(error.message);
        return;
      }

      if (error instanceof ServerFunctionError && error.status === 500) {
        toast.error('Er ging iets mis. Probeer het later opnieuw.');
        return;
      }

      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }

      toast.error('Er ging iets mis. Probeer het later opnieuw.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-xl"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-background text-on-background rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                    <MessageSquare size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-on-background leading-tight">Neem contact op</h2>
                    <p className="text-sm text-on-surface-variant font-medium">Stel je vraag aan het Co-Match team</p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="cm-modal-close-button p-2"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-black uppercase tracking-widest text-on-surface-variant ml-1">Titel (Verplicht)</label>
                  <input 
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={50}
                    placeholder="Mijn vraag over..."
                    className="w-full px-6 py-4 bg-surface-container-low border border-outline/40 rounded-2xl text-on-surface placeholder:text-on-surface-variant focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium"
                    required
                  />
                  <div className="flex justify-end">
                    <span className={`text-[10px] font-bold ${title.length === 50 ? 'text-red-500' : 'text-on-surface-variant'}`}>
                      {title.length}/50
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black uppercase tracking-widest text-on-surface-variant ml-1">Jouw vraag/opmerking (Verplicht)</label>
                  <textarea 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder="Type hier je bericht..."
                    className="w-full px-6 py-4 bg-surface-container-low border border-outline/40 rounded-2xl text-on-surface placeholder:text-on-surface-variant focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium resize-none"
                    required
                  />
                </div>

                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex gap-3">
                  <AlertCircle size={18} className="text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 leading-relaxed font-medium">
                    We proberen je vraag zo snel mogelijk te beantwoorden op <strong>{userEmail}</strong>.
                  </p>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-primary text-on-primary py-5 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin" size={24} />
                  ) : (
                    <>
                      Insturen
                      <Send size={20} />
                    </>
                  )}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
