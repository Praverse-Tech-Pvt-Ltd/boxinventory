import { BrowserRouter as Router } from "react-router-dom";
import AppContent from "./AppContent";
import { Toaster } from "react-hot-toast";

function App() {
  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      <Router>
        <AppContent />
      </Router>
    </>
  );
}

export default App;
