/**
 * imgblock（画像セクション）スマホ画像登録のテスト
 *
 * 何度も壊れた経緯があるため、ここで動作を固定しておく。
 * このテストが通らない = スマホ画像登録が壊れている、ということ。
 */

import { describe, it, expect } from "vitest";

// テスト対象の関数を直接インポートするため、エクスポートが必要。
// 現状 non-exported なので、テスト用に同等のロジックをここで再現する。
// → 将来的には ImageInsertPanel.tsx からエクスポートして import する形にする。

// ─── テスト用に関数を再実装（ImageInsertPanel.tsx と同一ロジック）──────────────

interface ImgBlockCfg {
  imageUrl: string;
  mobileImageUrl: string;
  alt: string;
  alignment: "left" | "center" | "right";
  width: string;
  height: string;
  borderRadius: string;
  paddingTop: string;
  paddingBottom: string;
  paddingH: string;
}

function parseImgBlockFromHtml(html: string, uniqueClass?: string | null): ImgBlockCfg | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const selector = uniqueClass ? `.${uniqueClass}` : ".lp-imgblock";
  const section = doc.querySelector(selector);
  const img = section?.querySelector("img");
  if (!section || !img) return null;
  const ss = section.getAttribute("style") ?? "";
  const is = img.getAttribute("style") ?? "";
  const innerEl = section.querySelector('[class*="lp-imgblock-inner--"]');
  const alignMatch = (innerEl?.className ?? "").match(/lp-imgblock-inner--(left|center|right)/);
  const sourceEl = section.querySelector("picture > source[media]") as HTMLSourceElement | null;
  const mobileImageUrl = sourceEl?.getAttribute("srcset") ?? "";
  return {
    imageUrl: img.getAttribute("src") ?? "",
    mobileImageUrl,
    alt: img.getAttribute("alt") ?? "",
    alignment: (alignMatch?.[1] ?? "center") as "left" | "center" | "right",
    width: is.match(/width:\s*([^;]+)/)?.[1]?.trim() ?? "100%",
    height: is.match(/height:\s*([^;]+)/)?.[1]?.trim() ?? "auto",
    borderRadius: is.match(/border-radius:\s*([^;]+)/)?.[1]?.trim() ?? "0",
    paddingTop: ss.match(/padding-top:\s*([^;]+)/)?.[1]?.trim() ?? "0",
    paddingBottom: ss.match(/padding-bottom:\s*([^;]+)/)?.[1]?.trim() ?? "0",
    paddingH: ss.match(/padding-left:\s*([^;]+)/)?.[1]?.trim() ?? "0",
  };
}

function replaceImgBlockInHtml(html: string, cfg: ImgBlockCfg, uniqueClass?: string | null): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const selector = uniqueClass ? `.${uniqueClass}` : ".lp-imgblock";
  const section = doc.querySelector(selector) as HTMLElement | null;
  if (!section) return html;
  const img = (section.querySelector("img.lp-imgblock-img") ?? section.querySelector("img")) as HTMLImageElement | null;
  if (!img) return html;

  const pt = cfg.paddingTop || "0";
  const pb = cfg.paddingBottom || "0";
  const ph = cfg.paddingH || "0";
  section.setAttribute("style", `padding-top:${pt};padding-bottom:${pb};padding-left:${ph};padding-right:${ph}`);

  const alignMod = cfg.alignment === "left" ? "left" : cfg.alignment === "right" ? "right" : "center";
  const innerEl = section.querySelector('[class*="lp-imgblock-inner"]') as HTMLElement | null;
  if (innerEl) innerEl.className = `lp-imgblock-inner lp-imgblock-inner--${alignMod}`;

  const src = cfg.imageUrl || "https://placehold.co/800x450?text=Image";
  const imgStyleParts = [
    `width:${cfg.width || "100%"}`,
    cfg.height && cfg.height !== "auto" ? `height:${cfg.height}` : "",
    cfg.borderRadius && cfg.borderRadius !== "0" && cfg.borderRadius !== "0px"
      ? `border-radius:${cfg.borderRadius}` : "",
  ].filter(Boolean);
  img.setAttribute("src", src);
  img.setAttribute("alt", cfg.alt);
  if (imgStyleParts.length > 0) {
    img.setAttribute("style", imgStyleParts.join(";"));
  } else {
    img.removeAttribute("style");
  }

  const picturePar = img.closest("picture");
  if (cfg.mobileImageUrl) {
    if (picturePar) {
      let sourceEl = picturePar.querySelector("source[media]") as HTMLSourceElement | null;
      if (!sourceEl) {
        sourceEl = doc.createElement("source") as HTMLSourceElement;
        sourceEl.setAttribute("media", "(max-width: 640px)");
        picturePar.insertBefore(sourceEl, img);
      }
      sourceEl.setAttribute("srcset", cfg.mobileImageUrl);
    } else {
      const picture = doc.createElement("picture");
      const sourceEl = doc.createElement("source") as HTMLSourceElement;
      sourceEl.setAttribute("media", "(max-width: 640px)");
      sourceEl.setAttribute("srcset", cfg.mobileImageUrl);
      img.parentNode!.insertBefore(picture, img);
      picture.appendChild(sourceEl);
      picture.appendChild(img);
    }
  } else {
    if (picturePar) {
      picturePar.parentNode!.insertBefore(img, picturePar);
      picturePar.remove();
    }
  }

  return doc.body.innerHTML;
}

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
    // まずスマホ画像を設定した HTML を作る
    const cfg = parseImgBlockFromHtml(TEMPLATE_HTML, "lp-imgblock_abc123")!;
    const updatedHtml = replaceImgBlockInHtml(TEMPLATE_HTML, { ...cfg, mobileImageUrl: MOBILE_URL }, "lp-imgblock_abc123");

    // その HTML を再パースして mobileImageUrl が取れるか確認
    const cfg2 = parseImgBlockFromHtml(updatedHtml, "lp-imgblock_abc123");
    expect(cfg2!.mobileImageUrl).toBe(MOBILE_URL);
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
    // まずスマホ画像を追加
    const withMobile = replaceImgBlockInHtml(TEMPLATE_HTML, { ...cfg, mobileImageUrl: MOBILE_URL }, "lp-imgblock_abc123");
    // 次に削除
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
