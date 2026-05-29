/**
 * LP プロジェクト 保存・復元ユーティリティ
 *
 * 将来の Supabase 拡張ポイント:
 *   - saveToLocal / loadFromLocal を saveToRemote / loadFromRemote に差し替え
 *   - LPProject.id をサーバー側 UUID と紐付ける
 *   - SerializedImage.dataUrl を Storage URL に差し替える
 */

import type { LPFormData, UploadedImage, VisualStyles } from "@/types";

// ─── Schema version ───────────────────────────────────────────────────────────

export const PROJECT_VERSION = 1 as const;
export const AUTOSAVE_KEY = "lp-generator-autosave";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SerializedImage {
  id: string;
  /** base64 data URL（ユーザーアップロード）または https:// URL（Unsplash）*/
  dataUrl: string;
  name: string;
  placement: string;
  attribution?: {
    photographerName: string;
    photographerUrl: string;
    photoUrl: string;
  };
}

export interface LPProject {
  version: 1;
  id: string;
  /** Supabase プロジェクト UUID（クラウド保存済みの場合のみ設定） */
  remoteId?: string;
  /** サービス名 or "名称未設定" */
  name: string;
  savedAt: string;
  // ── コアデータ ──
  formData: LPFormData;
  html: string;
  css: string;
  // ── カスタマイズ ──
  colorReplacements: Record<string, string>;
  visualStyles: VisualStyles;
  sectionOrder: { id: string; label: string }[];
  additionalCssByType: Record<string, string>;
  images: SerializedImage[];
  globalFont?: string;
}

export interface ProjectSnapshot {
  formData: LPFormData;
  html: string;
  css: string;
  colorReplacements: Record<string, string>;
  visualStyles: VisualStyles;
  sectionOrder: { id: string; label: string }[];
  additionalCssByType: Record<string, string>;
  images: SerializedImage[];
  globalFont?: string;
}

// ─── Image serialization ──────────────────────────────────────────────────────

async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  const res = await fetch(blobUrl);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 全画像をシリアライズ（blob: URL → base64 変換を行う非同期版）。
 * 手動保存・JSON ダウンロード時に使用。
 */
export async function serializeImages(imgs: UploadedImage[]): Promise<SerializedImage[]> {
  const out: SerializedImage[] = [];
  for (const img of imgs) {
    try {
      const dataUrl = img.url.startsWith("blob:")
        ? await blobUrlToDataUrl(img.url)
        : img.url;
      out.push({
        id: img.id,
        dataUrl,
        name: img.name,
        placement: img.placement,
        attribution: img.attribution,
      });
    } catch {
      // blob が読み取れない場合はスキップ
    }
  }
  return out;
}

/**
 * 同期版シリアライズ（blob: URL はスキップ）。
 * 自動保存（Auto-save）時に使用。Unsplash 画像（https://）は保存される。
 */
export function serializeImagesSync(imgs: UploadedImage[]): SerializedImage[] {
  return imgs
    .filter((img) => !img.url.startsWith("blob:"))
    .map((img) => ({
      id: img.id,
      dataUrl: img.url,
      name: img.name,
      placement: img.placement,
      attribution: img.attribution,
    }));
}

/** SerializedImage → UploadedImage（data URL をそのまま url に使用）*/
export function deserializeImages(imgs: SerializedImage[]): UploadedImage[] {
  return imgs
    .filter((img) => !!img.dataUrl)
    .map((img) => ({
      id: img.id,
      url: img.dataUrl,
      name: img.name,
      placement: img.placement,
      attribution: img.attribution,
    }));
}

// ─── Project build ────────────────────────────────────────────────────────────

export function buildProject(snap: ProjectSnapshot, opts?: { existingId?: string; remoteId?: string }): LPProject {
  return {
    version: PROJECT_VERSION,
    id: opts?.existingId ?? crypto.randomUUID(),
    ...(opts?.remoteId ? { remoteId: opts.remoteId } : {}),
    name: snap.formData.serviceName || "名称未設定",
    savedAt: new Date().toISOString(),
    ...snap,
  };
}

// ─── localStorage ─────────────────────────────────────────────────────────────

/** プロジェクトを localStorage に保存 */
export function saveToLocal(project: LPProject): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
  } catch (e) {
    console.warn("[LP Project] localStorage 保存失敗:", e);
  }
}

