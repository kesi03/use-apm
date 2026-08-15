// App.tsx
import React from "react";
import { SimpleApmButton } from "./apm/SimpleApmButton";
import { PageApm } from "./apm/PageApm";
import { ApmButton } from "./apm/ApmButton";

export function App() {
  return (
    <>
      
      <PageApm />

      {/* ------------------------------ */}
      {/* SimpleApmButton with Express /greet */}
      {/* ------------------------------ */}
      <SimpleApmButton
        txName="save-settings"
        onClick={async () => {
          console.log("Saving settings...");
        }}
        extraEvents={async (apm) => {
          await apm.createEventSpan("express-greet", async () => {
            await apm.wrapServiceCall(
              "express-greet",
              "/express/greet/Kester",
              {
                method: "GET"
              }
            );
          });
        }}
      >
        Save
      </SimpleApmButton>
      <p></p>
      {/* ------------------------------ */}
      {/* ApmButton with Express /slow + /custom */}
      {/* ------------------------------ */}
      <ApmButton
        txName="checkout"

        preEvents={[
          async (apm) => {
            apm.addMetadataField("startTime", Date.now());
          }
        ]}

        mainEvents={[
          async (apm) => {
            await apm.createEventSpan("validate-cart", async () => {
              // validateCart();
            });
          },
          async (apm) => {
            await apm.createEventSpan("calculate-totals", async () => {
              // calculateTotals();
            });
          }
        ]}

        extraEvents={[
          // Call Express /slow
          async (apm) => {
            await apm.createEventSpan("express-slow", async () => {
              await apm.wrapServiceCall(
                "express-slow",
                "/express/slow",
                { method: "GET" }
              );
            });
          },

          // Call Express /custom
          async (apm) => {
            await apm.createEventSpan("express-custom", async () => {
              await apm.wrapServiceCall(
                "express-custom",
                "/express/custom",
                { method: "GET" }
              );
            });
          },

          async (apm) => {
            apm.addMetadataField("cartValue", 199.99);
          }
        ]}

        postEvents={[
          async (apm) => {
            await apm.createEventSpan("update-ui", async () => {
              // updateUI();
            });
          }
        ]}
      >
        Checkout
      </ApmButton>
    </>
  );
}
