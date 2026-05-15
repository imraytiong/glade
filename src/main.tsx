import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { SettingsProvider } from "./utils/settings";
import { ErrorProvider } from "./contexts/ErrorContext";
import "./styles/theme.css";
import "./index.css";

import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/400-italic.css";

import TestHarness from "./TestHarness";

const isTestEditor = window.location.search.includes('test=editor');

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SettingsProvider>
      <ErrorProvider>
        {isTestEditor ? <TestHarness /> : <App />}
      </ErrorProvider>
    </SettingsProvider>
  </React.StrictMode>,
);
