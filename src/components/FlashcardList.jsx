import { useFlashcard } from "./context/FlashcardContext";
import FlashcardItem from "./FlashcardItem";

const FlashcardList = () => {
    const { flashcards } = useFlashcard();

    return (
        <div className="max-w-6xl mx-auto px-4 py-10">
            <div className="text-center mb-8">
                {flashcards.length === 0 ? (
                    <p className="text-gray-500 text-lg transition-opacity duration-700 ease-in-out">
                        No flashcards yet!
                    </p>
                ) : (
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-600">
                        Your Flashcards
                    </h2>
                )}
            </div>

            {flashcards.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {flashcards.map((card, index) => (
                        <FlashcardItem key={index} card={card} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default FlashcardList;
