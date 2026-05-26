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
      <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white bg-[#00AFCC]">
        {number}
      </span>
      <p className="text-gray-700 leading-relaxed pt-0.5 text-sm">{text}</p>
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

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 p-4 rounded-lg border-l-4 border-[#00AFCC] bg-[#E6F8FC]">
      <p className="text-[#006d80] text-sm leading-relaxed">
        <span className="font-bold">💡 ヒント：</span> {children}
      </p>
    </div>
  );
}

function RouteCard({
  number,
  title,
  description,
  steps,
  tip,
}: {
  number: string;
  title: string;
  description: string;
  steps: React.ReactNode[];
  tip?: React.ReactNode;
}) {
  return (
    <div className="mb-6 border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 text-white font-semibold text-sm bg-[#00AFCC]">
        ルート{number}：{title}
      </div>
      <div className="p-5 bg-white">
        <p className="text-gray-600 text-sm mb-4">{description}</p>
        {steps.map((step, i) => (
          <div key={i}>{step}</div>
        ))}
        {tip && <Tip>{tip}</Tip>}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-bold text-gray-800 mb-3 mt-5 flex items-center gap-2 text-sm border-b border-gray-100 pb-2">
      {children}
    </h3>
  );
}

// ─── Accordion ────────────────────────────────────────────────────────────────

