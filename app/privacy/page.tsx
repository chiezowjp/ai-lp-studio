import Link from "next/link";

export const metadata = {
  title: "プライバシーポリシー | AI LP STUDIO",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F2]">
      <div className="max-w-3xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-[#00AFCC] text-sm hover:underline">← AI LP STUDIO に戻る</Link>
          <h1 className="text-2xl font-black text-gray-900 mt-4">プライバシーポリシー</h1>
          <p className="text-sm text-gray-500 mt-1">最終更新日：2026年5月26日</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-8 text-sm text-gray-700 leading-relaxed">

          <section>
            <p>Studio Haru（以下「当社」）は、サービス「AI LP STUDIO」（以下「本サービス」）において、ユーザーの個人情報を適切に保護・管理することを重要な責務と考えています。本プライバシーポリシーでは、当社が収集する情報の種類、利用目的、管理方法についてご説明します。</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">第1条（収集する情報）</h2>
            <p className="mb-2">当社は以下の情報を収集することがあります。</p>
            <ul className="space-y-1.5 list-disc list-inside text-gray-600">
              <li>氏名・メールアドレス（Googleアカウント認証時に取得）</li>
              <li>プロフィール画像（Googleアカウントから取得）</li>
              <li>本サービス上で作成・編集したランディングページのデータ</li>
              <li>決済情報（Square経由で処理されるため、当社はカード番号等を保持しません）</li>
              <li>サービスの利用状況・アクセスログ（IPアドレス、ブラウザ情報等）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">第2条（情報の利用目的）</h2>
            <p className="mb-2">収集した情報は以下の目的で利用します。</p>
            <ul className="space-y-1.5 list-disc list-inside text-gray-600">
              <li>本サービスの提供・運営・改善</li>
              <li>ユーザー認証およびアカウント管理</li>
              <li>料金の請求・決済処理</li>
              <li>サービスに関するお知らせ・サポート対応</li>
              <li>不正利用の防止およびセキュリティの確保</li>
              <li>利用状況の分析・統計処理（個人を特定しない形）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">第3条（第三者提供）</h2>
            <p className="mb-2">当社は、以下の場合を除き、ユーザーの個人情報を第三者に提供しません。</p>
            <ul className="space-y-1.5 list-disc list-inside text-gray-600">
              <li>ユーザーの事前の同意がある場合</li>
              <li>法令に基づく開示要請がある場合</li>
              <li>人の生命・身体・財産の保護のために必要な場合</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">第4条（委託先・外部サービス）</h2>
            <p className="mb-2">本サービスでは以下の外部サービスを利用しています。各サービスのプライバシーポリシーもご確認ください。</p>
            <ul className="space-y-1.5 list-disc list-inside text-gray-600">
              <li>Google（認証・ログイン）</li>
              <li>Square（決済処理）</li>
              <li>Anthropic（AI生成機能）</li>
              <li>Unsplash（フリー画像の提供）</li>
              <li>Railway（サーバーホスティング）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">第5条（クッキー・アクセス解析）</h2>
            <p>本サービスでは、サービス改善のためにクッキー（Cookie）を使用することがあります。クッキーの使用を望まない場合は、ブラウザの設定により無効化できますが、一部機能が利用できなくなる場合があります。</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">第6条（情報の保管・セキュリティ）</h2>
            <p>当社は収集した個人情報を適切に管理し、不正アクセス・漏洩・紛失等を防止するために合理的なセキュリティ対策を講じます。ただし、インターネット上での完全なセキュリティを保証するものではありません。</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">第7条（保存期間）</h2>
            <p>個人情報は、利用目的の達成に必要な期間保存します。アカウント削除後は、法令上の保存義務がある情報を除き、速やかに削除します。</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">第8条（ユーザーの権利）</h2>
            <p className="mb-2">ユーザーは、自己の個人情報に関して以下の権利を有します。</p>
            <ul className="space-y-1.5 list-disc list-inside text-gray-600">
              <li>開示・訂正・削除の請求</li>
              <li>利用停止の請求</li>
            </ul>
            <p className="mt-2">これらの請求は、<a href="mailto:info@ailpstudio.com" className="text-[#00AFCC] hover:underline">info@ailpstudio.com</a> までご連絡ください。合理的な期間内に対応いたします。</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">第9条（未成年者）</h2>
            <p>本サービスは18歳未満の方の利用を想定していません。未成年者が個人情報を提供していることが判明した場合、速やかに削除します。</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">第10条（ポリシーの変更）</h2>
            <p>当社は必要に応じて本ポリシーを改定することがあります。重要な変更については、サービス内またはメールにてお知らせします。変更後も本サービスをご利用いただいた場合、改定後のポリシーに同意したものとみなします。</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">第11条（準拠法・管轄）</h2>
            <p>本ポリシーは日本法に準拠します。本ポリシーに関する紛争については、当社所在地を管轄する裁判所を専属的合意管轄とします。</p>
          </section>

          <section className="border-t border-gray-100 pt-6">
            <h2 className="text-base font-bold text-gray-900 mb-3">お問い合わせ</h2>
            <ul className="space-y-1 text-gray-600">
              <li>運営者：Studio Haru</li>
              <li>メール：<a href="mailto:info@ailpstudio.com" className="text-[#00AFCC] hover:underline">info@ailpstudio.com</a></li>
              <li>住所：お問い合わせください</li>
            </ul>
          </section>

        </div>

        {/* Footer links */}
        <div className="mt-8 flex gap-4 text-xs text-gray-400 justify-center">
          <Link href="/terms" className="hover:text-gray-600 transition-colors">利用規約</Link>
          <Link href="/" className="hover:text-gray-600 transition-colors">トップへ戻る</Link>
        </div>
      </div>
    </div>
  );
}
