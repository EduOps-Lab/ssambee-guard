"use client";

import React, { useState } from "react";
import axios from "axios";
import Link from "next/link";

interface LoginProps {
  onLogin: (token: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
      const targetUrl = `${apiUrl}/login`;
      const response = await axios.post(
        targetUrl,
        { username, password },
        {
          withCredentials: true,
        },
      );
      onLogin(response.data.token);
    } catch (err: any) {
      setError(err.response?.data?.message || "로그인에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-900">
      <div className="p-8 w-96 rounded-lg border shadow-xl bg-slate-800 border-slate-700">
        <h1 className="mb-6 text-2xl font-bold text-center text-blue-400">
          모니터링 제어 센터
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium text-slate-300">
              사용자 이름
            </label>
            <input
              type="text"
              className="p-2 w-full text-white rounded border bg-slate-700 border-slate-600 focus:outline-none focus:border-blue-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium text-slate-300">
              비밀번호
            </label>
            <input
              type="password"
              className="p-2 w-full text-white rounded border bg-slate-700 border-slate-600 focus:outline-none focus:border-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="py-2 w-full font-bold text-white bg-blue-600 rounded transition duration-200 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
        <div className="mt-4 text-center">
          <p className="text-sm text-slate-400">
            계정이 없으신가요?{" "}
            <Link href="/register" className="text-blue-400 hover:underline">
              여기에서 가입하세요
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
