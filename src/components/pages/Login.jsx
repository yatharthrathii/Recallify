import { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../firebase/firebase";
import { AuthContext } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { loginUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await login(email, password);

    if (res.error) {
      toast.error(res.error.message);
    } else {
      loginUser(res);
      toast.success("Login successful");
      navigate("/");
    }
  };

  const handleGuestLogin = async () => {
    try {
      const res = await login("guest@sutramail.com", "123456");
      if (res.error) {
        toast.error("Guest login failed");
      } else {
        loginUser(res);
        toast.success("Logged in as Guest");
        navigate("/");
      }
    } catch (error) {
      toast.error("Something went wrong with guest login", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-gray-800 px-4">
      <div className="bg-gray-900/80 backdrop-blur-xl w-full max-w-md p-8 rounded-2xl shadow-2xl border border-gray-800 text-center">
        <h2 className="text-4xl font-extrabold text-white mb-2 tracking-tighter">
          Welcome Back
        </h2>
        <p className="text-gray-400 mb-8 tracking-tighter">Login to continue</p>

        <form onSubmit={handleLogin} className="space-y-5">
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
            className="w-full p-3 rounded-lg bg-gradient-to-r from-gray-800 to-gray-700 text-white font-semibold tracking-wide cursor-pointer hover:from-gray-700 hover:to-gray-600 transition-all shadow-md"
          >
            Login
          </button>
        </form>

        {/* Forgot Password Link */}
        <div className="mt-6 space-y-3">
          <p className="text-sm text-gray-400 mt-6">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="font-medium text-gray-200 hover:text-gray-300 transition"
            >
              Create New
            </Link>
          </p>

          {/* Login as Guest */}
          <button
            onClick={handleGuestLogin}
            className="text-sm text-gray-400 hover:text-gray-200 transition cursor-pointer"
          >
            Login as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
