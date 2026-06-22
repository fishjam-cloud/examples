/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FISHJAM_ID?: string;
  readonly VITE_SANDBOX_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
