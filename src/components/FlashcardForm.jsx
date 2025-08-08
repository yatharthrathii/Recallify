import { useState } from "react";
import toast from "react-hot-toast";
import { useFlashcard } from "./context/FlashcardContext";

const FlashcardForm = () => {
    const [addQuestion, setAddQuestion] = useState("");
    const [addAnswer, setAddAnswer] = useState("");

    const { addFlashcard } = useFlashcard();

    const AddFormHandler = () => {
        if (addQuestion.trim() === "" || addAnswer.trim() === "") {
            toast.error("Please fill out both fields!");
            return;
        }

        toast.success("Flashcard added!");
        addFlashcard(addQuestion, addAnswer);
        setAddQuestion("");
        setAddAnswer("");
    };

    return (
        <div className="max-w-md mx-auto mt-10 bg-white shadow-xl rounded-2xl p-6 border border-purple-100 animate-fade-in">
            <h2 className="text-2xl font-bold text-center text-gray-600 mb-4">Create a Flashcard</h2>

            <input
                className="border border-gray-300 rounded-lg p-3 mb-3 w-full focus:outline-none focus:ring-2 focus:ring-gray-500 bg-gray-50 transition"
                placeholder="Enter your question"
                type="text"
                value={addQuestion}
                onChange={(e) => setAddQuestion(e.target.value)}
            />
            <input
                className="border border-gray-300 rounded-lg p-3 mb-4 w-full focus:outline-none focus:ring-2 focus:ring-gray-500 bg-gray-50 transition"
                placeholder="Enter the answer"
                type="text"
                value={addAnswer}
                onChange={(e) => setAddAnswer(e.target.value)}
            />
            <button
                className="bg-gray-500 text-white font-semibold py-2 w-full rounded-lg hover:bg-gray-600 transition duration-200 shadow-md"
                onClick={AddFormHandler}
            >
                Add Flashcard
            </button>
        </div>
    );
};

export default FlashcardForm;
