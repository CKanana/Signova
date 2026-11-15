import React from "react";
import { createRoot } from "react-dom/client";
import "../../../shared/constants/web-theme.css";
import "../../../shared/app-shell/src/app-shell.css";
import "../../../shared/app-shell/src/signova-tokens.css";
import "./styles/staff.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
