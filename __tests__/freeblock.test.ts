/**
 * FreeBlock（自由編集セクション）の純粋関数テスト
 *
 * parseFbElements / addFbElement / removeFbElement / moveFbElement /
 * updateFbElement / getFbBgColor / setFbBgColor / extractFbUniqueClass
 * が正しく動作するかを確認する。
 */

import { describe, it, expect } from "vitest";
import {
  extractFbUniqueClass,
  parseFbElements,
  addFbElement,
  removeFbElement,
  moveFbElement,
  updateFbElement,
  getFbBgColor,
  setFbBgColor,
  type FbElement,
} from "@/components/FreeBlockPanel";

// ─── テスト用 HTML ──────────────────────────────────────────────────────────────

const UNIQUE_CLASS = "lp-freeblock_abc123";

/** 見出し・テキスト・ボタンを含む典型的な freeblock */
const BASE_HTML = `<section class="${UNIQUE_CLASS} lp-freeblock" style="padding:40px 0">
  <div class="lp-fb-inner">
    <h2 class="lp-fb-heading" data-lp-fb-el="heading" data-lp-fb-el-id="el-1">タイトル</h2>
    <p class="lp-fb-text" data-lp-fb-el="text" data-lp-fb-el-id="el-2">本文テキスト</p>
    <a class="lp-fb-btn" href="https://example.com" data-lp-fb-el="button" data-lp-fb-el-id="el-3">ボタン</a>
  </div>
</section>`;

/** 画像要素あり（スマホ画像なし） */
const IMAGE_HTML = `<section class="${UNIQUE_CLASS} lp-freeblock">
  <div class="lp-fb-inner">
    <div class="lp-fb-img-wrap" data-lp-fb-el="image" data-lp-fb-el-id="el-img">
      <img src="https://example.com/photo.jpg" alt="" style="max-width:100%;height:auto;border-radius:8px;display:block;" />
    </div>
  </div>
</section>`;

/** 画像要素あり（スマホ画像あり） */
const MOBILE_IMG_URL = "data:image/jpeg;base64,/9j/FAKE";
const IMAGE_MOBILE_HTML = `<section class="${UNIQUE_CLASS} lp-freeblock">
  <div class="lp-fb-inner">
    <div class="lp-fb-img-wrap" data-lp-fb-el="image" data-lp-fb-el-id="el-img">
      <picture><source media="(max-width: 640px)" srcset="${MOBILE_IMG_URL}"><img src="https://example.com/photo.jpg" alt="" style="max-width:100%;height:auto;border-radius:8px;display:block;" /></picture>
    </div>
  </div>
</section>`;

// ─── extractFbUniqueClass ───────────────────────────────────────────────────────

describe("extractFbUniqueClass", () => {
  it("セレクター文字列から一意クラスを抽出できる", () => {
    const result = extractFbUniqueClass(".lp-freeblock_abc123.lp-freeblock");
    expect(result).toBe("lp-freeblock_abc123");
  });

  it("一意クラスなしのセレクターは null を返す", () => {
    expect(extractFbUniqueClass(".lp-freeblock")).toBeNull();
  });

  it("一意クラスのみのセレクターからも抽出できる", () => {
    expect(extractFbUniqueClass(".lp-freeblock_xyz789")).toBe("lp-freeblock_xyz789");
  });
});

// ─── parseFbElements ────────────────────────────────────────────────────────────

describe("parseFbElements", () => {
  it("見出し・テキスト・ボタンを正しく解析できる", () => {
    const els = parseFbElements(BASE_HTML, UNIQUE_CLASS);
    expect(els).toHaveLength(3);
    expect(els[0]).toMatchObject({ id: "el-1", type: "heading", content: "タイトル" });
    expect(els[1]).toMatchObject({ id: "el-2", type: "text", content: "本文テキスト" });
    expect(els[2]).toMatchObject({ id: "el-3", type: "button", content: "ボタン", link: "https://example.com" });
  });

  it("ボタンの href が '#' のとき link は空文字になる", () => {
    const html = BASE_HTML.replace('href="https://example.com"', 'href="#"');
    const els = parseFbElements(html, UNIQUE_CLASS);
    const btn = els.find((e) => e.type === "button");
    expect(btn?.link).toBe("");
  });

  it("画像要素の src を取得できる", () => {
    const els = parseFbElements(IMAGE_HTML, UNIQUE_CLASS);
    expect(els).toHaveLength(1);
    expect(els[0].type).toBe("image");
    expect(els[0].content).toBe("https://example.com/photo.jpg");
    expect(els[0].mobileImageUrl).toBeUndefined();
  });

  it("スマホ用画像がある場合 mobileImageUrl が取得できる", () => {
    const els = parseFbElements(IMAGE_MOBILE_HTML, UNIQUE_CLASS);
    expect(els[0].mobileImageUrl).toBe(MOBILE_IMG_URL);
  });

  it("uniqueClass が null のとき .lp-freeblock にフォールバックする", () => {
    const html = BASE_HTML.replace(UNIQUE_CLASS + " lp-freeblock", "lp-freeblock");
    const els = parseFbElements(html, null);
    expect(els).toHaveLength(3);
  });

  it("存在しないセクションのとき空配列を返す", () => {
    const html = "<section class='lp-hero'><h1>hello</h1></section>";
    const els = parseFbElements(html, UNIQUE_CLASS);
    expect(els).toHaveLength(0);
  });
});

// ─── addFbElement ───────────────────────────────────────────────────────────────

