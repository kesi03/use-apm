// apm/ApmButton.tsx
import React, { useState } from "react";
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
  const apm = useGlobalApm();
  const [status, setStatus] = useState("Idle");

  const runEvents = async (events: ApmButtonEvent[], label: string) => {
    if (!events.length) {
      return;
    }

    setStatus(`${label}: running...`);

    try {
      for (const evt of events) {
        await evt(apm);
      }
      setStatus(`${label}: complete`);
    } catch (error) {
      setStatus(`${label}: failed`);
      throw error;
    }
  };

  const handleClick = async () => {
    try {
      apm.preEvent(txName, "ui");
      await runEvents(preEvents, "Pre events");

      await apm.mainEvent("main-events", async () => {
        await runEvents(mainEvents, "Main events");
      });

      await runEvents(extraEvents, "Extra events");
      await runEvents(postEvents, "Post events");
      await apm.postEvent();
      setStatus("Transaction sent");
    } catch (error) {
      setStatus("Apm run failed");
      console.error("ApmButton failed:", error);
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
