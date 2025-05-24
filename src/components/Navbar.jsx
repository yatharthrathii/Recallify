import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const Navbar = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const location = useLocation();

    const navItems = [
        { name: "Home", path: "/" },
        { name: "Create", path: "/create" },
        { name: "Quiz", path: "/quiz" },
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <nav className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md fixed z-10">
            <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                <div className="text-2xl font-bold tracking-wide cursor-pointer hover:scale-105 transition-transform">
                    Recallify 🧠
                </div>

                {/* Desktop Menu */}
                <div className="hidden md:flex gap-8 text-lg font-medium items-center">
                    {navItems.map((item) => (
                        <Link
                            key={item.name}
                            to={item.path}
                            className={`relative group cursor-pointer ${
                                isActive(item.path) ? "text-amber-300" : ""
                            }`}
                        >
                            <span
                                className={`transition ${
                                    isActive(item.path) ? "text-amber-300" : "group-hover:text-amber-300"
                                }`}
                            >
                                {item.name}
                            </span>
                            <span
                                className={`absolute left-0 -bottom-1 h-0.5 bg-amber-300 transition-all ${
                                    isActive(item.path) ? "w-full" : "w-0 group-hover:w-full"
                                }`}
                            ></span>
                        </Link>
                    ))}
                </div>

                {/* Hamburger Icon */}
                <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="md:hidden text-white focus:outline-none"
                >
                    {menuOpen ? <X size={28} /> : <Menu size={28} />}
                </button>
            </div>

            {/* Mobile Menu */}
            {menuOpen && (
                <div className="md:hidden flex flex-col gap-4 px-6 pb-6 text-lg font-medium animate-fade-in">
                    {navItems.map((item) => (
                        <Link
                            key={item.name}
                            to={item.path}
                            onClick={() => setMenuOpen(false)}
                            className={`transition cursor-pointer ${
                                isActive(item.path) ? "text-amber-300" : "hover:text-amber-300"
                            }`}
                        >
                            {item.name}
                        </Link>
                    ))}
                </div>
            )}
        </nav>
    );
};

export default Navbar;
