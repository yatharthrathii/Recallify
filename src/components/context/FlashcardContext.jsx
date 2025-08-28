import { createContext, useContext, useState, useEffect } from "react";
import {
  getFlashcards,
  addFlashcard as firebaseAddFlashcard,
  deleteFlashcard as firebaseDeleteFlashcard,
  editFlashcard as firebaseEditFlashcard,
} from "../firebase/firebase";
import { AuthContext } from "./AuthContext";

const FlashcardContext = createContext();

export const FlashcardProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [flashcards, setFlashcards] = useState([]);

  const [dummyData, setDummyData] = useState([
    {
      question: "What is React?",
      options: ["Library", "Framework", "Language", "Tool"],
      answer: "Library",
    },
    {
      question: "What does CSS stand for?",
      options: [
        "Computer Style Sheets",
        "Creative Style Sheets",
        "Cascading Style Sheets",
        "Colorful Style Sheets",
      ],
      answer: "Cascading Style Sheets",
    },
    {
      question: "What is JSX in React?",
      options: [
        "A JavaScript file",
        "A syntax extension for JavaScript",
        "A CSS preprocessor",
        "A type of API",
      ],
      answer: "A syntax extension for JavaScript",
    },
    {
      question: "Which hook is used for side effects in React?",
      options: ["useEffect", "useState", "useRef", "useMemo"],
      answer: "useEffect",
    },
    {
      question: "Which of the following is NOT a valid React hook?",
      options: ["useReducer", "useFetch", "useCallback", "useRef"],
      answer: "useFetch",
    },
    {
      question: "What does the useState hook return?",
      options: [
        "An object with state",
        "An array with state and updater function",
        "A boolean and a setter",
        "A function that updates props",
      ],
      answer: "An array with state and updater function",
    },
    {
      question: "What is the purpose of keys in React lists?",
      options: [
        "To identify which items changed",
        "To style the elements",
        "To encrypt the list",
        "To enable routing",
      ],
      answer: "To identify which items changed",
    },
    {
      question: "What is prop drilling in React?",
      options: [
        "Passing props deeply through components unnecessarily",
        "Modifying props directly",
        "Storing props in Redux",
        "Debugging props",
      ],
      answer: "Passing props deeply through components unnecessarily",
    },
    {
      question: "What problem does React Context API solve?",
      options: [
        "Performance bottlenecks",
        "Re-renders",
        "Global state sharing without prop drilling",
        "Async API calls",
      ],
      answer: "Global state sharing without prop drilling",
    },
    {
      question: "What is the purpose of useMemo in React?",
      options: [
        "To memoize expensive calculations",
        "To manage side effects",
        "To store previous props",
        "To track state updates",
      ],
      answer: "To memoize expensive calculations",
    },
  ]);

  useEffect(() => {
    const fetchData = async () => {
      if (user?.localId && user?.idToken) {
        const data = await getFlashcards(user.localId, user.idToken);
        if (data) {
          const formatted = Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }));
          setFlashcards(formatted);
        } else {
          setFlashcards([]);
        }
      }
    };
    fetchData();
  }, [user]);

  const addCard = async (question, answer) => {
    if (!user) return;
    const newCard = { question, answer };
    const res = await firebaseAddFlashcard(user.localId, user.idToken, newCard);
    setFlashcards((prev) => [...prev, { id: res.name, ...newCard }]);
  };

  const deleteCard = async (id) => {
    if (!user) return;
    await firebaseDeleteFlashcard(user.localId, user.idToken, id);
    setFlashcards((prev) => prev.filter((c) => c.id !== id));
  };

  const editCard = async (id, question, answer) => {
    if (!user) return;
    const updated = { question, answer };
    await firebaseEditFlashcard(user.localId, user.idToken, id, updated);
    setFlashcards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updated } : c))
    );
  };

  return (
    <FlashcardContext.Provider
      value={{
        flashcards,
        addCard,
        deleteCard,
        editCard,
        dummyData,
        setDummyData,
      }}
    >
      {children}
    </FlashcardContext.Provider>
  );
};

export const useFlashcard = () => useContext(FlashcardContext);
