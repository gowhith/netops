const TOKEN_STORAGE_KEY = "netops-ai-access-token";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8020/api";
const DEMO_USERNAME = import.meta.env.VITE_BACKEND_USERNAME ?? "admin";
const DEMO_PASSWORD = import.meta.env.VITE_BACKEND_PASSWORD ?? "admin";

let accessToken: string | null = null;
let authPromise: Promise<string> | null = null;

function getStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

function storeToken(token: string) {
  accessToken = token;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
}

export function clearAccessToken() {
  accessToken = null;
  authPromise = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export async function ensureAccessToken() {
  if (accessToken) {
    return accessToken;
  }

  const storedToken = getStoredToken();
  if (storedToken) {
    accessToken = storedToken;
    return storedToken;
  }

  if (authPromise) {
    return authPromise;
  }

  authPromise = fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      username: DEMO_USERNAME,
      password: DEMO_PASSWORD,
    }),
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Authentication failed with ${response.status}`);
      }
      return response.json() as Promise<{ access_token: string }>;
    })
    .then((payload) => {
      storeToken(payload.access_token);
      authPromise = null;
      return payload.access_token;
    })
    .catch((error) => {
      clearAccessToken();
      throw error;
    });

  return authPromise;
}
