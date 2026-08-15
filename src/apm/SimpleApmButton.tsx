// apm/SimpleApmButton.tsx
import React from "react";
import { useGlobalApm } from "./ApmContext"; // 1. Importera din globala context-hook
import { useApm } from "./useApm"; 

type SimpleApmButtonProps = {
  // config behövs inte längre eftersom den sätts globalt i <ApmProvider>
  txName?: string;
  children: React.ReactNode;

  // main action
  onClick: (apm: ReturnType<typeof useApm>) => Promise<any> | any;

  // extra events (optional)
  extraEvents?: (apm: ReturnType<typeof useApm>) => Promise<void>;
};

export function SimpleApmButton({
  txName = "button-click",
  children,
  onClick,
  extraEvents
}: SimpleApmButtonProps) {
  
  // 2. Hämta den delade, globala APM-instansen istället för att skapa en ny
  const apm = useGlobalApm();

  const handleClick = async () => {
    // PRE
    apm.preEvent(txName, "ui");

    // MAIN
    await apm.mainEvent("main-action", async () => {
      return await onClick(apm);
    });

    // EXTRA EVENTS
    if (extraEvents) {
      await extraEvents(apm);
    }

    // POST
    await apm.postEvent();
  };

  return <button onClick={handleClick}>{children}</button>;
}
