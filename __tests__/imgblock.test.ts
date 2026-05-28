/**
 * imgblock（画像セクション）スマホ画像登録のテスト
 *
 * 何度も壊れた経緯があるため、ここで動作を固定しておく。
 * このテストが通らない = スマホ画像登録が壊れている、ということ。
 */

import { describe, it, expect } from "vitest";
import {
  parseImgBlockFromHtml,
  replaceImgBlockInHtml,
  type ImgBlockCfg,
} from "@/components/ImageInsertPanel";

// ─── テスト用 HTML ──────────────────────────────────────────────────────────────

/** sectionTemplates.ts が生成するテンプレート形式（lp-imgblock-img クラスあり） */
const TEMPLATE_HTML = `<section class="lp-imgblock_abc123 lp-imgblock" style="padding-top:40px;padding-bottom:40px;padding-left:0;padding-right:0">
  <div class="lp-imgblock-inner lp-imgblock-inner--center">
    <img class="lp-imgblock-img" src="https://placehold.co/800x450?text=Image" alt="" style="width:100%">
  </div>
</section>`;

/** AI 生成または手動記述の imgblock（lp-imgblock-img クラスなし） */
const PLAIN_HTML = `<section class="lp-imgblock_xyz789 lp-imgblock" style="padding-top:0;padding-bottom:0;padding-left:0;padding-right:0">
  <div class="lp-imgblock-inner lp-imgblock-inner--center">
    <img src="https://example.com/photo.jpg" alt="写真">
  </div>
</section>`;

const MOBILE_URL = "data:image/jpeg;base64,/9j/FAKE_BASE64_DATA";
const PC_URL = "https://example.com/pc.jpg";

// ─── テスト ────────────────────────────────────────────────────────────────────

describe("parseImgBlockFromHtml", () => {
  it("lp-imgblock-img クラスありの img を正しく解析できる", () => {
    const cfg = parseImgBlockFromHtml(TEMPLATE_HTML, "lp-imgblock_abc123");
    expect(cfg).not.toBeNull();
    expect(cfg!.imageUrl).toContain("placehold.co");
    expect(cfg!.mobileImageUrl).toBe("");
    expect(cfg!.alignment).toBe("center");
    expect(cfg!.width).toBe("100%");
  });

  it("lp-imgblock-img クラスなしの img も解析できる（AI生成HTML対応）", () => {
    const cfg = parseImgBlockFromHtml(PLAIN_HTML, "lp-imgblock_xyz789");
    expect(cfg).not.toBeNull();
    expect(cfg!.imageUrl).toBe("https://example.com/photo.jpg");
    expect(cfg!.alt).toBe("写真");
  });

  it("スマホ用画像が設定済みの HTML から mobileImageUrl を取得できる", () => {
    const cfg = parseImgBlockFromHtml(TEMPLATE_HTML, "lp-imgblock_abc123")!;
    const updatedHtml = replaceImgBlockInHtml(TEMPLATE_HTML, { ...cfg, mobileImageUrl: MOBILE_URL }, "lp-imgblock_abc123");

    const cfg2 = parseImgBlockFromHtml(updatedHtml, "lp-imgblock_abc123");
    expect(cfg2!.mobileImageUrl).toBe(MOBILE_URL);
  });

  it("padding-top / padding-bottom / paddingH を正しく解析できる", () => {
    const cfg = parseImgBlockFromHtml(TEMPLATE_HTML, "lp-imgblock_abc123");
    expect(cfg!.paddingTop).toBe("40px");
    expect(cfg!.paddingBottom).toBe("40px");
    expect(cfg!.paddingH).toBe("0");
  });

  it("セクションが存在しないとき null を返す", () => {
    const html = "<section class='lp-hero'><h1>hello</h1></section>";
    const result = parseImgBlockFromHtml(html, "lp-imgblock_notfound");
    expect(result).toBeNull();
  });
});

