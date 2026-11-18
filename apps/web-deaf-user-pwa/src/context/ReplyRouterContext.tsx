// ReplyRouterContext.tsx — tiny routing state for the teller-message pop-up.
//
// The pop-up is mounted at session level and therefore cannot import
// LiveSigningScreen or TextMessageScreen directly. Both screens set the
// "active route" here so the pop-up can decide, for example, that
// "Reply in sign language" should stay on the camera screen or switch from
// the text screen to it. This is *routing only*; it touches no
// recognition, socket or session logic.
//
// LiveSigningScreen sets route "camera". TextMessageScreen sets "text".
// The pop-up owns a separate "reply-in-sign text" string so both screens can
// render the same dismissible reply-context chip at the top of the camera
// frame.

import React, { createContext, useContext, useCallback, useState, type ReactNode } from "react";

export type Route = "camera" | "text";

interface ReplyRouterContextValue {
  route: Route;
  setRoute: (route: Route) => void;
  /** Text of the message being replied to, shown in the reply chip. */
  replyText: string;
  /** Clear a pending reply chip (dismissed by the user). */
  clearReplyText: () => void;
  /** Signal that the user asked to reply in sign; screens act on this. */
  requestReplyInSign: () => void;
  /** Signal that the pop-up just opened. */
  popUpOpen: boolean;
  setPopUpOpen: (open: boolean) => void;
}

const ReplyRouterContext = createContext<ReplyRouterContextValue | null>(null);

export function ReplyRouterProvider({ children }: { children: ReactNode }) {
  const [route, setRouteState] = useState<Route>("camera");
  const [replyText, setReplyText] = useState<string>("");
  const [popUpOpen, setPopUpOpen] = useState<boolean>(false);

  const setRoute = useCallback((r: Route) => {
    setRouteState(r);
  }, []);

  const clearReplyText = useCallback(() => {
    setReplyText("");
  }, []);

  const requestReplyInSign = useCallback(() => {
    // Consumed by screens: they decide whether to switch screen or stay.
    void React.useContext(ReplyRouterContext);
  }, []);

  return (
    <ReplyRouterContext.Provider
      value={{ route, setRoute, replyText, clearReplyText, requestReplyInSign, popUpOpen, setPopUpOpen }}
    >
      {children}
    </ReplyRouterContext.Provider>
  );
}

export function useReplyRouter(): ReplyRouterContextValue {
  const ctx = useContext(ReplyRouterContext);
  if (!ctx) throw new Error("useReplyRouter must be used within ReplyRouterProvider");
  return ctx;
}
