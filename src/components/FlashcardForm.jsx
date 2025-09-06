import { useState } from "react";
import toast from "react-hot-toast";
import { useFlashcard } from "./context/FlashcardContext";

const FlashcardForm = () => {
    const [addQuestion, setAddQuestion] = useState("");
    const [addAnswer, setAddAnswer] = useState("");
    const [loading, setLoading] = useState(false);

    const { addCard } = useFlashcard();

    // -------- Manual Add Flashcard --------
    const AddFormHandler = async () => {
        if (addQuestion.trim() === "" || addAnswer.trim() === "") {
            toast.error("Please fill out both fields!");
            return;
        }

        await addCard(addQuestion, addAnswer);
        toast.success("Flashcard added!");

        setAddQuestion("");
        setAddAnswer("");
    };

    // -------- AI Generate Flashcard --------
    const generateWithAI = async () => {
        if (!addQuestion.trim()) {
            toast.error("Please enter a topic/question first!");
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
                    "X-Title": "Recallify Flashcard",
                },
                body: JSON.stringify({
                    model: "deepseek/deepseek-chat-v3.1:free",
                    messages: [
                        {
                            role: "user",
                            content: `Generate one flashcard for this topic: "${addQuestion}". 
Return only in valid JSON format like this:
{
  "question": "string",
  "answer": "string"
}`,
                        },
                    ],
                }),
            });

            const data = await res.json();
            console.log("AI raw response:", data);

            let text = data?.choices?.[0]?.message?.content || "";

            // -------- Clean AI response --------
            text = text.trim();
            if (text.startsWith("```")) {
                text = text.replace(/```json|```/g, "").trim();
            }
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                text = match[0];
            }

            let flashcard;
            try {
                flashcard = JSON.parse(text);
            } catch (err) {
                console.error("JSON parse failed:", err, "Raw text:", text);
                toast.error("AI returned invalid data!");
                setLoading(false);
                return;
            }

            await addCard(flashcard.question, flashcard.answer);
            toast.success("AI Flashcard added!");

            setAddQuestion("");
            setAddAnswer("");
        } catch (err) {
            console.error("Error generating flashcard:", err);
            toast.error("Failed to generate flashcard!");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto mt-10 bg-white shadow-xl rounded-2xl p-6 border border-purple-100 animate-fade-in">
            <h2 className="text-2xl font-bold text-center text-gray-600 mb-4">
                Create a Flashcard
            </h2>

            {/* Question */}
            <input
                className="border border-gray-300 rounded-lg p-3 mb-3 w-full focus:outline-none focus:ring-2 focus:ring-gray-500 bg-gray-50 transition"
                placeholder="Enter your question or topic"
                type="text"
                value={addQuestion}
                onChange={(e) => setAddQuestion(e.target.value)}
            />

            {/* Answer (only for manual entry) */}
            <input
                className="border border-gray-300 rounded-lg p-3 mb-4 w-full focus:outline-none focus:ring-2 focus:ring-gray-500 bg-gray-50 transition"
                placeholder="Enter the answer"
                type="text"
                value={addAnswer}
                onChange={(e) => setAddAnswer(e.target.value)}
            />

            {/* Manual Add Button */}
            <button
                type="button"
                className="bg-gray-500 text-white font-semibold py-2 w-full rounded-lg hover:bg-gray-600 transition duration-200 shadow-md mb-3"
                onClick={AddFormHandler}
            >
                Add Flashcard
            </button>

            {/* AI Generate Button */}
            <button
                type="button"
                className="bg-gray-600 text-white font-semibold py-2 w-full cursor-pointer rounded-lg hover:bg-gray-700 transition duration-200 shadow-md"
                onClick={generateWithAI}
                disabled={loading}
            >
                {loading ? "Generating with AI..." : "Generate with AI"}
            </button>
        </div>
    );
};

export default FlashcardForm;
