import { FishjamClient } from "@fishjam-cloud/js-server-sdk";
import * as FishjamGemini from "@fishjam-cloud/js-server-sdk/gemini";

import config from "./config.js";

export const fishjam = new FishjamClient({
  fishjamId: config.FISHJAM_ID,
  managementToken: config.FISHJAM_MANAGEMENT_TOKEN,
});

export const genai = FishjamGemini.createClient({
  apiKey: config.GEMINI_API_KEY,
});
