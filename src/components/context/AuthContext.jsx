import { createContext, useContext, useState, useEffect } from "react";
import {
  signup as signupAPI,
  login as loginAPI,
  initUserStats,
  getUserStats,
  initUserFlashcards,
  getFlashcards,
} from "../firebase/firebase";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("user");
    }
  }, [user]);

  const signup = async (email, password) => {
    const data = await signupAPI(email, password);
    if (data.localId && data.idToken) {
      await initUserFlashcards(data.localId, data.idToken);
      await initUserStats(data.localId, data.idToken);

      const newUser = {
        id: data.localId,
        token: data.idToken,
        email: data.email,
      };
      setUser(newUser);
    }
    return data;
  };

  const login = async (email, password) => {
    const data = await loginAPI(email, password);
    if (data.localId && data.idToken) {
      const stats = await getUserStats(data.localId, data.idToken);
      if (!stats) await initUserStats(data.localId, data.idToken);

      const flashcards = await getFlashcards(data.localId, data.idToken);
      if (!flashcards) await initUserFlashcards(data.localId, data.idToken);

      const newUser = {
        id: data.localId,
        token: data.idToken,
        email: data.email,
      };
      setUser(newUser);
    }
    return data;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
