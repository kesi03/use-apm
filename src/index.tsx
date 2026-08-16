// index.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import "./main.css";
import { App } from "./App";
import { ApmProvider, useGlobalApm } from "./apm/ApmContext"; // Importera från den nya filen
import { ApmErrorBoundary } from "./apm/ApmErrorBoundary";

function RootApp() {
  const apm = useGlobalApm();
  return (
    <ApmErrorBoundary apm={apm}>
      <App />
    </ApmErrorBoundary>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <ApmProvider>
    <RootApp />
  </ApmProvider>
);
