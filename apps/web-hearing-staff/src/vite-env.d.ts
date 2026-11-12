/// <reference types="vite/client" />

// Augment the DOM Window interface so `window.google` (the Google
// Identity Services SDK) is typed without needing `any` casts.
interface Window {
  google?: {
    accounts?: {
      id?: {
        initialize(config: Record<string, unknown>): void;
        isInitialized(): boolean;
        prompt(): void;
      };
    };
  };
}
