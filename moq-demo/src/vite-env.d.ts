/// <reference types="vite/client" />

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
