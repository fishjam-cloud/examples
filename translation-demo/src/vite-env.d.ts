/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Required: the MoQ relay URL (no built-in default).
  readonly VITE_MOQ_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
