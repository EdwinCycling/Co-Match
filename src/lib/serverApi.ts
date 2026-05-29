import { auth } from './firebase';

const FUNCTION_BASE_PATH = '/.netlify/functions';

type ServerErrorPayload = {
  error?: string;
  details?: string;
};

async function getAuthHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ServerErrorPayload;
    return payload.error || payload.details || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export async function postToServerFunction<TResponse>(
  functionName: string,
  payload: Record<string, unknown>
): Promise<TResponse> {
  const response = await fetch(`${FUNCTION_BASE_PATH}/${functionName}`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<TResponse>;
}
