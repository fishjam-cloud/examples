const params = new URLSearchParams(window.location.search);

export const SANDBOX_API_URL =
  params.get("sandboxApiUrl") ?? import.meta.env.VITE_SANDBOX_API_URL ?? "";
