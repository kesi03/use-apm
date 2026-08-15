import axios from "axios";
import { ApmConfig, ApmTransaction } from "./types";

export type ApmServiceCallOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, any>;
  timeout?: number;
};

export class ApmClient {
  constructor(private config: ApmConfig, private txRef?: any) { }

  private getApiKey() {
    return this.config.apiKey || localStorage.getItem("apm_api_key") || "";
  }

  // Inject APM headers into axios calls
  injectApmHeaders(spanId: string) {
    if (!this.txRef?.current) return {};

    return {
      "X-APM-Transaction-ID": this.txRef.current.id,
      "X-APM-Span-ID": spanId
    };
  }

  enableAxiosInstrumentation(startSpan: Function, endSpan: Function) {
    axios.interceptors.request.use((config) => {
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
        const spanId = (response.config as any).__apmSpanId;
        if (spanId) endSpan(spanId);
        return response;
      },
      async (error) => {
        const spanId = (error.config as any).__apmSpanId;
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

    const mergedHeaders = {
      ...(options.headers || {}),
      ...apmHeaders
    };

    try {
      const res = await axios({
        url,
        method: options.method || "GET",
        data: options.body,
        headers: mergedHeaders,
        params: options.params,
        timeout: options.timeout
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

    await axios.post(`${this.config.apmUrl}/intake/v2/events`, ndjson, {
      headers: {
        "Content-Type": "application/x-ndjson",
        ...(this.getApiKey()
          ? { Authorization: `ApiKey ${this.getApiKey()}` }
          : {}),
      },
    });
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

    await axios.post(`${this.config.apmUrl}/intake/v2/events`, ndjson, {
      headers: {
        "Content-Type": "application/x-ndjson",
        ...(this.getApiKey()
          ? { Authorization: `ApiKey ${this.getApiKey()}` }
          : {}),
      },
    });
  }


  private buildNdjson(tx: ApmTransaction): string {
    const metadata = tx.metadata;
    const traceId = tx.id; 

    // 1. Prepare the standard metadata header line
    const metadataDoc = {
      metadata: {
        service: {
          name: this.config.serviceName,
          agent: { name: "custom-js-sdk", version: "1.0.0" }
        }
      }
    };

    // 2. Prepare the standalone transaction envelope using compliant underscore keys
    const transactionDoc = {
      transaction: {
        id: tx.id,
        trace_id: traceId,
        name: tx.name,
        type: tx.type,
        duration: tx.end! - tx.start,
        span_count: { started: tx.spans.length },
        
        labels: {
          // Custom fields from buttons (e.g., cartValue, startTime)
          ...metadata.custom,

          // Compliant Flattened User Data
          "user_id": metadata.user?.id || "anonymous",
          "user_username": metadata.user?.username || "",
          "user_email": metadata.user?.email || "",

          // Compliant Flattened Browser Context
          "browser_userAgent": metadata.browser?.userAgent || "",
          "browser_language": metadata.browser?.language || "",
          "browser_platform": metadata.browser?.platform || "",
          "browser_url": metadata.browser?.url || "",
          "browser_referrer": metadata.browser?.referrer || "",

          // Compliant Flattened Navigation Timings
          "navigation_dns": metadata.navigation?.dns || 0,
          "navigation_tcp": metadata.navigation?.tcp || 0,
          "navigation_ttfb": metadata.navigation?.ttfb || 0,
          "navigation_domReady": metadata.navigation?.domReady || 0,
          "navigation_loadTime": metadata.navigation?.loadTime || 0,
        }
      },
    };

    // 3. Map each nested span item into its own independent document line
    const spanDocs = tx.spans.map((s) => ({
      span: {
        id: s.id,
        transaction_id: tx.id,
        trace_id: traceId,
        parent_id: tx.id,
        name: s.name,
        type: s.type,
        duration: s.end! - s.start,
        start: s.start - tx.start,
      }
    }));

    // 4. Combine all elements into an NDJSON string joined by newlines
    const lines = [
      JSON.stringify(metadataDoc),
      JSON.stringify(transactionDoc),
      ...spanDocs.map(span => JSON.stringify(span))
    ];

    return lines.join("\n") + "\n";
}

}

