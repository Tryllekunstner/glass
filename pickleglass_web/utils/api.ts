import { auth as firebaseAuth } from './firebase';
import { 
  FirestoreUserService, 
  FirestoreSessionService, 
  FirestoreTranscriptService, 
  FirestoreAiMessageService, 
  FirestoreSummaryService, 
  FirestorePromptPresetService,
  FirestoreSession,
  FirestoreTranscript,
  FirestoreAiMessage,
  FirestoreSummary,
  FirestorePromptPreset
} from './firestore';
import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  display_name: string;
  email: string;
}

export interface Session {
  id: string;
  uid: string;
  title: string;
  session_type: string;
  started_at: number;
  ended_at?: number;
  sync_state: 'clean' | 'dirty';
  updated_at: number;
}

export interface Transcript {
  id: string;
  session_id: string;
  start_at: number;
  end_at?: number;
  speaker?: string;
  text: string;
  lang?: string;
  created_at: number;
  sync_state: 'clean' | 'dirty';
}

export interface AiMessage {
  id: string;
  session_id: string;
  sent_at: number;
  role: 'user' | 'assistant';
  content: string;
  tokens?: number;
  model?: string;
  created_at: number;
  sync_state: 'clean' | 'dirty';
}

export interface Summary {
  session_id: string;
  generated_at: number;
  model?: string;
  text: string;
  tldr: string;
  bullet_json: string;
  action_json: string;
  tokens_used?: number;
  updated_at: number;
  sync_state: 'clean' | 'dirty';
}

export interface PromptPreset {
  id: string;
  uid: string;
  title: string;
  prompt: string;
  is_default: 0 | 1;
  created_at: number;
  sync_state: 'clean' | 'dirty';
}

export interface SessionDetails {
    session: Session;
    transcripts: Transcript[];
    ai_messages: AiMessage[];
    summary: Summary | null;
}


// Always use Firebase mode - local mode has been completely removed
const isFirebaseMode = (): boolean => {
  return true;
};

const timestampToUnix = (timestamp: Timestamp): number => {
  return timestamp.seconds * 1000 + Math.floor(timestamp.nanoseconds / 1000000);
};

const unixToTimestamp = (unix: number): Timestamp => {
  return Timestamp.fromMillis(unix);
};

const convertFirestoreSession = (session: { id: string } & FirestoreSession, uid: string): Session => {
  return {
    id: session.id,
    uid,
    title: session.title,
    session_type: session.session_type,
    started_at: timestampToUnix(session.startedAt),
    ended_at: session.endedAt ? timestampToUnix(session.endedAt) : undefined,
    sync_state: 'clean',
    updated_at: timestampToUnix(session.startedAt)
  };
};

const convertFirestoreTranscript = (transcript: { id: string } & FirestoreTranscript): Transcript => {
  return {
    id: transcript.id,
    session_id: '',
    start_at: timestampToUnix(transcript.startAt),
    end_at: transcript.endAt ? timestampToUnix(transcript.endAt) : undefined,
    speaker: transcript.speaker,
    text: transcript.text,
    lang: transcript.lang,
    created_at: timestampToUnix(transcript.createdAt),
    sync_state: 'clean'
  };
};

const convertFirestoreAiMessage = (message: { id: string } & FirestoreAiMessage): AiMessage => {
  return {
    id: message.id,
    session_id: '',
    sent_at: timestampToUnix(message.sentAt),
    role: message.role,
    content: message.content,
    tokens: message.tokens,
    model: message.model,
    created_at: timestampToUnix(message.createdAt),
    sync_state: 'clean'
  };
};

const convertFirestoreSummary = (summary: FirestoreSummary, sessionId: string): Summary => {
  return {
    session_id: sessionId,
    generated_at: timestampToUnix(summary.generatedAt),
    model: summary.model,
    text: summary.text,
    tldr: summary.tldr,
    bullet_json: JSON.stringify(summary.bulletPoints),
    action_json: JSON.stringify(summary.actionItems),
    tokens_used: summary.tokensUsed,
    updated_at: timestampToUnix(summary.generatedAt),
    sync_state: 'clean'
  };
};

const convertFirestorePreset = (preset: { id: string } & FirestorePromptPreset, uid: string): PromptPreset => {
  return {
    id: preset.id,
    uid,
    title: preset.title,
    prompt: preset.prompt,
    is_default: preset.isDefault ? 1 : 0,
    created_at: timestampToUnix(preset.createdAt),
    sync_state: 'clean'
  };
};


