import { useState } from "react";
import toast from "react-hot-toast";
import api from "../config/Api";

export default function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobileNumber: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const { confirmPassword, ...submitData } = form;

      const res = await api.post("/api/auth/register", submitData);
      // store token
      localStorage.setItem("token", res.data.token);

      toast.success("Account created successfully ⚡");

      console.log(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      {/* Brand */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto text-white text-3xl">
          ⚡
        </div>
        <h1 className="text-3xl font-bold text-blue-600 mt-3">VoltPath</h1>
        <p className="text-gray-500 text-sm">Intelligent EV Trip Planning</p>
      </div>

      {/* Card */}
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-8">
        <h2 className="text-2xl font-semibold mb-1">Create Account</h2>
        <p className="text-gray-500 text-sm mb-6">
          Sign up to start planning smarter trips
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            value={form.name}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="email"
            name="email"
            placeholder="Email Address"
            value={form.email}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="number"
            name="mobileNumber"
            placeholder="Mobile Number"
            value={form.mobileNumber}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={form.confirmPassword}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition duration-200 disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        <p className="text-sm text-center text-gray-600 mt-6">
          Already have an account?{" "}
          <a
            href="/login"
            className="text-blue-600 font-medium hover:underline"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
