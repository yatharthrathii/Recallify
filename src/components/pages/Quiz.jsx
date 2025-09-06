import { useState, useEffect, useRef } from "react";
import { useFlashcard } from "../context/FlashcardContext";
import { useStats } from "../context/StatsContext";
import ProgressChart from "../ProgressChart";
import toast from "react-hot-toast";

const Quiz = () => {
  const { dummyData, setDummyData } = useFlashcard();
  const { stats, gainXP } = useStats();

  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [timerActive, setTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [showResult, setShowResult] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const timerRef = useRef(null);

  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (timeLeft === 0) {
      setTimerActive(false);
      handleFinish();
    }
    return () => clearTimeout(timerRef.current);
  }, [timerActive, timeLeft]);


  const generateQuestions = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a topic before generating quiz!");
      return;
    }

    const match = prompt.match(/(\d+)/);
    if (match && parseInt(match[1]) > 5) {
      toast.error("You can only generate up to 5 questions at once!");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "Recallify Quiz",
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-chat-v3.1:free",
          messages: [
            {
              role: "user",
              content: `${prompt}. Generate exactly 5 quiz questions in valid JSON format only, with this structure:
[
  {
    "question": "string",
    "options": ["A","B","C","D"],
    "answer": "string"
  }
]
Return only JSON, nothing else.`,
            },
          ],
        }),
      });

      const data = await res.json();
      console.log("OpenRouter raw response:", data);

      let text = data?.choices?.[0]?.message?.content || "";
      let questions;

      try {
        questions = JSON.parse(text);
      } catch (err) {
        console.warn("JSON parse failed, using fallback.");
        toast.error("AI returned invalid data. Showing sample question.");
        console.log(err)
        questions = [
          {
            question: "Sample Question (AI response invalid)",
            options: ["A", "B", "C", "D"],
            answer: "A",
          },
        ];
      }

      setDummyData(questions);
      setCurrentQ(0);
      setScore(0);
      setAnswers([]);
      setShowResult(false);
    } catch (err) {
      console.error("Error generating quiz:", err);
      toast.error("Failed to generate quiz. Try again!");
    } finally {
      setLoading(false);
    }
  };


  if (!dummyData || dummyData.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <div className="mb-6">
          <input
            type="text"
            value={prompt}
            placeholder="Type e.g. React ke 5 question do"
            onChange={(e) => setPrompt(e.target.value)}
            className="p-2 border rounded w-2/3"
          />
          <button
            onClick={generateQuestions}
            disabled={loading}
            className="ml-2 bg-blue-600 text-white px-4 py-2 rounded"
          >
            {loading ? "Generating..." : "Generate Quiz"}
          </button>
        </div>
        No flashcards to quiz!
      </div>
    );
  }

  const currentFlashcard = dummyData[currentQ];

  const handleAnswer = (choice) => {
    if (answers.find((a) => a.qIndex === currentQ)) return;

    const isCorrect = choice === currentFlashcard.answer;
    setAnswers((prev) => [
      ...prev,
      { qIndex: currentQ, correct: isCorrect, selected: choice },
    ]);
    if (isCorrect) setScore((prev) => prev + 1);
  };

  const handleNext = () => {
    if (currentQ < dummyData.length - 1) setCurrentQ(currentQ + 1);
  };

  const handlePrev = () => {
    if (currentQ > 0) setCurrentQ(currentQ - 1);
  };

  const handleFinish = async () => {
    setShowResult(true);
    const earnedXP = score * 10;

    if (earnedXP > 0) {
      console.log("Adding XP:", earnedXP);
      try {
        await gainXP(earnedXP);
        console.log("Stats after update:", stats);
        toast.success(`You earned ${earnedXP} XP!`);
      } catch (err) {
        console.error("XP update failed:", err);
      }
    } else {
      toast(`No XP earned this time. Try again!`);
    }
  };

  const resetQuiz = () => {
    setCurrentQ(0);
    setScore(0);
    setAnswers([]);
    setTimeLeft(60);
    setTimerActive(false);
    setShowResult(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 mt-5 bg-white rounded-xl shadow-lg flex flex-col min-h-screen">
      {/* XP Shower */}
      <div className="mb-6 flex justify-between items-center bg-gray-100 p-3 rounded-lg shadow-sm">
        <div className="text-lg font-semibold text-gray-700">
          🌟 XP: {stats?.xp ?? 0} / 100
        </div>
        <div className="text-sm text-gray-600">
          Level: {stats?.level ?? 1}
        </div>
      </div>

      {/* Input for AI Quiz Generator */}
      <div className="mb-6 flex gap-2">
        <input
          type="text"
          value={prompt}
          placeholder="Your AI Quizmaster is ready! Just ask: ‘5 questions about anything!"
          onChange={(e) => setPrompt(e.target.value)}
          className="p-2 border rounded flex-grow"
        />
        <button
          onClick={generateQuestions}
          disabled={loading}
          className="bg-gray-600 text-white px-4 py-2 rounded cursor-pointer"
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>

      {/* Timer & Controls */}
      <div className="flex justify-between items-center mb-6 gap-20">
        <div className="text-lg font-semibold text-gray-700">
          Time Left:{" "}
          <span
            className={`${timeLeft <= 10 ? "text-red-600" : "text-green-600"
              }`}
          >
            {timeLeft}s
          </span>
        </div>

        <div className="flex">
          {!timerActive ? (
            <button
              onClick={() => setTimerActive(true)}
              className="bg-gray-600 text-white px-4 py-1 rounded hover:bg-gray-700 transition"
            >
              Start Timer
            </button>
          ) : (
            <button
              onClick={() => setTimerActive(false)}
              className="bg-red-600 text-white px-4 py-1 rounded hover:bg-red-700 transition"
            >
              Pause Timer
            </button>
          )}
          <button
            onClick={() => {
              setTimeLeft(60);
              setTimerActive(false);
            }}
            className="ml-2 bg-gray-300 text-gray-800 px-3 py-1 rounded hover:bg-gray-400 transition"
          >
            Reset Timer
          </button>
        </div>
      </div>

      {/* Question */}
      <div className="mb-6 flex-grow">
        <h2 className="text-2xl font-bold text-gray-700 mb-4">
          Question {currentQ + 1} of {dummyData.length}
        </h2>
        <p className="text-gray-800 text-lg">{currentFlashcard.question}</p>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {currentFlashcard.options.map((opt, i) => {
          const userAnswer = answers.find((a) => a.qIndex === currentQ);
          const isCorrect = opt === currentFlashcard.answer;
          const isSelected = userAnswer && userAnswer.selected === opt;
          return (
            <button
              key={i}
              onClick={() => handleAnswer(opt)}
              disabled={!!userAnswer}
              className={`
                px-4 py-3 rounded-lg border text-left
                transition
                ${userAnswer
                  ? isCorrect
                    ? "bg-green-400 border-green-600 text-white"
                    : isSelected
                      ? "bg-red-400 border-red-600 text-white"
                      : "bg-gray-100 border-gray-300 cursor-not-allowed"
                  : "bg-gray-100 border-gray-300 hover:bg-gray-300"
                }
              `}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mb-6">
        <button
          onClick={handlePrev}
          disabled={currentQ === 0}
          className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
        >
          Previous
        </button>
        {currentQ === dummyData.length - 1 ? (
          <button
            onClick={handleFinish}
            className="px-4 py-2 rounded bg-gray-600 text-white hover:bg-gray-700"
          >
            Finish Quiz
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={currentQ === dummyData.length - 1}
            className="px-4 py-2 rounded bg-gray-600 text-white hover:bg-gray-700"
          >
            Next
          </button>
        )}
      </div>

      {/* ProgressChart */}
      <div className="mt-5">
        <ProgressChart />
      </div>

      {/* Result Modal */}
      {showResult && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg max-w-md w-full shadow-lg relative animate-fadeIn">
            <h3 className="text-2xl font-bold mb-4 text-gray-700">
              Quiz Results
            </h3>
            <p className="mb-2">Total Questions: {dummyData.length}</p>
            <p className="mb-2">Attempted: {answers.length}</p>
            <p className="mb-2 text-green-600">
              Correct: {answers.filter((a) => a.correct).length}
            </p>
            <p className="mb-6 text-red-600">
              Incorrect: {answers.filter((a) => !a.correct).length}
            </p>
            <p className="text-lg font-semibold">Score: {score}</p>

            <button
              onClick={() => {
                resetQuiz();
                setShowResult(false);
              }}
              className="mt-6 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Restart Quiz
            </button>
            <button
              onClick={() => setShowResult(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl font-bold"
              aria-label="Close Results"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quiz;
