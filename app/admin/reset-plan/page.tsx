"use client";

import { useAuth } from "@/lib/auth-context";
import { useState } from "react";

export default function ResetPlanPage() {
  const { session } = useAuth();
  const [result, setResult] = useState("");

  const handleReset = async () => {
    if (!session) { setResult("ログインしてください"); return; }
    const res = await fetch("/api/admin/reset-plan", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const json = await res.json();
    setResult(JSON.stringify(json));
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <button onClick={handleReset} className="px-6 py-3 bg-red-500 text-white rounded-xl font-bold">
        プランをトライアルにリセット
      </button>
      {result && <p className="text-sm text-gray-600">{result}</p>}
    </div>
  );
}
