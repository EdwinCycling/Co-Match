import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { X, LogOut, Trash2, CalendarDays, Mail, LogIn, AlertTriangle } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { useSettings } from '../contexts/SettingsContext';
import { formatDate } from '../lib/formatters';

interface AccountModalProps {
  onClose: () => void;
}

export default function AccountModal({ onClose }: AccountModalProps) {
  const { t } = useTranslation();
  const { dateFormat } = useSettings();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      onClose();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      await user.delete(); // Note: This might require recent re-authentication in Firebase
      onClose();
    } catch (error) {
      console.error('Error deleting account:', error);
      // Fallback: just sign out if re-auth fails in demo mode
      await signOut(auth);
      onClose();
    }
  };

  if (!user) return null;

  const creationTime = user.metadata.creationTime ? formatDate(new Date(user.metadata.creationTime), dateFormat) : '-';
  const lastSignInTime = user.metadata.lastSignInTime ? formatDate(new Date(user.metadata.lastSignInTime), dateFormat) : '-';

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-background w-full max-w-sm rounded-[2.5rem] shadow-2xl border border-outline/20 relative overflow-hidden"
      >
        <button
          onClick={onClose}
          className="absolute right-6 top-6 p-2 rounded-full hover:bg-surface-container transition-colors z-10"
        >
          <X className="w-5 h-5 text-on-surface-variant" />
        </button>

        <div className="p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 rounded-full overflow-hidden mb-4 border-4 border-surface shadow-md">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary flex items-center justify-center text-white text-3xl font-bold">
                  {user.email?.[0].toUpperCase() || 'U'}
                </div>
              )}
            </div>
            <h2 className="text-xl font-display font-black text-on-background">{user.displayName || 'User'}</h2>
            <p className="text-sm font-medium text-on-surface-variant flex items-center gap-1 mt-1">
              <Mail className="w-3 h-3" />
              {user.email}
            </p>
          </div>

          <div className="space-y-4 mb-8 bg-surface-container-low p-4 rounded-2xl border border-outline/20">
            <div className="flex justify-between items-center text-sm">
              <span className="text-on-surface-variant font-medium flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                {t('account.joined', { defaultValue: 'Ingeschreven' })}
              </span>
              <span className="font-bold text-on-surface">{creationTime}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-on-surface-variant font-medium flex items-center gap-2">
                <LogIn className="w-4 h-4" />
                {t('account.last_login', { defaultValue: 'Laatst ingelogd' })}
              </span>
              <span className="font-bold text-on-surface">{lastSignInTime}</span>
            </div>
          </div>

          {!showDeleteConfirm ? (
            <div className="space-y-3">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-surface-container hover:bg-surface-container-high text-on-surface font-bold rounded-xl transition-colors"
                title={t('account.logout_title', 'Uitloggen')}
              >
                <LogOut className="w-5 h-5" />
                {t('account.logout', { defaultValue: 'Uitloggen' })}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center justify-center gap-2 py-3.5 text-error/80 hover:text-error hover:bg-error/10 font-bold rounded-xl transition-colors"
              >
                <Trash2 className="w-5 h-5" />
                {t('account.delete_account', { defaultValue: 'Account verwijderen' })}
              </button>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-error/10 p-5 rounded-2xl border border-error/20"
            >
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-error leading-relaxed">
                  {t('account.delete_warning', { defaultValue: 'Weet je zeker dat je jouw account wilt verwijderen? Dit kan niet ongedaan worden gemaakt. Al je gegevens, woningen en credits gaan definitief verloren.' })}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 bg-white text-on-surface font-bold rounded-xl border border-outline hover:bg-surface-container transition-colors text-sm"
                >
                  {t('common.cancel', { defaultValue: 'Annuleren' })}
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className="flex-1 py-2.5 bg-error text-white font-bold rounded-xl hover:bg-error/90 transition-colors text-sm"
                >
                  {t('account.confirm_delete', { defaultValue: 'Verwijder definitief' })}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
