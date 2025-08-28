import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { FlashcardProvider } from "./components/context/FlashcardContext.jsx";
import { AuthProvider } from "./components/context/AuthContext.jsx";

createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <FlashcardProvider>
      <App />
    </FlashcardProvider>
  </AuthProvider>
);
