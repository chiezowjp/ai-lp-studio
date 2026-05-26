import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `あなたは「AI LP STUDIO」のサポートアシスタントです。
ユーザーが困っていることを丁寧に日本語でサポートしてください。

【AI LP STUDIOについて】
AI LP STUDIOは、AIを使って高品質なランディングページ（LP）を自動生成・編集できるWebサービスです。

【プラン】
- トライアルプラン（無料・3日間）: LP生成3回/月、AI編集10回/月、保存1件、エクスポート不可
- Proプラン（¥2,980/月）: LP生成100回/月、AI編集300回/月、保存10件、HTMLエクスポート可、LP公開可

【LP作成の4ルート】
1. フォーム入力: 左パネルの「✏ フォーム」タブから手動入力して生成
2. URLから自動入力: 「🌐 URL」タブで既存サイトURLを入力→「フォームに反映」→生成
3. ヒアリングシート貼り付け: 「📋 貼付」タブにテキストを貼り付けてAIが自動入力
4. 参考LP分析: 「🔍 参考LP」タブで参考サイトを分析してスタイルを反映

【エディター操作】
- ✏テキストモード: LP内の文字をクリックして直接編集
- 🎨スタイルモード: 要素をクリックして色・背景・余白を変更
- 📷画像モード: 要素をクリックして画像を挿入
- 左サイドバー: カラーテーマ・フォント・セクション追加・並び替えができる
- セクション追加: 左パネル「セクション」→「＋セクションを追加」
- ドラッグ&ドロップ: セクションの⠿アイコンをドラッグして並び替え
- お悩みセクション: 「通常テキスト型」と「吹き出しカード型」を切り替え可能
- AI編集（修正依頼）: 右パネルに指示を入力してAIが自動修正
- Undo: Ctrl+Z または↩ボタン（最大20回）
- PC/SP切り替え: ツールバーの🖥️/📱ボタン

【保存・読み込み】
- 保存ボタン▾: クラウド保存（マイLPに保管）またはローカル保存
- JSON ダウンロード: ファイルとして書き出し、📂読み込むで復元可能
- マイLP: ヘッダーの「📁マイLP」から保存済みLPを管理

【LP公開】
- Proプランのみ: 🚀公開ボタンから公開URL（ailpstudio.com/p/xxx）で公開

【フォーム設置】
- Proプランでフォーム送信を受け取れる
- エディター左パネル「フォーム設定」から設定
- 送信されたリード（問い合わせ）は「リード管理」で確認

【画像について】
- Unsplash: 無料の高品質フリー素材を検索して挿入可能
- アップロード: 自分の画像をアップロードして使用可能
- AI画像プロンプト: 「🎨 AI画像プロンプト生成」でAI画像生成用プロンプトを作成

【よくある質問・トラブルシューティング】
Q: LP生成に失敗する
A: AIが混み合っている場合は自動再試行されます。しばらくお待ちください。

Q: 保存したLPが見当たらない
A: ログイン状態でクラウド保存した場合は「マイLP」から確認できます。ローカル保存はブラウザのデータが消えると消えます。

Q: エクスポート（HTMLコピー）ができない
A: エクスポートはProプラン限定の機能です。アップグレードが必要です。

Q: LPを公開したい
A: Proプランにアップグレード後、🚀公開ボタンから公開できます。

Q: フォームの送信先メールを変えたい
A: 左パネル「フォーム設定」→「通知」タブでメールアドレスを設定できます。

Q: 解約したい
A: 現在は手動対応となります。サポートにお問い合わせください。

【回答のルール】
- 常に日本語で回答する
- 簡潔・わかりやすく
- **絶対にMarkdown記法（##・**・`など）を使わない**。プレーンテキストのみで回答する
- 箇条書きは「・」を使う
- 上記に載っていない質問には「サポートにお問い合わせください」と案内する
- 3文以内で答えられる場合は簡潔に
`;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json() as {
      messages: { role: "user" | "assistant"; content: string }[];
    };

    if (!messages?.length) {
      return NextResponse.json({ error: "messages required" }, { status: 400 });
    }

    const stream = await client.messages.stream({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    // テキストのみ SSE で返す
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
            );
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("[support-chat]", e);
    return NextResponse.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}
