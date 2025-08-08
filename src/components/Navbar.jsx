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
        <nav className="w-full bg-gradient-to-r from-black/100 via-gray-1000/50 to-gray-800/80 backdrop-blur-lg text-gray-300 shadow-lg fixed z-10 border-b border-gray-700">
            <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                {/* Logo */}
                <div className="text-2xl font-extrabold tracking-wide cursor-pointer hover:scale-105 transition-transform text-gray-200">
                    <Link to="/">Recallify</Link>
                </div>

                {/* Desktop Menu */}
                <div className="hidden md:flex gap-8 text-lg font-medium items-center">
                    {navItems.map((item) => (
                        <Link
                            key={item.name}
                            to={item.path}
                            className={`relative group cursor-pointer ${isActive(item.path) ? "text-gray-100" : "text-gray-400"
                                }`}
                        >
                            <span
                                className={`transition ${isActive(item.path) ? "text-gray-100" : "group-hover:text-gray-200"
                                    }`}
                            >
                                {item.name}
                            </span>
                            <span
                                className={`absolute left-0 -bottom-1 h-0.5 bg-gray-300 transition-all ${isActive(item.path) ? "w-full" : "w-0 group-hover:w-full"
                                    }`}
                            ></span>
                        </Link>
                    ))}
                </div>

                {/* Hamburger Icon */}
                <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="md:hidden text-gray-300 focus:outline-none"
                >
                    {menuOpen ? <X size={28} /> : <Menu size={28} />}
                </button>
            </div>

            {/* Mobile Menu */}
            {menuOpen && (
                <div className="md:hidden py-3 flex flex-col gap-4 px-6 pb-6 text-lg font-medium animate-fade-in bg-gradient-to-b from-black/90 via-gray-900/90 to-gray-800/90 backdrop-blur-lg border-t border-gray-700/40">
                    {navItems.map((item) => (
                        <Link
                            key={item.name}
                            to={item.path}
                            onClick={() => setMenuOpen(false)}
                            className={`transition cursor-pointer ${isActive(item.path) ? "text-gray-100" : "hover:text-gray-200"
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
