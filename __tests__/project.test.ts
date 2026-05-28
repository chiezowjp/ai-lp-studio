/**
 * プロジェクト保存・復元のテスト
 *
 * 「新しい state を追加したのに保存パスへの追加を忘れる」を防ぐ。
 * ProjectSnapshot / LPProject の全フィールドが実際の保存データに含まれているかを確認する。
 */

import { describe, it, expect } from "vitest";
import {
  buildProject,
  serializeImagesSync,
  deserializeImages,
  PROJECT_VERSION,
  type ProjectSnapshot,
  type LPProject,
  type SerializedImage,
} from "@/lib/project";
import type { LPFormData, VisualStyles } from "@/types";

// ─── テスト用フィクスチャ ───────────────────────────────────────────────────────

const DUMMY_FORM_DATA: LPFormData = {
  serviceName: "テストサービス",
  industry: "飲食",
  target: "30代女性",
  area: "東京",
  serviceDetail: "テスト内容",
  price: "5,000円〜",
  strengths: "品質が高い",
  designMood: "シンプル",
  ctaType: "contact",
  ctaLink: "https://example.com/contact",
};

const DUMMY_VISUAL_STYLES: VisualStyles = {
  ".lp-hero": { styles: { backgroundColor: "#ffffff" } },
};

const DUMMY_SNAPSHOT: ProjectSnapshot = {
  formData: DUMMY_FORM_DATA,
  html: "<section class='lp-hero'><h1>テスト</h1></section>",
  css: ".lp-hero { background: #fff; }",
  colorReplacements: { "#ff0000": "#00ff00" },
  visualStyles: DUMMY_VISUAL_STYLES,
  sectionOrder: [{ id: "hero", label: "ファーストビュー" }],
  additionalCssByType: { imgblock: ".lp-imgblock { box-sizing: border-box; }" },
  images: [],
  globalFont: "noto-sans-jp",   // ← このフィールドが保存されているかが重要
};

// ─── LPProject に含まれるべき全フィールドのリスト ─────────────────────────────
// 新しいフィールドを ProjectSnapshot / LPProject に追加したら、
// このリストにも追加すること。テストが落ちたら追加漏れに気づける。

const REQUIRED_SNAPSHOT_FIELDS: (keyof ProjectSnapshot)[] = [
  "formData",
  "html",
  "css",
  "colorReplacements",
  "visualStyles",
  "sectionOrder",
  "additionalCssByType",
  "images",
  "globalFont",   // ← フォント選択：以前ここで保存漏れが発生した
];

const REQUIRED_PROJECT_FIELDS: (keyof LPProject)[] = [
  "version",
  "id",
  "name",
  "savedAt",
  "formData",
  "html",
  "css",
  "colorReplacements",
  "visualStyles",
  "sectionOrder",
  "additionalCssByType",
  "images",
  "globalFont",
];

// ─── テスト ────────────────────────────────────────────────────────────────────

describe("ProjectSnapshot フィールド網羅チェック", () => {
  it("buildProject が全必須フィールドを LPProject に含める", () => {
    const project = buildProject(DUMMY_SNAPSHOT);

    for (const field of REQUIRED_PROJECT_FIELDS) {
      expect(project, `LPProject に ${field} がない`).toHaveProperty(field);
    }
  });

  it("buildProject が globalFont を保持する（過去の保存漏れバグの再発防止）", () => {
    const project = buildProject(DUMMY_SNAPSHOT);
    expect(project.globalFont).toBe("noto-sans-jp");
  });

  it("globalFont が undefined のとき LPProject の globalFont も undefined になる", () => {
    const snap: ProjectSnapshot = { ...DUMMY_SNAPSHOT, globalFont: undefined };
    const project = buildProject(snap);
    expect(project.globalFont).toBeUndefined();
  });

  it("REQUIRED_SNAPSHOT_FIELDS に含まれる全フィールドが DUMMY_SNAPSHOT に存在する", () => {
    // このテスト自体がフィールドリストの漏れを検出する
    for (const field of REQUIRED_SNAPSHOT_FIELDS) {
      expect(DUMMY_SNAPSHOT, `DUMMY_SNAPSHOT に ${field} がない`).toHaveProperty(field);
    }
  });
});

