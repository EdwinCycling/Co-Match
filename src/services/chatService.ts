import { postToServerFunction } from '../lib/serverApi';

type ChatWriteResponse = {
  ok: boolean;
  chatId?: string;
  created?: boolean;
  favorites?: string[];
};

export async function markChatRead(chatId: string) {
  return postToServerFunction<ChatWriteResponse>('chat-writes', {
    action: 'mark-chat-read',
    chatId,
  });
}

export async function toggleFavorite(propertyId: string, shouldFavorite: boolean) {
  return postToServerFunction<ChatWriteResponse>('chat-writes', {
    action: 'toggle-favorite',
    propertyId,
    shouldFavorite,
  });
}

export async function sendSeekerMessage(propertyId: string, text: string, autoFavorite = true) {
  return postToServerFunction<ChatWriteResponse>('chat-writes', {
    action: 'send-seeker-message',
    propertyId,
    text,
    autoFavorite,
  });
}

export async function sendSeekerAudioMessage(propertyId: string, audioUrl: string, autoFavorite = true) {
  return postToServerFunction<ChatWriteResponse>('chat-writes', {
    action: 'send-seeker-audio',
    propertyId,
    text: '[Audio]',
    audioUrl,
    autoFavorite,
  });
}

export async function sendProviderMessage(chatId: string, text: string) {
  return postToServerFunction<ChatWriteResponse>('chat-writes', {
    action: 'send-provider-message',
    chatId,
    text,
  });
}

export async function blockChat(chatId: string) {
  return postToServerFunction<ChatWriteResponse>('chat-writes', {
    action: 'block-chat',
    chatId,
  });
}

export async function toggleLinkedInChatShare(chatId: string, shouldShare: boolean, linkedInUrl?: string | null) {
  return postToServerFunction<ChatWriteResponse>('chat-writes', {
    action: 'toggle-linkedin-share',
    chatId,
    shouldShare,
    linkedInUrl: linkedInUrl || '',
  });
}

export async function terminateChat(chatId: string, terminationText: string) {
  return postToServerFunction<ChatWriteResponse>('chat-writes', {
    action: 'terminate-chat',
    chatId,
    terminationText,
  });
}

export async function terminateSeekerChat(chatId: string) {
  return postToServerFunction<ChatWriteResponse>('chat-writes', {
    action: 'terminate-seeker-chat',
    chatId,
  });
}

export async function proposeMeeting(chatId: string, scheduledAt: string, systemText: string) {
  return postToServerFunction<ChatWriteResponse>('chat-writes', {
    action: 'propose-meeting',
    chatId,
    scheduledAt,
    systemText,
  });
}

export async function respondToMeeting(chatId: string, meetingAction: 'accept' | 'decline' | 'repropose', systemText: string, scheduledAt?: string) {
  return postToServerFunction<ChatWriteResponse>('chat-writes', {
    action: 'respond-to-meeting',
    chatId,
    meetingAction,
    systemText,
    scheduledAt: scheduledAt || '',
  });
}
