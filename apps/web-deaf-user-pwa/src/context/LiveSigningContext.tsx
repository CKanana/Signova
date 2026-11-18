// LiveSigningContext.tsx — PWA-only live recognition state.
//
// Holds the glosses committed by the live recognition stabilizer and the
// evolving translation text while the Deaf user is signing. Kept out of the
// shared SessionContext so the React Native mobile app (which consumes the
// shared SessionContextValue type) is unaffected.

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { CommittedSign } from "../model/liveRecognition";

interface LiveSigningValue {
  liveSigns: readonly CommittedSign[];
  liveTranslation: string;
  liveConfidence: number;
  isLiveRecognising: boolean;
  commitSign: (sign: string, confidence: number) => void;
  setLiveTranslation: (text: string) => void;
  resetLiveSigning: () => void;
  setLiveRecognising: (recognising: boolean) => void;
  pendingDraft: string | null;
  setPendingDraft: (text: string | null) => void;
}

const LiveSigningContext = createContext<LiveSigningValue | null>(null);

export function LiveSigningProvider({ children }: { children: ReactNode }) {
  const [liveSigns, setLiveSigns] = useState<CommittedSign[]>([]);
  const [liveTranslation, setLiveTranslationState] = useState<string>("");
  const [liveConfidence, setLiveConfidence] = useState<number>(0);
  const [isLiveRecognising, setLiveRecognising] = useState<boolean>(false);
  const [pendingDraft, setPendingDraftState] = useState<string | null>(null);

  const commitSign = useCallback((sign: string, confidence: number): void => {
    setLiveSigns((prev) => [...prev, { sign, confidence, ts: Date.now() }]);
    setLiveConfidence(confidence);
  }, []);

  const setLiveTranslation = useCallback((text: string): void => {
    setLiveTranslationState(text);
  }, []);

  const resetLiveSigning = useCallback((): void => {
    setLiveSigns([]);
    setLiveTranslationState("");
    setLiveConfidence(0);
  }, []);

  const setPendingDraft = useCallback((text: string | null): void => {
    setPendingDraftState(text);
  }, []);

  const value: LiveSigningValue = {
    liveSigns,
    liveTranslation,
    liveConfidence,
    isLiveRecognising,
    commitSign,
    setLiveTranslation,
    resetLiveSigning,
    setLiveRecognising,
    pendingDraft,
    setPendingDraft,
  };

  return (
    <LiveSigningContext.Provider value={value}>{children}</LiveSigningContext.Provider>
  );
}

export function useLiveSigning(): LiveSigningValue {
  const context = useContext(LiveSigningContext);
  if (!context) {
    throw new Error("useLiveSigning must be used within a LiveSigningProvider");
  }
  return context;
}
