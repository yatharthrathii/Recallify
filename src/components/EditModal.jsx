import { useState, useEffect } from "react";

const EditModal = ({ question, answer, onClose, onSave }) => {
    const [editedQuestion, setEditedQuestion] = useState(question);
    const [editedAnswer, setEditedAnswer] = useState(answer);

    useEffect(() => {
        setEditedQuestion(question);
        setEditedAnswer(answer);
    }, [question, answer]);

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Edit Flashcard</h2>

                <input
                    type="text"
                    value={editedQuestion}
                    onChange={(e) => setEditedQuestion(e.target.value)}
                    placeholder="Edit Question"
                    className="w-full border border-gray-300 rounded-lg p-2 mb-4"
                />

                <textarea
                    value={editedAnswer}
                    onChange={(e) => setEditedAnswer(e.target.value)}
                    placeholder="Edit Answer"
                    className="w-full border border-gray-300 rounded-lg p-2 mb-4"
                    rows={4}
                />

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(editedQuestion, editedAnswer)}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditModal;
