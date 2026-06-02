/**
 * Centralized message keys for i18n translations
 * Organized by feature/category for type-safe access
 */

export const MESSAGE_KEYS = {
  // Admin - Expert Links
  admin: {
    expertLinks: {
      deleteConfirm: 'admin.expertLinks.deleteConfirm',
      deleteSuccess: 'admin.expertLinks.deleteSuccess',
      deleteError: 'admin.expertLinks.deleteError',
      loadError: 'admin.expertLinks.loadError',
      allFieldsRequired: 'admin.expertLinks.allFieldsRequired',
      saveSuccess: 'admin.expertLinks.saveSuccess',
      updateStatusError: 'admin.expertLinks.updateStatusError',
    },
    giftsDashboard: {
      deleteConfirm: 'admin.giftsDashboard.deleteConfirm',
      deleteSuccess: 'admin.giftsDashboard.deleteSuccess',
      deleteError: 'admin.giftsDashboard.deleteError',
      savingNotice: 'admin.giftsDashboard.savingNotice',
    },
    newsletter: {
      sendingNotice: 'admin.newsletter.sendingNotice',
      sendSuccess: 'admin.newsletter.sendSuccess',
      sendError: 'admin.newsletter.sendError',
      testSuccess: 'admin.newsletter.testSuccess',
      testError: 'admin.newsletter.testError',
    },
    contactRequests: {
      rejectSuccess: 'admin.contactRequests.rejectSuccess',
      rejectError: 'admin.contactRequests.rejectError',
      updateError: 'admin.contactRequests.updateError',
    },
    dashboard: {
      deactivateUserConfirm: 'admin.dashboard.deactivateUserConfirm',
      deactivateUserSuccess: 'admin.dashboard.deactivateUserSuccess',
      deactivateUserError: 'admin.dashboard.deactivateUserError',
      activateUserSuccess: 'admin.dashboard.activateUserSuccess',
      activateUserError: 'admin.dashboard.activateUserError',
    },
  },

  // Chat & Messaging
  chat: {
    deleteConfirm: 'chat.deleteConfirm',
    blockUserConfirm: 'chat.blockUserConfirm',
    blockUserSuccess: 'chat.blockUserSuccess',
    blockUserError: 'chat.blockUserError',
    sendError: 'chat.sendError',
    loadError: 'chat.loadError',
  },

  // Contact Modal
  contact: {
    sendSuccess: 'contact.sendSuccess',
    sendError: 'contact.sendError',
    requiredFields: 'contact.requiredFields',
    invalidEmail: 'contact.invalidEmail',
  },

  // Gifts / Rewards
  gift: {
    claimSuccess: 'gift.claimSuccess',
    claimError: 'gift.claimError',
    enterCodePrompt: 'gift.enterCodePrompt',
    invalidCode: 'gift.invalidCode',
    codeAlreadyUsed: 'gift.codeAlreadyUsed',
  },

  // Account Actions
  account: {
    deleteWarning: 'account.delete_warning',
    deleteConfirm: 'account.confirm_delete',
    disableWarning: 'account.disable_warning',
    disableConfirm: 'account.confirm_disable',
    disableSuccess: 'account.disable_success',
    disableError: 'account.disable_error',
  },

  // Reports
  report: {
    generateSuccess: 'report.generateSuccess',
    generateError: 'report.generateError',
    downloadSuccess: 'report.downloadSuccess',
    downloadError: 'report.downloadError',
    shareSuccess: 'report.shareSuccess',
    shareError: 'report.shareError',
  },

  // Property Management
  property: {
    deleteConfirm: 'property.deleteConfirm',
    deleteSuccess: 'property.deleteSuccess',
    deleteError: 'property.deleteError',
    saveSuccess: 'property.saveSuccess',
    saveError: 'property.saveError',
    publishSuccess: 'property.publishSuccess',
    publishError: 'property.publishError',
    limitReachedError: 'property.limitReachedError',
  },

  // Profile
  profile: {
    saveSuccess: 'profile.saveSuccess',
    saveError: 'profile.saveError',
    uploadSuccess: 'profile.uploadSuccess',
    uploadError: 'profile.uploadError',
    deleteImageConfirm: 'profile.deleteImageConfirm',
  },

  // Generic / Common
  common: {
    loading: 'common.loading',
    success: 'common.success',
    error: 'common.error',
    warning: 'common.warning',
    confirm: 'common.confirm',
    cancel: 'common.cancel',
    close: 'common.close',
    retry: 'common.retry',
    tryAgain: 'common.tryAgain',
    pleaseTryAgain: 'common.pleaseTryAgain',
    requiredField: 'common.requiredField',
    unexpectedError: 'common.unexpectedError',
  },
} as const;

/**
 * Type-safe message key type derived from MESSAGE_KEYS
 * Ensures only valid keys can be used
 */
export type MessageKey = 
  | typeof MESSAGE_KEYS[keyof typeof MESSAGE_KEYS][keyof typeof MESSAGE_KEYS[keyof typeof MESSAGE_KEYS]]
  | typeof MESSAGE_KEYS.common[keyof typeof MESSAGE_KEYS.common];
