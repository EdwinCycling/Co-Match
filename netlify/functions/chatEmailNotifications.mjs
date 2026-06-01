import { arrayUnion } from './_shared.mjs';

const CHAT_EMAIL_TRANSLATIONS = {
  nl: {
    seeker_subject: '📬 Nieuw chatbericht op Co-Match van {{providerName}}!',
    seeker_title_label: 'Direct Bericht Notificatie',
    seeker_greeting: 'Beste {{seekerName}},',
    seeker_desc:
      'Goed nieuws! Woningaanbieder <strong>{{providerName}}</strong> heeft zojuist een nieuw chatbericht gestuurd voor de woning "<strong>{{propertyTitle}}</strong>" in {{propertyCity}}.',
    seeker_cta: 'Bekijk Chat & Reageer Nu',
    seeker_footer:
      'Je ontvangt deze e-mail omdat je e-mailmeldingen voor nieuwe chatberichten hebt ingeschakeld op het Co-Match platform.',
    seeker_unsubscribe: 'Afmelden voor chat-e-mailmeldingen',
    seeker_reply_urgency:
      'We raden je aan om zo snel mogelijk te reageren om de kansen op een succesvolle match te maximaliseren en een uitstekend reactieprofiel op te bouwen.',
    provider_subject: '💬 Nieuwe reactie op je woning "{{propertyTitle}}" van {{seekerName}}!',
    provider_title_label: 'Direct Bericht Notificatie',
    provider_greeting: 'Beste {{providerName}},',
    provider_desc_first_chat_ever:
      'Gefeliciteerd! Je hebt de allereerst mogelijke reactie ontvangen op je woning "<strong>{{propertyTitle}}</strong>" in {{propertyCity}} van kandidaat <strong>{{seekerName}}</strong>.',
    provider_desc_each_seeker_first_chat:
      'Goed nieuws! Een nieuwe kandidaat <strong>{{seekerName}}</strong> heeft zojuist zijn eerste reactie gestuurd voor je woning "<strong>{{propertyTitle}}</strong>" in {{propertyCity}}.',
    provider_desc_always:
      'Goed nieuws! Kandidaat <strong>{{seekerName}}</strong> heeft zojuist een nieuw chatbericht gestuurd voor je woning "<strong>{{propertyTitle}}</strong>" in {{propertyCity}}.',
    provider_cta: 'Bekijk Chat & Beantwoord Nu',
    provider_unsubscribe: 'Afmelden voor chat-e-mailmeldingen',
    provider_footer:
      'Je ontvangt deze e-mail omdat je e-mailmeldingen voor nieuwe chatberichten hebt ingeschakeld op het Co-Match platform.',
    provider_reply_urgency:
      'We raden je aan om snel te reageren om de interesse en voortgang van je kandidaat optimaal warm te houden.',
  },
  en: {
    seeker_subject: '📬 New chat message on Co-Match from {{providerName}}!',
    seeker_title_label: 'Direct Message Notification',
    seeker_greeting: 'Dear {{seekerName}},',
    seeker_desc:
      'Good news! Landlord <strong>{{providerName}}</strong> just sent you a new chat message regarding property "<strong>{{propertyTitle}}</strong>" in {{propertyCity}}.',
    seeker_cta: 'View Chat & Reply Now',
    seeker_footer:
      'You are receiving this email because you have enabled email notifications for new chat messages on Co-Match.',
    seeker_unsubscribe: 'Unsubscribe from chat email notifications',
    seeker_reply_urgency:
      'We recommend you reply as soon as possible to maximize your chances of a successful match and build an excellent response profile.',
    provider_subject: '💬 New reaction on your property "{{propertyTitle}}" from {{seekerName}}!',
    provider_title_label: 'Direct Message Notification',
    provider_greeting: 'Dear {{providerName}},',
    provider_desc_first_chat_ever:
      'Congratulations! You received the very first reaction on your property "<strong>{{propertyTitle}}</strong>" in {{propertyCity}} from candidate <strong>{{seekerName}}</strong>.',
    provider_desc_each_seeker_first_chat:
      'Good news! A new candidate <strong>{{seekerName}}</strong> sent their first reaction for your property "<strong>{{propertyTitle}}</strong>" in {{propertyCity}}.',
    provider_desc_always:
      'Great news! Candidate <strong>{{seekerName}}</strong> has sent a new chat message regarding your property "<strong>{{propertyTitle}}</strong>" in {{propertyCity}}.',
    provider_cta: 'View Chat & Reply Now',
    provider_unsubscribe: 'Unsubscribe from chat email notifications',
    provider_footer:
      'You are receiving this email because you have enabled email notifications for new chat messages on Co-Match.',
    provider_reply_urgency:
      'We recommend replying quickly to keep your candidate\'s interest and progress warm.',
  },
};

