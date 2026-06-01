import { auth } from './firebase';

const FUNCTION_BASE_PATH = '/.netlify/functions';

type ServerErrorPayload = {
  error?: string;
  message?: string;
  details?: string;
  code?: number;
};

type ServerFunctionRequestOptions = {
  forceRefreshToken?: boolean;
};

export class ServerFunctionError extends Error {
  status: number;
  payload?: ServerErrorPayload;

  constructor(message: string, status: number, payload?: ServerErrorPayload) {
    super(message);
    this.name = 'ServerFunctionError';
    this.status = status;
    this.payload = payload;
  }
}

async function getAuthHeaders(options: ServerFunctionRequestOptions = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken(options.forceRefreshToken === true);
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ServerErrorPayload;
    return payload.message || payload.error || payload.details || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export async function postToServerFunction<TResponse>(
  functionName: string,
  payload: Record<string, unknown>,
  options: ServerFunctionRequestOptions = {}
): Promise<TResponse> {
  const response = await fetch(`${FUNCTION_BASE_PATH}/${functionName}`, {
    method: 'POST',
    headers: await getAuthHeaders(options),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let payload: ServerErrorPayload | undefined;

    try {
      payload = (await response.clone().json()) as ServerErrorPayload;
    } catch {
      payload = undefined;
    }

    throw new ServerFunctionError(await parseError(response), response.status, payload);
  }

  return response.json() as Promise<TResponse>;
}
