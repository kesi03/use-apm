#!/usr/bin/env tsx
import dotenv from "dotenv";
// Load .env values immediately before building the CLI options
dotenv.config();

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { Client } from "@elastic/elasticsearch";

// Setup Yargs Command Line Interface
yargs(hideBin(process.argv))
  .command(
    "create-apm-token",
    "Generate a Base64 API Key for Elastic Cloud Serverless APM using values from .env",
    (y) => {
      return y
        .option("node", {
          alias: "n",
          type: "string",
          description: "Your Elastic Serverless APM endpoint URL",
          // Automatically falls back to the .env variable if the flag is omitted
          default: process.env.ELASTIC_ADMIN_NODE_URL,
          demandOption: !process.env.ELASTIC_ADMIN_NODE_URL, // Required ONLY if not present in .env
        })
        .option("admin-key", {
          alias: "a",
          type: "string",
          description: "Your master admin Elastic API Key (Base64 string)",
          // Automatically falls back to the .env variable if the flag is omitted
          default: process.env.ELASTIC_ADMIN_API_KEY,
          demandOption: !process.env.ELASTIC_ADMIN_API_KEY, // Required ONLY if not present in .env
        })
        .option("name", {
          type: "string",
          description: "Custom name for the generated APM API Key",
          default: "express-backend-apm-token",
        });
    },
    async (argv) => {
      // Ensure we actually have the required configuration strings
      if (!argv.node || !argv.adminKey) {
        console.error("❌ Error: Missing configuration. Provide flags or set ELASTIC_ADMIN_NODE_URL and ELASTIC_ADMIN_API_KEY in your .env file.");
        process.exit(1);
      }

      // Initialize the official Elasticsearch Client using the Admin API Key
      const client = new Client({
        node: argv.node,
        auth: {
          apiKey: argv.adminKey,
        },
      });

      try {
        console.log(`\nConnecting to Elastic Serverless at: ${argv.node}...`);

        // Send request with Serverless Application Privileges
        const response = await client.security.createApiKey({
          name: argv.name,
          role_descriptors: {
            apm_writer: {
              applications: [
                {
                  application: "apm",
                  privileges: ["event:write", "config_agent:read"],
                  resources: ["*"],
                },
              ],
            },
          },
        });

        const { id, api_key } = response;

        // Combine id and api_key into standard Base64 string expected by APM Agent
        const base64ApiKey = Buffer.from(`${id}:${api_key}`).toString("base64");

        console.log("\n=======================================================");
        console.log("✔ Scoped APM Token Generated Successfully!");
        console.log("=======================================================");
        console.log(`ELASTIC_APM_API_KEY=${base64ApiKey}`);
        console.log("=======================================================\n");
        console.log("Copy the environment variable above into your backend .env file.");
        
      } catch (error) {
        console.error("\n❌ Failed to generate API Key:");
        if (error instanceof Error) {
          console.error(error.message);
        } else {
          console.error(error);
        }
        process.exit(1);
      }
    }
  )
  .demandCommand(1, "You must provide a valid command.")
  .help()
  .parse();
