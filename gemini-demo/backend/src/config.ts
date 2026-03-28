import z from "zod";
import dotenv from "dotenv";

dotenv.config({ path: "../.env", quiet: true });

export default z
  .object({
    PORT: z.coerce.number().int().default(8000),
    FISHJAM_ID: z.string(),
    FISHJAM_MANAGEMENT_TOKEN: z.string(),
    GEMINI_API_KEY: z.string(),
  })
  .parse(process.env);
