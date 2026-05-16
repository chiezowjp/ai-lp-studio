/**
 * Claude API の生テキストから JSON オブジェクトを安全に抽出・パースする。
 * - Markdown コードブロック (```json ... ```) を除去
 * - 最外側の { ... } を探して抽出
 * - パース失敗時はユーザー向けエラーメッセージを throw
 */
export function extractAndParseJSON<T = Record<string, unknown>>(raw: string): T {
  // 1. Markdown コードブロックを除去
  let cleaned = raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  // 2. 最初の { から最後の } までを抽出
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI出力の整形に失敗しました。再生成してください。");
  }

  const jsonStr = cleaned.slice(start, end + 1);

  // 3. パース
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    throw new Error("AI出力の整形に失敗しました。再生成してください。");
  }
}
