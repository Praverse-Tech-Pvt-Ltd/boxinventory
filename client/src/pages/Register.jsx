import { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import { registerUser } from "../services/authService";
import { setCredentials } from "../redux/authSlice";
import { FaArrowLeft } from "react-icons/fa";
import { motion } from "framer-motion";
import { FiEye, FiEyeOff } from "react-icons/fi";

const Register = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await registerUser(formData);
      dispatch(setCredentials(res));
      navigate("/");
    } catch (error) {
      alert(error.response?.data?.message || "Registration failed");
    }
  };

  return (
    <section className="min-h-screen w-full bg-gradient-to-br from-[#FFF6F0] to-[#EAF2F8] flex items-center justify-center px-4 py-10 text-[#4B2E2E] outfit relative overflow-hidden">
      {/* Back Button */}
      <motion.div
        className="absolute top-6 left-6"
        initial={{ x: -30, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-[#4B2E2E] hover:text-[#8A2C02] hover:underline transition"
        >
          <FaArrowLeft />
          <span className="text-sm font-medium">Back to Home</span>
        </button>
      </motion.div>

      {/* Registration Card */}
      <motion.div
        className="w-full max-w-md bg-white/80 backdrop-blur-xl p-8 rounded-2xl shadow-lg border border-pink-100"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <motion.h2
          className="text-3xl font-bold text-center text-pink-700 mb-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          ✨ Create Your Account
        </motion.h2>

        <motion.p
          className="text-center text-sm mb-6 text-gray-600"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Join <span className="font-semibold">Eraya RATNA</span> and discover
          the divine within you 💫
        </motion.p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <motion.div
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            <label className="block mb-1 text-sm font-medium">Full Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              placeholder="Your Name"
              required
            />
          </motion.div>

          <motion.div
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.45 }}
          >
            <label className="block mb-1 text-sm font-medium">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              placeholder="you@example.com"
              required
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.45 }}
          >
            <label className="block mb-1 text-sm font-medium">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-2 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute top-1/2 right-3 transform -translate-y-1/2 text-pink-600 hover:text-pink-800 transition"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
              </button>
            </div>
          </motion.div>

          <motion.button
            type="submit"
            className="w-full bg-pink-600 text-white py-2 rounded-lg hover:bg-pink-700 transition"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            Register
          </motion.button>
        </form>

        <motion.p
          className="mt-4 text-center text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-pink-600 hover:underline font-medium"
          >
            Login here
          </Link>
        </motion.p>

        <motion.p
          className="mt-6 text-center italic text-sm text-[#5D3A00]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          “As you take your first step with us, may you walk the path of light,
          peace, and prosperity.” 🧘‍♀️
        </motion.p>
      </motion.div>
    </section>
  );
};

export default Register;
