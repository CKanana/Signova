import React from "react";
import { createRoot } from "react-dom/client";
import { applyWebTheme } from "../../../shared/constants/theme";
import "../../../shared/constants/web-theme.css";
import App from "./App";

applyWebTheme(document.documentElement);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);