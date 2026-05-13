const params = new URLSearchParams(window.location.search);

export const fishjamId =
  params.get("fishjamId") ?? import.meta.env.VITE_FISHJAM_ID ?? "";

export const SANDBOX_API_URL =
  params.get("sandboxApiUrl") ?? import.meta.env.VITE_SANDBOX_API_URL ?? "";

export const MOQ_BASE_URL =
  params.get("baseUrl") ??
  import.meta.env.VITE_MOQ_BASE_URL ??
  "https://moq.fishjam.work:443";