let API_ORIGIN = process.env.NODE_ENV === 'development'
  ? 'http://localhost:9001'
  : '';

const loadRuntimeConfig = async (): Promise<string | null> => {
  try {
    const response = await fetch('/runtime-config.json');
    if (response.ok) {
      const config = await response.json();
      console.log('✅ Runtime config loaded:', config);
      return config.API_URL;
    }
  } catch (error) {
    console.log('⚠️ Failed to load runtime config:', error);
  }
  return null;
};

let apiUrlInitialized = false;
let initializationPromise: Promise<void> | null = null;

const initializeApiUrl = async () => {
  if (apiUrlInitialized) return;
  
  // Electron IPC 관련 코드를 모두 제거하고 runtime-config.json 또는 fallback에만 의존합니다.
  const runtimeUrl = await loadRuntimeConfig();
  if (runtimeUrl) {
    API_ORIGIN = runtimeUrl;
    apiUrlInitialized = true;
    return;
  }

  console.log('📍 Using fallback API URL:', API_ORIGIN);
  apiUrlInitialized = true;
};

if (typeof window !== 'undefined') {
  initializationPromise = initializeApiUrl();
}

const userInfoListeners: Array<(userInfo: UserProfile | null) => void> = [];

export const getUserInfo = (): UserProfile | null => {
  if (typeof window === 'undefined') return null;
  
  const storedUserInfo = localStorage.getItem('pickleglass_user');
  if (storedUserInfo) {
    try {
      return JSON.parse(storedUserInfo);
    } catch (error) {
      console.error('Failed to parse user info:', error);
      localStorage.removeItem('pickleglass_user');
    }
  }
  return null;
};

export const setUserInfo = (userInfo: UserProfile | null, skipEvents: boolean = false) => {
  if (typeof window === 'undefined') return;
  
  if (userInfo) {
    localStorage.setItem('pickleglass_user', JSON.stringify(userInfo));
  } else {
    localStorage.removeItem('pickleglass_user');
  }
  
  if (!skipEvents) {
    userInfoListeners.forEach(listener => listener(userInfo));
    
    window.dispatchEvent(new Event('userInfoChanged'));
  }
};

export const onUserInfoChange = (listener: (userInfo: UserProfile | null) => void) => {
  userInfoListeners.push(listener);
  
  return () => {
    const index = userInfoListeners.indexOf(listener);
    if (index > -1) {
      userInfoListeners.splice(index, 1);
    }
  };
};

export const getApiHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  const userInfo = getUserInfo();
  if (userInfo?.uid) {
    headers['X-User-ID'] = userInfo.uid;
  }
  
  return headers;
};


export const apiCall = async (path: string, options: RequestInit = {}) => {
  if (!apiUrlInitialized && initializationPromise) {
    await initializationPromise;
  }
  
  if (!apiUrlInitialized) {
    await initializeApiUrl();
  }
  
  const url = `${API_ORIGIN}${path}`;
  console.log('🌐 apiCall (Local Mode):', {
    path,
    API_ORIGIN,
    fullUrl: url,
    initialized: apiUrlInitialized,
    timestamp: new Date().toISOString()
  });
  
  const defaultOpts: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...getApiHeaders(),
      ...(options.headers || {}),
    },
    ...options,
  };
  return fetch(url, defaultOpts);
};


export const searchConversations = async (query: string): Promise<Session[]> => {
  if (!query.trim()) {
    return [];
  }

  const sessions = await getSessions();
  return sessions.filter(session => 
    session.title.toLowerCase().includes(query.toLowerCase())
  );
};

export const getSessions = async (): Promise<Session[]> => {
  const uid = firebaseAuth.currentUser!.uid;
  const firestoreSessions = await FirestoreSessionService.getSessions(uid);
  return firestoreSessions.map(session => convertFirestoreSession(session, uid));
};

export const getSessionDetails = async (sessionId: string): Promise<SessionDetails> => {
  const uid = firebaseAuth.currentUser!.uid;
  
  const [session, transcripts, aiMessages, summary] = await Promise.all([
    FirestoreSessionService.getSession(uid, sessionId),
    FirestoreTranscriptService.getTranscripts(uid, sessionId),
    FirestoreAiMessageService.getAiMessages(uid, sessionId),
    FirestoreSummaryService.getSummary(uid, sessionId)
  ]);

  if (!session) {
    throw new Error('Session not found');
  }

  return {
    session: convertFirestoreSession({ id: sessionId, ...session }, uid),
    transcripts: transcripts.map(t => ({ ...convertFirestoreTranscript(t), session_id: sessionId })),
    ai_messages: aiMessages.map(m => ({ ...convertFirestoreAiMessage(m), session_id: sessionId })),
    summary: summary ? convertFirestoreSummary(summary, sessionId) : null
  };
};

