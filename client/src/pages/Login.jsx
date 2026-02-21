import React from "react";
import { FiMail, FiLock } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa";

export default function Login() {
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
          <p className="text-gray-500 text-sm">
            Intelligent EV Trip Planning
          </p>
        </div>

        {/* Card */}
        <div className="bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
          
          <h2 className="text-2xl font-semibold mb-1">Welcome back</h2>
          <p className="text-gray-500 text-sm mb-6">
            Enter your credentials to access your account
          </p>

          {/* Email */}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700">
              Email
            </label>
            <div className="flex items-center border rounded-lg px-3 mt-1 bg-gray-50 focus-within:ring-2 focus-within:ring-blue-500">
              <FiMail className="text-gray-400 mr-2" />
              <input
                type="email"
                placeholder="you@example.com"
                className="w-full py-2 bg-transparent outline-none text-sm"
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-3">
            <label className="text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="flex items-center border rounded-lg px-3 mt-1 bg-gray-50 focus-within:ring-2 focus-within:ring-blue-500">
              <FiLock className="text-gray-400 mr-2" />
              <input
                type="password"
                placeholder="••••••••"
                className="w-full py-2 bg-transparent outline-none text-sm"
              />
            </div>
          </div>

          {/* Remember + Forgot */}
          <div className="flex items-center justify-between mb-5 text-sm">
            <label className="flex items-center gap-2 text-gray-600">
              <input type="checkbox" className="accent-blue-600" />
              Remember me
            </label>
            <a href="#" className="text-blue-600 hover:underline">
              Forgot password?
            </a>
          </div>

          {/* Sign In Button */}
          <button className="w-full py-2.5 rounded-lg text-white font-medium 
                             bg-linear-to-r from-blue-600 to-blue-700 
                             hover:from-blue-700 hover:to-blue-800 
                             transition duration-300 shadow-md">
            Sign in
          </button>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="px-3 text-gray-400 text-sm">
              Or continue with
            </span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* Social Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button className="flex items-center justify-center gap-2 border rounded-lg py-2 hover:bg-gray-50 transition">
              <FcGoogle size={20} />
              Google
            </button>

            <button className="flex items-center justify-center gap-2 border rounded-lg py-2 hover:bg-gray-50 transition">
              <FaGithub size={18} />
              GitHub
            </button>
          </div>

          {/* Demo Alert */}
          <div className="mt-5 bg-blue-50 border border-blue-200 text-blue-700 text-sm p-3 rounded-lg">
            ℹ This is a demo login page. Authentication is not yet implemented.
          </div>
        </div>

        {/* Bottom */}
        <p className="text-center text-sm text-gray-600 mt-6">
          Don’t have an account?{" "}
          <a href="#" className="text-blue-600 font-medium hover:underline">
            Create an account
          </a>
        </p>
      </div>
    </div>
  );
}