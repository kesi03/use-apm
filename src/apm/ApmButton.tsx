// apm/ApmButton.tsx
import React from "react";
import { useGlobalApm } from "./ApmContext";
import { useApm } from "./useApm";

export type ApmButtonEvent = (apm: ReturnType<typeof useApm>) => Promise<void> | void;

export type ApmButtonProps = {
  txName?: string;
  children: React.ReactNode;

  preEvents?: ApmButtonEvent[];
  mainEvents?: ApmButtonEvent[];
  extraEvents?: ApmButtonEvent[];
  postEvents?: ApmButtonEvent[];
};

export function ApmButton({
  txName = "button-click",
  children,
  preEvents = [],
  mainEvents = [],
  extraEvents = [],
  postEvents = []
}: ApmButtonProps) {
  
  // 2. Använd den globala instansen istället för att initiera en ny
  const apm = useGlobalApm();

  const runEvents = async (events: ApmButtonEvent[]) => {
    for (const evt of events) {
      await evt(apm);
    }
  };

  const handleClick = async () => {
    // PRE
    apm.preEvent(txName, "ui");
    await runEvents(preEvents);

    // MAIN
    await apm.mainEvent("main-events", async () => {
      await runEvents(mainEvents);
    });

    // EXTRA
    await runEvents(extraEvents);

    // POST
    await runEvents(postEvents);
    await apm.postEvent();
  };

  return <button onClick={handleClick}>{children}</button>;
}
