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
  const data = await res.json();

  if (data.localId && data.idToken) {
    await initUserStats(data.localId, data.idToken);
    await initUserFlashcards(data.localId, data.idToken);
  }

  return data;
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
  const data = await res.json();

  if (data.localId && data.idToken) {
    const stats = await getUserStats(data.localId, data.idToken);
    if (!stats) await initUserStats(data.localId, data.idToken);

    const flashcards = await getFlashcards(data.localId, data.idToken);
    if (!flashcards) await initUserFlashcards(data.localId, data.idToken);
  }

  return data;
};

// ---------- REALTIME DB (Flashcards) ----------
export const initUserFlashcards = async (userId, idToken) => {
  const res = await fetch(`${DATABASE_URL}/users/${userId}/flashcards.json?auth=${idToken}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return res.json();
};

export const getFlashcards = async (userId, idToken) => {
  const res = await fetch(`${DATABASE_URL}/users/${userId}/flashcards.json?auth=${idToken}`);
  return res.json();
};

export const addFlashcard = async (userId, idToken, flashcard) => {
  const res = await fetch(`${DATABASE_URL}/users/${userId}/flashcards.json?auth=${idToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(flashcard),
  });
  return res.json();
};

export const deleteFlashcard = async (userId, idToken, cardId) => {
  const res = await fetch(`${DATABASE_URL}/users/${userId}/flashcards/${cardId}.json?auth=${idToken}`, {
    method: "DELETE",
  });
  if (!res.ok) console.error("Failed to delete card", await res.text());
  return res.json();
};

export const editFlashcard = async (userId, idToken, cardId, updatedData) => {
  const res = await fetch(`${DATABASE_URL}/users/${userId}/flashcards/${cardId}.json?auth=${idToken}`, {
     method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updatedData),
  });
  if (!res.ok) console.error("Failed to edit card", await res.text());
  return res.json();
};

// ---------- USER STATS ----------
export const getUserStats = async (userId, idToken) => {
  const res = await fetch(`${DATABASE_URL}/users/${userId}/stats.json?auth=${idToken}`);
  return res.json();
};

// Updated to include XP history
export const updateUserStats = async (userId, idToken, stats) => {
  const today = new Date().toISOString().split("T")[0];

  let history = stats.history || [];
  const todayIndex = history.findIndex(h => h.date === today);

  if (todayIndex > -1) {
    history[todayIndex].xp = stats.xp;
  } else {
    history.push({ date: today, xp: stats.xp });
  }

  const updatedStats = { ...stats, history };

  const res = await fetch(`${DATABASE_URL}/users/${userId}/stats.json?auth=${idToken}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updatedStats),
  });
  return res.json();
};

// Initialize user stats with history
export const initUserStats = async (userId, idToken) => {
  const today = new Date().toISOString().split("T")[0];

  const defaultStats = {
    xp: 0,
    level: 1,
    streak: 0,
    lastLogin: today,
    badges: {
      first100: false,
      streak7: false,
    },
    history: [{ date: today, xp: 0 }],
  };

  const res = await fetch(`${DATABASE_URL}/users/${userId}/stats.json?auth=${idToken}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(defaultStats),
  });
  return res.json();
};