describe("buildProject", () => {
  it("version が PROJECT_VERSION になっている", () => {
    const project = buildProject(DUMMY_SNAPSHOT);
    expect(project.version).toBe(PROJECT_VERSION);
  });

  it("name は formData.serviceName から取得される", () => {
    const project = buildProject(DUMMY_SNAPSHOT);
    expect(project.name).toBe("テストサービス");
  });

  it("serviceName が空のとき name は '名称未設定' になる", () => {
    const snap: ProjectSnapshot = {
      ...DUMMY_SNAPSHOT,
      formData: { ...DUMMY_FORM_DATA, serviceName: "" },
    };
    const project = buildProject(snap);
    expect(project.name).toBe("名称未設定");
  });

  it("existingId を渡すと id が上書きされる", () => {
    const existingId = "existing-uuid-1234";
    const project = buildProject(DUMMY_SNAPSHOT, { existingId });
    expect(project.id).toBe(existingId);
  });

  it("remoteId を渡すと remoteId が設定される", () => {
    const project = buildProject(DUMMY_SNAPSHOT, { remoteId: "remote-uuid-5678" });
    expect(project.remoteId).toBe("remote-uuid-5678");
  });

  it("savedAt が ISO 8601 形式の日時文字列になっている", () => {
    const project = buildProject(DUMMY_SNAPSHOT);
    expect(() => new Date(project.savedAt)).not.toThrow();
    expect(new Date(project.savedAt).toISOString()).toBe(project.savedAt);
  });

  it("html / css / colorReplacements / visualStyles がそのまま引き継がれる", () => {
    const project = buildProject(DUMMY_SNAPSHOT);
    expect(project.html).toBe(DUMMY_SNAPSHOT.html);
    expect(project.css).toBe(DUMMY_SNAPSHOT.css);
    expect(project.colorReplacements).toEqual(DUMMY_SNAPSHOT.colorReplacements);
    expect(project.visualStyles).toEqual(DUMMY_SNAPSHOT.visualStyles);
  });
});

describe("serializeImagesSync / deserializeImages（画像シリアライズ）", () => {
  const HTTPS_IMAGE = {
    id: "img-1",
    url: "https://images.unsplash.com/photo-123",
    name: "Unsplash photo",
    placement: "hero",
    attribution: {
      photographerName: "John Doe",
      photographerUrl: "https://unsplash.com/@johndoe",
      photoUrl: "https://unsplash.com/photos/123",
    },
  };

  const BLOB_IMAGE = {
    id: "img-2",
    url: "blob:http://localhost:3000/fake-blob-id",
    name: "uploaded.jpg",
    placement: "other",
  };

  it("https:// URL はシリアライズされる", () => {
    const result = serializeImagesSync([HTTPS_IMAGE]);
    expect(result).toHaveLength(1);
    expect(result[0].dataUrl).toBe(HTTPS_IMAGE.url);
    expect(result[0].id).toBe("img-1");
  });

  it("blob: URL はシリアライズ時にスキップされる", () => {
    const result = serializeImagesSync([BLOB_IMAGE]);
    expect(result).toHaveLength(0);
  });

  it("混在しているとき blob のみスキップされる", () => {
    const result = serializeImagesSync([HTTPS_IMAGE, BLOB_IMAGE]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("img-1");
  });

  it("attribution が正しく保存・復元される", () => {
    const serialized = serializeImagesSync([HTTPS_IMAGE]);
    const restored = deserializeImages(serialized);
    expect(restored[0].attribution).toEqual(HTTPS_IMAGE.attribution);
  });

  it("deserializeImages で dataUrl が url にマッピングされる", () => {
    const serialized: SerializedImage[] = [
      { id: "img-3", dataUrl: "data:image/jpeg;base64,FAKE", name: "test.jpg", placement: "hero" },
    ];
    const result = deserializeImages(serialized);
    expect(result[0].url).toBe("data:image/jpeg;base64,FAKE");
  });

  it("dataUrl が空の SerializedImage はスキップされる", () => {
    const serialized: SerializedImage[] = [
      { id: "img-4", dataUrl: "", name: "empty.jpg", placement: "hero" },
    ];
    const result = deserializeImages(serialized);
    expect(result).toHaveLength(0);
  });
});
