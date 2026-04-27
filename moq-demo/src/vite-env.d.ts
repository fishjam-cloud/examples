/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FISHJAM_ID?: string;
  readonly VITE_MOQ_BASE_URL?: string;
  readonly VITE_FISHJAM_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Declare moq custom elements so SolidJS JSX accepts them without errors.
declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "moq-watch": JSX.HTMLAttributes<HTMLElement> & {
        url?: string;
        name?: string;
        muted?: boolean;
        paused?: boolean;
        reload?: boolean;
        jitter?: string | number;
      };
      "moq-publish": JSX.HTMLAttributes<HTMLElement> & {
        url?: string;
        name?: string;
        source?: string;
        muted?: boolean;
        invisible?: boolean;
      };
      "moq-watch-ui": JSX.HTMLAttributes<HTMLElement>;
      "moq-publish-ui": JSX.HTMLAttributes<HTMLElement>;
    }
  }
}
