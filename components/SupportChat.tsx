"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUICK_QUESTIONS = [
  "LPの作り方を教えて",
  "セクションを追加するには？",
  "保存する方法は？",
  "Proプランの機能は？",
];

export default function SupportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 新しいメッセージが来たら一番下へスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // パネルが開いたらフォーカス
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    // アシスタントの返答用プレースホルダー
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok || !res.body) throw new Error("通信エラー");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const { text } = JSON.parse(data) as { text: string };
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = { ...last, content: last.content + text };
              }
              return next;
            });
          } catch { /* ignore parse errors */ }
        }
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: "エラーが発生しました。もう一度お試しください。",
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* ── チャットパネル ── */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-80 sm:w-96 flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
          style={{ maxHeight: "min(560px, calc(100vh - 100px))" }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 bg-[#00AFCC] text-white shrink-0">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-sm font-black shrink-0">
              AI
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight">サポートBot</p>
              <p className="text-[10px] text-white/70 leading-tight">AI LP STUDIO の使い方を回答します</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F5F5F2]">

            {/* 初期メッセージ */}
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="flex gap-2 items-start">
                  <div className="w-7 h-7 rounded-full bg-white overflow-hidden border border-gray-200 shrink-0 mt-0.5">
                    <img src="/support-avatar.png" alt="サポート" className="w-full h-full object-cover" />
                  </div>
                  <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2.5 text-sm text-gray-700 shadow-sm max-w-[85%]">
                    こんにちは！AI LP STUDIOのサポートBotです。<br />
                    使い方についてお気軽にご質問ください 😊
                  </div>
                </div>
                {/* クイック質問 */}
                <div className="flex flex-wrap gap-1.5 pl-9">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="px-2.5 py-1 text-[11px] bg-white border border-[#b3e8f4] text-[#00AFCC] rounded-full hover:bg-[#E6F8FC] transition-colors font-medium"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* メッセージ一覧 */}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 items-start ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-white overflow-hidden border border-gray-200 shrink-0 mt-0.5">
                    <img src="/support-avatar.png" alt="サポート" className="w-full h-full object-cover" />
                  </div>
                )}
                <div
                  className={[
                    "rounded-2xl px-3 py-2.5 text-sm shadow-sm max-w-[85%] whitespace-pre-wrap break-words",
                    msg.role === "user"
                      ? "bg-[#00AFCC] text-white rounded-tr-sm"
                      : "bg-white text-gray-700 rounded-tl-sm",
                  ].join(" ")}
                >
                  {msg.content || (
                    <span className="flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-gray-100 p-3 bg-white">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder="質問を入力… (Enter で送信)"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00AFCC] transition disabled:opacity-50"
                style={{ minHeight: "38px", maxHeight: "96px" }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 96) + "px";
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="w-9 h-9 bg-[#00AFCC] hover:bg-[#0099B3] disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors shrink-0"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── フローティングボタン ── */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={[
          "fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all",
          open
            ? "bg-gray-600 hover:bg-gray-700 rotate-0"
            : "bg-[#00AFCC] hover:bg-[#0099B3] hover:scale-110",
        ].join(" ")}
        aria-label="サポートチャットを開く"
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
          </svg>
        )}
      </button>
    </>
  );
}
