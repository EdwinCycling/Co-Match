import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Clipboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

interface ModalPopupProps {
  isOpen: boolean;
  title?: string;
  message: React.ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  copyValue?: string;
  copyLabel?: string;
  copyButtonText?: string;
}

export default function ModalPopup({
  isOpen,
  title,
  message,
  onClose,
  onConfirm,
  confirmText,
  cancelText,
  copyValue,
  copyLabel,
  copyButtonText,
}: ModalPopupProps) {
  const { t } = useTranslation();
  const [isCopying, setIsCopying] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleCopy = async () => {
    if (!copyValue) return;
    setIsCopying(true);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(copyValue);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = copyValue;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      toast.success(t('common.copy_link_success', 'Link gekopieerd naar klembord!'));
    } catch (error) {
      console.error('Clipboard copy failed:', error);
      toast.error(t('common.copy_link_failed', 'Kopiëren mislukt. Kopieer de link handmatig.'));
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-lg bg-background rounded-[2rem] shadow-2xl overflow-hidden border border-outline"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-outline">
              <div>
                <h2 className="text-xl font-display font-black text-on-surface">
                  {title || t('common.modal_title', 'Melding')}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="h-10 w-10 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors flex items-center justify-center text-on-surface-variant"
                aria-label={t('common.close', 'Sluiten')}
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-5 text-on-surface-variant">
              <div className="text-base leading-relaxed break-words">{message}</div>
              {copyValue && (
                <div className="space-y-3">
                  <label className="block text-sm font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                    {copyLabel || t('common.copy_link', 'Kopieer link')}
                  </label>
                  <div className="flex gap-3 items-center">
                    <input
                      readOnly
                      value={copyValue}
                      className="flex-1 rounded-2xl border border-outline bg-surface px-4 py-3 text-sm text-on-surface outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopy}
                      disabled={isCopying}
                      className="px-4 py-3 rounded-2xl bg-primary text-on-primary font-bold text-sm transition hover:bg-primary/90 disabled:opacity-60"
                    >
                      {copyButtonText || t('common.copy', 'Kopiëren')}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-5 border-t border-outline bg-surface-container flex flex-col gap-3 sm:flex-row sm:justify-end sm:items-center">
              {onConfirm ? (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-surface-container-low text-on-surface font-black text-sm uppercase tracking-[0.2em] hover:bg-surface-container transition"
                  >
                    {cancelText || t('common.cancel', 'Annuleren')}
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-primary text-on-primary font-black text-sm uppercase tracking-[0.2em] hover:bg-primary/95 transition"
                  >
                    {confirmText || t('common.confirm', 'Bevestigen')}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full px-5 py-3 rounded-2xl bg-primary text-on-primary font-black text-sm uppercase tracking-[0.2em] hover:bg-primary/95 transition"
                >
                  {cancelText || t('common.close', 'Sluiten')}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