describe("replaceImgBlockInHtml - スマホ画像登録（最重要）", () => {
  it("スマホ画像を登録すると <picture><source> が追加される", () => {
    const cfg = parseImgBlockFromHtml(TEMPLATE_HTML, "lp-imgblock_abc123")!;
    const result = replaceImgBlockInHtml(TEMPLATE_HTML, { ...cfg, mobileImageUrl: MOBILE_URL }, "lp-imgblock_abc123");

    expect(result).toContain("<picture>");
    expect(result).toContain('media="(max-width: 640px)"');
    expect(result).toContain(`srcset="${MOBILE_URL}"`);
  });

  it("lp-imgblock-img クラスなしの img でもスマホ画像を登録できる", () => {
    const cfg = parseImgBlockFromHtml(PLAIN_HTML, "lp-imgblock_xyz789")!;
    const result = replaceImgBlockInHtml(PLAIN_HTML, { ...cfg, mobileImageUrl: MOBILE_URL }, "lp-imgblock_xyz789");

    expect(result).toContain("<picture>");
    expect(result).toContain(`srcset="${MOBILE_URL}"`);
  });

  it("スマホ画像を削除すると <picture> が取り除かれる", () => {
    const cfg = parseImgBlockFromHtml(TEMPLATE_HTML, "lp-imgblock_abc123")!;
    const withMobile = replaceImgBlockInHtml(TEMPLATE_HTML, { ...cfg, mobileImageUrl: MOBILE_URL }, "lp-imgblock_abc123");
    const cfg2 = parseImgBlockFromHtml(withMobile, "lp-imgblock_abc123")!;
    const result = replaceImgBlockInHtml(withMobile, { ...cfg2, mobileImageUrl: "" }, "lp-imgblock_abc123");

    expect(result).not.toContain("<picture>");
    expect(result).toContain("<img");
  });

  it("スマホ画像を差し替えると srcset が更新される", () => {
    const cfg = parseImgBlockFromHtml(TEMPLATE_HTML, "lp-imgblock_abc123")!;
    const withMobile = replaceImgBlockInHtml(TEMPLATE_HTML, { ...cfg, mobileImageUrl: MOBILE_URL }, "lp-imgblock_abc123");
    const cfg2 = parseImgBlockFromHtml(withMobile, "lp-imgblock_abc123")!;

    const NEW_MOBILE = "data:image/png;base64,UPDATED";
    const result = replaceImgBlockInHtml(withMobile, { ...cfg2, mobileImageUrl: NEW_MOBILE }, "lp-imgblock_abc123");

    expect(result).toContain(`srcset="${NEW_MOBILE}"`);
    expect(result).not.toContain(`srcset="${MOBILE_URL}"`);
  });

  it("PC画像の src を変更しても HTML が正しく返る", () => {
    const cfg = parseImgBlockFromHtml(TEMPLATE_HTML, "lp-imgblock_abc123")!;
    const result = replaceImgBlockInHtml(TEMPLATE_HTML, { ...cfg, imageUrl: PC_URL }, "lp-imgblock_abc123");

    const cfg2 = parseImgBlockFromHtml(result, "lp-imgblock_abc123");
    expect(cfg2!.imageUrl).toBe(PC_URL);
  });

  it("alignment を right に変更できる", () => {
    const cfg = parseImgBlockFromHtml(TEMPLATE_HTML, "lp-imgblock_abc123")!;
    const result = replaceImgBlockInHtml(TEMPLATE_HTML, { ...cfg, alignment: "right" }, "lp-imgblock_abc123");

    const cfg2 = parseImgBlockFromHtml(result, "lp-imgblock_abc123");
    expect(cfg2!.alignment).toBe("right");
  });

  it("paddingTop / paddingBottom / paddingH を変更できる", () => {
    const cfg = parseImgBlockFromHtml(TEMPLATE_HTML, "lp-imgblock_abc123")!;
    const result = replaceImgBlockInHtml(
      TEMPLATE_HTML,
      { ...cfg, paddingTop: "20px", paddingBottom: "30px", paddingH: "16px" },
      "lp-imgblock_abc123",
    );

    const cfg2 = parseImgBlockFromHtml(result, "lp-imgblock_abc123");
    expect(cfg2!.paddingTop).toBe("20px");
    expect(cfg2!.paddingBottom).toBe("30px");
    expect(cfg2!.paddingH).toBe("16px");
  });

  it("uniqueClass が null のとき .lp-imgblock セレクターにフォールバックする", () => {
    const html = TEMPLATE_HTML.replace("lp-imgblock_abc123 lp-imgblock", "lp-imgblock");
    const cfg = parseImgBlockFromHtml(html, null)!;
    const result = replaceImgBlockInHtml(html, { ...cfg, mobileImageUrl: MOBILE_URL }, null);

    expect(result).toContain("<picture>");
  });

  it("存在しないセクションのとき元の HTML をそのまま返す", () => {
    const html = "<section class='lp-hero'><h1>hello</h1></section>";
    const cfg: ImgBlockCfg = {
      imageUrl: "", mobileImageUrl: MOBILE_URL, alt: "", alignment: "center",
      width: "100%", height: "auto", borderRadius: "0",
      paddingTop: "0", paddingBottom: "0", paddingH: "0",
    };
    const result = replaceImgBlockInHtml(html, cfg, "lp-imgblock_notfound");
    expect(result).toBe(html);
  });
});
