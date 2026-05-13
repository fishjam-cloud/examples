export const DEFAULT_FISHJAM_ID =
  new URLSearchParams(window.location.search).get("fishjamId") ??
  import.meta.env.VITE_FISHJAM_ID;

export const DEFAULT_SANDBOX_API_URL =
  new URLSearchParams(window.location.search).get("sandboxApiUrl") ??
  import.meta.env.VITE_SANDBOX_API_URL;
