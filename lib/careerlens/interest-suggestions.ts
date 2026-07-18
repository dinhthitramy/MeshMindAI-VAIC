const DEFAULT_SUGGESTIONS = [
  "Giải quyết vấn đề",
  "Làm sản phẩm thực tế",
  "Làm việc với con người",
  "Nghiên cứu và khám phá",
] as const;

const SUGGESTION_RULES: Array<{ pattern: RegExp; suggestions: readonly string[] }> = [
  {
    pattern: /toán|logic|thống kê|phân tích/,
    suggestions: ["Phân tích dữ liệu", "AI và học máy", "Tài chính", "Tối ưu vận hành"],
  },
  {
    pattern: /tin|lập trình|code|phần mềm|máy tính|công nghệ/,
    suggestions: ["Phát triển phần mềm", "An toàn thông tin", "Dữ liệu và AI", "Tự động hóa"],
  },
  {
    pattern: /văn|viết|ngữ văn|nội dung|kể chuyện/,
    suggestions: ["Truyền thông", "Chiến lược nội dung", "Luật", "Nghiên cứu người dùng"],
  },
  {
    pattern: /anh|ngoại ngữ|tiếng|ngôn ngữ/,
    suggestions: ["Kinh doanh quốc tế", "Biên phiên dịch", "Du lịch", "Customer Success"],
  },
  {
    pattern: /sinh|hóa|y|dược|phòng thí nghiệm/,
    suggestions: ["Công nghệ sinh học", "Chăm sóc sức khỏe", "Công nghệ thực phẩm", "Nghiên cứu phòng lab"],
  },
  {
    pattern: /lý|vật lý|điện|điện tử|cơ khí|sửa chữa/,
    suggestions: ["Robot", "Tự động hóa", "Năng lượng tái tạo", "Thiết kế kỹ thuật"],
  },
  {
    pattern: /vẽ|mỹ thuật|thiết kế|sáng tạo|âm nhạc|nghệ thuật/,
    suggestions: ["Thiết kế sản phẩm", "UX/UI", "Truyền thông số", "Kiến trúc"],
  },
  {
    pattern: /kinh doanh|marketing|bán hàng|tài chính|quản trị/,
    suggestions: ["Khởi nghiệp", "Marketing số", "Đầu tư", "Chuỗi cung ứng"],
  },
  {
    pattern: /thể thao|bóng|chạy|bơi|cầu lông/,
    suggestions: ["Quản lý thể thao", "Huấn luyện", "Truyền thông thể thao", "Phục hồi vận động"],
  },
];

export function getInterestSuggestions(subjectOrSkill: string): string[] {
  const normalized = subjectOrSkill.trim().toLocaleLowerCase("vi");
  const matched = SUGGESTION_RULES.filter(({ pattern }) => pattern.test(normalized)).flatMap(
    ({ suggestions }) => suggestions,
  );

  return [...new Set(matched.length > 0 ? matched : DEFAULT_SUGGESTIONS)].slice(0, 6);
}

