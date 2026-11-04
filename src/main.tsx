import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App";
import { AppProvider } from "./context/AppContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
        <Toaster position="top-right" richColors closeButton theme="dark" />
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
