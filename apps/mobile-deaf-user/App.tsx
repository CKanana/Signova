import React from "react";
import { SessionProvider } from "./src/context/SessionContext";
import { RootNavigator } from "./src/navigation/RootNavigator";

export default function App() {
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  );
}