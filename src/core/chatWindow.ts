/**
 * Tách AI Tutor ra một cửa sổ trình duyệt riêng.
 *
 * Hai cửa sổ cùng origin nên dùng chung localStorage. Nhờ vậy cuộc hội thoại
 * được chia sẻ sẵn, chỉ cần lắng nghe sự kiện `storage` để bên kia vẽ lại.
 */

/** Đường dẫn của cửa sổ chat rời. */
export const CHAT_POPOUT_PATH = '/ai-chat';

/** Tên cửa sổ, đặt cố định để không mở trùng nhiều cửa sổ. */
const CHAT_WINDOW_NAME = 'aws_ai_tutor_popout';

/** Khoá localStorage chứa ngữ cảnh câu hỏi mà cửa sổ chính đang xem. */
export const POPOUT_CONTEXT_KEY = 'aws_ai_popout_context';

/** Khoá đánh dấu cửa sổ rời còn sống (heartbeat). */
const POPOUT_ALIVE_KEY = 'aws_ai_popout_alive';

/** Cửa sổ rời coi là đã đóng nếu quá 4 giây không báo hiệu. */
const ALIVE_TIMEOUT_MS = 4000;

export interface PopoutContext {
  questionId?: number;
  selectedAnswer?: string;
  isSubmitted?: boolean;
  isCorrect?: boolean;
  userNotes?: string;
  currentMode?: string;
}

/** Trang hiện tại có phải cửa sổ chat rời không. */
export function isChatPopoutWindow(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.replace(/\/+$/, '') === CHAT_POPOUT_PATH;
}

/** Mở (hoặc focus lại) cửa sổ chat rời. */
export function openChatPopout(): Window | null {
  if (typeof window === 'undefined') return null;

  const width = Math.min(520, window.screen.availWidth);
  const height = Math.min(820, window.screen.availHeight);
  const left = Math.max(0, window.screen.availWidth - width - 40);
  const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));

  const features = [
    'popup=yes',
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'noopener=no',
  ].join(',');

  const win = window.open(CHAT_POPOUT_PATH, CHAT_WINDOW_NAME, features);
  if (win) {
    win.focus();
    return win;
  }

  // Trình duyệt chặn popup -> mở tạm bằng tab thường
  const tab = window.open(CHAT_POPOUT_PATH, CHAT_WINDOW_NAME);
  tab?.focus();
  return tab;
}

/** Cửa sổ chính ghi ngữ cảnh câu hỏi để cửa sổ rời đọc theo. */
export function writePopoutContext(ctx: PopoutContext): void {
  try {
    window.localStorage.setItem(POPOUT_CONTEXT_KEY, JSON.stringify(ctx));
  } catch {
    // Hết quota hoặc bị chặn -> bỏ qua, popout vẫn chạy được
  }
}

/** Cửa sổ rời đọc ngữ cảnh mới nhất. */
export function readPopoutContext(): PopoutContext {
  try {
    const raw = window.localStorage.getItem(POPOUT_CONTEXT_KEY);
    return raw ? (JSON.parse(raw) as PopoutContext) : {};
  } catch {
    return {};
  }
}

/** Cửa sổ rời báo hiệu là nó đang mở. */
export function markPopoutAlive(): void {
  try {
    window.localStorage.setItem(POPOUT_ALIVE_KEY, String(Date.now()));
  } catch {
    // Bỏ qua
  }
}

/** Xoá dấu hiệu khi cửa sổ rời đóng lại. */
export function clearPopoutAlive(): void {
  try {
    window.localStorage.removeItem(POPOUT_ALIVE_KEY);
  } catch {
    // Bỏ qua
  }
}

/** Cửa sổ rời có đang mở không (dùng để ẩn chatbox nổi ở cửa sổ chính). */
export function isPopoutAlive(): boolean {
  try {
    const raw = window.localStorage.getItem(POPOUT_ALIVE_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < ALIVE_TIMEOUT_MS;
  } catch {
    return false;
  }
}
