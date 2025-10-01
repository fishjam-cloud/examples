/// <reference types="vite/client" />

// biome-ignore lint/correctness/noUnusedVariables: for type checking
interface ViteTypeOptions {
	strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
	readonly VITE_BACKEND_URL: string;
	readonly VITE_FISHJAM_ID: string;
}

// biome-ignore lint/correctness/noUnusedVariables: for type checking
interface ImportMeta {
	readonly env: ImportMetaEnv;
}
