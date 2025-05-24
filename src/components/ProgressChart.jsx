import { useEffect, useState } from "react";

const ProgressChart = () => {
    const data = [
        { day: "Mon", count: 2 },
        { day: "Tue", count: 5 },
        { day: "Wed", count: 3 },
        { day: "Thu", count: 8 },
        { day: "Fri", count: 4 },
        { day: "Sat", count: 6 },
        { day: "Sun", count: 1 },
    ];

    const maxCount = Math.max(...data.map(d => d.count));
    const [animate, setAnimate] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setAnimate(true);
        }, 100); // slight delay to trigger transition smoothly
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="w-full max-w-5xl mx-auto px-4 py-16 bg-white">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-gray-700">
                Your Flashcard Activity
            </h2>

            <div className="flex justify-between items-end h-64 w-full pt-6">
                {data.map((item, idx) => {
                    const heightPercent = (item.count / maxCount) * 100;

                    return (
                        <div key={idx} className="flex flex-col items-center w-full">
                            <div className="relative w-10 h-48 flex items-end justify-center group">
                                <div
                                    className="w-full bg-indigo-600 rounded-t-md group-hover:bg-indigo-400"
                                    style={{
                                        height: animate ? `${heightPercent}%` : "0%",
                                        transition: "height 0.7s ease-out",
                                        transitionDelay: `${idx * 150}ms`, // delay between bars
                                    }}
                                >
                                    {/* Tooltip */}
                                    <div className="absolute -top-8 text-xs text-white bg-gray-800 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition duration-300">
                                        {item.count} cards
                                    </div>
                                </div>
                            </div>
                            <span className="mt-3 text-sm text-gray-600">{item.day}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ProgressChart;
