const COURSE_COLORS = [
  "#E0900C",
  "#138C8A",
  "#3A9D5D",
  "#9B59B6",
  "#2980B9",
  "#E67E22",
  "#16A085",
  "#8E44AD",
  "#2C3E50",
  "#C0392B",
] as const;

export function courseColor(course: string): string {
  let h = 0;
  for (let i = 0; i < course.length; i++)
    h = (h * 31 + course.charCodeAt(i)) >>> 0;
  return COURSE_COLORS[h % COURSE_COLORS.length];
}
