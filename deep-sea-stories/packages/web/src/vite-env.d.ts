/// <reference types="vite/client" />

interface ViteTypeOptions {
	strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
	readonly VITE_BACKEND_URL: string;
	readonly VITE_BACKEND_WS_URL: string;
	readonly VITE_FISHJAM_ID: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
