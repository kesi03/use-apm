export type ApmConfig = {
  apmUrl: string;          // e.g. "/apm" or full APM server URL
  apiKey?: string;         // optional if injected by proxy
  serviceName: string;
  serviceVersion?: string;
  environment?:string;
};

export type ApmTransactionType = "page" | "ui" | "custom";

export type ApmTransaction = {
  id: string;
  name: string;
  type: ApmTransactionType;
  start: number;
  end?: number;
  spans: ApmSpan[];
  result?: string;
  outcome?: string;
  metadata: any;
};

export type ApmSpan = {
  id: string;
  name: string;
  type: string;
  start: number;
  end?: number;
};
