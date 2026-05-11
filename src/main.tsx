import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { SettingsProvider } from "./utils/settings";
import "./styles/theme.css";
import "./index.css";

import TestHarness from "./TestHarness";

const isTestEditor = window.location.search.includes('test=editor');

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SettingsProvider>
      {isTestEditor ? <TestHarness /> : <App />}
    </SettingsProvider>
  </React.StrictMode>,
);
