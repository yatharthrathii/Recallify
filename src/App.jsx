import { BrowserRouter as Router, Routes, Route } from "react-router";
import Navbar from "./components/Navbar";
import Home from "./components/pages/Home";
import Create from "./components/pages/Create";
import Quiz from "./components/pages/Quiz";
import { FlashcardProvider } from "./components/context/FlashcardContext";
import { AuthProvider } from "./components/context/AuthContext";
import { Toaster } from "react-hot-toast";
import Footer from "./components/Footer";

import Login from "./components/pages/Login";
import Signup from "./components/pages/Signup";

import ProtectedRoute from "./components/ProtectedRoute";
import Profile from "./components/pages/Profile";

function App() {
  return (
    <AuthProvider>
      <FlashcardProvider>
        <Router>
          <Toaster />
          <Navbar />
          <div className="pt-16">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              {/* Protected Routes */}
              <Route path="/create" element={<ProtectedRoute><Create /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/quiz" element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
            </Routes>
          </div>
          <Footer />
        </Router>
      </FlashcardProvider>
    </AuthProvider>
  );
}

export default App;
