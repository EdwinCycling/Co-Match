import React, { createContext, useContext, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import i18n from '../i18n';

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

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmOptions | null;
  resolve?: (value?: any) => void;
  reject?: (reason?: any) => void;
}

interface MessageContextType {
  confirmModal: {
    isOpen: boolean;
    options: ConfirmOptions | null;
    onConfirm: () => Promise<void>;
    onCancel: () => void;
  };
  messageService: {
    success: (messageKey: string, options?: ToastOptions) => void;
    error: (messageKey: string, options?: ToastOptions) => void;
    info: (messageKey: string, options?: ToastOptions) => void;
    warning: (messageKey: string, options?: ToastOptions) => void;
    loading: (messageKey: string, options?: ToastOptions) => string;
    dismiss: (toastId: string) => void;
    dismissAll: () => void;
    confirm: (options: ConfirmOptions) => Promise<void>;
  };
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

export function MessageProvider({ children }: { children: React.ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    options: null,
  });

  const translateMessage = useCallback((messageKey: string, options?: ToastOptions) => {
    const defaultValue = options?.defaultValue || messageKey;
    return i18n.t(messageKey, { ...options, defaultValue });
  }, []);

  const messageService = {
    success: (messageKey: string, options?: ToastOptions) => toast.success(translateMessage(messageKey, options), options),
    error: (messageKey: string, options?: ToastOptions) => toast.error(translateMessage(messageKey, options), options),
    info: (messageKey: string, options?: ToastOptions) => toast(translateMessage(messageKey, options), options),
    warning: (messageKey: string, options?: ToastOptions) => toast(translateMessage(messageKey, options), { icon: '⚠️', ...options }),
    loading: (messageKey: string, options?: ToastOptions) => toast.loading(translateMessage(messageKey, options), options),
    dismiss: (toastId: string) => toast.dismiss(toastId),
    dismissAll: () => toast.dismiss(),
    confirm: (options: ConfirmOptions) => {
      return new Promise<void>((resolve, reject) => {
        setConfirmState({
          isOpen: true,
          options,
          resolve,
          reject,
        });
      });
    },
  };

  const handleConfirm = useCallback(async () => {
    if (confirmState.resolve) confirmState.resolve();
    setConfirmState({ isOpen: false, options: null });
  }, [confirmState]);

  const handleCancel = useCallback(() => {
    if (confirmState.reject) confirmState.reject(new Error('User cancelled'));
    setConfirmState({ isOpen: false, options: null });
  }, [confirmState]);

  const value: MessageContextType = {
    confirmModal: {
      isOpen: confirmState.isOpen,
      options: confirmState.options,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
    messageService,
  };

  return (
    <MessageContext.Provider value={value}>
      {children}
    </MessageContext.Provider>
  );
}

export function useMessages() {
  const context = useContext(MessageContext);
  if (!context) throw new Error('useMessages must be used within a MessageProvider');
  return context.messageService;
}

export function useConfirmModal() {
  const context = useContext(MessageContext);
  if (!context) throw new Error('useConfirmModal must be used within a MessageProvider');
  return context.confirmModal;
}

export function useMessageService() {
  const context = useContext(MessageContext);
  if (!context) throw new Error('useMessageService must be used within a MessageProvider');
  return context;
}

export default MessageContext;