describe("addFbElement", () => {
  it("見出し要素を追加できる", () => {
    const result = addFbElement(BASE_HTML, "heading", UNIQUE_CLASS);
    const els = parseFbElements(result, UNIQUE_CLASS);
    expect(els).toHaveLength(4);
    expect(els[3].type).toBe("heading");
  });

  it("画像要素を追加できる", () => {
    const result = addFbElement(BASE_HTML, "image", UNIQUE_CLASS);
    const els = parseFbElements(result, UNIQUE_CLASS);
    expect(els[3].type).toBe("image");
  });

  it("ボタン要素を追加できる", () => {
    const result = addFbElement(BASE_HTML, "button", UNIQUE_CLASS);
    const els = parseFbElements(result, UNIQUE_CLASS);
    const last = els[els.length - 1];
    expect(last.type).toBe("button");
  });
});

// ─── removeFbElement ────────────────────────────────────────────────────────────

describe("removeFbElement", () => {
  it("指定した id の要素を削除できる", () => {
    const result = removeFbElement(BASE_HTML, "el-2", UNIQUE_CLASS);
    const els = parseFbElements(result, UNIQUE_CLASS);
    expect(els).toHaveLength(2);
    expect(els.find((e) => e.id === "el-2")).toBeUndefined();
  });

  it("存在しない id を渡しても変化しない", () => {
    const result = removeFbElement(BASE_HTML, "no-such-id", UNIQUE_CLASS);
    const els = parseFbElements(result, UNIQUE_CLASS);
    expect(els).toHaveLength(3);
  });
});

// ─── moveFbElement ──────────────────────────────────────────────────────────────

describe("moveFbElement", () => {
  it("要素を上に移動できる", () => {
    const result = moveFbElement(BASE_HTML, "el-2", "up", UNIQUE_CLASS);
    const els = parseFbElements(result, UNIQUE_CLASS);
    expect(els[0].id).toBe("el-2");
    expect(els[1].id).toBe("el-1");
  });

  it("要素を下に移動できる", () => {
    const result = moveFbElement(BASE_HTML, "el-2", "down", UNIQUE_CLASS);
    const els = parseFbElements(result, UNIQUE_CLASS);
    expect(els[1].id).toBe("el-3");
    expect(els[2].id).toBe("el-2");
  });

  it("先頭要素を up しても変化しない", () => {
    const result = moveFbElement(BASE_HTML, "el-1", "up", UNIQUE_CLASS);
    const els = parseFbElements(result, UNIQUE_CLASS);
    expect(els[0].id).toBe("el-1");
  });

  it("末尾要素を down しても変化しない", () => {
    const result = moveFbElement(BASE_HTML, "el-3", "down", UNIQUE_CLASS);
    const els = parseFbElements(result, UNIQUE_CLASS);
    expect(els[2].id).toBe("el-3");
  });
});

// ─── updateFbElement ────────────────────────────────────────────────────────────

describe("updateFbElement", () => {
  it("見出しのテキストを更新できる", () => {
    const result = updateFbElement(BASE_HTML, "el-1", "新しいタイトル", UNIQUE_CLASS);
    const els = parseFbElements(result, UNIQUE_CLASS);
    expect(els[0].content).toBe("新しいタイトル");
  });

  it("ボタンのリンクを更新できる", () => {
    const result = updateFbElement(BASE_HTML, "el-3", { link: "https://new.example.com" }, UNIQUE_CLASS);
    const els = parseFbElements(result, UNIQUE_CLASS);
    const btn = els.find((e) => e.id === "el-3");
    expect(btn?.link).toBe("https://new.example.com");
  });

  it("画像の mobileImageUrl を更新できる", () => {
    const result = updateFbElement(IMAGE_HTML, "el-img", { mobileImageUrl: MOBILE_IMG_URL }, UNIQUE_CLASS);
    const els = parseFbElements(result, UNIQUE_CLASS);
    expect(els[0].mobileImageUrl).toBe(MOBILE_IMG_URL);
  });

  it("存在しない id を渡しても他の要素は変化しない", () => {
    const result = updateFbElement(BASE_HTML, "no-id", "更新", UNIQUE_CLASS);
    const els = parseFbElements(result, UNIQUE_CLASS);
    expect(els[0].content).toBe("タイトル");
  });
});

// ─── getFbBgColor / setFbBgColor ────────────────────────────────────────────────

describe("getFbBgColor / setFbBgColor", () => {
  it("背景色なしのとき #ffffff を返す", () => {
    expect(getFbBgColor(BASE_HTML, UNIQUE_CLASS)).toBe("#ffffff");
  });

  it("背景色を設定した HTML から hex を取得できる", () => {
    const withBg = setFbBgColor(BASE_HTML, UNIQUE_CLASS, "#123456");
    expect(getFbBgColor(withBg, UNIQUE_CLASS)).toBe("#123456");
  });

  it("背景色を #ffffff に設定すると style 属性から除去される", () => {
    const withBg = setFbBgColor(BASE_HTML, UNIQUE_CLASS, "#ff0000");
    const reset = setFbBgColor(withBg, UNIQUE_CLASS, "#ffffff");
    expect(reset).not.toContain("background-color:#ff0000");
  });

  it("setFbBgColor は既存の背景色を上書きする", () => {
    const first = setFbBgColor(BASE_HTML, UNIQUE_CLASS, "#aabbcc");
    const second = setFbBgColor(first, UNIQUE_CLASS, "#001122");
    const color = getFbBgColor(second, UNIQUE_CLASS);
    expect(color).toBe("#001122");
    expect(second).not.toContain("#aabbcc");
  });

  it("uniqueClass が null のとき .lp-freeblock にフォールバックする", () => {
    const html = BASE_HTML.replace(UNIQUE_CLASS + " lp-freeblock", "lp-freeblock");
    const withBg = setFbBgColor(html, null, "#abcdef");
    expect(getFbBgColor(withBg, null)).toBe("#abcdef");
  });
});
