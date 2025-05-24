import { useState } from "react";

const EditModal = ({ question, answer, onClose, onSave }) => {
    const [editedQuestion, setEditedQuestion] = useState(question);
    const [editedAnswer, setEditedAnswer] = useState(answer);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editedQuestion.trim() === "" || editedAnswer.trim() === "") return;
        onSave(editedQuestion, editedAnswer);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-11/12 max-w-md animate-fade-in">
                <h3 className="text-xl font-bold mb-4 text-indigo-700">Edit Flashcard</h3>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <input
                        type="text"
                        value={editedQuestion}
                        onChange={(e) => setEditedQuestion(e.target.value)}
                        placeholder="Edit question"
                        className="border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                        type="text"
                        value={editedAnswer}
                        onChange={(e) => setEditedAnswer(e.target.value)}
                        placeholder="Edit answer"
                        className="border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                    <div className="flex justify-end gap-4 mt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-md bg-gray-300 hover:bg-gray-400 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition"
                        >
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditModal;
