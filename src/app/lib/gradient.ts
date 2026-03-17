/**
 * 캐릭터 ID를 기반으로 결정론적 그라데이션 클래스를 반환합니다.
 * Tailwind 퍼지를 위해 전체 클래스 문자열을 사용합니다.
 */
const GRADIENTS = [
  "bg-gradient-to-br from-violet-500 to-pink-500",
  "bg-gradient-to-br from-blue-600 to-cyan-500",
  "bg-gradient-to-br from-teal-500 to-emerald-400",
  "bg-gradient-to-br from-orange-500 to-amber-400",
  "bg-gradient-to-br from-indigo-600 to-purple-500",
  "bg-gradient-to-br from-rose-500 to-pink-400",
  "bg-gradient-to-br from-sky-500 to-blue-400",
  "bg-gradient-to-br from-fuchsia-500 to-purple-600",
] as const;

export function getCardGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffff;
  }
  return GRADIENTS[hash % GRADIENTS.length] ?? GRADIENTS[0];
}
