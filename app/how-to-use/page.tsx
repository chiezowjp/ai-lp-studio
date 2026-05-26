"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AccordionItem {
  id: string;
  emoji: string;
  title: string;
  content: React.ReactNode;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Step({ number, text }: { number: number; text: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 mb-3">
      <span
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white"
        style={{ backgroundColor: "#00AFCC" }}
      >
        {number}
      </span>
      <p className="text-gray-700 leading-relaxed pt-0.5">{text}</p>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 p-4 rounded-lg border-l-4 border-orange-400 bg-orange-50">
      <p className="text-orange-800 text-sm leading-relaxed">
        <span className="font-bold">⚠️ 注意：</span> {children}
      </p>
    </div>
  );
}

function RouteCard({
  number,
  title,
  description,
  steps,
}: {
  number: string;
  title: string;
  description: string;
  steps: React.ReactNode[];
}) {
  return (
    <div className="mb-6 border border-gray-200 rounded-xl overflow-hidden">
      <div
        className="px-5 py-3 text-white font-semibold text-sm"
        style={{ backgroundColor: "#00AFCC" }}
      >
        ルート{number}：{title}
      </div>
      <div className="p-5 bg-white">
        <p className="text-gray-600 text-sm mb-4">{description}</p>
        {steps.map((step, i) => (
          <div key={i}>{step}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Accordion ────────────────────────────────────────────────────────────────

function Accordion({ items }: { items: AccordionItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div
            key={item.id}
            className="border border-gray-200 rounded-xl overflow-hidden shadow-sm"
          >
            <button
              onClick={() => toggle(item.id)}
              className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition-colors text-left"
            >
              <span className="flex items-center gap-3 font-semibold text-gray-800 text-base">
                <span className="text-xl">{item.emoji}</span>
                {item.title}
              </span>
              <span
                className="flex-shrink-0 ml-2 text-lg transition-transform duration-200"
                style={{
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  color: "#00AFCC",
                }}
              >
                ▾
              </span>
            </button>
            {isOpen && (
              <div className="px-5 pb-6 pt-2 bg-white border-t border-gray-100">
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Section Content ──────────────────────────────────────────────────────────

const accordionItems: AccordionItem[] = [
  {
    id: "about",
    emoji: "🚀",
    title: "AI LP STUDIOとは",
    content: (
      <div className="text-gray-700 leading-relaxed space-y-3">
        <p>
          <strong>AI LP STUDIO</strong> は、AIの力を使って高品質なランディングページ（LP）を素早く作成・公開できるサービスです。
        </p>
        <ul className="list-none space-y-2 mt-2">
          {[
            "フォームに情報を入力するだけでAIがLPのHTMLを自動生成",
            "既存サイトのURLを読み込んで情報を自動入力",
            "参考LPを分析してデザインの方向性を決定",
            "作成後はビジュアルエディターでテキスト・カラー・フォントを編集",
            "そのまま公開URLを発行してすぐに使える",
            "問い合わせフォームの設置・リード管理もワンストップ",
            "アクセス解析でLP効果を計測",
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span style={{ color: "#00AFCC" }} className="font-bold mt-0.5">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-gray-500 mt-3">
          コーディング不要。マーケターや営業担当者が自分でLPを作れる時代へ。
        </p>
      </div>
    ),
  },
  {
    id: "start",
    emoji: "👤",
    title: "はじめ方（ログイン・トライアル登録）",
    content: (
      <div>
        <p className="text-gray-600 mb-4 text-sm">まずはアカウントを作成してサービスを開始しましょう。</p>
        <Step number={1} text="トップページの「無料で試す」または「ログイン」ボタンをクリックします。" />
        <Step number={2} text="メールアドレスとパスワードを入力して新規登録、またはGoogleアカウントでログインします。" />
        <Step number={3} text="登録完了後、自動的にトライアルプランが開始されます。クレジットカードの登録は不要です。" />
        <Step number={4} text="ダッシュボード（マイLP）が表示されたら準備完了です。早速LPを作ってみましょう！" />
        <Note>
          トライアルは登録日から14日間有効です。期間終了後は自動課金されません。Proプランへのアップグレードは「プランについて」セクションをご確認ください。
        </Note>
      </div>
    ),
  },
  {
    id: "create",
    emoji: "✏️",
    title: "LPを作る（4つのルート）",
    content: (
      <div>
        <p className="text-gray-600 mb-5 text-sm">
          LPの作成方法は4つのルートから選べます。状況に合わせて最適な方法をお選びください。
        </p>

        <RouteCard
          number="①"
          title="フォームに手入力して作る"
          description="一番シンプルな方法。自分でフォームに情報を入力してLPを生成します。"
          steps={[
            <Step key={1} number={1} text="エディター画面を開き、左側の「LPフォーム」に必要事項（サービス名・キャッチコピー・ターゲット・特徴など）を入力します。" />,
            <Step key={2} number={2} text="すべての項目を入力したら「LP生成」ボタンをクリックします。" />,
            <Step key={3} number={3} text="AIがHTMLを生成し、右側のプレビューにLPが表示されます。" />,
          ]}
        />

        <RouteCard
          number="②"
          title="既存サイトURLから自動入力して作る"
          description="自社や競合のWebサイトURLを入力するだけで、AIがサイトを解析してフォームを自動入力します。"
          steps={[
            <Step key={1} number={1} text="エディター画面上部の「サイトURLから読み込む」ボタンをクリックします。" />,
            <Step key={2} number={2} text="読み込みたいWebサイトのURL（例：https://example.com）を入力して「読み込む」を押します。" />,
            <Step key={3} number={3} text="AIがサイトを解析し、サービス名・説明文・特徴などをフォームに自動入力します。" />,
            <Step key={4} number={4} text="自動入力された内容を確認・修正してから「LP生成」ボタンをクリックします。" />,
          ]}
        />

        <RouteCard
          number="③"
          title="ヒアリングシートからコピペして作る"
          description="既存のヒアリングシートや提案書がある場合、内容をコピーしてフォームに貼り付けるだけでOKです。"
          steps={[
            <Step key={1} number={1} text="ヒアリングシートや提案資料からサービス情報をコピーします。" />,
            <Step key={2} number={2} text="エディター左側のフォーム各項目に対応する内容をペーストします。" />,
            <Step key={3} number={3} text="内容を確認・調整してから「LP生成」ボタンをクリックします。" />,
          ]}
        />

        <RouteCard
          number="④"
          title="参考LPを参考にして作る"
          description="気に入ったLPのURLを入力すると、そのLPのデザイン・構成・トーンをAIが分析し、参考情報として生成に活かします。"
          steps={[
            <Step key={1} number={1} text="エディター右上の「参考LP分析」ボタンをクリックします。" />,
            <Step key={2} number={2} text="参考にしたいLPのURLを入力して「分析する」を押します。" />,
            <Step key={3} number={3} text="分析結果（セクション構成・トーン・特徴）が表示されます。活用する項目を選択します。" />,
            <Step key={4} number={4} text="フォームの情報と合わせて「LP生成」ボタンをクリックします。" />,
          ]}
        />

        <Note>
          ルート②と④を組み合わせる場合は、必ず <strong>②（サイトURL読み込み）→ ④（参考LP分析）の順番</strong> で行ってください。先に④を実行すると、②で上書きされる場合があります。
        </Note>
      </div>
    ),
  },
  {
    id: "edit",
    emoji: "🎨",
    title: "LPを編集する",
    content: (
      <div>
        <p className="text-gray-600 mb-4 text-sm">生成されたLPは、ビジュアルエディターで細かく編集できます。</p>

        <h3 className="font-semibold text-gray-800 mb-2 mt-4">📝 テキスト編集</h3>
        <Step number={1} text="プレビュー上のテキスト部分をクリックすると、そのテキストが選択された状態になります。" />
        <Step number={2} text="右側の編集パネルにテキスト編集フィールドが表示されるので、内容を書き換えます。" />
        <Step number={3} text="変更はリアルタイムでプレビューに反映されます。" />

        <h3 className="font-semibold text-gray-800 mb-2 mt-5">🎨 カラー変更</h3>
        <Step number={1} text="右パネルの「カラーテーマ」タブを開きます。" />
        <Step number={2} text="メインカラー・背景色・テキスト色などをカラーピッカーで変更できます。" />
        <Step number={3} text="プリセットテーマから一括変更することもできます。" />

        <h3 className="font-semibold text-gray-800 mb-2 mt-5">🔤 フォント変更</h3>
        <Step number={1} text="右パネルの「ビジュアルスタイル」タブを開きます。" />
        <Step number={2} text="フォントドロップダウンから好みのフォントを選択します（日本語・英語フォント対応）。" />

        <h3 className="font-semibold text-gray-800 mb-2 mt-5">➕ セクション追加・並び替え</h3>
        <Step number={1} text="「セクション追加」ボタンから新しいセクション（料金表・FAQ・タイムラインなど）を追加できます。" />
        <Step number={2} text="「セクション並び替え」パネルでドラッグ&ドロップしてセクションの順序を変更できます。" />
      </div>
    ),
  },
  {
    id: "images",
    emoji: "🖼️",
    title: "画像を使う",
    content: (
      <div>
        <p className="text-gray-600 mb-4 text-sm">LP内の画像はアセットライブラリまたはUnsplashから挿入できます。</p>

        <h3 className="font-semibold text-gray-800 mb-2">📁 アセットライブラリ（自分でアップロード）</h3>
        <Step number={1} text="右パネルの「画像」タブを開き、「画像をアップロード」をクリックします。" />
        <Step number={2} text="PC上の画像ファイル（JPG・PNG・WebP・GIFなど）を選択してアップロードします。" />
        <Step number={3} text="アップロードした画像はライブラリに保存され、何度でも再利用できます。" />
        <Step number={4} text="挿入したい箇所でライブラリから画像を選択して「挿入」します。" />

        <h3 className="font-semibold text-gray-800 mb-2 mt-5">🔍 Unsplash（フリー素材）</h3>
        <Step number={1} text="画像パネル内の「Unsplashから検索」タブを選択します。" />
        <Step number={2} text="キーワードを英語または日本語で入力して検索します（例：「office」「team」「technology」）。" />
        <Step number={3} text="気に入った画像をクリックするとLP内に挿入されます。商用利用も可能です。" />

        <Note>
          Unsplashの画像は著作権フリーですが、フォトグラファーへのクレジット表記が推奨されています。重要な商用利用の場合は利用規約を確認してください。
        </Note>
      </div>
    ),
  },
  {
    id: "form",
    emoji: "📋",
    title: "フォームを設置する",
    content: (
      <div>
        <p className="text-gray-600 mb-4 text-sm">LPにお問い合わせフォームを設置して、リードを収集できます。</p>
        <Step number={1} text="右パネルの「フォーム設定」タブを開きます。" />
        <Step number={2} text="収集する項目（名前・メールアドレス・電話番号・メッセージなど）を選択・追加します。" />
        <Step number={3} text="フォームの送信ボタンのテキストや、送信後のサンキューメッセージを設定します。" />
        <Step number={4} text="設定を保存すると、LPのフォームセクションに自動的に反映されます。" />
        <Step number={5} text="送信されたリードは「リード管理」ページで確認・エクスポートできます。" />
        <Note>
          フォームはLP公開後に機能します。プレビュー画面での送信テストはできません。
        </Note>
      </div>
    ),
  },
  {
    id: "publish",
    emoji: "🌐",
    title: "LPを公開する",
    content: (
      <div>
        <p className="text-gray-600 mb-4 text-sm">作成したLPは専用URLで即座に公開できます。</p>

        <h3 className="font-semibold text-gray-800 mb-2">🔗 公開URL</h3>
        <Step number={1} text="エディター上部の「公開する」ボタンをクリックします。" />
        <Step number={2} text="確認ダイアログが表示されたら「公開」を押します。" />
        <Step number={3} text="専用URL（例：https://lp.ailpstudio.com/p/xxxxxxxx）が発行されます。" />
        <Step number={4} text="URLをコピーして、メールや広告・SNSなどで共有できます。" />

        <h3 className="font-semibold text-gray-800 mb-2 mt-5">🔍 SEO設定</h3>
        <Step number={1} text="右パネルの「SEO」タブを開きます。" />
        <Step number={2} text="ページタイトル・メタディスクリプション・OGP画像を設定します。" />
        <Step number={3} text="SEOスコアチェッカーで改善点を確認し、スコアを上げましょう。" />

        <Note>
          公開後にLPを更新した場合は、再度「公開する」ボタンを押してください。変更は自動では反映されません。
        </Note>
      </div>
    ),
  },
  {
    id: "analytics",
    emoji: "📊",
    title: "データを確認する（Analytics・リード管理）",
    content: (
      <div>
        <p className="text-gray-600 mb-4 text-sm">公開したLPのパフォーマンスデータをリアルタイムで確認できます。</p>

        <h3 className="font-semibold text-gray-800 mb-2">📈 Analytics（アクセス解析）</h3>
        <Step number={1} text="左メニューの「Analytics」をクリックするか、マイLPの該当プロジェクトから「分析を見る」を選択します。" />
        <Step number={2} text="ページビュー・ユニークビジター・滞在時間・コンバージョン率などが確認できます。" />
        <Step number={3} text="期間フィルターで「過去7日」「過去30日」「カスタム期間」を切り替えられます。" />

        <h3 className="font-semibold text-gray-800 mb-2 mt-5">📨 リード管理</h3>
        <Step number={1} text="左メニューの「リード管理」をクリックします。" />
        <Step number={2} text="フォームから送信された問い合わせ一覧が表示されます。" />
        <Step number={3} text="「CSVエクスポート」ボタンでリードデータをダウンロードできます。" />

        <Note>
          AnalyticsデータはLP公開後から計測が始まります。公開前のプレビューアクセスはカウントされません。
        </Note>
      </div>
    ),
  },
  {
    id: "save",
    emoji: "💾",
    title: "保存・管理",
    content: (
      <div>
        <p className="text-gray-600 mb-4 text-sm">作成したLPはクラウドに自動保存されます。</p>

        <h3 className="font-semibold text-gray-800 mb-2">☁️ クラウド保存</h3>
        <Step number={1} text="LP編集中の変更は「保存する」ボタンを押すことでクラウドに保存されます。" />
        <Step number={2} text="保存済みのLPは「マイLP」ページからいつでも再編集できます。" />

        <h3 className="font-semibold text-gray-800 mb-2 mt-5">📁 マイLP（プロジェクト一覧）</h3>
        <Step number={1} text="左メニューの「マイLP」をクリックするとプロジェクト一覧が表示されます。" />
        <Step number={2} text="各LPカードの「編集」ボタンでエディターを開けます。" />

        <h3 className="font-semibold text-gray-800 mb-2 mt-5">📋 複製・タイトル変更</h3>
        <Step number={1} text="マイLPページの各プロジェクトカード右上の「…」メニューを開きます。" />
        <Step number={2} text="「複製」を選択すると、同じ内容のLPが新規プロジェクトとして作成されます。" />
        <Step number={3} text="「タイトルを変更」でプロジェクト名を編集できます（公開URLには影響しません）。" />

        <Note>
          トライアルプランでは作成できるLPの数に上限があります。詳しくは「プランについて」をご確認ください。
        </Note>
      </div>
    ),
  },
  {
    id: "plan",
    emoji: "💳",
    title: "プランについて",
    content: (
      <div>
        <p className="text-gray-600 mb-4 text-sm">AI LP STUDIOには「トライアル」と「Pro」の2つのプランがあります。</p>

        <div className="overflow-x-auto mb-5">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: "#00AFCC" }} className="text-white">
                <th className="px-4 py-3 text-left rounded-tl-lg">機能</th>
                <th className="px-4 py-3 text-center">トライアル</th>
                <th className="px-4 py-3 text-center rounded-tr-lg">Pro</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["利用期間", "14日間", "無制限"],
                ["LP作成数", "3件まで", "無制限"],
                ["LP公開", "○", "○"],
                ["カスタムドメイン", "×", "○"],
                ["Analytics", "基本", "詳細"],
                ["リード管理", "○", "○"],
                ["CSVエクスポート", "×", "○"],
                ["サポート", "メール", "優先メール"],
              ].map(([feature, trial, pro], i) => (
                <tr
                  key={i}
                  className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="px-4 py-2.5 font-medium text-gray-700 border-b border-gray-100">{feature}</td>
                  <td className="px-4 py-2.5 text-center text-gray-600 border-b border-gray-100">{trial}</td>
                  <td className="px-4 py-2.5 text-center font-semibold border-b border-gray-100" style={{ color: "#00AFCC" }}>{pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="font-semibold text-gray-800 mb-2">⬆️ Proへのアップグレード方法</h3>
        <Step number={1} text="左メニューの「プラン・お支払い」または画面上部のバナーをクリックします。" />
        <Step number={2} text="プラン選択画面で「Proプランにアップグレード」ボタンをクリックします。" />
        <Step number={3} text="クレジットカード情報を入力して支払い手続きを完了します（Stripe決済）。" />
        <Step number={4} text="アップグレード完了後、即座にProの全機能が利用可能になります。" />

        <Note>
          Proプランは月額課金制です。解約はいつでも可能で、解約後は当月末まで利用できます。返金対応はしておりません。
        </Note>
      </div>
    ),
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HowToUsePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5F5F2" }}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">📖</span>
            <h1 className="text-lg font-bold text-gray-800">使い方ガイド</h1>
            <span
              className="hidden sm:inline-block text-xs font-medium px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: "#00AFCC" }}
            >
              AI LP STUDIO
            </span>
          </div>
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors"
          >
            <span>←</span>
            <span className="hidden sm:inline">エディターへ</span>
            <span className="sm:hidden">戻る</span>
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Hero */}
        <div
          className="rounded-2xl p-6 mb-8 text-white"
          style={{ background: "linear-gradient(135deg, #00AFCC 0%, #0090aa 100%)" }}
        >
          <h2 className="text-2xl font-bold mb-2">AI LP STUDIOの使い方</h2>
          <p className="text-blue-50 text-sm leading-relaxed">
            このガイドでは、AI LP STUDIOの基本的な使い方からプラン詳細まで説明しています。
            各セクションをクリックして詳細を確認してください。
          </p>
        </div>

        {/* Accordion */}
        <Accordion items={accordionItems} />

        {/* Footer note */}
        <div className="mt-8 text-center text-xs text-gray-400">
          <p>ご不明な点はサポートまでお問い合わせください。</p>
          <p className="mt-1">© AI LP STUDIO</p>
        </div>
      </main>
    </div>
  );
}
