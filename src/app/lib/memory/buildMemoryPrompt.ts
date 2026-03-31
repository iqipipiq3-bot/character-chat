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
    const fields: Record<string, string> = {};
    for (const line of relationship.content.split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      if (key && val) fields[key] = val;
    }
    const charName = fields["character_name"] ?? "";
    const charToUser = fields["캐릭터는 유저에게"] ?? "";
    const userToChar = fields["유저는 캐릭터에게"] ?? "";
    const emotion = fields["유저를 향한 감정"] ?? "";

    const lines = [`- 캐릭터 이름: ${charName}`];
    if (charToUser) lines.push(`  캐릭터는 유저에게: ${charToUser}`);
    if (userToChar) lines.push(`  유저는 캐릭터에게: ${userToChar}`);
    if (emotion) lines.push(`  유저를 향한 감정: ${emotion}`);

    sections.push(`[캐릭터 관계도]\n${lines.join("\n")}`);
  }

  if (sections.length === 0) return "";

  return `=== 장기 기억 ===\n${sections.join("\n\n")}`;
}
