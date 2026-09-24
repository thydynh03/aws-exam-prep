# BÁO CÁO TRIỂN KHAI HOÀN TẤT: RBAC + USER ANALYTICS + FEEDBACK + QUESTION SOURCE MANAGEMENT

## 1. Tóm Tắt Kiến Trúc RBAC & Backend System
Hệ thống kiểm soát truy cập dựa trên vai trò (Role-Based Access Control - RBAC) và phân tích hành vi người học đã được triển khai hoàn chỉnh mà không phá vỡ bất kỳ tính năng học tập cốt lõi nào hiện có (1019 câu hỏi, chế độ thi thử, flashcards, dịch vụ AWS, sơ đồ kiến trúc, giải thích chi tiết tiếng Việt).

### Kiến Trúc Phân Tầng:
1. **Cơ sở dữ liệu SQLite chuẩn hóa (`aws-exam-prep/data/app.db`)**:
   - Sử dụng Node.js v24 native `node:sqlite` (`DatabaseSync`), không cần phụ thuộc binary ngoài hoặc Python build tools.
   - Bảng: `users`, `sessions`, `user_devices`, `study_progress`, `exam_attempts`, `notes`, `bookmarks`, `flashcards_progress`, `study_plans`, `question_sources`, `custom_questions`, `feedback`, `audit_logs`.
   - Toàn bộ bảng đều có chỉ mục (`INDEX`) và ràng buộc khóa ngoại (`FOREIGN KEY`) đầy đủ.
2. **RESTful API Server (`src/server/app.ts`) & Middleware Guard (`src/server/middleware.ts`)**:
   - `requireAuth`: Xác thực Bearer Token qua bảng `sessions`, gắn đối tượng `req.user` vào request.
   - `requireRole('ADMIN')`: Chặn triệt để mọi truy cập trái phép từ học viên thông thường vào các tài nguyên quản trị (trả về mã `403 Forbidden`).
   - Tích hợp trực tiếp vào Vite Dev Server qua `server.middlewares.use()` trong `vite.config.ts`, cho phép chạy đồng thời cả Frontend và Backend API mà không gặp sự cố CORS.
3. **Frontend Context & API Client (`src/core/api.ts`, `src/context/AuthContext.tsx`, `src/context/useAuth.ts`)**:
   - Tự động lưu Bearer token vào `localStorage` và tự khôi phục phiên đăng nhập khi mở lại trình duyệt.
   - Tự động thu thập thông tin thiết bị (`userAgent`, `platform`, `screenResolution`).
   - Tự động đồng bộ và di trú dữ liệu học tập cục bộ (`localStorage`) lên máy chủ khi học viên đăng nhập lần đầu.

---

## 2. Danh Sách Role & Phân Quyền Hạn (RBAC Matrix)

| Chức năng / Endpoint | Role: `LEARNER` | Role: `ADMIN` | Ghi chú bảo mật |
| :--- | :---: | :---: | :--- |
| **Đăng nhập hệ thống** | Tên bất kỳ (không cần pass) | `admin` + passcode `admin123` | Ngăn chặn việc chiếm quyền admin |
| **Học tập, làm bài, thi thử 1019 câu** | ✅ Đầy đủ | ✅ Đầy đủ | Bảo toàn 100% tính năng học tập |
| **Xem/lưu tiến độ học tập của mình** | ✅ Chỉ của bản thân | ✅ Đầy đủ | Cách ly tuyệt đối theo `user_id` (Chống IDOR) |
| **Ghi chú cá nhân (Notes) & Bookmarks** | ✅ Chỉ của bản thân | ✅ Xem & phân tích | Không ai xem được ghi chú học viên khác |
| **Gửi phản hồi / báo lỗi (Feedback)** | ✅ Gửi & xem phản hồi của mình | ✅ Xem toàn bộ, xử lý & trả lời | Học viên theo dõi được phản hồi từ Admin |
| **Đóng góp câu hỏi mới** | ✅ Tạo câu hỏi (Trạng thái `PENDING_REVIEW`) | ✅ Tạo câu hỏi (Duyệt `APPROVED` trực tiếp) | Câu hỏi học viên gửi ở chế độ Private |
| **Xem câu hỏi do mình tạo** | ✅ Thấy câu hỏi của mình | ✅ Thấy toàn bộ | Học viên khác không thấy câu hỏi pending |
| **Bảng điều khiển Admin Overview KPIs** | ❌ Bị chặn (403) | ✅ Đầy đủ chỉ số hệ thống | Chặn ở tầng API backend |
| **Phân tích chi tiết người học (Deep-Dive)** | ❌ Bị chặn (403) | ✅ Thiết bị, thói quen, lỗi sai lặp lại | Xem thiết bị, giờ học, lỗ hổng kiến trúc |
| **Hàng đợi kiểm duyệt câu hỏi (Moderation)** | ❌ Bị chặn (403) | ✅ Phê duyệt / Từ chối (kèm lý do) | Phê duyệt xong mới public toàn hệ thống |
| **Nhập câu hỏi hàng loạt (JSON Importer)** | ❌ Bị chặn (403) | ✅ Phân tích & nạp hàng loạt | Hỗ trợ schema JSON tùy biến |
| **Nhật ký thao tác quản trị (Audit Logs)** | ❌ Bị chặn (403) | ✅ Tra cứu lịch sử thao tác | Ghi vết mọi hành động duyệt/sửa |

