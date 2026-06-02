import toast from 'react-hot-toast';
import i18n from '../i18n';
import { MESSAGE_KEYS } from '../constants/messages';

/**
 * Type definitions for message service
 */
export interface ToastOptions {
  defaultValue?: string;
  duration?: number;
  [key: string]: any;
}

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDangerous?: boolean;
}

/**
 * Message Service - Centralized toast and confirmation management
 * Provides type-safe, i18n-integrated notifications
 */
class MessageService {
  /**
   * Show success toast with translation key
   */
  success(messageKey: string, options?: ToastOptions) {
    const message = String(i18n.t(messageKey, options));
    toast.success(message, {
      duration: options?.duration || 3000,
    });
  }

  /**
   * Show error toast with translation key
   */
  error(messageKey: string, options?: ToastOptions) {
    const message = String(i18n.t(messageKey, options));
    toast.error(message, {
      duration: options?.duration || 4000,
    });
  }

  /**
   * Show info toast with translation key
   */
  info(messageKey: string, options?: ToastOptions) {
    const message = String(i18n.t(messageKey, options));
    toast(message, {
      duration: options?.duration || 3000,
      icon: 'ℹ️',
    });
  }

  /**
   * Show warning toast with translation key
   */
  warning(messageKey: string, options?: ToastOptions) {
    const message = String(i18n.t(messageKey, options));
    toast(message, {
      duration: options?.duration || 4000,
      icon: '⚠️',
    });
  }

  /**
   * Show loading toast (returns toast ID for updating/dismissing)
   */
  loading(messageKey: string, options?: ToastOptions) {
    const message = String(i18n.t(messageKey, options));
    return toast.loading(message);
  }

  /**
   * Dismiss a specific toast by ID
   */
  dismiss(toastId: string) {
    toast.dismiss(toastId);
  }

  /**
   * Dismiss all toasts
   */
  dismissAll() {
    toast.dismiss();
  }

  /**
   * Generic toast with custom options
   * Useful for when you need more control over the toast
   */
  custom(messageKey: string, options?: ToastOptions & { icon?: string }) {
    const message = String(i18n.t(messageKey, options));
    return toast(message, {
      duration: options?.duration || 3000,
      icon: options?.icon,
    });
  }

  /**
   * Show a confirmation dialog (must be used with hook for full functionality)
   * Returns a promise that resolves when user confirms, rejects when cancels
   */
  async confirm(options: ConfirmOptions): Promise<void> {
    // This is a placeholder - the actual confirm will be managed by the hook
    // The hook will handle the modal state and return a promise
    return new Promise((resolve, reject) => {
      // Store the callbacks for the hook to use
      (window as any).__messageServiceConfirmCallback = {
        options,
        resolve,
        reject,
        pending: true,
      };
      // Dispatch event to notify hook to open modal
      window.dispatchEvent(new CustomEvent('messageService:openConfirm', { detail: options }));
    });
  }
}

// Create singleton instance
export const messageService = new MessageService();

/**
 * React hook for message service
 * Must be used in a component to enable confirmation dialogs
 */
export interface UseMessageServiceReturn {
  messageService: MessageService;
  confirmModal: {
    isOpen: boolean;
    options: ConfirmOptions | null;
    onConfirm: () => void;
    onCancel: () => void;
  };
}

export function useMessageService(): UseMessageServiceReturn {
  const [confirmModal, setConfirmModal] = React.useState<{
    isOpen: boolean;
    options: ConfirmOptions | null;
  }>({
    isOpen: false,
    options: null,
  });

  React.useEffect(() => {
    const handleOpenConfirm = (event: any) => {
      const options = event.detail as ConfirmOptions;
      setConfirmModal({
        isOpen: true,
        options,
      });
    };

    window.addEventListener('messageService:openConfirm', handleOpenConfirm);
    return () => {
      window.removeEventListener('messageService:openConfirm', handleOpenConfirm);
    };
  }, []);

  const handleConfirm = () => {
    const callback = (window as any).__messageServiceConfirmCallback;
    if (callback && callback.pending) {
      callback.resolve();
      callback.pending = false;
    }
    setConfirmModal({ isOpen: false, options: null });
  };

  const handleCancel = () => {
    const callback = (window as any).__messageServiceConfirmCallback;
    if (callback && callback.pending) {
      callback.reject(new Error('User cancelled'));
      callback.pending = false;
    }
    setConfirmModal({ isOpen: false, options: null });
  };

  return {
    messageService,
    confirmModal: {
      isOpen: confirmModal.isOpen,
      options: confirmModal.options,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
  };
}

export default messageService;

// Add React import for the hook
import React from 'react';
