import { FishjamProvider } from "@fishjam-cloud/react-client";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

const fishjamId = import.meta.env.FISHJAM_ID as string;

console.log("fishjamId", fishjamId);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FishjamProvider fishjamId={fishjamId}>
      <App />
    </FishjamProvider>
  </StrictMode>,
);
