export type ConversationMemory = {
  id: string;
  type: "core_concept" | "timeline" | "relationship" | string;
  content: string;
  importance: number;
  is_active: boolean;
  rp_date?: string | null;
  turn_range?: string | null;
  source?: string;
  created_at?: string;
  updated_at?: string;
};

function parseTurnStart(turnRange: string | null | undefined): number {
  if (!turnRange) return Infinity;
  const match = /^(\d+)/.exec(turnRange);
  return match ? parseInt(match[1], 10) : Infinity;
}

export function buildMemoryPrompt(memories: ConversationMemory[]): string {
  if (memories.length === 0) return "";

  const active = memories
    .filter((m) => m.is_active)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 20);

  if (active.length === 0) return "";

  const coreConcepts = active.filter((m) => m.type === "core_concept");
  const timelines = active
    .filter((m) => m.type === "timeline")
    .sort((a, b) => parseTurnStart(a.turn_range) - parseTurnStart(b.turn_range));
  const relationship = active.filter((m) => m.type === "relationship")[0] ?? null;

  const sections: string[] = [];

  if (coreConcepts.length > 0) {
    const lines = coreConcepts.map((m) => `- ${m.content}`).join("\n");
    sections.push(`[절대 기억]\n${lines}`);
  }

  if (timelines.length > 0) {
    const lines = timelines
      .map((m) => {
        const meta = [
          m.turn_range ? `${m.turn_range}턴` : null,
          m.rp_date && m.rp_date !== "알 수 없음" ? m.rp_date : null,
        ]
          .filter(Boolean)
          .join(" | ");
        return meta ? `- [${meta}] ${m.content}` : `- ${m.content}`;
      })
      .join("\n");
    sections.push(`[사건 타임라인]\n${lines}`);
  }

  if (relationship) {
    type RelItem = { character_name?: string; emotion?: string; relationship?: string };
    let items: RelItem[] = [];
    try {
      const parsed = JSON.parse(relationship.content);
      if (Array.isArray(parsed)) items = parsed as RelItem[];
    } catch {
      // JSON 파싱 실패 → 기존 텍스트 형식 그대로 주입
      sections.push(`[캐릭터 관계도]\n${relationship.content}`);
      items = [];
    }

    if (items.length > 0) {
      const lines = items
        .filter((it) => it.character_name?.trim())
        .map((it) => `- ${it.character_name} | 유저를 향한 감정: ${it.emotion ?? ""} | 사이: ${it.relationship ?? ""}`);
      if (lines.length > 0) {
        sections.push(`[캐릭터 관계도]\n${lines.join("\n")}`);
      }
    }
  }

  if (sections.length === 0) return "";

  return `=== 장기 기억 ===\n${sections.join("\n\n")}`;
}
