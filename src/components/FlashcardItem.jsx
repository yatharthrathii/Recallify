import { useState } from "react";
import { useFlashcard } from "./context/FlashcardContext";
import EditModal from "./EditModal";

const FlashcardItem = ({ card }) => {
    const [flipped, setFlipped] = useState(false);
    const { deleteFlashcard, editFlashcard } = useFlashcard();

    // For showing/hiding edit popup
    const [showModal, setShowModal] = useState(false);

    // Function to handle modal save (edit)
    const handleEditSave = (updatedQuestion, updatedAnswer) => {
        editFlashcard(card.id, updatedQuestion, updatedAnswer);
        setShowModal(false);
    };

    return (
        <>
            <div
                className="w-full h-64 sm:h-72 perspective cursor-pointer"
                onClick={() => setFlipped(!flipped)}
            >
                <div
                    className={`relative w-full h-full transition-transform duration-700 ease-in-out preserve-3d ${flipped ? "rotate-y-180" : ""
                        }`}
                >
                    {/* Front (Question) */}
                    <div className="absolute w-full h-full backface-hidden bg-indigo-500 text-white p-4 rounded-xl shadow-lg flex items-center justify-center text-lg sm:text-xl font-semibold text-center">
                        {card.question}
                    </div>

                    {/* Back (Answer) */}
                    <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-purple-500 text-white p-4 rounded-xl shadow-lg flex flex-col items-center justify-center text-center">
                        <p className="text-lg sm:text-xl font-semibold mb-4">{card.answer}</p>

                        <div className="flex gap-4 justify-center mt-4">
                            {/* Delete Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteFlashcard(card.id);
                                }}
                                className="relative inline-flex items-center justify-center px-5 py-2 overflow-hidden font-semibold text-white transition duration-300 ease-out bg-gradient-to-r from-pink-500 to-red-500 rounded-lg shadow-md hover:scale-105 hover:shadow-lg"
                            >
                                🗑 Delete
                            </button>

                            {/* Edit Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation(); // stop flip on edit click
                                    setShowModal(true); // show modal
                                }}
                                className="relative inline-flex items-center justify-center px-5 py-2 overflow-hidden font-semibold text-white transition duration-300 ease-out bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-lg shadow-md hover:scale-105 hover:shadow-lg"
                            >
                                ✏️ Edit
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Modal popup */}
            {showModal && (
                <EditModal
                    question={card.question}
                    answer={card.answer}
                    onClose={() => setShowModal(false)}
                    onSave={handleEditSave}
                />
            )}
        </>
    );
};

export default FlashcardItem;
