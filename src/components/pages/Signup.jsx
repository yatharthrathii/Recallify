import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    const res = await signup(email, password);

    if (res.error) {
      toast.error(res.error.message);
    } else {
      toast.success("Account created");
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-gray-800 px-4">
      <div className="bg-gray-900/80 backdrop-blur-xl w-full max-w-md p-8 rounded-2xl shadow-2xl border border-gray-800 text-center">
        <h2 className="text-4xl font-extrabold text-white mb-2 tracking-tighter">
          Create Account
        </h2>
        <p className="text-gray-400 mb-8 tracking-tighter">Join us and get started</p>

        <form onSubmit={handleSignup} className="space-y-5">
          <input
            type="email"
            placeholder="Email Address"
            className="w-full p-3 rounded-lg bg-gray-800/60 text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 rounded-lg bg-gray-800/60 text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            className="w-full p-3 rounded-lg bg-gradient-to-r from-gray-700 to-gray-600 text-white font-semibold tracking-wide hover:from-gray-600 hover:to-gray-500 transition-all shadow-md"
          >
            Signup
          </button>
        </form>

        <p className="text-sm text-gray-400 mt-6">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-gray-200 hover:text-gray-300 transition"
          >
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
