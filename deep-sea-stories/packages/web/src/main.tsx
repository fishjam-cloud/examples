import { FishjamProvider } from "@fishjam-cloud/react-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TRPCClientProvider } from "./contexts/trpc.tsx";
import "./index.css";
import { BrowserRouter, Route, Routes } from "react-router";
import Layout from "./Layout.tsx";
import HomeView from "./views/HomeView.tsx";
import RoomView from "./views/RoomView.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retryDelay: 2000,
    },
  },
});

// biome-ignore lint/style/noNonNullAssertion: root always exists
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TRPCClientProvider queryClient={queryClient}>
        <FishjamProvider fishjamId={import.meta.env.VITE_FISHJAM_ID}>
          <Layout>
            <BrowserRouter>
              <Routes>
                <Route index element={<HomeView />} />
                <Route path=":roomId" element={<RoomView />} />
              </Routes>
            </BrowserRouter>
          </Layout>
        </FishjamProvider>
      </TRPCClientProvider>
    </QueryClientProvider>
  </StrictMode>,
);
