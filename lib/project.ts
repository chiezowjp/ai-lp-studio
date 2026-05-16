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

export function buildProject(snap: ProjectSnapshot): LPProject {
  return {
    version: PROJECT_VERSION,
    id: crypto.randomUUID(),
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
