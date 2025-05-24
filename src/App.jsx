import { BrowserRouter as Router, Routes, Route } from "react-router";
import Navbar from "./components/Navbar";
import Home from "./components/pages/Home"
import Create from "./components/pages/Create";
import Quiz from "./components/pages/Quiz";
import { FlashcardProvider } from "./components/context/FlashcardContext";
import { Toaster } from "react-hot-toast";
import Footer from "./components/Footer";

function App() {
  return (
    <FlashcardProvider>
      <Router>
        <Toaster />
        <Navbar />
        <div className="pt-16">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create" element={<Create />} />
            <Route path="/quiz" element={<Quiz />} />
          </Routes>
        </div>
        <Footer/>
      </Router>
    </FlashcardProvider>
  );
}

export default App;
