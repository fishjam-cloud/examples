export const SANDBOX_API_URL =
  new URLSearchParams(window.location.search).get("sandboxApiUrl") ??
  import.meta.env.VITE_SANDBOX_API_URL;
