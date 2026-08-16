import axios from "axios";
import {ApmConfig, ApmTransaction } from "./types";

declare const __DEV_MACHINE_NAME__: string;

export type ApmServiceCallOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, any>;
  timeout?: number;
};

export class ApmClient {
  constructor(private readonly config: ApmConfig, private readonly txRef?: any) { }

  private getApiKey() {
    return this.config.apiKey || localStorage.getItem("apm_api_key") || "";
  }

  // Helper to generate a compliant pseudo-random 32-character trace ID if missing
  private generateFallbackTraceId(): string {
    let s = "";
    while (s.length < 32) {
      s += Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
    }
    return s.slice(0, 32);
  }

  // Inject standard, custom, and state APM headers into outgoing HTTP calls
  injectApmHeaders(spanId: string) {
    if (!this.txRef?.current) return {};

    const tx = this.txRef.current;
    
    // Fall back safely if the underlying object hasn't mapped traceId yet
    const traceId = tx.traceId || tx.metadata?.traceId || this.generateFallbackTraceId();
    
    // W3C format: version (00) - traceId (32 hex) - parentId/spanId (16 hex) - traceFlags (01 sampled)
    const w3cTraceParent = `00-${traceId}-${spanId}-01`;

    const headers: Record<string, string> = {
      "X-APM-Transaction-ID": tx.id,
      "X-APM-Span-ID": spanId,
      "traceparent": w3cTraceParent,
      "elastic-apm-traceparent": w3cTraceParent
    };

    // If your transaction object tracks an existing tracestate string, propagate it downstream
    const traceStateStr = tx.traceState || tx.metadata?.traceState;
    if (traceStateStr) {
      headers["tracestate"] = traceStateStr;
    }

    return headers;
  }

  enableAxiosInstrumentation(startSpan: Function, endSpan: Function) {
    axios.interceptors.request.use((config) => {
      // BUGFIX: Skip instrumentation if flagged by wrapServiceCall to prevent double instrumentation
      if ((config as any).__apmBypassInstrumentation) {
        return config;
      }

      // BUGFIX: Ignorera interna APM-anrop för att förhindra evig loop
      if (config.url?.startsWith(this.config.apmUrl)) {
        return config;
      }

      const spanId = startSpan(config.url || "axios-request", "service");

      (config as any).__apmSpanId = spanId;

      const apmHeaders = this.injectApmHeaders(spanId);
      const requestHeaders = config.headers ?? {};
      config.headers = {
        ...(requestHeaders as Record<string, string>),
        ...apmHeaders
      } as any;

      return config;
    });

    axios.interceptors.response.use(
      (response) => {
        // BUGFIX: Säkerställ att config existerar
        const spanId = response.config ? (response.config as any).__apmSpanId : undefined;
        if (spanId) endSpan(spanId);
        return response;
      },
      async (error) => {
        // BUGFIX: Säkerställ att error och error.config existerar innan läsning
        const spanId = error?.config ? (error.config as any).__apmSpanId : undefined;
        if (spanId) {
          endSpan(spanId);
          await this.captureError(error, spanId);
        }
        throw error;
      }
    );
  }


  async wrapServiceCall(
    name: string,
    url: string,
    options: ApmServiceCallOptions,
    startSpan: (name: string, type?: string) => string,
    endSpan: (id: string) => void
  ) {
    const spanId = startSpan(name, "service");
    const apmHeaders = this.injectApmHeaders(spanId);

    const requestHeaders = options.headers ?? {};
    const mergedHeaders = { ...requestHeaders, ...apmHeaders };

    try {
      const res = await axios({
        url,
        method: options.method || "GET",
        data: options.body,
        headers: mergedHeaders,
        params: options.params,
        timeout: options.timeout,
        // Configured flag to safely bypass interceptor instrumentation:
        ...({ __apmBypassInstrumentation: true } as any) 
      });

      endSpan(spanId);
      return res;
    } catch (e) {
      endSpan(spanId);
      await this.captureError(e, spanId);
      throw e;
    }
  }


