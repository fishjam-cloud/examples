const params = new URLSearchParams(window.location.search);

export const fishjamId =
  params.get("fishjamId") ??
  import.meta.env.VITE_FISHJAM_ID ??
  "";

export const MOQ_BASE_URL =
  params.get("baseUrl") ??
  import.meta.env.VITE_MOQ_BASE_URL ??
  "https://moq.fishjam.work:443";

export const FISHJAM_API_BASE_URL =
  import.meta.env.VITE_FISHJAM_API_BASE_URL ??
  "https://cloud.fishjam.io/api/v1/connect";
