import { ApmConfig } from "./types";

declare const __DEV_MACHINE_NAME__: string;

function flattenObject(
    obj: Record<string, any>, 
    prefix = '', 
    res: Record<string, any> = {}
): Record<string, any> {
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const propName = prefix ? `${prefix}_${key}` : key;
            const value = obj[key];

            if (value !== null && typeof value === 'object') {
                // Keep empty objects or empty arrays as they are
                if (Object.keys(value).length === 0) {
                    res[propName] = value;
                } else {
                    // Recursively flatten nested structures
                    flattenObject(value, propName, res);
                }
            } else {
                res[propName] = value;
            }
        }
    }
    return res;
}


export class MetadataCollector {
  private readonly metadata: Record<string,any>;
  constructor(config:ApmConfig) {
    this.metadata = {
      service: {
        name: config?.serviceName ?? "use-apm-react",
        version: config?.serviceVersion ?? "1.0.0",
        environment: config?.environment ?? "development",

        agent: {
          name: "use-apm-js",
          version: "0.1.0"
        },

        language: { name: "javascript" },
        framework: { name: "react" },

        node: {
          configured_name:
            (typeof __DEV_MACHINE_NAME__ !== "undefined" && __DEV_MACHINE_NAME__) ||
            window.location.hostname ||
            "browser",

          name:
            (typeof __DEV_MACHINE_NAME__ !== "undefined" && __DEV_MACHINE_NAME__) ||
            window.location.hostname ||
            "browser"
        }
      },

      page: {
        url: window.location.href,
        referer: document.referrer || null
      },

      user: {},
      labels: {},
      system: {}
    };
  }

  get() {
    return this.metadata;
  }

  setUser(user:Record<string,any>){
    this.metadata.user = { ...this.metadata.user, ...user };
  }

  addLabels(labels:Record<string,any>):MetadataCollector {
    this.metadata.labels = { ...this.metadata.labels, ...labels };
    return this;
  }

  addFlattenLabels(labels:Record<string,any>):MetadataCollector{
    const flattened=flattenObject(labels);
    this.metadata.labels = { ...this.metadata.labels, ...flattened };
    return this;
  }

  addSystem(ctx:Record<string,any>):MetadataCollector{
    this.metadata.system = { ...this.metadata.system, ...ctx };
    return this;
  }
}
