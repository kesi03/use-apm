import { useRef } from "react";
import { ApmClient, ApmServiceCallOptions } from "./client";
import { ApmConfig, ApmTransaction, ApmSpan, ApmTransactionType } from "./types";
import { getBrowserContext, getSmartUser, getNavigationTimings } from "./context";

export function useApm(config: ApmConfig) {
  const txRef = useRef<ApmTransaction | null>(null);

  // Single client instance, with access to txRef
  const client = useRef(new ApmClient(config, txRef)).current;

  const startTransaction = (name: string, type: ApmTransactionType = "custom") => {
    const id = crypto.randomUUID();
    const start = performance.now();

    const metadata = {
      service: { 
        name: config.serviceName ,
        node: {
          name: window.location.hostname || 'browser'
        }
      },
      user: getSmartUser(),
      browser: getBrowserContext(),
      navigation: getNavigationTimings(),
      custom: {}
    };

    const tx: ApmTransaction = {
      id,
      name,
      type,
      start,
      spans: [],
      metadata,
    };

    txRef.current = tx;
    sessionStorage.setItem("apm_tx", JSON.stringify(tx));
  };

  const setMetadata = (obj: Record<string, any>) => {
    if (!txRef.current) return;
    txRef.current.metadata.custom = {
      ...txRef.current.metadata.custom,
      ...obj
    };
    client.setTransaction(txRef.current);
    sessionStorage.setItem("apm_tx", JSON.stringify(txRef.current));
  };

  const addMetadataField = (key: string, value: any) => {
    if (!txRef.current) return;
    txRef.current.metadata.custom[key] = value;
    client.setTransaction(txRef.current);
    sessionStorage.setItem("apm_tx", JSON.stringify(txRef.current));
  };

  const getMetadata = () => {
    return txRef.current?.metadata.custom || {};
  };

  const startSpan = (name: string, type = "action"): string => {
    if (!txRef.current) throw new Error("No active transaction");

    const span: ApmSpan = {
      id: crypto.randomUUID(),
      name,
      type,
      start: performance.now(),
    };

    txRef.current.spans.push(span);
    client.setTransaction(txRef.current);
    sessionStorage.setItem("apm_tx", JSON.stringify(txRef.current));
    return span.id;
  };

  const endSpan = (spanId: string) => {
    if (!txRef.current) return;
    const span = txRef.current.spans.find((s) => s.id === spanId);
    if (!span) return;
    span.end = performance.now();
    client.setTransaction(txRef.current);
    sessionStorage.setItem("apm_tx", JSON.stringify(txRef.current));
  };

  const endTransaction = async () => {
    if (!txRef.current) return;
    txRef.current.end = performance.now();
    sessionStorage.setItem("apm_tx", JSON.stringify(txRef.current));

    const tx = txRef.current;
    client.setTransaction(txRef.current);
    txRef.current = null;
    sessionStorage.removeItem("apm_tx");

    await client.sendTransaction(tx);
  };

  const preEvent = (name: string, type: ApmTransactionType = "custom") => {
    startTransaction(name, type);
  };

  const mainEvent = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const spanId = startSpan(name, "main");
    try {
      const result = await fn();
      endSpan(spanId);
      return result;
    } catch (e) {
      endSpan(spanId);
      await captureError(e, spanId);
      throw e;
    }
  };

  const postEvent = async () => {
  try {
    await endTransaction();
  } catch (e) {
    await client.captureError(e);
    throw e;
  }
};

  const createEventSpan = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const spanId = startSpan(name, "event");
    try {
      const result = await fn();
      endSpan(spanId);
      return result;
    } catch (e) {
      endSpan(spanId);
      await captureError(e, spanId);
      throw e;
    }
  };

  const injectApmHeaders = (spanId: string) => {
    if (!txRef.current) return {};

    return {
      "X-APM-Transaction-ID": txRef.current.id,
      "X-APM-Span-ID": spanId
    };
  };

  const captureError = async (error: any, spanId?: string) => {
  await client.captureError(error, spanId);
};


  return {
    preEvent,
    mainEvent,
    postEvent,
    startTransaction,
    startSpan,
    endSpan,
    endTransaction,

    client,

    setMetadata,
    addMetadataField,
    getMetadata,

    createEventSpan,
    injectApmHeaders,
    captureError,
    wrapServiceCall: (
    name: string,
    url: string,
    options: ApmServiceCallOptions = {}
  ) => client.wrapServiceCall(name, url, options, startSpan, endSpan)
  };
}
