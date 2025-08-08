import { Link } from "react-router-dom";

export default function HomeBody() {

    const features = [
        { title: "Smart Repetition", desc: "Uses spaced repetition logic to boost long-term memory." },
        { title: "Clean UI", desc: "Minimal, modern, and distraction-free flashcard experience." },
        { title: "Offline First", desc: "All your cards saved in local storage. No internet needed." },
        { title: "Fast & Lightweight", desc: "Optimized to load quickly and run smoothly on any device." },
        { title: "Privacy Focused", desc: "Your data stays on your device — no tracking or ads." },
        { title: "Customizable", desc: "Adjust themes, fonts, and layouts to your liking (coming soon!)." },
    ];

    return (
        <main className="flex flex-col items-center text-gray-300 bg-black px-6 pb-20 min-h-screen">

            {/*Hero Section */}
            <section className="text-center max-w-4xl mt-28">
                <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 leading-tight">
                    Supercharge Your Memory with{" "}
                    <span
                        className="text-gray-500 drop-shadow-[0_0_15px_rgba(200,200,200,0.2)]"
                    >
                        Recallify
                    </span>
                </h1>
                <p className="text-lg text-gray-400 mb-8">
                    The ultimate flashcard tool powered by intelligent design. Learn faster, retain longer.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Link
                        to="/create"
                        className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl transition duration-300 text-lg font-semibold text-gray-200 shadow-lg shadow-black/30"
                    >
                        Get Started
                    </Link>
                    <button className="px-6 py-3 border border-gray-500 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-xl transition duration-300 text-lg font-semibold">
                        Learn More
                    </button>
                </div>
            </section>

            {/* Features Section */}
            <section className="mt-32 w-full max-w-6xl px-4 grid grid-cols-1 sm:grid-cols-3 gap-8">
                {features.map((feature, idx) => (
                    <div
                        key={idx}
                        className="bg-gradient-to-br from-black/80 to-gray-900/80 backdrop-blur-lg border border-gray-700 rounded-xl p-6 text-center transition transform hover:scale-105 duration-500 shadow-lg hover:shadow-gray-500/20"
                    >
                        <h3 className="text-xl font-bold mb-2 text-gray-200">{feature.title}</h3>
                        <p className="text-gray-400">{feature.desc}</p>
                    </div>
                ))}
            </section>

            {/*Explanation Section */}
            <section className="mt-32 max-w-4xl text-center">
                <h2 className="text-3xl font-bold mb-6 text-gray-200">What Recallify Does &amp; Future Plans</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-left">
                    <div className="bg-gradient-to-br from-black/80 to-gray-900/80 p-6 rounded-xl backdrop-blur-lg border border-gray-700 transition hover:scale-[1.02] duration-300 hover:shadow-gray-500/20">
                        <h3 className="text-xl font-semibold mb-2 text-gray-300">Core Features</h3>
                        <ul className="list-disc pl-5 text-gray-400 space-y-2">
                            <li>Create, edit, and delete flashcards easily</li>
                            <li>Flip animations to test yourself</li>
                            <li>Persistent storage via LocalStorage</li>
                            <li>Stylish and intuitive interface</li>
                        </ul>
                    </div>
                    <div className="bg-gradient-to-br from-black/80 to-gray-900/80 p-6 rounded-xl backdrop-blur-lg border border-gray-700 transition hover:scale-[1.02] duration-300 hover:shadow-gray-500/20">
                        <h3 className="text-xl font-semibold mb-2 text-gray-300">Coming Soon</h3>
                        <ul className="list-disc pl-5 text-gray-400 space-y-2">
                            <li>Account login and sync across devices</li>
                            <li>AI-powered flashcard suggestions</li>
                            <li>Notifications & reminders</li>
                            <li>Custom themes and layouts</li>
                        </ul>
                    </div>
                </div>
            </section>
        </main>
    );
}
