// ==========================================
// 1. INITIALIZATION (MUST BE AT THE VERY TOP)
// ==========================================
import { apmAgent } from "./apm"; // Starts Elastic APM before any other modules are loaded

// ==========================================
// 2. IMPORTS
// ==========================================
import express, { Request, Response } from "express";
import axios from "axios";

// ==========================================
// 3. SERVER BOOTSTRAP FUNCTION
// ==========================================
async function startServer() {
    const app = express();
    const port = process.env.PORT || 3000;

    app.use(express.json());

    // Helper function to simulate network latency
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    // ==========================================
    // 4. API ROUTES / ENDPOINTS
    // ==========================================

    // Default root API route
    app.get("/api-status", (_req: Request, res: Response) => {
        res.json("Hello from Express.js (Elastic APM + TS + Axios)");
    });

    // Greet route (Simulates 200ms delay)
    app.get("/greet/:name", async (req: Request, res: Response) => {
        await sleep(200);
        res.json(`Hello, ${req.params.name}!`);
    });

    // Slow route (Simulates 1000ms delay)
    app.get("/slow", async (_req: Request, res: Response) => {
        await sleep(1000);
        res.json("Slow response");
    });

    // Custom transaction (Manual APM tracking)
    app.get("/custom", (_req: Request, res: Response) => {
        const tx = apmAgent.startTransaction("custom-work", "custom");
        const span = tx?.startSpan("do-some-work", "custom");

        setTimeout(() => {
            span?.end();
            tx?.end();
            res.json("Custom span captured");
        }, 500);
    });

    // Chained route (Distributed Tracing with Axios)
    app.post("/chain", async (req: Request, res: Response) => {
        const chain = req.body;
        const traceparent = req.headers["traceparent"] as string | undefined;

        // Start a manual span for this step in the chain
        const span = apmAgent.startSpan("express-chain-step", "custom");

        try {
            // Mark this Express instance as completed in the chain
            const member = chain.chain.members.find((m: any) => m.name === "expressjs");
            if (member) member.completed = true;

            // Find the next service in the chain to call
            const idx = chain.chain.members.findIndex((m: any) => m.name === "expressjs");
            const next = chain.chain.members[idx + 1];

            // If a next service exists, forward the request with the traceparent header
            if (next) {
                await axios.post(next.url, chain, {
                    headers: {
                        "Content-Type": "application/json",
                        ...(traceparent ? { traceparent } : {})
                    }
                });
            }

            res.json(chain);
        }
        catch (err) {
            // Log the error to Elastic APM before rethrowing it
            if (err instanceof Error) {
                apmAgent.captureError(err);
            } else {
                apmAgent.captureError(String(err));
            }
            throw err;
        } finally {
            // Always close your manual span
            span?.end();
        }
    });

    // Error route (For testing error handling in APM)
    app.get("/error", (_req: Request, _res: Response) => {
        throw new Error("Boom from Express.js demo");
    });

    // ==========================================
    // 5. START SERVER
    // ==========================================
    app.listen(port, () => {
        console.log(`Express API server listening on :${port}`);
    });
}

// Execute the bootstrap function
startServer().catch((err) => {
    console.error("Failed to start the integrated server:", err);
});