function limitString(value, maxLength = 200) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
}

function getCleanFirstName(fullName, fallback) {
  const trimmed = limitString(fullName, 200);
  if (!trimmed) {
    return fallback;
  }

  if (trimmed.includes('@')) {
    const part = trimmed.split('@')[0];
    const cleanPart = part.replace(/[0-9]/g, '').replace(/[._-]/g, ' ').trim();
    const firstWord = cleanPart.split(/\s+/)[0];
    if (firstWord && firstWord.length > 1) {
      return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
    }

    return fallback;
  }

  const firstWord = trimmed.split(/\s+/)[0];
  return firstWord
    ? firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase()
    : fallback;
}

function resolvePublicFirstName(profileData, fallback) {
  if (profileData?.firstName) {
    return getCleanFirstName(profileData.firstName, fallback);
  }

  if (profileData?.nickname) {
    return getCleanFirstName(profileData.nickname, fallback);
  }

  if (profileData?.displayName) {
    return getCleanFirstName(profileData.displayName, fallback);
  }

  return fallback;
}

async function loadPublicProfile(db, userId) {
  const snap = await db.collection('public_profiles').doc(userId).get();
  return snap.exists ? snap.data() || {} : {};
}

async function loadChatAlertPreferences(db, userId) {
  const [userSnap, prefSnap] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('users').doc(userId).collection('settings').doc('preferences').get(),
  ]);

  const userData = userSnap.exists ? userSnap.data() || {} : {};
  const prefData = prefSnap.exists ? prefSnap.data() || {} : {};

  return {
    chatMailAlertEnabled:
      prefData.chatMailAlertEnabled !== undefined
        ? prefData.chatMailAlertEnabled !== false
        : userData.chatMailAlertEnabled !== false,
    providerChatMailAlertOption:
      prefData.providerChatMailAlertOption || userData.providerChatMailAlertOption || 'always',
    language: prefData.language || userData.language || 'nl',
  };
}

async function recordChatAlertSideEffects(db, userId, payload) {
  const {
    chatId,
    subject,
    html,
    chatText,
    recipientName,
    chatSenderName,
    isProviderAlert,
    cooldownField,
  } = payload;

  const chatRef = db.collection('chats').doc(chatId);
  const chatSnap = await chatRef.get();
  if (!chatSnap.exists) {
    throw new Error('Error: Chat not found.');
  }

  const chatData = chatSnap.data() || {};
  if (chatData.providerId !== userId && chatData.seekerId !== userId) {
    throw new Error('Error: Access denied.');
  }

  const recipientUserId = isProviderAlert ? chatData.providerId : chatData.seekerId;
  const recipientSnap = await db.collection('users').doc(recipientUserId).get();
  const recipientEmail = recipientSnap.exists ? limitString(recipientSnap.data()?.email, 254) : '';
  const nowIso = new Date().toISOString();
  const historyRef = db.collection('users').doc(userId).collection('settings').doc('alert_history');

  await historyRef.set(
    {
      alerts: arrayUnion({
        subject,
        html,
        matchesCount: 1,
        createdAt: nowIso,
        isChatAlert: true,
        ...(isProviderAlert ? { isProviderAlert: true } : {}),
        chatSenderName,
        chatText,
        recipientName,
        recipientEmail,
      }),
    },
    { merge: true }
  );

  await chatRef.update({
    [cooldownField]: nowIso,
  });
}