function Accordion({ items }: { items: AccordionItem[] }) {
  const [openId, setOpenId] = useState<string | null>("about");

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div key={item.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <button
              onClick={() => toggle(item.id)}
              className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition-colors text-left"
            >
              <span className="flex items-center gap-3 font-semibold text-gray-800 text-sm">
                <span className="text-xl">{item.emoji}</span>
                {item.title}
              </span>
              <span
                className="flex-shrink-0 ml-2 text-lg transition-transform duration-200 text-[#00AFCC]"
                style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
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
      <div className="text-gray-700 leading-relaxed space-y-3 text-sm">
        <p>
          <strong>AI LP STUDIO</strong> は、AIを使って高品質なランディングページ（LP）を素早く作成・公開できるサービスです。コーディングの知識は一切不要です。
        </p>
        <ul className="list-none space-y-2 mt-2">
          {[
            "サービス情報を入力するだけでAIがLPを自動生成",
            "既存サイトのURLを読み込んでフォームを自動入力",
            "ビジュアルエディターでテキスト・カラー・フォントを編集",
            "専用URLで即座に公開（サーバー不要）",
            "お問い合わせフォームの設置・リード管理",
            "アクセス解析（Analytics）でLP効果を計測",
            "AI画像プロンプトで画像のヒントを生成",
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-[#00AFCC] font-bold mt-0.5">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: "start",
    emoji: "👤",
    title: "はじめ方（ログイン・トライアル登録）",
    content: (
      <div>
        <p className="text-gray-600 mb-4 text-sm">Googleアカウントがあればすぐに始められます。クレジットカードの登録は不要です。</p>
        <Step number={1} text="トップページ右上の「ログイン」ボタンをクリックします。" />
        <Step number={2} text="「Googleでログイン」を選択してGoogleアカウントでログインします。" />
        <Step number={3} text="ログイン後、自動的に3日間のトライアルが開始されます。" />
        <Step number={4} text="エディター画面が表示されたら準備完了です。早速LPを作ってみましょう！" />
        <Note>
          トライアルは登録日から<strong>3日間</strong>有効です。期間終了後は編集・エクスポートがロックされます。Proプランにアップグレードするといつまでも利用できます。
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
            <Step key={1} number={1} text="エディター左側のフォームに「業種」「ターゲット」「サービス名」「サービス内容」「価格」「強み」などを入力します。" />,
            <Step key={2} number={2} text="フォームの内容を確認したら「LP生成」ボタンをクリックします。" />,
            <Step key={3} number={3} text="AIがHTMLを生成し、右側のプレビューにLPが表示されます（約30〜60秒）。" />,
          ]}
          tip="入力内容が詳しいほど、より精度の高いLPが生成されます。「強み」や「ターゲット」は具体的に書くのがポイントです。"
        />

        <RouteCard
          number="②"
          title="既存サイトURLから自動入力して作る"
          description="自社サイトのURLを入力するだけで、AIがサイトを解析してフォームを自動入力します。"
          steps={[
            <Step key={1} number={1} text="フォーム上部の「🌐 URL」タブをクリックします。" />,
            <Step key={2} number={2} text="自社サイトのURL（例：https://example.com）を入力して「読み込む」を押します。" />,
            <Step key={3} number={3} text="AIがサイトを解析し、サービス名・内容・特徴などをフォームに自動入力します。" />,
            <Step key={4} number={4} text="自動入力された内容を確認・修正してから「LP生成」ボタンをクリックします。" />,
          ]}
          tip="参考LPも使いたい場合は、このルート②を先に行ってからルート④へ進んでください。"
        />

        <RouteCard
          number="③"
          title="ヒアリングシートからコピペして作る"
          description="ヒアリングシートや企画書のテキストをコピペするだけで、AIが各項目に自動で振り分けます。"
          steps={[
            <Step key={1} number={1} text="フォーム上部の「📋 貼付」タブをクリックします。" />,
            <Step key={2} number={2} text="ヒアリングシートや企画書の内容をそのままテキストエリアに貼り付けます。" />,
            <Step key={3} number={3} text="「この内容でLPを生成」ボタンを押すと、AIが内容を解析して各フォーム項目に自動入力します。" />,
            <Step key={4} number={4} text="入力された内容を確認・修正してから「LP生成」ボタンをクリックします。" />,
          ]}
          tip="箇条書きや段落形式など、どんなテキスト形式でもAIが自動で解析します。"
        />

        <RouteCard
          number="④"
          title="参考LPを参考にして作る"
          description="気に入ったLPのURLを読み込むと、そのLPのデザイン・構成・トーンをAIが分析して生成に活かします。"
          steps={[
            <Step key={1} number={1} text="フォーム上部の「🔍 参考」タブをクリックします。" />,
            <Step key={2} number={2} text="参考にしたいLPのURLを入力して「分析する」を押します。" />,
            <Step key={3} number={3} text="分析結果（セクション構成・トーン・特徴）が表示されます。" />,
            <Step key={4} number={4} text="フォームの情報と合わせて「LP生成」ボタンをクリックします。" />,
          ]}
          tip="自社サービスがある場合は、ルート②でURLを読み込んでフォームを自動入力した後に、このルート④で参考LPを読み込むと効果的です。"
        />

        <Note>
          ルート②と④を組み合わせる場合は、必ず <strong>②（サイトURL読み込み）→ ④（参考LP分析）の順番</strong> で行ってください。②を先に実行しないとフォームの情報が上書きされる場合があります。
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
        <p className="text-gray-600 mb-4 text-sm">生成されたLPは右側のエディターパネルで細かく編集できます。上部のタブで「テキスト」「スタイル」「画像」を切り替えて使います。</p>

        <SectionTitle>📝 テキスト編集</SectionTitle>
        <Step number={1} text="上部タブの「テキスト」を選択した状態で、プレビュー上のテキスト部分をクリックします。" />
        <Step number={2} text="右パネルに編集フィールドが表示されるので、内容を書き換えます。" />
        <Step number={3} text="変更はリアルタイムでプレビューに反映されます。" />
        <Tip>見出し・本文・ボタンのテキストなど、LP内のほぼすべてのテキストを直接編集できます。</Tip>

        <SectionTitle>🎨 カラーテーマ変更</SectionTitle>
        <Step number={1} text="左サイドバーの「カラーテーマ」セクションに6色のカラーパレットが表示されています。" />
        <Step number={2} text="変更したい色をクリックするとカラーピッカーが開き、好みの色に変更できます。" />
        <Step number={3} text="変更はリアルタイムでプレビューに反映されます。気に入らない場合はUndoボタン（↩）で戻せます。" />

        <SectionTitle>🔤 フォント変更</SectionTitle>
        <Step number={1} text="上部タブの「スタイル」を選択します。" />
        <Step number={2} text="「フォント」ドロップダウンから好みのフォントを選択します（日本語・英語フォント対応）。" />
        <Step number={3} text="フォントはLP全体に一括適用されます。" />

        <SectionTitle>➕ セクション追加・並び替え</SectionTitle>
        <Step number={1} text="左サイドバー下部の「＋ セクションを追加」ボタンをクリックします。" />
        <Step number={2} text="追加したいセクションの種類（料金表・FAQ・タイムライン・お客様の声など）を選択します。" />
        <Step number={3} text="「セクション並び替え」パネルでドラッグ&ドロップしてセクションの順序を変更できます。" />
        <Step number={4} text="Undoボタン（↩）でセクションの追加・並び替えを元に戻せます。" />

        <SectionTitle>✏️ AI編集（修正依頼）</SectionTitle>
        <Step number={1} text="エディター下部の「AIに修正を依頼」フォームに修正内容を入力します。" />
        <Step number={2} text="例：「ヒーローセクションのキャッチコピーをより力強い表現に変えてください」" />
        <Step number={3} text="AIが指示に従ってLPを修正します。気に入らない場合はUndoで戻せます。" />
      </div>
    ),
  },
  {
    id: "images",
    emoji: "🖼️",
    title: "画像を使う",
    content: (
      <div>
        <p className="text-gray-600 mb-4 text-sm">LP内の画像は3つの方法で挿入・管理できます。上部タブの「画像」から操作します。</p>

        <SectionTitle>📁 アセットライブラリ（自分でアップロード）</SectionTitle>
        <Step number={1} text="上部タブの「画像」を選択し、「アセットライブラリ →」リンクをクリックします。" />
        <Step number={2} text="「画像をアップロード」ボタンからPC上の画像ファイル（JPG・PNG・WebP・GIFなど）をアップロードします。" />
        <Step number={3} text="アップロードした画像はライブラリに保存され、複数のLPで再利用できます。" />
        <Step number={4} text="エディターに戻り、挿入したい箇所をクリックしてライブラリから画像を選択します。" />

        <SectionTitle>🔍 Unsplash（フリー素材）</SectionTitle>
        <Step number={1} text="画像パネル内の「Unsplashから検索」タブを選択します。" />
        <Step number={2} text="キーワードを英語または日本語で入力して検索します（例：「office」「team」「beauty」）。" />
        <Step number={3} text="気に入った画像をクリックするとLP内のクリックした箇所に挿入されます。商用利用も可能です。" />
        <Tip>Unsplashは英語キーワードで検索するとより多くの結果が出ます。</Tip>

        <SectionTitle>🤖 AI画像プロンプト生成</SectionTitle>
        <Step number={1} text="左サイドバー上部の「🎨 AI画像プロンプト生成」ボタンをクリックします。" />
        <Step number={2} text="AIがLPの内容をもとに、画像生成AIに使えるプロンプト（呪文）を自動で作成します。" />
        <Step number={3} text="生成されたプロンプトをコピーして、Midjourney・DALL-E・Stable Diffusionなどの画像生成AIに貼り付けます。" />
        <Step number={4} text="生成した画像をアセットライブラリにアップロードしてLPに挿入します。" />
        <Tip>このLPにぴったりのオリジナル画像をAIで作りたい場合に活用してください。</Tip>

        <Note>
          Unsplashの画像は商用利用可能ですが、フォトグラファーへのクレジット表記が推奨されています。
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
        <p className="text-gray-600 mb-4 text-sm">LPにお問い合わせフォームを設置して、訪問者からの問い合わせを受け付けられます。</p>

        <SectionTitle>⚙️ フォームの設定</SectionTitle>
        <Step number={1} text="上部タブの右端にある「フォーム」アイコン（📋）をクリックしてフォーム設定パネルを開きます。" />
        <Step number={2} text="「フォームを有効にする」トグルをONにします。" />
        <Step number={3} text="収集する項目（名前・メールアドレス・電話番号・メッセージなど）のトグルをON/OFFで選択します。" />
        <Step number={4} text="フォーム名・送信ボタンのテキスト・サンキューメッセージを設定します。" />
        <Step number={5} text="「保存」ボタンを押して設定を確定します。" />

        <SectionTitle>📬 リードの確認</SectionTitle>
        <Step number={1} text="LPを公開後、フォームから送信があると「リード管理」ページに記録されます。" />
        <Step number={2} text="ヘッダー右上のユーザーアイコンをクリックし「リード管理」を選択します。" />
        <Step number={3} text="送信日時・名前・メールアドレスなどが一覧で確認できます。" />
        <Step number={4} text="各リードをクリックすると詳細を確認でき、ステータス（新規・対応済・アーカイブ）を変更できます。" />
        <Step number={5} text="「⬇ CSV」ボタンでリードデータを一括ダウンロードできます。" />

        <Note>
          フォームの送信はLP公開後にのみ機能します。プレビュー画面での送信テストはできません。
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
        <p className="text-gray-600 mb-4 text-sm">作成したLPは専用URLで即座に公開できます。サーバーやドメインは不要です。</p>

        <SectionTitle>🚀 公開する</SectionTitle>
        <Step number={1} text="エディター上部の「🚀 公開」ボタンをクリックします。" />
        <Step number={2} text="公開設定パネルが開きます。「公開する」ボタンを押します。" />
        <Step number={3} text="専用URL（例：https://ai-lp-studio-production.up.railway.app/p/スラグ名）が発行されます。" />
        <Step number={4} text="URLをコピーして、メール・広告・SNSなどで共有できます。" />

        <SectionTitle>🔗 スラグ（URL）の変更</SectionTitle>
        <Step number={1} text="公開設定パネル内の「URL スラグ」欄に任意の文字列を入力します。" />
        <Step number={2} text="半角英数字とハイフン（-）のみ使用できます（例：my-beauty-salon）。" />
        <Step number={3} text="「保存」ボタンを押すとURLが変更されます。" />
        <Note>スラグを変更すると以前のURLは無効になります。広告などで使用している場合はご注意ください。</Note>

        <SectionTitle>🔍 SEO設定</SectionTitle>
        <Step number={1} text="公開設定パネル内のSEO設定でページタイトル・メタディスクリプションを入力します。" />
        <Step number={2} text="エディター上部タブの「スタイル」内にあるSEOチェッカーでスコアを確認できます。" />
        <Step number={3} text="タイトル30〜60文字、ディスクリプション70〜120文字が理想です。" />

        <Tip>LPを更新した後は再度「公開」ボタンを押すことで変更が反映されます。</Tip>
      </div>
    ),
  },
  {
    id: "analytics",
    emoji: "📊",
    title: "データを確認する（Analytics・リード管理）",
    content: (
      <div>
        <p className="text-gray-600 mb-4 text-sm">公開したLPのパフォーマンスをリアルタイムで計測できます。（Proプラン限定）</p>

        <SectionTitle>📈 Analyticsの見方</SectionTitle>
        <Step number={1} text="マイLPページで公開済みのLPの「📊 分析」ボタンをクリックします。" />
        <Step number={2} text="KPIカードでページビュー・ユニーク訪問者・CTAクリック率・フォーム送信率などを確認できます。" />
        <Step number={3} text="右上の期間選択で「直近7日」「直近30日」「直近90日」を切り替えられます。" />

        <SectionTitle>📉 各指標の意味</SectionTitle>
        <div className="space-y-2 text-sm text-gray-700 mb-4">
          <div className="flex gap-2 items-start"><span className="font-bold text-[#00AFCC] shrink-0">PV</span><span>ページビュー：LPが表示された回数</span></div>
          <div className="flex gap-2 items-start"><span className="font-bold text-[#00AFCC] shrink-0">UV</span><span>ユニーク訪問者：個別の訪問者数（同じ人の複数回アクセスは1人とカウント）</span></div>
          <div className="flex gap-2 items-start"><span className="font-bold text-[#00AFCC] shrink-0">CTR</span><span>CTAクリック率：ボタンをクリックした訪問者の割合</span></div>
          <div className="flex gap-2 items-start"><span className="font-bold text-[#00AFCC] shrink-0">CVR</span><span>フォーム送信率：フォームを送信した訪問者の割合</span></div>
        </div>
        <Step number={4} text="スクロール到達率でLP内のどこまで読まれているかが分かります。" />
        <Step number={5} text="デバイス比率でPC・スマホ・タブレットの割合を確認できます。" />
        <Step number={6} text="流入元（上位10）でどこからの訪問者が多いかが分かります。" />

        <Tip>CVR（フォーム送信率）の目標は3%以上です。低い場合はCTAボタンの文言やフォームの入力項目を見直してみましょう。</Tip>
      </div>
    ),
  },
  {
    id: "save",
    emoji: "💾",
    title: "保存・管理",
    content: (
      <div>
        <p className="text-gray-600 mb-4 text-sm">作成したLPはクラウドに保存して、いつでも再編集できます。</p>

        <SectionTitle>☁️ クラウド保存</SectionTitle>
        <Step number={1} text="エディター上部の「💾 保存 ▾」ボタンをクリックするとメニューが開きます。" />
        <Step number={2} text="「☁️ クラウドに保存」を選択するとサーバーに保存されます。" />
        <Step number={3} text="保存中は「保存中...」、完了すると「✓ 保存済み」と表示されます。" />
        <Step number={4} text="30秒ごとに自動でクラウド保存も行われます。" />
        <Tip>「💾 ローカルに保存」を選ぶとブラウザに即時保存します。クラウド保存と合わせて活用してください。</Tip>

        <SectionTitle>📁 マイLP（プロジェクト一覧）</SectionTitle>
        <Step number={1} text="エディター上部の「📁 マイLP」ボタンをクリックするとプロジェクト一覧が表示されます。" />
        <Step number={2} text="各LPの「編集」ボタンをクリックするとエディターが開きます。" />
        <Step number={3} text="公開済みのLPには「📊 分析」ボタンも表示されます。" />

        <SectionTitle>📋 タイトルの変更</SectionTitle>
        <Step number={1} text="マイLPページでLPのタイトル部分をクリックすると編集モードになります。" />
        <Step number={2} text="新しいタイトルを入力してEnterキーを押すと保存されます（Escapeでキャンセル）。" />

        <SectionTitle>📑 複製</SectionTitle>
        <Step number={1} text="マイLPページの各LPの「複製」ボタンをクリックします。" />
        <Step number={2} text="同じ内容のLPが「〇〇 のコピー」という名前で新規作成されます。" />
        <Step number={3} text="ABテストや複数パターンの作成に便利です。" />

        <SectionTitle>＋ 新規作成</SectionTitle>
        <Step number={1} text="エディター上部の「＋ 新規」ボタンをクリックします。" />
        <Step number={2} text="確認ダイアログが表示されるので「OK」を押すと、白紙の状態でエディターが開きます。" />
        <Note>
          トライアルプランで保存できるLPは1件までです。Proプランでは最大10件保存できます。
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
        <p className="text-gray-600 mb-4 text-sm">AI LP STUDIOには「トライアル（3日間無料）」と「Pro（月額¥2,980）」の2つのプランがあります。</p>

        <div className="overflow-x-auto mb-5">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#00AFCC] text-white">
                <th className="px-4 py-3 text-left rounded-tl-lg">機能</th>
                <th className="px-4 py-3 text-center">トライアル</th>
                <th className="px-4 py-3 text-center rounded-tr-lg">Pro</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["利用期間", "3日間", "無制限"],
                ["クラウド保存数", "1件", "10件"],
                ["LP生成回数（月）", "3回", "100回"],
                ["AI編集回数（月）", "10回", "300回"],
                ["参考LP解析（月）", "3回", "100回"],
                ["HTMLコピー", "×", "○"],
                ["LP公開", "×", "○"],
                ["フォーム設置", "○（プレビューのみ）", "○（本番送信）"],
                ["Analytics", "×", "○"],
                ["リード管理", "×", "○"],
                ["アセットライブラリ", "10件", "無制限"],
                ["月額料金", "無料", "¥2,980（税込）"],
              ].map(([feature, trial, pro], i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-4 py-2.5 font-medium text-gray-700 border-b border-gray-100">{feature}</td>
                  <td className="px-4 py-2.5 text-center text-gray-600 border-b border-gray-100">{trial}</td>
                  <td className="px-4 py-2.5 text-center font-semibold border-b border-gray-100 text-[#00AFCC]">{pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <SectionTitle>⬆️ Proへのアップグレード方法</SectionTitle>
        <Step number={1} text="エディター上部のプランバッジ（「トライアル」と表示されている部分）をクリックします。または画面上部のバナーから「Proにする」をクリックします。" />
        <Step number={2} text="料金プランページで「Proにアップグレード」ボタンをクリックします。" />
        <Step number={3} text="Square決済ページに遷移するので、クレジットカード情報を入力して支払いを完了します。" />
        <Step number={4} text="支払い完了後、自動的にProプランが有効になります（反映まで最大1分程度かかる場合があります）。" />

        <Note>
          Proプランは月額課金制（¥2,980/月・税込）です。解約はいつでも可能で、解約後は当月末まで利用できます。
        </Note>
      </div>
    ),
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HowToUsePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F5F5F2]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">📖</span>
            <h1 className="text-lg font-bold text-gray-800">使い方ガイド</h1>
            <span className="hidden sm:inline-block text-xs font-medium px-2 py-0.5 rounded-full text-white bg-[#00AFCC]">
              AI LP STUDIO
            </span>
          </div>
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
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
        <div className="rounded-2xl p-6 mb-8 text-white bg-gradient-to-r from-[#00AFCC] to-[#0090aa]">
          <h2 className="text-2xl font-bold mb-2">AI LP STUDIOの使い方</h2>
          <p className="text-blue-50 text-sm leading-relaxed">
            このガイドでは、AI LP STUDIOの基本的な使い方から各機能の詳細まで説明しています。
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