/** localStorage からプロジェクトを読み込む。無効なら null を返す */
export function loadFromLocal(): LPProject | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as LPProject;
    if (p.version !== PROJECT_VERSION || !p.html) return null;
    return p;
  } catch {
    return null;
  }
}

/** localStorage の保存データを削除 */
export function clearLocal(): void {
  localStorage.removeItem(AUTOSAVE_KEY);
}

// ─── File I/O ─────────────────────────────────────────────────────────────────

/** プロジェクトを JSON ファイルとしてダウンロード */
export function downloadProject(project: LPProject): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = project.name.replace(/[\s/\\:*?"<>|]/g, "_");
  a.href = url;
  a.download = `lp-${safeName}-${project.savedAt.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** JSON ファイルを読み込んで LPProject を返す */
export async function parseProjectFile(file: File): Promise<LPProject> {
  const text = await file.text();
  const p = JSON.parse(text) as LPProject;
  if (p.version !== PROJECT_VERSION) {
    throw new Error(`バージョン ${p.version} のプロジェクトには対応していません`);
  }
  if (!p.html) {
    throw new Error("有効な LP プロジェクトファイルではありません");
  }
  return p;
}

// ─── Storage Upload Helpers（クラウド保存用）────────────────────────────────

/** blob: URL → Supabase Storage URL（失敗時は null） */
async function blobUrlToStorageUrl(
  blobUrl: string,
  fileName: string,
  accessToken: string,
): Promise<string | null> {
  try {
    const fetchRes = await fetch(blobUrl);
    const blob = await fetchRes.blob();
    const file = new File([blob], fileName, { type: blob.type });
    const form = new FormData();
    form.append("file", file);
    form.append("usage_type", "lp_image");
    const uploadRes = await fetch("/api/assets", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    if (!uploadRes.ok) return null;
    const asset = await uploadRes.json() as { url: string };
    return asset.url;
  } catch {
    return null;
  }
}

/** data: URL → Supabase Storage URL（失敗時は null） */
async function dataUrlToStorageUrl(
  dataUrl: string,
  accessToken: string,
): Promise<string | null> {
  try {
    const [header, b64] = dataUrl.split(",");
    const mime = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
    const ext = mime.split("/")[1]?.split("+")[0] ?? "jpg";
    const byteChars = atob(b64);
    const byteArr = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArr], { type: mime });
    const file = new File([blob], `lp_image_${Date.now()}.${ext}`, { type: mime });
    const form = new FormData();
    form.append("file", file);
    form.append("usage_type", "lp_image");
    const uploadRes = await fetch("/api/assets", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    if (!uploadRes.ok) return null;
    const asset = await uploadRes.json() as { url: string };
    return asset.url;
  } catch {
    return null;
  }
}

/**
 * クラウド保存用: images 配列の blob:/data: URL を Supabase Storage URL に変換。
 * アップロード失敗時は base64 にフォールバック。
 */
export async function uploadAndSerializeImages(
  imgs: UploadedImage[],
  accessToken: string,
): Promise<SerializedImage[]> {
  const out: SerializedImage[] = [];
  for (const img of imgs) {
    try {
      let finalUrl = img.url;
      if (img.url.startsWith("blob:")) {
        const storageUrl = await blobUrlToStorageUrl(img.url, img.name, accessToken);
        finalUrl = storageUrl ?? await blobUrlToDataUrl(img.url);
      }
      out.push({
        id: img.id,
        dataUrl: finalUrl,
        name: img.name,
        placement: img.placement,
        attribution: img.attribution,
      });
    } catch {
      // skip broken images
    }
  }
  return out;
}

/**
 * クラウド保存用: HTML 内の data:image URL を Supabase Storage URL に置換。
 * 同一 data: URL の重複アップロードを防ぐためキャッシュを使用。
 */
export async function replaceHtmlDataUrlsWithStorage(
  html: string,
  accessToken: string,
): Promise<string> {
  const DATA_URL_RE = /data:image\/[^;'"]+;base64,[A-Za-z0-9+/]+=*/g;
  const unique = [...new Set(html.match(DATA_URL_RE) ?? [])];
  if (unique.length === 0) return html;

  let result = html;
  for (const dataUrl of unique) {
    const storageUrl = await dataUrlToStorageUrl(dataUrl, accessToken);
    if (storageUrl) {
      result = result.split(dataUrl).join(storageUrl);
    }
  }
  return result;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatSavedAt(isoString: string): string {
  return new Date(isoString).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