---

## 3. Danh Sách Endpoint REST API Mới

### Nhóm Xác thực (`/api/auth/*`)
- `POST /api/auth/login`: Đăng nhập học viên hoặc quản trị viên (yêu cầu passcode nếu role admin). Ghi nhận thiết bị.
- `GET /api/auth/me` & `GET /api/auth/session`: Lấy thông tin phiên làm việc hiện tại.
- `POST /api/auth/logout`: Đăng xuất và hủy token phiên làm việc.

### Nhóm Dữ liệu Người học (`/api/users/me/*` - Yêu cầu xác thực, chống IDOR)
- `GET /api/users/me/progress`: Lấy toàn bộ tiến độ làm câu hỏi của người học.
- `POST /api/users/me/progress`: Lưu kết quả làm câu hỏi (đáp án, đúng/sai, số lần thử, thời gian).
- `POST /api/users/me/progress/migrate`: Đồng bộ dữ liệu offline từ localStorage lên database.
- `GET /api/users/me/notes`: Lấy danh sách ghi chú của người học.
- `POST /api/users/me/notes`: Thêm / sửa ghi chú cho một câu hỏi.
- `DELETE /api/users/me/notes/:questionId`: Xóa ghi chú cá nhân.
- `GET /api/users/me/history`: Lấy lịch sử các đợt thi thử.
- `POST /api/users/me/history`: Lưu kết quả đợt thi thử vừa hoàn thành.
- `GET /api/users/me/bookmarks`: Lấy danh sách câu hỏi đã đánh dấu.
- `POST /api/users/me/bookmarks/toggle`: Đánh dấu / bỏ đánh dấu câu hỏi.

### Nhóm Ngân hàng Câu hỏi & Đóng góp (`/api/questions/*`)
- `GET /api/questions/custom`: Lấy danh sách câu hỏi tùy chỉnh (Câu hỏi công khai đã duyệt + câu hỏi do chính người đó tạo).
- `POST /api/questions/submit`: Người học hoặc Admin gửi câu hỏi mới (Trạng thái `PENDING_REVIEW` hoặc `APPROVED`).
- `GET /api/questions/my-submissions`: Người học theo dõi các câu hỏi mình đã gửi và trạng thái kiểm duyệt.

### Nhóm Phản hồi & Góp ý (`/api/feedback/*`)
- `POST /api/feedback`: Học viên gửi phản hồi (bug, lỗi nội dung, UI/UX, đề xuất).
- `GET /api/feedback/my`: Học viên xem lịch sử phản hồi của mình và câu trả lời từ Admin.

### Nhóm Quản Trị Hệ Thống (`/api/admin/*` - Yêu cầu role === 'ADMIN')
- `GET /api/admin/overview`: Báo cáo chỉ số KPI tổng thể (người dùng, số lượt làm bài, độ chính xác, chủ đề yếu, câu hỏi sai nhiều nhất).
- `GET /api/admin/users`: Danh sách người học kèm bộ lọc, tìm kiếm và phân trang.
- `GET /api/admin/users/:id/analytics`: Phân tích sâu 1 người học (thiết bị, thời gian ưa thích, thói quen học, câu hỏi hay sai, quan niệm sai lệch, ghi chú, đề xuất cá nhân hóa).
- `GET /api/admin/questions/review`: Hàng đợi các câu hỏi đang chờ Admin kiểm duyệt.
- `POST /api/admin/questions/:id/approve`: Phê duyệt câu hỏi, lập tức công bố vào ngân hàng đề thi chung.
- `POST /api/admin/questions/:id/reject`: Từ chối câu hỏi kèm lý do gửi cho tác giả.
- `POST /api/admin/questions/import-json`: Nhập dữ liệu câu hỏi từ file/chuỗi JSON hàng loạt.
- `GET /api/admin/sources`: Danh sách các nguồn câu hỏi (Canonical, Imported, Learner-submitted).
- `GET /api/admin/feedback`: Hộp thư tiếp nhận góp ý với bộ lọc trạng thái và mức độ ưu tiên.
- `PATCH /api/admin/feedback/:id`: Cập nhật trạng thái phản hồi và gửi nội dung giải đáp tới học viên.
- `GET /api/admin/audit-logs`: Nhật ký kiểm tra thao tác của các quản trị viên.