  async sendTransaction(tx: ApmTransaction) {
    const ndjson = this.buildNdjson(tx);
    try {
      const res = await axios.post(`${this.config.apmUrl}/intake/v2/events`, ndjson, {
        headers: {
          "Content-Type": "application/x-ndjson",
          ...(this.getApiKey()
            ? { Authorization: `ApiKey ${this.getApiKey()}` }
            : {}),
        },
      });
      // eslint-disable-next-line no-console
      console.info("APM sendTransaction response:", res.status, res.data);
    } catch (e) {
      // Swallow network errors when reporting telemetry so app flow is not interrupted
      // eslint-disable-next-line no-console
      console.warn("APM sendTransaction failed:", e);
    }
  }

  async captureError(
    error: any,
    spanId?: string
  ) {
    if (!this.txRef?.current) return;

    const tx = this.txRef.current;

    const errorEvent = {
      error: {
        id: crypto.randomUUID(),
        trace_id: tx.id,
        parent_id: spanId || undefined,
        exception: {
          message: error?.message || String(error),
          type: error?.name || "Error",
          stacktrace: error?.stack || undefined
        }
      }
    };

    const ndjson = [
      JSON.stringify({ metadata: tx.metadata }),
      JSON.stringify(errorEvent)
    ].join("\n");
    try {
      const res = await axios.post(`${this.config.apmUrl}/intake/v2/events`, ndjson, {
        headers: {
          "Content-Type": "application/x-ndjson",
          ...(this.getApiKey()
            ? { Authorization: `ApiKey ${this.getApiKey()}` }
            : {}),
        },
      });
      // eslint-disable-next-line no-console
      console.info("APM captureError response:", res.status, res.data);
    } catch (e) {
      // Do not throw from error reporting; log and continue.
      // eslint-disable-next-line no-console
      console.warn("APM captureError failed:", e);
    }
  }


  private buildNdjson(tx: ApmTransaction): string {
    const metadata = tx.metadata || {};

    const timeOrigin = (typeof performance !== "undefined" && (performance as any).timeOrigin)
      || (Date.now() - (typeof performance !== "undefined" ? performance.now() : 0));
    const txTimestampUs = Math.round((timeOrigin + tx.start) * 1000);

    const traceId = (() => {
      if (metadata.traceId) return metadata.traceId;
      try {
        if (typeof crypto !== "undefined") {
          if ((crypto as any).randomUUID) {
            return (crypto as any).randomUUID().replaceAll("-", "").slice(0, 32);
          }
          if ((crypto as any).getRandomValues) {
            const arr = new Uint8Array(16);
            (crypto as any).getRandomValues(arr);
            return Array.from(arr)
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
          }
        }
      } catch (e) {
        // ignore and fallback to pseudo-random
      }

      return this.generateFallbackTraceId();
    })();

    const metadataDoc: any = {
      metadata: {
        service: {
          name: this.config.serviceName,
          node: {
            configured_name: __DEV_MACHINE_NAME__ ||metadata?.node?.configured_name || window.location.hostname || "browser",
            name: __DEV_MACHINE_NAME__ || metadata?.node?.name || window.location.hostname || "browser"
          },
          agent: { name: "react", version: "1.0.0" },
          environment: metadata?.environment || "development"
        },
        labels: metadata?.custom || undefined,
        user: metadata?.user || undefined,
        system: metadata?.system || undefined
      }
    };

    const durationMs = tx.end! - tx.start;
    const transactionDoc: any = {
      transaction: {
        id: tx.id,
        trace_id: traceId,
        name: tx.name || undefined,
        type: tx.type || "custom",
        duration: Number.parseFloat((durationMs).toFixed(3)),
        span_count: { started: tx.spans.length || 0 },
        timestamp: txTimestampUs,
        context: {
          user: metadata.user || undefined,
          page: { url: metadata.browser?.url || undefined },
          custom: metadata.custom || undefined,
          service: { environment: metadata.environment || "development" }
        }
      }
    };

    const spanDocs = tx.spans.map((s) => ({
      span: {
        id: s.id,
        transaction_id: tx.id,
        trace_id: traceId,
        parent_id: tx.id,
        name: s.name,
        type: s.type || "custom",
        start: s.start - tx.start,
        duration: s.end ? Number.parseFloat((s.end - s.start).toFixed(3)) : 0,
      }
    }));

    const lines = [
      JSON.stringify(metadataDoc),
      JSON.stringify(transactionDoc),
      ...spanDocs.map((span) => JSON.stringify(span))
    ];

    return lines.join("\n") + "\n";
  }
}
