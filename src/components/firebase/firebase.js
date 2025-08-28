const API_KEY = import.meta.env.VITE_FIREBASE_API_KEY;
const DATABASE_URL = import.meta.env.VITE_FIREBASE_DB_URL;

// ---------- AUTH ----------
export const signup = async (email, password) => {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  return res.json();
};

export const login = async (email, password) => {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  return res.json();
};

export const resetPassword = async (email) => {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestType: "PASSWORD_RESET", email }),
    }
  );
  return res.json();
};

// ---------- REALTIME DB (Flashcards) ----------

export const getFlashcards = async (userId, idToken) => {
  const res = await fetch(
    `${DATABASE_URL}/flashcards/${userId}.json?auth=${idToken}`
  );
  return res.json();
};

export const addFlashcard = async (userId, idToken, flashcard) => {
  const res = await fetch(
    `${DATABASE_URL}/flashcards/${userId}.json?auth=${idToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(flashcard),
    }
  );
  return res.json(); 
};

export const deleteFlashcard = async (userId, idToken, cardId) => {
  const res = await fetch(
    `${DATABASE_URL}/flashcards/${userId}/${cardId}.json?auth=${idToken}`,
    {
      method: "DELETE",
    }
  );
  if (!res.ok) {
    console.error("Failed to delete card", await res.text());
  }
  return res.json();
};

export const editFlashcard = async (userId, idToken, cardId, updatedData) => {
  const res = await fetch(
    `${DATABASE_URL}/flashcards/${userId}/${cardId}.json?auth=${idToken}`,
    {
      method: "PATCH", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedData),
    }
  );
  if (!res.ok) {
    console.error("Failed to edit card", await res.text());
  }
  return res.json();
};
