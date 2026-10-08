import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import {
  Step,
  CommunicationMethod,
  Message,
  StaffInfo,
  OrganisationInfo,
  AccessibilitySettings,
  SessionContextValue,
} from "../../../../shared/types/session";

const DEFAULT_ORGANISATION: OrganisationInfo = {
  name: "Kenyatta National Hospital",
  shortName: "KNH",
  welcomeMessage: "Communication support is available in sign language or text.",
  serviceName: "Customer Support",
  counterLabel: "Counter Tablet 04",
  primaryColor: "#5B2A86",
  backgroundColor: "#FFF8DC",
};

const DEFAULT_STAFF: StaffInfo = {
  name: "Grace Wanjiku",
  role: "Customer Support Specialist",
  serviceDesk: "Customer Support · Main Reception",
  counterNumber: "04",
  isAvailable: true,
};

const DEFAULT_ACCESSIBILITY: AccessibilitySettings = {
  largeText: false,
  highContrast: false,
  captions: true,
  visualAlerts: true,
  reduceMotion: false,
  language: "English / KSL",
};

const INITIAL_MESSAGES: Message[] = [
  {
    id: "msg-1",
    sender: "user",
    text: "Hello, I need help with my account.",
    timestamp: "9:43 AM",
    method: "sign",
    confidence: 0.94,
  },
  {
    id: "msg-2",
    sender: "staff",
    text: "Of course. How can I help you today?",
    timestamp: "9:43 AM",
    method: "speech",
  },
  {
    id: "msg-3",
    sender: "user",
    text: "I cannot access my online account.",
    timestamp: "9:44 AM",
    method: "sign",
    confidence: 0.91,
  },
];

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<Step>("splash");
  const [previousStep, setPreviousStep] = useState<Step | null>(null);
  const [method, setMethodState] = useState<CommunicationMethod>("sign");
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [currentDraft, setCurrentDraft] = useState<string>("Hello, I need help with my account.");
  const [detectedGloss, setDetectedGlossState] = useState<string>("Hello, I need help with my account.");
  const [confidence, setConfidence] = useState<number>(0.94);
  const [isHandsDetected, setIsHandsDetected] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [staff, setStaff] = useState<StaffInfo>(DEFAULT_STAFF);
  const [organisation, setOrganisation] = useState<OrganisationInfo>(DEFAULT_ORGANISATION);
  const [accessibility, setAccessibility] = useState<AccessibilitySettings>(DEFAULT_ACCESSIBILITY);

  const goToStep = useCallback((nextStep: Step) => {
    setPreviousStep(step);
    setStep(nextStep);
  }, [step]);

  const goBack = useCallback(() => {
    if (step === "settings" || step === "help") {
      setStep(previousStep ?? "welcome");
      return;
    }

    switch (step) {
      case "welcome":
        // At root welcome
        break;
      case "method":
        goToStep("welcome");
        break;
      case "tellers":
        goToStep("method");
        break;
      case "text":
        goToStep("method");
        break;
      case "connecting":
        goToStep(method === "sign" ? "tellers" : "method");
        break;
      case "permission":
        goToStep("method");
        break;
      case "ready":
        goToStep("method");
        break;
      case "live":
        goToStep("tellers");
        break;
      case "translating":
        goToStep("live");
        break;
      case "confirm":
      case "uncertain":
        goToStep("live");
        break;
      case "sent":
        goToStep("conversation");
        break;
      case "response":
        goToStep("conversation");
        break;
      case "conversation":
        goToStep("welcome");
        break;
      case "complete":
      case "offline":
        goToStep("welcome");
        break;
      default:
        goToStep("welcome");
    }
  }, [step, previousStep, goToStep]);

  const setMethod = useCallback((newMethod: CommunicationMethod) => {
    setMethodState(newMethod);
  }, []);

  const updateStaff = useCallback((newStaff: StaffInfo) => {
    setStaff(newStaff);
  }, []);

  const setDetectedGloss = useCallback((gloss: string, conf = 0.94) => {
    setDetectedGlossState(gloss);
    setCurrentDraft(gloss);
    setConfidence(conf);
  }, []);

  const setHandsDetected = useCallback((detected: boolean) => {
    setIsHandsDetected(detected);
  }, []);

  const sendMessage = useCallback((text: string, sendMethod: "sign" | "text" = "sign") => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text,
      timestamp: timeStr,
      method: sendMethod,
      confidence: sendMethod === "sign" ? confidence : undefined,
    };
    setMessages((prev) => [...prev, newMessage]);
    goToStep("sent");
  }, [confidence, goToStep]);

  const receiveStaffMessage = useCallback((text: string) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      sender: "staff",
      text,
      timestamp: timeStr,
      method: "speech",
    };
    setMessages((prev) => [...prev, newMessage]);
    goToStep("response");
  }, [goToStep]);

  const updateAccessibility = useCallback((updates: Partial<AccessibilitySettings>) => {
    setAccessibility((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateOrganisation = useCallback((updates: Partial<OrganisationInfo>) => {
    setOrganisation((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetSession = useCallback(() => {
    setMessages(INITIAL_MESSAGES);
    setCurrentDraft("");
    setDetectedGloss("");
    setConfidence(0.94);
    setIsHandsDetected(false);
    goToStep("welcome");
  }, [goToStep]);

  const value: SessionContextValue = {
    step,
    previousStep,
    method,
    messages,
    currentDraft,
    detectedGloss,
    confidence,
    isHandsDetected,
    isConnected,
    staff,
    organisation,
    accessibility,
    goToStep,
    goBack,
    setMethod,
    setStaff: updateStaff,
    setCurrentDraft,
    setDetectedGloss,
    setHandsDetected,
    sendMessage,
    receiveStaffMessage,
    updateAccessibility,
    updateOrganisation,
    resetSession,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
