import { FaLinkedin, FaInstagram, FaTwitter, FaGithub } from "react-icons/fa";

const Footer = () => {
    return (
        <footer className="bg-gradient-to-r from-black via-gray-900 to-gray-900 text-gray-400 py-8 px-6">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">

                {/* Left Text */}
                <div className="text-center md:text-left">
                    <h2 className="text-xl font-semibold text-white mb-2">Recallify</h2>
                    <p className="text-sm max-w-sm">
                        Empowering your memory with AI-driven flashcards. Build smarter, revise faster, remember longer.
                    </p>
                    <p className="text-xs mt-2 text-gray-400">© 2025 Recallify. All rights reserved.</p>
                </div>

                {/* Social Links */}
                <div className="flex space-x-6 text-2xl">
                    <a
                        href="https://www.linkedin.com/in/yatharthrathii" // Change to your actual LinkedIn URL
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="LinkedIn"
                        className="hover:text-blue-500 transition"
                    >
                        <FaLinkedin />
                    </a>
                    <a
                        href="https://www.instagram.com/yatharthrathii/#" // Change to your actual Instagram URL
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Instagram"
                        className="hover:text-pink-500 transition"
                    >
                        <FaInstagram />
                    </a>
                    <a
                        href="https://x.com/yatharthrathiii?t=_HYFcs11Ml-xpPY1XeyC_Q&s=09" // Change to your actual X/Twitter URL
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="X Twitter"
                        className="hover:text-sky-400 transition"
                    >
                        <FaTwitter />
                    </a>
                    <a
                        href="https://github.com/yatharthrathii/yatharthrathii" // Change to your actual GitHub URL
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="GitHub"
                        className="hover:text-gray-400 transition"
                    >
                        <FaGithub />
                    </a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
