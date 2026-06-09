/**
 * 挿入済み画像（lp-inserted-img）の純粋関数テスト
 *
 * insertImageAdjacentToElement / updateInsertedImage / deleteInsertedImage /
 * parseInsertedImage が正しく動作するかを確認する。
 */

import { describe, it, expect } from "vitest";
import {
  insertImageAdjacentToElement,
  updateInsertedImage,
  deleteInsertedImage,
  parseInsertedImage,
  type InsertedImageConfig,
} from "@/components/ImageInsertPanel";

// ─── テスト用フィクスチャ ─────────────────────────────────────────────────────

const BASE_CFG: InsertedImageConfig = {
  id: "test-img-1",
  url: "https://example.com/photo.jpg",
  mobileImageUrl: "",
  alt: "テスト画像",
  width: "80%",
  alignment: "center",
  borderRadius: 8,
  marginV: 16,
  linkUrl: "",
};

/** 典型的な LP セクション HTML */
const SECTION_HTML = `<section class="lp-hero" style="padding:60px 0">
  <h1 data-element-id="heading-1">メインタイトル</h1>
  <p>説明文</p>
</section>`;

/** 画像挿入済みの HTML（テスト間で共有） */
function buildInsertedHtml(cfg: InsertedImageConfig = BASE_CFG): string {
  return insertImageAdjacentToElement(SECTION_HTML, ".lp-hero", "section_end", cfg);
}

// ─── insertImageAdjacentToElement ────────────────────────────────────────────

describe("insertImageAdjacentToElement", () => {
  it("section_end に画像ラッパーが追加される", () => {
    const result = buildInsertedHtml();
    expect(result).toContain("lp-inserted-img");
    expect(result).toContain(`src="https://example.com/photo.jpg"`);
  });

  it("挿入した画像の data-element-id が設定されている", () => {
    const result = buildInsertedHtml();
    expect(result).toContain(`data-element-id="test-img-1"`);
  });

  it("alignment が style に反映される", () => {
    const result = buildInsertedHtml({ ...BASE_CFG, alignment: "left" });
    expect(result).toContain("text-align:left");
  });

  it("borderRadius が style に反映される", () => {
    const result = buildInsertedHtml({ ...BASE_CFG, borderRadius: 16 });
    expect(result).toContain("border-radius:16px");
  });

  it("スマホ用画像を設定すると <picture><source> が追加される", () => {
    const MOBILE = "data:image/jpeg;base64,FAKE";
    const result = buildInsertedHtml({ ...BASE_CFG, mobileImageUrl: MOBILE });
    expect(result).toContain("<picture>");
    expect(result).toContain(`srcset="${MOBILE}"`);
  });

  it("before に挿入すると指定要素の前に入る", () => {
    const result = insertImageAdjacentToElement(
      SECTION_HTML, "h1", "before", BASE_CFG, "heading-1",
    );
    // lp-inserted-img が h1 の前にある（先に出現する）
    const imgIdx = result.indexOf("lp-inserted-img");
    const h1Idx = result.indexOf("<h1");
    expect(imgIdx).toBeLessThan(h1Idx);
  });

  it("セクターが存在しないとき元の HTML をそのまま返す", () => {
    const result = insertImageAdjacentToElement(
      SECTION_HTML, ".lp-notfound", "section_end", BASE_CFG,
    );
    expect(result).toBe(SECTION_HTML);
  });
});

// ─── parseInsertedImage ──────────────────────────────────────────────────────

describe("parseInsertedImage", () => {
  it("挿入済み画像の設定を正しく復元できる", () => {
    const html = buildInsertedHtml();
    const cfg = parseInsertedImage(html, "test-img-1");
    expect(cfg).not.toBeNull();
    expect(cfg!.url).toContain("example.com");
    expect(cfg!.alignment).toBe("center");
    expect(cfg!.borderRadius).toBe(8);
    expect(cfg!.marginV).toBe(16);
    expect(cfg!.width).toBe("80%");
  });

  it("スマホ用画像の mobileImageUrl を復元できる", () => {
    const MOBILE = "data:image/jpeg;base64,FAKE";
    const html = buildInsertedHtml({ ...BASE_CFG, mobileImageUrl: MOBILE });
    const cfg = parseInsertedImage(html, "test-img-1");
    expect(cfg!.mobileImageUrl).toBe(MOBILE);
  });

  it("存在しない imageId を渡すと null を返す", () => {
    const html = buildInsertedHtml();
    expect(parseInsertedImage(html, "no-such-id")).toBeNull();
  });
});

// ─── updateInsertedImage ─────────────────────────────────────────────────────

describe("updateInsertedImage", () => {
  it("url を差し替えられる", () => {
    const html = buildInsertedHtml();
    const result = updateInsertedImage(html, "test-img-1", { url: "https://new.example.com/img.jpg" });
    expect(result).toContain(`src="https://new.example.com/img.jpg"`);
  });

  it("alignment を left に変更できる", () => {
    const html = buildInsertedHtml();
    const result = updateInsertedImage(html, "test-img-1", { alignment: "left" });
    const cfg = parseInsertedImage(result, "test-img-1");
    expect(cfg!.alignment).toBe("left");
  });

  it("borderRadius を変更できる", () => {
    const html = buildInsertedHtml();
    const result = updateInsertedImage(html, "test-img-1", { borderRadius: 24 });
    const cfg = parseInsertedImage(result, "test-img-1");
    expect(cfg!.borderRadius).toBe(24);
  });

  it("mobileImageUrl を追加できる", () => {
    const html = buildInsertedHtml();
    const MOBILE = "data:image/jpeg;base64,MOBILE";
    const result = updateInsertedImage(html, "test-img-1", { mobileImageUrl: MOBILE });
    const cfg = parseInsertedImage(result, "test-img-1");
    expect(cfg!.mobileImageUrl).toBe(MOBILE);
  });

  it("mobileImageUrl を削除できる（空文字で上書き）", () => {
    const MOBILE = "data:image/jpeg;base64,MOBILE";
    const html = buildInsertedHtml({ ...BASE_CFG, mobileImageUrl: MOBILE });
    const result = updateInsertedImage(html, "test-img-1", { mobileImageUrl: "" });
    expect(result).not.toContain("<picture>");
  });

  it("存在しない imageId を渡すと元の HTML をそのまま返す", () => {
    const html = buildInsertedHtml();
    const result = updateInsertedImage(html, "no-such-id", { url: "https://new.com/img.jpg" });
    expect(result).toBe(html);
  });
});

// ─── deleteInsertedImage ─────────────────────────────────────────────────────

describe("deleteInsertedImage", () => {
  it("指定した画像を削除できる", () => {
    const html = buildInsertedHtml();
    const result = deleteInsertedImage(html, "test-img-1");
    expect(result).not.toContain("lp-inserted-img");
    expect(result).not.toContain("test-img-1");
  });

  it("削除後も他の HTML コンテンツは残る", () => {
    const html = buildInsertedHtml();
    const result = deleteInsertedImage(html, "test-img-1");
    expect(result).toContain("メインタイトル");
  });

  it("存在しない imageId を渡しても HTML は壊れない", () => {
    const html = buildInsertedHtml();
    const result = deleteInsertedImage(html, "no-such-id");
    expect(result).toContain("lp-inserted-img");
  });
});
