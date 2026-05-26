/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_WS_BASE_URL?: string;
  readonly VITE_DISABLE_BACKEND_WS?: string;
  readonly VITE_BACKEND_USERNAME?: string;
  readonly VITE_BACKEND_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
