import React, { useState } from "react";
import { FiMail, FiLock } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../config/Api";

export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.email || !form.password) {
      toast.error("Please fill all fields");
      return;
    }

    try {
      setLoading(true);

      const res = await api.post("/api/auth/login", form);

      // store JWT
      localStorage.setItem("token", res.data.token);

      toast.success("Login successful ⚡");

      // redirect to dashboard
      navigate("/dashboard");

    } catch (err) {
      toast.error(err?.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg">
              <span className="text-white text-2xl font-bold">⚡</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-800">VoltPath</h1>
          <p className="text-gray-500 text-sm">Intelligent EV Trip Planning</p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white shadow-xl rounded-2xl p-8 border border-gray-100"
        >
          <h2 className="text-2xl font-semibold mb-1">Welcome back</h2>
          <p className="text-gray-500 text-sm mb-6">
            Enter your credentials to access your account
          </p>

          {/* Email */}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700">Email</label>
            <div className="flex items-center border rounded-lg px-3 mt-1 bg-gray-50 focus-within:ring-2 focus-within:ring-blue-500">
              <FiMail className="text-gray-400 mr-2" />
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full py-2 bg-transparent outline-none text-sm"
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-5">
            <label className="text-sm font-medium text-gray-700">Password</label>
            <div className="flex items-center border rounded-lg px-3 mt-1 bg-gray-50 focus-within:ring-2 focus-within:ring-blue-500">
              <FiLock className="text-gray-400 mr-2" />
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full py-2 bg-transparent outline-none text-sm"
              />
            </div>
          </div>

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-white font-medium 
                       bg-gradient-to-r from-blue-600 to-blue-700 
                       hover:from-blue-700 hover:to-blue-800 
                       transition duration-300 shadow-md disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          {/* Bottom */}
          <p className="text-center text-sm text-gray-600 mt-6">
            Don’t have an account?{" "}
            <a href="/register" className="text-blue-600 font-medium hover:underline">
              Create an account
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}