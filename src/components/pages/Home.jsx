import { useEffect, useState } from "react";
import { Link } from "react-router";

export default function HomeBody() {
    const [glow, setGlow] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => setGlow((g) => !g), 1500);
        return () => clearInterval(interval);
    }, []);

    return (
        <main className="flex flex-col items-center text-white bg-gradient-to-br from-purple-900 via-indigo-900 to-indigo-800 px-6 pb-20">

            {/* 🚀 Hero Section */}
            <section className="text-center max-w-4xl mt-20">
                <h1 className={`text-4xl sm:text-5xl font-extrabold mb-4 leading-tight transition-colors`}>
                    Supercharge Your Memory with{" "}
                    <span
                        className={`text-4xl sm:text-5xl font-extrabold mb-4 leading-tight transition-colors duration-1000 ${glow
                            ? "text-purple-400 drop-shadow-[0_0_10px_rgba(167,139,250,0.8)]"
                            : "text-purple-300"
                            }`}
                    >
                        Recallify
                    </span>
                </h1>
                <p className="text-lg text-gray-300 mb-8">
                    The ultimate flashcard tool powered by intelligent design. Learn faster, retain longer.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl transition duration-300 text-lg font-semibold">
                        <Link to="/create">Get Started</Link>
                    </button>
                    <button className="px-6 py-3 border border-white hover:bg-white hover:text-indigo-800 rounded-xl transition duration-300 text-lg font-semibold">
                        Learn More
                    </button>
                </div>
            </section>

            {/* 🌟 Features Section */}
            <section className="mt-32 w-full max-w-6xl px-4 grid grid-cols-1 sm:grid-cols-3 gap-8">
                {[
                    {
                        title: "Smart Repetition",
                        desc: "Uses spaced repetition logic to boost long-term memory.",
                    },
                    {
                        title: "Clean UI",
                        desc: "Minimal, modern, and distraction-free flashcard experience.",
                    },
                    {
                        title: "Offline First",
                        desc: "All your cards saved in local storage. No internet needed.",
                    },
                    {
                        title: "Fast & Lightweight",
                        desc: "Optimized to load quickly and run smoothly on any device.",
                    },
                    {
                        title: "Privacy Focused",
                        desc: "Your data stays on your device — no tracking or ads.",
                    },
                    {
                        title: "Customizable",
                        desc: "Adjust themes, fonts, and layouts to your liking (coming soon!).",
                    },
                ].map((feature, idx) => (
                    <div
                        key={idx}
                        className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 text-center transition transform hover:scale-105 duration-500 shadow-lg"
                    >
                        <h3 className="text-xl font-bold mb-2 text-purple-200">{feature.title}</h3>
                        <p className="text-gray-300">{feature.desc}</p>
                    </div>
                ))}
            </section>

            {/* 📘 Explanation Section */}
            <section className="mt-32 max-w-4xl text-center">
                <h2 className="text-3xl font-bold mb-6">What Recallify Does &amp; Future Plans</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-left">
                    <div className="bg-white/10 p-6 rounded-xl backdrop-blur-md border border-white/20 transition hover:scale-[1.02] duration-300">
                        <h3 className="text-xl font-semibold mb-2 text-green-300">✅ Core Features</h3>
                        <ul className="list-disc pl-5 text-gray-300 space-y-2">
                            <li>Create, edit, and delete flashcards easily</li>
                            <li>Flip animations to test yourself</li>
                            <li>Persistent storage via LocalStorage</li>
                            <li>Stylish and intuitive interface</li>
                        </ul>
                    </div>
                    <div className="bg-white/10 p-6 rounded-xl backdrop-blur-md border border-white/20 transition hover:scale-[1.02] duration-300">
                        <h3 className="text-xl font-semibold mb-2 text-yellow-300">🌟 Coming Soon</h3>
                        <ul className="list-disc pl-5 text-gray-300 space-y-2">
                            <li>Account login and sync across devices</li>
                            <li>AI-powered flashcard suggestions</li>
                            <li>Notifications & reminders</li>
                            <li>Custom themes and layouts</li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* 📊 Progress Tracking Section */}
            <section className="mt-32 max-w-4xl text-center">
                <h2 className="text-3xl font-bold mb-6 text-emerald-300">Track Your Progress</h2>
                <p className="text-gray-300 text-lg mb-6">
                    Visualize your learning journey with detailed progress charts. Keep track of how many flashcards you've mastered, and stay motivated!
                </p>
                <div className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 text-left shadow-lg">
                    <ul className="list-disc pl-5 text-gray-300 space-y-2">
                        <li>View your daily, weekly, and total flashcard activity</li>
                        <li>Charts update automatically as you study</li>
                        <li>Helps identify weak areas and improve efficiency</li>
                    </ul>
                </div>
            </section>

            {/* 🧪 Quiz Mode Section */}
            <section className="mt-32 max-w-4xl text-center">
                <h2 className="text-3xl font-bold mb-6 text-pink-300">Interactive Quiz Mode</h2>
                <p className="text-gray-300 text-lg mb-6">
                    Ready to test your knowledge? Enter quiz mode to challenge yourself with MCQs based on your flashcards.
                </p>
                <div className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 text-left shadow-lg">
                    <ul className="list-disc pl-5 text-gray-300 space-y-2">
                        <li>Multiple-choice questions auto-generated from your flashcards</li>
                        <li>Instant feedback on right/wrong answers</li>
                        <li>Perfect for revision and self-assessment</li>
                    </ul>
                </div>
            </section>

            {/* 🧠 Bonus Section: Why Recallify? */}
            <section className="mt-32 max-w-5xl px-6 text-center">
                <h2 className="text-3xl font-bold mb-6 text-purple-300">Why Choose Recallify?</h2>
                <p className="text-gray-300 max-w-3xl mx-auto text-lg leading-relaxed">
                    Recallify is designed for learners who want a no-nonsense, distraction-free, and powerful flashcard tool.
                    Unlike bulky apps with confusing features, Recallify keeps it simple, fast, and secure.
                    Whether you're a student, professional, or lifelong learner, Recallify helps you memorize efficiently without compromise.
                </p>
            </section>
        </main>
    );
}
