// ─── フォーム設定の型定義 ─────────────────────────────────────────────────────

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox";

export interface FormField {
  /** ユニーク ID（フォーム内で重複しない） */
  id: string;
  /** フィールドタイプ */
  type: FieldType;
  /** payload のキー名（英数字・アンダースコア） */
  name: string;
  /** 表示ラベル */
  label: string;
  /** プレースホルダー（text / email / tel / textarea 用） */
  placeholder?: string;
  /** 必須項目 */
  required: boolean;
  /** 選択肢（select / radio / checkbox 用） */
  options?: string[];
  /** 並び順（0始まり） */
  order: number;
}

export interface EmailNotificationConfig {
  enabled: boolean;
  /** null の場合はオーナーのアカウントメールアドレスを使用 */
  toEmail: string | null;
}

export interface AutoReplyConfig {
  /** 自動返信メールを送信するか */
  enabled: boolean;
  /** 件名（省略時はデフォルト） */
  subject: string;
  /** 本文の締め言葉（署名・補足など） */
  footer: string;
}

export interface GoogleSheetsConfig {
  enabled: boolean;
  /** スプレッドシートID（URL の /d/{id}/ 部分） */
  spreadsheetId: string;
  /** シートタブ名（省略時は Sheet1） */
  sheetName: string;
}

export interface WebhookConfig {
  enabled: boolean;
  /** 送信先 URL */
  url: string;
  /** 署名用シークレットトークン（X-Webhook-Secret ヘッダー） */
  secretToken: string;
}

export interface FormConfig {
  /** フォームを有効にするか */
  enabled: boolean;
  /** フォームフィールド一覧 */
  fields: FormField[];
  /** 送信ボタンのテキスト */
  submitButtonText: string;
  /** 送信完了メッセージ */
  successMessage: string;
  /** 送信完了後のリダイレクト URL（null = リダイレクトしない） */
  redirectUrl: string | null;
  /** メール通知設定 */
  emailNotification: EmailNotificationConfig;
  /** 問い合わせ者への自動返信設定 */
  autoReply: AutoReplyConfig;
  /** Google Sheets 連携設定 */
  googleSheets: GoogleSheetsConfig;
  /** Webhook 送信設定 */
  webhook: WebhookConfig;
}

// ─── デフォルト値 ─────────────────────────────────────────────────────────────

export const DEFAULT_FORM_FIELDS: FormField[] = [
  {
    id: "f_name",
    type: "text",
    name: "name",
    label: "お名前",
    placeholder: "山田 太郎",
    required: true,
    order: 0,
  },
  {
    id: "f_email",
    type: "email",
    name: "email",
    label: "メールアドレス",
    placeholder: "example@email.com",
    required: true,
    order: 1,
  },
  {
    id: "f_tel",
    type: "tel",
    name: "tel",
    label: "電話番号",
    placeholder: "090-0000-0000",
    required: false,
    order: 2,
  },
  {
    id: "f_message",
    type: "textarea",
    name: "message",
    label: "お問い合わせ内容",
    placeholder: "ご質問・ご要望をお書きください",
    required: false,
    order: 3,
  },
];

export const DEFAULT_FORM_CONFIG: FormConfig = {
  enabled: false,
  fields: DEFAULT_FORM_FIELDS,
  submitButtonText: "送信する",
  successMessage: "お問い合わせありがとうございます。担当者より折り返しご連絡いたします。",
  redirectUrl: null,
  emailNotification: {
    enabled: true,
    toEmail: null,
  },
  autoReply: {
    enabled: false,
    subject: "",
    footer: "",
  },
  googleSheets: {
    enabled: false,
    spreadsheetId: "",
    sheetName: "Sheet1",
  },
  webhook: {
    enabled: false,
    url: "",
    secretToken: "",
  },
};

// ─── Webhook ペイロード型 ─────────────────────────────────────────────────────

export interface WebhookPayload {
  event: "form_submit";
  project: {
    id: string;
    slug: string | null;
    title: string;
  };
  lead: {
    id: string;
    form_name: string;
    submitted_at: string;
    referrer: string | null;
  };
  /** フォーム送信値 */
  data: Record<string, unknown>;
}
