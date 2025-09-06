import { useState, useContext, useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext } from "./context/AuthContext";

const Navbar = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const location = useLocation();
    const { user, logout } = useContext(AuthContext);

    const profileRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                profileRef.current &&
                !profileRef.current.contains(event.target)
            ) {
                setProfileOpen(false);
            }
        };

        if (profileOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [profileOpen]);

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
                                className={`transition ${isActive(item.path)
                                    ? "text-gray-100"
                                    : "group-hover:text-gray-200"
                                    }`}
                            >
                                {item.name}
                            </span>
                            <span
                                className={`absolute left-0 -bottom-1 h-0.5 bg-gray-300 transition-all ${isActive(item.path)
                                    ? "w-full"
                                    : "w-0 group-hover:w-full"
                                    }`}
                            ></span>
                        </Link>
                    ))}

                    {/* Auth Links */}
                    {!user ? (
                        <Link
                            to="/login"
                            className={`relative group cursor-pointer ${isActive("/login") ? "text-gray-100" : "text-gray-400"
                                }`}
                        >
                            <span
                                className={`transition ${isActive("/login")
                                    ? "text-gray-100"
                                    : "group-hover:text-gray-200"
                                    }`}
                            >
                                Login
                            </span>
                            <span
                                className={`absolute left-0 -bottom-1 h-0.5 bg-gray-300 transition-all ${isActive("/login")
                                    ? "w-full"
                                    : "w-0 group-hover:w-full"
                                    }`}
                            ></span>
                        </Link>
                    ) : (
                        <div className="relative" ref={profileRef}>
                            <button
                                onClick={() => setProfileOpen(!profileOpen)}
                                className="relative group cursor-pointer text-gray-400 hover:text-gray-200"
                            >
                                Profile
                                <span
                                    className={`absolute left-0 -bottom-1 h-0.5 bg-gray-300 transition-all ${profileOpen ? "w-full" : "w-0 group-hover:w-full"
                                        }`}
                                ></span>
                            </button>

                            {profileOpen && (
                                <div className="absolute text-sm right-0 mt-3 w-40 bg-gradient-to-b from-gray-800 to-gray-700 text-gray-200 rounded-lg shadow-lg border border-gray-700 py-2">
                                    <Link
                                        to="/profile"
                                        className="block px-4 py-2 hover:bg-gray-700 rounded-md"
                                        onClick={() => setProfileOpen(false)}
                                    >
                                        My Profile
                                    </Link>
                                    <div className="h-px bg-gray-600 my-2"></div>
                                    <button
                                        onClick={() => {
                                            logout();
                                            setProfileOpen(false);
                                        }}
                                        className="block w-full text-left px-4 py-2 cursor-pointer hover:bg-gray-700 rounded-md"
                                    >
                                        Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
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
                            className={`transition cursor-pointer ${isActive(item.path)
                                ? "text-gray-100"
                                : "hover:text-gray-200"
                                }`}
                        >
                            {item.name}
                        </Link>
                    ))}

                    {/* Auth in Mobile */}
                    {!user ? (
                        <Link
                            to="/login"
                            onClick={() => setMenuOpen(false)}
                            className={`transition cursor-pointer ${isActive("/login")
                                ? "text-gray-100"
                                : "hover:text-gray-200"
                                }`}
                        >
                            Login
                        </Link>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <Link
                                to="/profile"
                                onClick={() => setMenuOpen(false)}
                                className="transition cursor-pointer hover:text-gray-200 text-gray-400"
                            >
                                My Profile
                            </Link>
                            <button
                                onClick={() => {
                                    logout();
                                    setMenuOpen(false);
                                }}
                                className="transition cursor-pointer hover:text-gray-200 text-left text-gray-400"
                            >
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            )}
        </nav>
    );
};

export default Navbar;