---

## 4. Giao Diện Người Dùng & Trải Nghiệm (Hỗ Trợ Theme Dark & Light 100%)
- **`LoginModal`**: Giao diện đăng nhập hiện đại, chuyển đổi nhanh giữa Học viên và Quản trị viên, hiển thị thông tin thiết bị đang dùng, chặn truy cập khi chưa đăng nhập.
- **`Header`**: Thêm huy hiệu người dùng (`ADMIN` / `LEARNER`), nút "Góp ý", nút "Đóng góp câu hỏi", nút "Admin Portal" (dành riêng cho Admin), nút Đăng xuất.
- **`FeedbackModal`**: 2 tab gồm Soạn góp ý mới (chọn loại vấn đề, độ ưu tiên) và Lịch sử phản hồi (kèm câu trả lời từ Admin).
- **`QuestionSubmitModal`**: 3 tab gồm Soạn câu hỏi (kèm kiểm tra đáp án hợp lệ), Xem trước thời gian thực (Live Preview), và Danh sách câu hỏi đã gửi kèm trạng thái (`PENDING_REVIEW`, `APPROVED`, `REJECTED`).
- **`AdminDashboardView`**: Trung tâm quản trị toàn diện gồm 6 tab trực quan:
  1. *Tổng quan*: Biểu đồ KPI, tỉ lệ đúng, chủ đề yếu nhất, top câu hỏi sai nhiều nhất.
  2. *Người học & Thói quen*: Danh sách người học, mở Drawer phân tích chuyên sâu (thiết bị, khung giờ học, câu sai lặp lại, quan niệm sai lầm, lời khuyên cải thiện).
  3. *Kiểm duyệt câu hỏi*: Xem nội dung câu hỏi, phê duyệt vào đề thi hoặc từ chối kèm lý do.
  4. *Nguồn đề & Nhập JSON*: Quản lý nguồn đề, dán JSON mẫu và nạp đề thi tự động.
  5. *Hộp thư góp ý*: Xem báo lỗi của người học, thay đổi trạng thái và gửi phản hồi.
  6. *Nhật ký hoạt động*: Truy vết minh bạch mọi thao tác quản trị.

---

## 5. Kết Quả Kiểm Thử & Xác Nhận Chất Lượng

### Test Suite:
- Toàn bộ **8 file kiểm thử** với **75 test cases** vượt qua 100% (Thời gian chạy ~1s):
  - `src/core/__tests__/distractor_explainer.test.ts` (12 tests) - PASSED
  - `src/core/__tests__/clues_and_explanations.test.ts` (6 tests) - PASSED
  - `src/core/__tests__/notes_editor.test.ts` (3 tests) - PASSED
  - `src/core/__tests__/learning_and_features.test.ts` (13 tests) - PASSED
  - `src/core/__tests__/edge_cases.test.ts` (7 tests) - PASSED
  - `src/core/__tests__/i18n.test.ts` (4 tests) - PASSED
  - `src/core/__tests__/core.test.ts` (14 tests) - PASSED
  - `src/server/__tests__/rbac_api.test.ts` (16 tests) - PASSED (Bao gồm kiểm tra cách ly dữ liệu IDOR, chặn quyền 403, quy trình duyệt câu hỏi, phản hồi, và thống kê thiết bị/thói quen).

### Linter & Type Check:
- `oxlint`: **0 warnings, 0 errors** trên 69 files.
- `tsc -b && vite build`: **Exit code 0**, build production thành công.

---

## 6. Hướng Dẫn Tài Khoản Kiểm Thử

### Tài Khoản Học Viên (Learner):
- **Tên đăng nhập**: Nhập bất kỳ tên nào (ví dụ: `quang_aws`, `anh_tuan`, `student_cloud`)
- Không yêu cầu mật khẩu. Hệ thống tự động tạo hồ sơ hoặc tải lại toàn bộ lịch sử thi, ghi chú, tiến độ của người đó.

### Tài Khoản Quản Trị Viên (Admin):
- Nhấp chuyển sang tab **Quản trị (Admin)** trên giao diện đăng nhập
- **Tên đăng nhập**: `admin`
- **Mật khẩu Quản trị (Passcode)**: `admin123`
- Nhấp vào nút **Admin** trên thanh Header để mở **Bảng Quản Trị Hệ Thống**.
