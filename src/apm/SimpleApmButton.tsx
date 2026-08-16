// apm/SimpleApmButton.tsx
import React, { useState } from "react";
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
  const apm = useGlobalApm();
  const [status, setStatus] = useState("Idle");

  const handleClick = async () => {
    try {
      setStatus("PRE: running");
      apm.preEvent(txName, "ui");
      setStatus("PRE: complete");

      setStatus("MAIN: running");
      await apm.mainEvent("main-action", async () => {
        return await onClick(apm);
      });
      setStatus("MAIN: complete");

      if (extraEvents) {
        setStatus("EXTRA: running");
        await extraEvents(apm);
        setStatus("EXTRA: complete");
      }

      setStatus("POST: running");
      await apm.postEvent();
      setStatus("POST: complete");
    } catch (error) {
      setStatus("Apm lifecycle failed");
      console.error("SimpleApmButton failed:", error);
    }
  };

  return (
    <div>
      <button className="btn-black" onClick={handleClick}>{children}</button>
    <div className="clear-both" aria-hidden="true" />
      <div className="apm-status" aria-live="polite">
        {status}
      </div>
    </div>
  );
}
