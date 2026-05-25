/**
 * lib/google-sheets.ts — Google Sheets 行追加ユーティリティ
 *
 * Service Account を使用して Sheets API に直接リクエストする。
 * googleapis ライブラリ不使用 — Node.js の crypto で JWT を生成。
 *
 * 環境変数:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  — サービスアカウント JSON の文字列
 *                                   (Base64 encoded or raw JSON string)
 *
 * サービスアカウントに「スプレッドシートの編集者」権限を付与してください。
 */

import { createSign } from "crypto";

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

// ─── JWT 生成 ─────────────────────────────────────────────────────────────────

function base64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessToken(sa: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );

  const signingInput = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = base64url(signer.sign(sa.private_key));
  const jwt = `${signingInput}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Google OAuth token error: ${err}`);
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };
  return access_token;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SheetsAppendOptions {
  spreadsheetId: string;
  sheetName: string;
  row: string[];
}

/**
 * Google Sheets にデータ行を追加する。
 * GOOGLE_SERVICE_ACCOUNT_JSON が未設定の場合はスキップ。
 */
export async function appendToGoogleSheets(opts: SheetsAppendOptions): Promise<void> {
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!saJson) {
    console.warn("[google-sheets] GOOGLE_SERVICE_ACCOUNT_JSON not set. Skipping.");
    return;
  }

  let sa: ServiceAccountKey;
  try {
    // Base64 encoded または raw JSON どちらも受け入れる
    const raw = saJson.startsWith("{")
      ? saJson
      : Buffer.from(saJson, "base64").toString("utf-8");
    sa = JSON.parse(raw) as ServiceAccountKey;
  } catch {
    console.error("[google-sheets] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON.");
    return;
  }

  const token = await getAccessToken(sa);

  const range = encodeURIComponent(`${opts.sheetName}!A1`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${opts.spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [opts.row] }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Sheets API error ${res.status}: ${body}`);
  }
}

/**
 * スプレッドシートIDを URL から抽出するユーティリティ
 * https://docs.google.com/spreadsheets/d/{id}/edit → {id}
 */
export function extractSpreadsheetId(urlOrId: string): string {
  const m = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : urlOrId;
}
