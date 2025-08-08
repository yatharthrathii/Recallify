import { useState, useEffect, useRef } from "react";
import { useFlashcard } from "../context/FlashcardContext";
import ProgressChart from "../ProgressChart";

const Quiz = () => {
    const { dummyData } = useFlashcard();

    const [currentQ, setCurrentQ] = useState(0);
    const [score, setScore] = useState(0);
    const [answers, setAnswers] = useState([]);
    const [timerActive, setTimerActive] = useState(false);
    const [timeLeft, setTimeLeft] = useState(60);
    const [showResult, setShowResult] = useState(false);

    const timerRef = useRef(null);

    useEffect(() => {
        if (timerActive && timeLeft > 0) {
            timerRef.current = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
        } else if (timeLeft === 0) {
            setTimerActive(false);
            setShowResult(true);
        }
        return () => clearTimeout(timerRef.current);
    }, [timerActive, timeLeft]);

    if (!dummyData || dummyData.length === 0) {
        return (
            <div className="text-center py-20 text-gray-500">
                No flashcards to quiz!
            </div>
        );
    }

    const currentFlashcard = dummyData[currentQ];

    const handleAnswer = (choice) => {
        if (answers.find((a) => a.qIndex === currentQ)) return;

        const isCorrect = choice === currentFlashcard.answer;
        setAnswers((prev) => [...prev, { qIndex: currentQ, correct: isCorrect, selected: choice }]);
        if (isCorrect) setScore((prev) => prev + 1);
    };

    const handleNext = () => {
        if (currentQ < dummyData.length - 1) setCurrentQ(currentQ + 1);
    };

    const handlePrev = () => {
        if (currentQ > 0) setCurrentQ(currentQ - 1);
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
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-lg flex flex-col min-h-screen">
            {/* Timer & Controls */}
            <div className="flex justify-between items-center mb-6 gap-20">
                <div className="text-lg font-semibold text-gray-700">
                    Time Left:{" "}
                    <span className={`${timeLeft <= 10 ? "text-red-600" : "text-green-600"}`}>
                        {timeLeft}s
                    </span>
                </div>
                <div className="flex" >
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
                        onClick={() => setShowResult(true)}
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

            {/* ProgressChart at bottom */}
            <div className="mt-auto">
                <ProgressChart />
            </div>

            {/* Result Modal */}
            {showResult && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-lg max-w-md w-full shadow-lg relative animate-fadeIn">
                        <h3 className="text-2xl font-bold mb-4 text-gray-700">Quiz Results</h3>
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