function buildSeekerEmailHtml({
  textTrans,
  subject,
  greetingLabel,
  descriptionText,
  sanitizedMsg,
  chatUrl,
  siteUrl,
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${subject}</title></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:30px auto;padding:25px;border-radius:24px;border:1px solid #e2e8f0;background-color:#FAF9F6;">
    <div style="text-align:center;padding-bottom:25px;border-bottom:1px solid #e2e8f0;">
      <h1 style="color:#6a826e;font-size:20px;font-weight:800;margin:0;text-transform:uppercase;">Co-Match Chat</h1>
      <p style="font-size:11px;color:#10b981;font-weight:800;text-transform:uppercase;margin-top:6px;">${textTrans.seeker_title_label}</p>
    </div>
    <div style="margin:25px 0;font-size:14px;line-height:1.6;color:#334155;">
      <p style="margin:0 0 12px 0;font-weight:700;font-size:16px;color:#1e293b;">${greetingLabel}</p>
      <p style="margin:0 0 16px 0;">${descriptionText}</p>
      <div style="background-color:#f1f5f9;border-left:4px solid #8DAA91;border-radius:12px;padding:16px;margin:20px 0;font-style:italic;">"${sanitizedMsg}"</div>
      <p style="margin:0;">${textTrans.seeker_reply_urgency}</p>
    </div>
    <div style="text-align:center;margin:30px 0 25px 0;">
      <a href="${chatUrl}" style="display:inline-block;background-color:#8DAA91;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:14px;font-weight:800;font-size:12px;text-transform:uppercase;">${textTrans.seeker_cta}</a>
    </div>
    <div style="text-align:center;border-top:1px solid #e2e8f0;padding-top:20px;font-size:11px;color:#64748b;">
      <p style="margin:0 0 10px 0;">${textTrans.seeker_footer}</p>
      <p style="margin:0;"><a href="${siteUrl}?unsubscribeChatAlerts=true">${textTrans.seeker_unsubscribe}</a></p>
    </div>
  </div>
</body>
</html>`;
}

function buildProviderEmailHtml({
  textTrans,
  subject,
  greetingLabel,
  descriptionText,
  sanitizedMsg,
  chatUrl,
  siteUrl,
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${subject}</title></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:30px auto;padding:25px;border-radius:24px;border:1px solid #e2e8f0;background-color:#FAF9F6;">
    <div style="text-align:center;padding-bottom:25px;border-bottom:1px solid #e2e8f0;">
      <h1 style="color:#1e3a8a;font-size:20px;font-weight:800;margin:0;text-transform:uppercase;">Co-Match Chat</h1>
      <p style="font-size:11px;color:#3b82f6;font-weight:800;text-transform:uppercase;margin-top:6px;">${textTrans.provider_title_label}</p>
    </div>
    <div style="margin:25px 0;font-size:14px;line-height:1.6;color:#334155;">
      <p style="margin:0 0 12px 0;font-weight:700;font-size:16px;color:#1e293b;">${greetingLabel}</p>
      <p style="margin:0 0 16px 0;">${descriptionText}</p>
      <div style="background-color:#f1f5f9;border-left:4px solid #3b82f6;border-radius:12px;padding:16px;margin:20px 0;font-style:italic;">"${sanitizedMsg}"</div>
      <p style="margin:0;">${textTrans.provider_reply_urgency}</p>
    </div>
    <div style="text-align:center;margin:30px 0 25px 0;">
      <a href="${chatUrl}" style="display:inline-block;background-color:#3b82f6;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:14px;font-weight:800;font-size:12px;text-transform:uppercase;">${textTrans.provider_cta}</a>
    </div>
    <div style="text-align:center;border-top:1px solid #e2e8f0;padding-top:20px;font-size:11px;color:#64748b;">
      <p style="margin:0 0 10px 0;">${textTrans.provider_footer}</p>
      <p style="margin:0;"><a href="${siteUrl}?unsubscribeChatAlerts=true">${textTrans.provider_unsubscribe}</a></p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendChatEmailNotification(db, senderUid, body) {
  const chatId = limitString(body.chatId, 120);
  const messageText = limitString(body.messageText, 500);
  const siteUrl = limitString(body.siteUrl, 500) || 'https://co-match.nl';

  if (!chatId || !messageText) {
    return { status: 'failed', reason: 'invalid_payload' };
  }

  const chatSnap = await db.collection('chats').doc(chatId).get();
  if (!chatSnap.exists) {
    return { status: 'failed', reason: 'chat_not_found' };
  }

  const chatData = chatSnap.data() || {};
  const seekerId = limitString(chatData.seekerId, 120);
  const providerId = limitString(chatData.providerId, 120);
  const propertyId = limitString(chatData.propertyId, 120);

  if (!seekerId || !providerId || !propertyId) {
    return { status: 'failed', reason: 'invalid_chat_references' };
  }

  if (senderUid !== seekerId && senderUid !== providerId) {
    throw new Error('Error: Access denied.');
  }

  const isProviderSender = senderUid === providerId;
  const recipientId = isProviderSender ? seekerId : providerId;
  const recipientPrefs = await loadChatAlertPreferences(db, recipientId);

  if (!recipientPrefs.chatMailAlertEnabled) {
    return { status: 'skipped', reason: 'recipient_disabled_notifications' };
  }

  const [propertySnap, seekerPublic, providerPublic] = await Promise.all([
    db.collection('properties').doc(propertyId).get(),
    loadPublicProfile(db, seekerId),
    loadPublicProfile(db, providerId),
  ]);

  const propertyTitle = propertySnap.exists ? limitString(propertySnap.data()?.title, 200) || 'Woning' : 'Woning';
  const propertyCity = propertySnap.exists
    ? limitString(propertySnap.data()?.city, 120) || 'de geselecteerde stad'
    : 'de geselecteerde stad';

  const seekerFirstName = resolvePublicFirstName(seekerPublic, 'Woningzoeker');
  const providerFirstName = resolvePublicFirstName(providerPublic, 'Aanbieder');
  const sanitizedMsg = messageText.length > 250 ? `${messageText.slice(0, 250)}...` : messageText;
  const langKey = String(recipientPrefs.language || 'nl').startsWith('en') ? 'en' : 'nl';
  const textTrans = CHAT_EMAIL_TRANSLATIONS[langKey];
  const chatUrl = `${siteUrl}?chatId=${encodeURIComponent(chatId)}`;

  if (isProviderSender) {
    const lastSent = chatData.lastChatMailSentAt;
    if (lastSent) {
      const elapsedMs = Date.now() - new Date(lastSent).getTime();
      if (elapsedMs < 15 * 60 * 1000) {
        return { status: 'skipped', reason: 'cooldown_active' };
      }
    }

    const subject = textTrans.seeker_subject.replace('{{providerName}}', providerFirstName);
    const greetingLabel = textTrans.seeker_greeting.replace('{{seekerName}}', seekerFirstName);
    const descriptionText = textTrans.seeker_desc
      .replace('{{providerName}}', providerFirstName)
      .replace('{{propertyTitle}}', propertyTitle)
      .replace('{{propertyCity}}', propertyCity);

    const html = buildSeekerEmailHtml({
      textTrans,
      subject,
      greetingLabel,
      descriptionText,
      sanitizedMsg,
      chatUrl,
      siteUrl,
    });

    await recordChatAlertSideEffects(db, senderUid, {
      chatId,
      subject,
      html,
      chatText: sanitizedMsg,
      recipientName: seekerFirstName,
      chatSenderName: providerFirstName,
      isProviderAlert: false,
      cooldownField: 'lastChatMailSentAt',
    });

    return { status: 'sent' };
  }

  const messages = Array.isArray(chatData.messages) ? chatData.messages : [];
  const messageCount = messages.length;
  const providerOption = recipientPrefs.providerChatMailAlertOption;

  if (providerOption === 'only_first_chat_ever') {
    const chatsSnap = await db.collection('chats').where('propertyId', '==', propertyId).get();
    if (chatsSnap.size > 1 || messageCount > 1) {
      return { status: 'skipped', reason: 'not_first_chat_ever' };
    }
  } else if (providerOption === 'each_seeker_first_chat') {
    if (messageCount > 1) {
      return { status: 'skipped', reason: 'not_seeker_first_chat' };
    }
  } else {
    const lastSent = chatData.lastProviderChatMailSentAt;
    if (lastSent) {
      const elapsedMs = Date.now() - new Date(lastSent).getTime();
      if (elapsedMs < 15 * 60 * 1000) {
        return { status: 'skipped', reason: 'cooldown_active' };
      }
    }
  }

  const subject = textTrans.provider_subject
    .replace('{{propertyTitle}}', propertyTitle)
    .replace('{{seekerName}}', seekerFirstName);
  const greetingLabel = textTrans.provider_greeting.replace('{{providerName}}', providerFirstName);

  let descriptionText = textTrans.provider_desc_always;
  if (providerOption === 'only_first_chat_ever') {
    descriptionText = textTrans.provider_desc_first_chat_ever;
  } else if (providerOption === 'each_seeker_first_chat') {
    descriptionText = textTrans.provider_desc_each_seeker_first_chat;
  }

  descriptionText = descriptionText
    .replace('{{propertyTitle}}', propertyTitle)
    .replace('{{propertyCity}}', propertyCity)
    .replace('{{seekerName}}', seekerFirstName);

  const html = buildProviderEmailHtml({
    textTrans,
    subject,
    greetingLabel,
    descriptionText,
    sanitizedMsg,
    chatUrl: `${siteUrl}?openChatId=${encodeURIComponent(propertyId)}`,
    siteUrl,
  });

  await recordChatAlertSideEffects(db, senderUid, {
    chatId,
    subject,
    html,
    chatText: sanitizedMsg,
    recipientName: providerFirstName,
    chatSenderName: seekerFirstName,
    isProviderAlert: true,
    cooldownField: 'lastProviderChatMailSentAt',
  });

  return { status: 'sent' };
}
