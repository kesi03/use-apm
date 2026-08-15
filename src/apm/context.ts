export function getUserContext() {
  return {
    username: localStorage.getItem("user") || undefined,
    email: localStorage.getItem("email") || undefined,
    id: localStorage.getItem("userId") || undefined,
  };
}

export function getBrowserContext() {
  const nav = navigator;
  const screen = window.screen;

  return {
    userAgent: nav.userAgent,
    vendor: nav.vendor,
    platform: nav.platform,
    language: nav.language,
    languages: nav.languages,
    cookies: getCookieMap(),
    os: detectOS(),

    // Screen + viewport
    screen: {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio
    },

    // Device capabilities
    hardware: {
      memory: (nav as any).deviceMemory,          // Chrome only
      cores: nav.hardwareConcurrency,
    },

    // Network
    connection: getConnectionInfo(),

    // Page info
    url: window.location.href,
    referrer: document.referrer,
    historyLength: window.history.length,
    navigationType: getNavigationType(),

    // Timezone
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

    // Preferences
    prefersColorScheme: getColorScheme(),
    prefersReducedMotion: getReducedMotion(),

    // Page visibility
    visibilityState: document.visibilityState,

    // Online status
    online: nav.onLine
  };
}

export function detectOS() {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const vendor = navigator.vendor || "";

  // iOS (iPhone, iPad, iPod)
  if (/iPhone|iPad|iPod/.test(platform)) return "iOS";

  // macOS
  if (/Mac/.test(platform)) return "macOS";

  // Windows
  if (/Win/.test(platform)) return "Windows";

  // Android
  if (/Android/.test(ua)) return "Android";

  // ChromeOS
  if (/CrOS/.test(ua)) return "ChromeOS";

  // Linux (desktop)
  if (/Linux/.test(platform) || /Linux/.test(ua)) return "Linux";

  // Fallback
  return "Unknown";
}


function getConnectionInfo() {
  const conn = (navigator as any).connection || {};
  return {
    type: conn.effectiveType,
    downlink: conn.downlink,
    rtt: conn.rtt,
    saveData: conn.saveData
  };
}

function getNavigationType() {
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
  if (!nav) return "unknown";
  return nav.type; // navigate, reload, back_forward, prerender
}

function getColorScheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "reduce"
    : "no-preference";
}


export function getNavigationTimings() {
  const perf = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (!perf) return {};

  return {
    dns: perf.domainLookupEnd - perf.domainLookupStart,
    tcp: perf.connectEnd - perf.connectStart,
    ttfb: perf.responseStart - perf.requestStart,
    domContentLoaded: perf.domContentLoadedEventEnd - perf.startTime,
    load: perf.loadEventEnd - perf.startTime,
    redirect: perf.redirectEnd - perf.redirectStart,
    fetchStart: perf.fetchStart - perf.startTime,
  };
}

export function getJwtUser() {
  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    getCookie("token");

  if (!token) return {};

  try {
    const [, payload] = token.split(".");
    const decoded = JSON.parse(atob(payload));

    return {
      userId: decoded.sub,
      username: decoded.name,
      email: decoded.email,
      roles: decoded.roles,
      tenantId: decoded.tenantId,
      permissions: decoded.permissions
    };
  } catch {
    return {};
  }
}

export function getCookieMap() {
  const out: Record<string, string> = {};

  document.cookie.split(";").forEach(cookie => {
    const [key, ...rest] = cookie.split("=");
    if (!key) return;
    out[key.trim()] = decodeURIComponent(rest.join("="));
  });

  return out;
}


function getCookie(name: string) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? match[2] : null;
}

export function getUserFromCookies() {
  const cookies = getCookieMap();

  return {
    username: cookies["X-User-Name"],
    userId: cookies["X-User-Id"],
    tenantId: cookies["X-Tenant"],
    roles: cookies["X-Roles"]?.split(",")
  };
}

export const auth = {
  getUser() {
    return (window as any)["__authUser"] || {};
  }
};

export function getSmartUser() {
  return {
    ...getUserContext(),      // localStorage/sessionStorage
    ...getJwtUser(),          // JWT token
    ...getUserFromCookies(),  // SSO cookies
    ...auth.getUser()         // global auth provider
  };
}
