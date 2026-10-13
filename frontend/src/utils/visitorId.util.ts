import { setCookie } from "cookies-next";

// A hash of what this browser looks like, so the admin audit log can follow
// one visitor across requests even without an account. It goes out as the
// X-Browser-Fingerprint header on api calls and as the visitor_id cookie, the
// cookie is what reaches the backend on plain downloads and <img> previews.

let cached: string | undefined;

const fnv1a = (input: string, seed: number) => {
  let h = 0x811c9dc5 ^ seed;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
};

export const fingerprintHash = (input: string) =>
  [1, 2, 3, 4].map((seed) => fnv1a(input, seed)).join("");

// the same text renders a little differently per gpu, driver and font set
const canvasSignal = () => {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    canvas.width = 220;
    canvas.height = 30;
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(110, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("pingvin share \u{1F427}", 2, 2);
    return canvas.toDataURL();
  } catch {
    return "";
  }
};

const webglSignal = () => {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (!gl) return "";
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    return info
      ? `${gl.getParameter(info.UNMASKED_VENDOR_WEBGL)}|${gl.getParameter(info.UNMASKED_RENDERER_WEBGL)}`
      : `${gl.getParameter(gl.VENDOR)}|${gl.getParameter(gl.RENDERER)}`;
  } catch {
    return "";
  }
};

export const getVisitorId = () => {
  if (typeof window === "undefined") return undefined;
  if (cached) return cached;

  cached = fingerprintHash(
    [
      navigator.language,
      navigator.hardwareConcurrency,
      navigator.platform,
      `${screen.width}x${screen.height}x${screen.colorDepth}`,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      canvasSignal(),
      webglSignal(),
    ].join("~"),
  );
  setCookie("visitor_id", cached, {
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
  return cached;
};
