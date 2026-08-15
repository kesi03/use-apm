// apm/ApmContext.tsx
import React, { createContext, useContext } from "react";
import { useApm } from "./useApm";

// Konfigurationen kan ligga centralt här
export const apmConfig = {
  apmUrl: "/apm",
  serviceName: "react-apm-sdk",
};

type ApmContextType = ReturnType<typeof useApm> | null;
const ApmContext = createContext<ApmContextType>(null);

export function ApmProvider({ children }: { children: React.ReactNode }) {
  const apm = useApm(apmConfig);

  return (
    <ApmContext.Provider value={apm}>
      {children}
    </ApmContext.Provider>
  );
}

export function useGlobalApm() {
  const context = useContext(ApmContext);
  if (!context) {
    throw new Error("useGlobalApm måste användas inuti en <ApmProvider>");
  }
  return context;
}
