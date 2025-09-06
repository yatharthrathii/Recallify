import FlashcardForm from "../FlashcardForm";
import FlashcardList from "../FlashcardList";

const Create = () => {
    return (
        <div className="mt-24">
            <div className="px-2">
                <FlashcardForm/>
            </div>
            <FlashcardList />
        </div>
    );
};

export default Create;