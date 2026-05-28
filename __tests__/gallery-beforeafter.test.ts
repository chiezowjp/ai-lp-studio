/**
 * ギャラリーアイテム・Before/After 画像の純粋関数テスト
 *
 * isGalleryElement / updateGalleryItemImage / getGalleryItemSrc /
 * getBeforeAfterSrc / replaceBeforeAfterImage が正しく動作するかを確認する。
 */

import { describe, it, expect } from "vitest";
import {
  isGalleryElement,
  updateGalleryItemImage,
  getGalleryItemSrc,
  getBeforeAfterSrc,
  replaceBeforeAfterImage,
} from "@/components/ImageInsertPanel";

// ─── テスト用 HTML ──────────────────────────────────────────────────────────────

/** img 自体に data-element-id が付いているギャラリー（lp-gallery-img） */
const GALLERY_IMG_HTML = `<section class="lp-gallery">
  <div class="lp-gallery-grid">
    <img class="lp-gallery-img" data-element-id="gal-1" src="https://example.com/img1.jpg" alt="">
    <img class="lp-gallery-img" data-element-id="gal-2" src="https://example.com/img2.jpg" alt="">
  </div>
</section>`;

/** 親 div に data-element-id が付いているギャラリー（lp-gallery-item） */
const GALLERY_ITEM_HTML = `<section class="lp-gallery">
  <div class="lp-gallery-grid">
    <div class="lp-gallery-item" data-element-id="item-1">
      <img class="lp-gallery-img" src="https://example.com/img1.jpg" alt="">
    </div>
    <div class="lp-gallery-item" data-element-id="item-2">
      <img class="lp-gallery-img" src="https://example.com/img2.jpg" alt="">
    </div>
  </div>
</section>`;

/** Before/After セクション */
const BEFORE_AFTER_HTML = `<section class="lp-ba">
  <div class="lp-ba-img" data-element-id="ba-before">
    <img src="https://placehold.co/400x300?text=Before" alt="">
  </div>
  <div class="lp-ba-img" data-element-id="ba-after">
    <img src="https://placehold.co/400x300?text=After" alt="">
  </div>
</section>`;

// ─── isGalleryElement ────────────────────────────────────────────────────────

describe("isGalleryElement", () => {
  it("lp-gallery-img クラスの要素は true を返す", () => {
    expect(isGalleryElement(GALLERY_IMG_HTML, "gal-1")).toBe(true);
  });

  it("lp-gallery-item クラスの要素は true を返す", () => {
    expect(isGalleryElement(GALLERY_ITEM_HTML, "item-1")).toBe(true);
  });

  it("ギャラリーでない要素は false を返す", () => {
    expect(isGalleryElement(GALLERY_IMG_HTML, "ba-before")).toBe(false);
  });

  it("存在しない elementId は false を返す", () => {
    expect(isGalleryElement(GALLERY_IMG_HTML, "no-such")).toBe(false);
  });

  it("Before/After 要素は false を返す", () => {
    expect(isGalleryElement(BEFORE_AFTER_HTML, "ba-before")).toBe(false);
  });
});

// ─── getGalleryItemSrc ───────────────────────────────────────────────────────

describe("getGalleryItemSrc", () => {
  it("lp-gallery-img の src を取得できる（img に id が付いている場合）", () => {
    const src = getGalleryItemSrc(GALLERY_IMG_HTML, "gal-1");
    expect(src).toBe("https://example.com/img1.jpg");
  });

  it("lp-gallery-item の中の img src を取得できる（div に id が付いている場合）", () => {
    const src = getGalleryItemSrc(GALLERY_ITEM_HTML, "item-2");
    expect(src).toBe("https://example.com/img2.jpg");
  });

  it("存在しない elementId は空文字を返す", () => {
    expect(getGalleryItemSrc(GALLERY_IMG_HTML, "no-such")).toBe("");
  });
});

// ─── updateGalleryItemImage ──────────────────────────────────────────────────

describe("updateGalleryItemImage", () => {
  it("lp-gallery-img の src を差し替えられる", () => {
    const result = updateGalleryItemImage(GALLERY_IMG_HTML, "gal-1", "https://new.example.com/new.jpg");
    expect(result).toContain(`src="https://new.example.com/new.jpg"`);
  });

  it("指定した img だけが更新され他は変わらない", () => {
    const result = updateGalleryItemImage(GALLERY_IMG_HTML, "gal-1", "https://updated.com/img.jpg");
    expect(result).toContain("https://example.com/img2.jpg"); // gal-2 は変わらない
    expect(result).not.toContain("https://example.com/img1.jpg"); // gal-1 は更新される
  });

  it("lp-gallery-item（div に id）の中の img src を差し替えられる", () => {
    const result = updateGalleryItemImage(GALLERY_ITEM_HTML, "item-1", "https://new.com/updated.jpg");
    expect(result).toContain(`src="https://new.com/updated.jpg"`);
  });

  it("存在しない elementId を渡すと元の HTML をそのまま返す", () => {
    const result = updateGalleryItemImage(GALLERY_IMG_HTML, "no-such", "https://new.com/img.jpg");
    expect(result).toBe(GALLERY_IMG_HTML);
  });
});

// ─── getBeforeAfterSrc ───────────────────────────────────────────────────────

describe("getBeforeAfterSrc", () => {
  it("Before 画像の src を取得できる", () => {
    const src = getBeforeAfterSrc(BEFORE_AFTER_HTML, "ba-before");
    expect(src).toContain("Before");
  });

  it("After 画像の src を取得できる", () => {
    const src = getBeforeAfterSrc(BEFORE_AFTER_HTML, "ba-after");
    expect(src).toContain("After");
  });

  it("存在しない elementId は空文字を返す", () => {
    expect(getBeforeAfterSrc(BEFORE_AFTER_HTML, "no-such")).toBe("");
  });
});

// ─── replaceBeforeAfterImage ─────────────────────────────────────────────────

describe("replaceBeforeAfterImage", () => {
  it("Before 枠の画像を差し替えられる", () => {
    const NEW_URL = "https://example.com/real-before.jpg";
    const result = replaceBeforeAfterImage(BEFORE_AFTER_HTML, "ba-before", NEW_URL);
    const src = getBeforeAfterSrc(result, "ba-before");
    expect(src).toBe(NEW_URL);
  });

  it("After 枠の画像を差し替えられる", () => {
    const NEW_URL = "https://example.com/real-after.jpg";
    const result = replaceBeforeAfterImage(BEFORE_AFTER_HTML, "ba-after", NEW_URL);
    const src = getBeforeAfterSrc(result, "ba-after");
    expect(src).toBe(NEW_URL);
  });

  it("一方を更新してももう一方は変わらない", () => {
    const result = replaceBeforeAfterImage(BEFORE_AFTER_HTML, "ba-before", "https://new.com/before.jpg");
    const afterSrc = getBeforeAfterSrc(result, "ba-after");
    expect(afterSrc).toContain("After"); // After は元のまま
  });

  it("data: URL（アップロード画像）も設定できる", () => {
    const DATA_URL = "data:image/jpeg;base64,/9j/FAKE_DATA";
    const result = replaceBeforeAfterImage(BEFORE_AFTER_HTML, "ba-before", DATA_URL);
    expect(result).toContain(DATA_URL);
  });

  it("存在しない elementId を渡すと元の HTML をそのまま返す", () => {
    const result = replaceBeforeAfterImage(BEFORE_AFTER_HTML, "no-such", "https://new.com/img.jpg");
    expect(result).toBe(BEFORE_AFTER_HTML);
  });
});
