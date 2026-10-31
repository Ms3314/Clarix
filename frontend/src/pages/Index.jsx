import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { resetAllStores } from "@/lib/resetStores";

export default () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "student",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const response = await api.post("/auth/login", {
          username: formData.username,
          password: formData.password,
        });
        localStorage.setItem("clarix_token", response.data.access_token);
        resetAllStores();
        const redirectCode = localStorage.getItem('join_redirect')
        if (redirectCode) {
          localStorage.removeItem('join_redirect')
          navigate(`/join/${redirectCode}`)
        } else {
          navigate("/dashboard")
        }
      } else {
        await api.post("/auth/signup", {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        });
        setIsLogin(true);
        setFormData({ username: "", email: "", password: "", role: "student" });
        alert("Registration successful! Please login.");
      }
    } catch (error) {
      const detail = error.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d) => d.msg || d).join(", ")
        : detail || error.response?.data?.message || "An error occurred";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setFormData({ username: "", email: "", password: "", role: "student" });
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Left — Brand Section */}
      <div className="hidden lg:flex flex-1 flex-col relative bg-gradient-to-br from-[#F5F1EC] via-[#EEE8E1] to-[#E3EDDF] pt-12 pl-12 overflow-hidden">
        <div className="absolute top-[-80px] right-[-80px] w-[300px] h-[300px] rounded-full bg-[#4A7C59]/5" />
        <div className="absolute bottom-[120px] left-[-60px] w-[200px] h-[200px] rounded-full bg-[#4A7C59]/8" />
        <div className="absolute top-[40%] right-[20%] w-[120px] h-[120px] rounded-full bg-[#4A7C59]/4" />

        <img
          src={
            "/icon.png"
          }
          className="w-[56px] h-[54px] object-fill relative z-10"
        />
        <div className="flex-1 flex flex-col justify-center pb-20 pl-10 relative z-10">
          <div className="flex flex-col gap-5">
            <h1 className="text-[#1C1B1A] text-5xl font-extrabold leading-[1.1] tracking-tight max-w-[520px]">
              The Classroom of your Dreams !!
            </h1>
            <p className="text-[#5A5958] text-lg leading-relaxed max-w-[460px]">
              Empower your educational journey with AI-powered classroom
              management and study tools designed for modern learners.
            </p>
          </div>
        </div>
      </div>

      {/* Right — Auth Section */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-[#FAF8F6] to-[#F2EDE8] px-5">
        <div className="w-full max-w-[400px]">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <img
              src={
                "/icon.png"
              }
              className="w-[52px] h-[50px] mb-3 object-fill"
            />
            <span className="text-[#1C1B1A] text-xl font-bold text-center">
              The Classroom of your Dreams !!
            </span>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-black/5 border border-[#E8E4E0] px-8 py-9">
            <div className="mb-7">
              <h2 className="text-[#1C1B1A] text-[28px] font-bold tracking-tight">
                {isLogin ? "Welcome back" : "Create account"}
              </h2>
              <p className="text-[#6B6A68] text-sm mt-1.5">
                {isLogin
                  ? "Sign in to your account to continue"
                  : "Join Clarix to start learning"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-[#4A4948] text-sm font-medium block mb-1.5">
                  Username
                </label>
                <input
                  placeholder="Enter your username"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  className="w-full text-[#1C1B1A] bg-white text-sm py-2.5 px-3.5 rounded-xl border border-[#D4D0CC] outline-none placeholder:text-[#ACAAA6] transition-all duration-200 focus:border-[#4A7C59] focus:ring-2 focus:ring-[#4A7C59]/15 hover:border-[#C0BCB8]"
                />
              </div>

              {!isLogin && (
                <>
                  <div>
                    <label className="text-[#4A4948] text-sm font-medium block mb-1.5">
                      Email
                    </label>
                    <input
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="w-full text-[#1C1B1A] bg-white text-sm py-2.5 px-3.5 rounded-xl border border-[#D4D0CC] outline-none placeholder:text-[#ACAAA6] transition-all duration-200 focus:border-[#4A7C59] focus:ring-2 focus:ring-[#4A7C59]/15 hover:border-[#C0BCB8]"
                    />
                  </div>

                  <div>
                    <label className="text-[#4A4948] text-sm font-medium block mb-1.5">
                      I am a
                    </label>
                    <div className="flex gap-2.5">
                      {["student", "teacher"].map((role) => (
                        <label
                          key={role}
                          className={`flex-1 flex items-center justify-center cursor-pointer py-2.5 px-4 rounded-xl border text-sm font-medium transition-all duration-200 ${
                            formData.role === role
                              ? "border-[#4A7C59] bg-[#4A7C59]/8 text-[#4A7C59] shadow-sm"
                              : "border-[#D4D0CC] text-[#6B6A68] bg-white hover:border-[#C0BCB8]"
                          }`}
                        >
                          <input
                            type="radio"
                            value={role}
                            checked={formData.role === role}
                            onChange={(e) =>
                              setFormData({ ...formData, role: e.target.value })
                            }
                            className="sr-only"
                          />
                          <svg
                            className={`w-3.5 h-3.5 mr-2 ${
                              formData.role === role
                                ? "text-[#4A7C59]"
                                : "text-[#ACAAA6]"
                            }`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            {formData.role === role ? (
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            ) : (
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
                                clipRule="evenodd"
                              />
                            )}
                          </svg>
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[#4A4948] text-sm font-medium">
                    Password
                  </label>
                  {isLogin && (
                    <span className="text-[#4A7C59] text-xs font-medium cursor-pointer hover:text-[#3d6b4c] transition-colors">
                      Forgot?
                    </span>
                  )}
                </div>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full text-[#1C1B1A] bg-white text-sm py-2.5 px-3.5 rounded-xl border border-[#D4D0CC] outline-none placeholder:text-[#ACAAA6] transition-all duration-200 focus:border-[#4A7C59] focus:ring-2 focus:ring-[#4A7C59]/15 hover:border-[#C0BCB8]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#4A7C59] text-white text-sm font-semibold py-2.5 rounded-xl border-0 cursor-pointer transition-all duration-200 disabled:opacity-50 hover:bg-[#3d6b4c] hover:shadow-lg hover:shadow-[#4A7C59]/20 active:scale-[0.98] mt-1"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Processing...
                  </span>
                ) : isLogin ? (
                  "Sign In"
                ) : (
                  "Create Account"
                )}
              </button>
            </form>

            <div className="flex items-center justify-center gap-1.5 mt-6">
              <span className="text-[#6B6A68] text-sm">
                {isLogin
                  ? "Don't have an account?"
                  : "Already have an account?"}
              </span>
              <button
                type="button"
                onClick={toggleMode}
                className="text-[#4A7C59] text-sm font-semibold bg-none border-0 cursor-pointer hover:text-[#3d6b4c] transition-colors p-0"
              >
                {isLogin ? "Register" : "Sign In"}
              </button>
            </div>
          </div>

          <p className="text-[#ACAAA6] text-xs text-center mt-5">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};
