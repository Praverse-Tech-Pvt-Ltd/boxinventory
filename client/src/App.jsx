import { BrowserRouter as Router } from "react-router-dom";
import AppContent from "./AppContent";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "./context/ThemeContext";

function App() {
  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      <ThemeProvider>
        <Router>
          <AppContent />
        </Router>
      </ThemeProvider>
    </>
  );
}

export default App;
