import { createRoot } from "react-dom/client";
import "@zoonk/ui/globals.css";
import { App } from "./app";

const rootElement = document.querySelector("#root");

if (!rootElement) {
  throw new Error("The mailbox root element is missing.");
}

createRoot(rootElement).render(<App />);