export const createSession = async (title?: string): Promise<{ id: string }> => {
  const uid = firebaseAuth.currentUser!.uid;
  const sessionId = await FirestoreSessionService.createSession(uid, {
    title: title || 'New Session',
    session_type: 'ask',
    endedAt: undefined
  });
  return { id: sessionId };
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  const uid = firebaseAuth.currentUser!.uid;
  await FirestoreSessionService.deleteSession(uid, sessionId);
};

export const getUserProfile = async (): Promise<UserProfile> => {
  const user = firebaseAuth.currentUser!;
  const firestoreProfile = await FirestoreUserService.getUser(user.uid);
  
  return {
    uid: user.uid,
    display_name: firestoreProfile?.displayName || user.displayName || 'User',
    email: firestoreProfile?.email || user.email || 'no-email@example.com'
  };
};

export const updateUserProfile = async (data: { displayName: string }): Promise<void> => {
  const uid = firebaseAuth.currentUser!.uid;
  await FirestoreUserService.updateUser(uid, { displayName: data.displayName });
};

export const findOrCreateUser = async (user: UserProfile): Promise<UserProfile> => {
  const uid = firebaseAuth.currentUser!.uid;
  const existingUser = await FirestoreUserService.getUser(uid);
  
  if (!existingUser) {
    await FirestoreUserService.createUser(uid, {
      displayName: user.display_name,
      email: user.email
    });
  }
  
  return user;
};

export const saveApiKey = async (apiKey: string): Promise<void> => {
  console.log('API key management moved to cloud-based profile system');
  return;
};

export const checkApiKeyStatus = async (): Promise<{ hasApiKey: boolean }> => {
  return { hasApiKey: true };
};

export const deleteAccount = async (): Promise<void> => {
  const uid = firebaseAuth.currentUser!.uid;
  
  await FirestoreUserService.deleteUser(uid);
  
  await firebaseAuth.currentUser!.delete();
};

export const getPresets = async (): Promise<PromptPreset[]> => {
  const uid = firebaseAuth.currentUser!.uid;
  const firestorePresets = await FirestorePromptPresetService.getPresets(uid);
  return firestorePresets.map(preset => convertFirestorePreset(preset, uid));
};

export const createPreset = async (data: { title: string, prompt: string }): Promise<{ id: string }> => {
  const uid = firebaseAuth.currentUser!.uid;
  const presetId = await FirestorePromptPresetService.createPreset(uid, {
    title: data.title,
    prompt: data.prompt,
    isDefault: false
  });
  return { id: presetId };
};

export const updatePreset = async (id: string, data: { title: string, prompt: string }): Promise<void> => {
  const uid = firebaseAuth.currentUser!.uid;
  await FirestorePromptPresetService.updatePreset(uid, id, {
    title: data.title,
    prompt: data.prompt
  });
};

export const deletePreset = async (id: string): Promise<void> => {
  const uid = firebaseAuth.currentUser!.uid;
  await FirestorePromptPresetService.deletePreset(uid, id);
};

export interface BatchData {
    profile?: UserProfile;
    presets?: PromptPreset[];
    sessions?: Session[];
}

export const getBatchData = async (includes: ('profile' | 'presets' | 'sessions')[]): Promise<BatchData> => {
  const result: BatchData = {};
  
  const promises: Promise<any>[] = [];
  
  if (includes.includes('profile')) {
    promises.push(getUserProfile().then(profile => ({ type: 'profile', data: profile })));
  }
  if (includes.includes('presets')) {
    promises.push(getPresets().then(presets => ({ type: 'presets', data: presets })));
  }
  if (includes.includes('sessions')) {
    promises.push(getSessions().then(sessions => ({ type: 'sessions', data: sessions })));
  }
  
  const results = await Promise.all(promises);
  
  results.forEach(({ type, data }) => {
    result[type as keyof BatchData] = data;
  });
  
  return result;
};

export const logout = async () => {
  const { signOut } = await import('firebase/auth');
  await signOut(firebaseAuth);
  
  setUserInfo(null);
  
  localStorage.removeItem('openai_api_key');
  localStorage.removeItem('user_info');
  
  window.location.href = '/login';
};
