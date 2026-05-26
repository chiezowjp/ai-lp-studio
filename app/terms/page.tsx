import Link from "next/link";

export const metadata = {
  title: "利用規約 | AI LP STUDIO",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F2]">
      <div className="max-w-3xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-[#00AFCC] text-sm hover:underline">← AI LP STUDIO に戻る</Link>
          <h1 className="text-2xl font-black text-gray-900 mt-4">利用規約</h1>
          <p className="text-sm text-gray-500 mt-1">最終更新日：2026年5月26日</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-8 text-sm text-gray-700 leading-relaxed">

          <section>
            <p>本利用規約（以下「本規約」）は、Studio Haru（以下「当社」）が提供するサービス「AI LP STUDIO」（以下「本サービス」）の利用条件を定めるものです。ご利用の前に必ずお読みください。本サービスをご利用いただくことで、本規約に同意したものとみなします。</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">第1条（定義）</h2>
            <ul className="space-y-1.5 list-disc list-inside text-gray-600">
              <li>「ユーザー」とは、本規約に同意のうえ本サービスに登録した方を指します。</li>
              <li>「コンテンツ」とは、本サービスを通じて生成・編集されたランディングページのHTML・CSS・テキスト・画像等を指します。</li>
              <li>「Proプラン」とは、月額料金を支払うことで利用できる有料プランを指します。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">第2条（利用登録）</h2>
            <p>本サービスはGoogleアカウントによる認証を通じてご利用いただけます。ユーザーは正確な情報を提供し、アカウントを適切に管理する責任を負います。第三者によるアカウントの不正利用について、当社は責任を負いません。</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">第3条（プランと料金）</h2>
            <ul className="space-y-1.5 list-disc list-inside text-gray-600">
              <li>トライアルプランは無料でご利用いただけます（登録から3日間）。</li>
              <li>Proプランの月額料金は¥2,980（税込）です。</li>
              <li>料金はSquareを通じて決済され、月次で請求されます。</li>
              <li>支払い済みの料金は原則として返金いたしません。</li>
              <li>料金は予告なく変更される場合があります。変更の際は事前にメールまたはサービス内でお知らせします。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">第4条（解約）</h2>
            <p>Proプランの解約をご希望の場合は、<a href="mailto:info@ailpstudio.com" className="text-[#00AFCC] hover:underline">info@ailpstudio.com</a> までメールにてお申し付けください。解約後も当月末日までサービスをご利用いただけます。</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">第5条（禁止事項）</h2>
            <p className="mb-2">ユーザーは以下の行為を行ってはなりません。</p>
            <ul className="space-y-1.5 list-disc list-inside text-gray-600">
              <li>法令または公序良俗に違反する行為</li>
              <li>第三者の知的財産権・プライバシー・名誉を侵害する行為</li>
              <li>虚偽の情報を登録する行為</li>
              <li>本サービスのシステムに過度な負荷をかける行為</li>
              <li>本サービスを通じて生成したコンテンツを第三者に無断で再販・配布する行為</li>
              <li>反社会的勢力との関係がある状態での利用</li>
              <li>その他、当社が不適切と判断する行為</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">第6条（知的財産権）</h2>
            <p>本サービスを通じてユーザーが生成したコンテンツの著作権はユーザーに帰属します。ただし、本サービス自体のシステム・デザイン・ロゴ等の著作権は当社に帰属します。</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">第7条（サービスの変更・停止）</h2>
            <p>当社は、事前の通知なく本サービスの内容を変更、または一時的・永続的に停止することができます。これによりユーザーに損害が生じても、当社は責任を負いません。</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">第8条（免責事項）</h2>
            <ul className="space-y-1.5 list-disc list-inside text-gray-600">
              <li>本サービスはAIによる自動生成を含むため、生成されるコンテンツの正確性・完全性を保証しません。</li>
              <li>本サービスの利用により生じた損害（機会損失・データ損失・事業損失等）について、当社は責任を負いません。</li>
              <li>第三者のサービス（Google、Square、Unsplash等）の不具合・変更に起因する損害について、当社は責任を負いません。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">第9条（個人情報）</h2>
            <p>個人情報の取り扱いについては、<Link href="/privacy" className="text-[#00AFCC] hover:underline">プライバシーポリシー</Link>をご確認ください。</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">第10条（規約の変更）</h2>
            <p>当社は必要に応じて本規約を変更できます。変更後の規約はサービス内または当社ウェブサイトに掲載した時点で効力を生じます。</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">第11条（準拠法・管轄）</h2>
            <p>本規約の解釈は日本法に準拠します。本サービスに関する紛争については、当社所在地を管轄する裁判所を専属的合意管轄とします。</p>
          </section>

          <section className="border-t border-gray-100 pt-6">
            <h2 className="text-base font-bold text-gray-900 mb-3">運営者情報</h2>
            <ul className="space-y-1 text-gray-600">
              <li>運営者：Studio Haru</li>
              <li>メール：<a href="mailto:info@ailpstudio.com" className="text-[#00AFCC] hover:underline">info@ailpstudio.com</a></li>
              <li>住所：お問い合わせください</li>
            </ul>
          </section>

        </div>

        {/* Footer links */}
        <div className="mt-8 flex gap-4 text-xs text-gray-400 justify-center">
          <Link href="/privacy" className="hover:text-gray-600 transition-colors">プライバシーポリシー</Link>
          <Link href="/" className="hover:text-gray-600 transition-colors">トップへ戻る</Link>
        </div>
      </div>
    </div>
  );
}
