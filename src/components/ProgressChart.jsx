import { useEffect, useState } from "react";
import { useStats } from "./context/StatsContext";

const ProgressChart = () => {
    const { stats } = useStats();
    const [animate, setAnimate] = useState(false);

    const data = stats?.history
        ? [...stats.history].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-7)
        : [];

    const maxCount = data.length > 0 ? Math.max(...data.map(d => d.xp)) : 0;

    useEffect(() => {
        const timer = setTimeout(() => setAnimate(true), 100);
        return () => clearTimeout(timer);
    }, []);

    if (!data || data.length === 0) return null;

    return (
        <div className="w-full max-w-5xl mx-auto px-4 py-16 bg-white">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-gray-700">
                Your XP Activity
            </h2>

            <div className="flex justify-between items-end h-64 w-full pt-6">
                {data.map((item, idx) => {
                    const heightPercent = maxCount > 0 ? (item.xp / maxCount) * 100 : 0;

                    return (
                        <div key={idx} className="flex flex-col items-center w-full">
                            <div className="relative w-10 h-48 flex items-end justify-center group">
                                <div
                                    className="w-full bg-blue-500 rounded-t-md group-hover:bg-blue-400"
                                    style={{
                                        height: animate ? `${heightPercent}%` : "0%",
                                        transition: "height 0.7s ease-out",
                                        transitionDelay: `${idx * 150}ms`,
                                    }}
                                >
                                    <div className="absolute -top-8 text-xs text-white bg-gray-800 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition duration-300">
                                        {item.xp} XP
                                    </div>
                                </div>
                            </div>
                            <span className="mt-3 text-sm text-gray-600">
                                {new Date(item.date).toLocaleDateString("en-US", { weekday: 'short' })}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ProgressChart;
