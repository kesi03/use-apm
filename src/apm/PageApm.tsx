// apm/PageApm.tsx
import { useEffect } from "react";
import { useGlobalApm } from "./ApmContext"; 

type PageApmProps = {
  name?: string;
};

export function PageApm({ name = document.title || "page" }: PageApmProps) {
  const apm = useGlobalApm();

  useEffect(() => {
    apm.preEvent(name, "page");

    // MAIN: 
    const renderSpanId = apm.startSpan("render", "render");
    apm.endSpan(renderSpanId);

    // POST: 
    const handleUnload = () => {
      apm.postEvent();
    };

    window.addEventListener("beforeunload", handleUnload);
    
    // Cleanup: Om komponenten avmonteras (t.ex. vid sidbyte i React Router)
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      apm.postEvent();
    };
  }, [name, apm]); // 2. Lyssna på om namnet ändras

  return null;
}
