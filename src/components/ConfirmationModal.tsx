import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  isDangerous?: boolean; // if true, confirmation button will be red
}

/**
 * Reusable confirmation modal to replace window.confirm
 * Supports async operations and danger indicators
 */
export default function ConfirmationModal({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isLoading = false,
  isDangerous = false,
}: ConfirmationModalProps) {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isProcessing) onCancel();
      }
      if (e.key === 'Enter') {
        if (!isProcessing) handleConfirm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onCancel]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmButtonLabel = confirmLabel || t('common.confirm', { defaultValue: 'Confirm' });
  const cancelButtonLabel = cancelLabel || t('common.cancel', { defaultValue: 'Cancel' });

  return (
    <AnimatePresence>
      {isOpen && (
        <React.Fragment>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isProcessing && onCancel()}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] cursor-pointer"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md bg-background rounded-3xl shadow-2xl z-[101] flex flex-col overflow-hidden"
          >
            {/* Title */}
            <div className="flex items-center justify-between p-6 border-b border-outline">
              <h2 className="text-xl font-display font-bold text-on-background flex-1 pr-4">
                {title}
              </h2>
            </div>

            {/* Description */}
            <div className="p-6 text-on-surface-variant leading-relaxed whitespace-pre-wrap">
              {description}
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-outline flex gap-3 justify-end bg-surface">
              <button
                onClick={onCancel}
                disabled={isProcessing}
                className="px-6 py-3 rounded-xl font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelButtonLabel}
              </button>
              <button
                onClick={handleConfirm}
                disabled={isProcessing || isLoading}
                className={`px-6 py-3 rounded-xl font-semibold text-on-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDangerous
                    ? 'bg-error hover:bg-error/95 shadow-lg shadow-error/20'
                    : 'bg-primary hover:bg-primary/95 shadow-lg shadow-primary/20'
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  confirmButtonLabel
                )}
              </button>
            </div>
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}
