"use client";

import { useState } from "react";

interface Props {
  label: string;
  code: string;
  language?: string;
}

export default function CodeBlock({ label, code, language = "html" }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-400 uppercase">{language}</span>
          <span className="text-gray-500 text-xs">—</span>
          <span className="text-sm font-medium text-gray-200">{label}</span>
        </div>
        <button
          onClick={handleCopy}
          className="text-xs px-3 py-1.5 rounded-md font-semibold transition-all
            bg-indigo-600 hover:bg-indigo-500 text-white"
        >
          {copied ? "✓ コピー済み" : "コピー"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 bg-gray-900 text-gray-100 text-xs leading-relaxed max-h-80">
        <code>{code}</code>
      </pre>
    </div>
  );
}
