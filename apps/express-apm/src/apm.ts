import apm from "elastic-apm-node";

import dotenv from "dotenv";

// Load environment variables from the .env file immediately
dotenv.config();

console.log(`apiKey:${process.env.ELASTIC_APM_API_KEY}`);
console.log(`serviceName:${process.env.ELASTIC_APM_SERVICE_NAME}`);
console.log(`serverUrl:${process.env.ELASTIC_APM_SERVER_URL}`);
console.log(`environment:${process.env.ELASTIC_APM_ENVIRONMENT}`);

// Read the raw API key from your environment
const rawApiKey = process.env.ELASTIC_APM_API_KEY || "";

// If the key doesn't already start with "ApiKey ", prepend it
const formattedApiKey = rawApiKey.startsWith("ApiKey ") 
  ? rawApiKey 
  : `ApiKey ${rawApiKey}`;

export const apmAgent = apm.start({
  serviceName: process.env.ELASTIC_APM_SERVICE_NAME || "express-apm",
  serverUrl: process.env.ELASTIC_APM_SERVER_URL || "https://your-apm-endpoint:443",
  environment: process.env.ELASTIC_APM_ENVIRONMENT || "development",
  // Optional: API key alternative
  apiKey: formattedApiKey,
  captureSpanStackTraces: true
});

