"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase";
import { MarkdownEditor } from "../components/MarkdownEditor";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { convertToWebP } from "../lib/convertToWebP";
import { CharacterCard } from "../components/CharacterCard";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "profile" | "settings" | "scenarios" | "assets" | "lorebook" | "publish";

type ScenarioItem = {
  localId: string;
  id?: string;
  name: string;
  greeting: string;
  prompt: string;
};

type AssetItem = {
  localId: string;
  id?: string;
  file?: File;
  url?: string;
  preview?: string;
  title?: string;
  keyword?: string;
};

type LorebookItem = {
  localId: string;
  id?: string;
  title: string;
  keyword: string[];
  content: string;
};

type PromptTemplate = {
  id: string;
  title: string;
  content: string;
};

type LoreTemplate = {
  id: string;
  title: string;
  keywords: string[];
  content: string;
};

export type CharacterFormInitialData = {
  name: string;
  description: string;
  introduction: string;
  prompt: string;
  thumbnailUrl: string | null;
  tags: string[];
  scenarios: { id: string; name: string; greeting: string; prompt: string }[];
  assets: { id: string; url: string; title?: string; keyword?: string }[];
  lorebooks: { id: string; title: string; keyword: string[]; content: string }[];
  creatorComment: string;
  targetGender: string;
  ageRating: string;
  recommendedModel: string;
  visibility: string;
};

type Props = {
  mode: "create" | "edit";
  characterId?: string;
  initialData?: CharacterFormInitialData;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; required: boolean }[] = [
  { id: "profile", label: "프로필", required: true },
  { id: "settings", label: "캐릭터 설정", required: true },
  { id: "scenarios", label: "시작 상황", required: true },
  { id: "assets", label: "에셋", required: false },
  { id: "lorebook", label: "로어북", required: false },
  { id: "publish", label: "등록 설정", required: true },
];

const CHAT_MODELS = [
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
] as const;

type ChatModelValue = (typeof CHAT_MODELS)[number]["value"];

const TARGET_GENDER_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "female", label: "여성향" },
  { value: "male", label: "남성향" },
] as const;

const AGE_RATING_OPTIONS = [
  { value: "all", label: "전체 이용가" },
  { value: "adult", label: "성인 이용가" },
] as const;

const INPUT =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600";
const LABEL = "block text-sm font-medium";

const cap = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);

// ─── Component ────────────────────────────────────────────────────────────────

export function CharacterFormClient({ mode, characterId, initialData }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  // ── Profile ──
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(initialData?.thumbnailUrl ?? null);
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [introduction, setIntroduction] = useState(initialData?.introduction ?? "");
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);
  const [tagInput, setTagInput] = useState("");

  // ── Settings ──
  const [prompt, setPrompt] = useState(initialData?.prompt ?? "");

  // ── Templates ──
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateSaving, setTemplateSaving] = useState(false);
  const [showNewTemplateForm, setShowNewTemplateForm] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState("");
  const [newTemplateContent, setNewTemplateContent] = useState("");
  const [newTemplateSaving, setNewTemplateSaving] = useState(false);
  const [templateEditingId, setTemplateEditingId] = useState<string | null>(null);
  const [templateEditTitle, setTemplateEditTitle] = useState("");
  const [templateEditContent, setTemplateEditContent] = useState("");
  const [templateEditSaving, setTemplateEditSaving] = useState(false);

  // ── Scenarios ──
  const [scenarios, setScenarios] = useState<ScenarioItem[]>(
    initialData?.scenarios?.length
      ? initialData.scenarios.map((s) => ({ ...s, localId: s.id }))
      : [{ localId: crypto.randomUUID(), name: "", greeting: "", prompt: "" }]
  );
  const [activeScenarioId, setActiveScenarioId] = useState<string>(
    () => initialData?.scenarios?.[0]?.id ?? scenarios[0]?.localId ?? ""
  );

  // ── Assets ──
  const assetInputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<AssetItem[]>(
    (initialData?.assets ?? []).map((a) => ({ ...a, localId: a.id, title: a.title ?? "", keyword: a.keyword ?? "" }))
  );
  const [editingAsset, setEditingAsset] = useState<AssetItem | null>(null);
  const [assetModalError, setAssetModalError] = useState<string | null>(null);
  const [deletedAssetIds, setDeletedAssetIds] = useState<string[]>([]);

  // ── Lorebook ──
  const [lorebooks, setLorebooks] = useState<LorebookItem[]>(
    (initialData?.lorebooks ?? []).map((l) => ({ ...l, localId: l.id }))
  );

  const MAX_LOREBOOKS = 20;
  const [loreKeywordInputs, setLoreKeywordInputs] = useState<Record<string, string>>({});
  const [expandedLoreIds, setExpandedLoreIds] = useState<Set<string>>(() => new Set<string>());
  const loreDragIndex = useRef<number | null>(null);
  const [loreDragOver, setLoreDragOver] = useState<number | null>(null);

  // ── Lorebook Templates ──
  const [loreTemplates, setLoreTemplates] = useState<LoreTemplate[]>([]);
  const [loreTemplatesLoading, setLoreTemplatesLoading] = useState(false);
  const [showLoreTemplateForm, setShowLoreTemplateForm] = useState(false);
  const [loreTemplateTitle, setLoreTemplateTitle] = useState("");
  const [loreTemplateKeywordInput, setLoreTemplateKeywordInput] = useState("");
  const [loreTemplateKeywords, setLoreTemplateKeywords] = useState<string[]>([]);
  const [loreTemplateContent, setLoreTemplateContent] = useState("");
  const [loreTemplateSaving, setLoreTemplateSaving] = useState(false);
  const [loreTemplateEditingId, setLoreTemplateEditingId] = useState<string | null>(null);
  const [loreTemplateEditTitle, setLoreTemplateEditTitle] = useState("");
  const [loreTemplateEditKeywordInput, setLoreTemplateEditKeywordInput] = useState("");
  const [loreTemplateEditKeywords, setLoreTemplateEditKeywords] = useState<string[]>([]);
  const [loreTemplateEditContent, setLoreTemplateEditContent] = useState("");
  const [loreTemplateEditSaving, setLoreTemplateEditSaving] = useState(false);

  // ── Publish ──
  const [creatorComment, setCreatorComment] = useState(initialData?.creatorComment ?? "");
  const [targetGender, setTargetGender] = useState(initialData?.targetGender ?? "");
  const [ageRating, setAgeRating] = useState(initialData?.ageRating ?? "");
  const [recommendedModel, setRecommendedModel] = useState<ChatModelValue>(
    (initialData?.recommendedModel as ChatModelValue | undefined) ?? "gemini-2.5-pro"
  );
  const [visibility, setVisibility] = useState<"public" | "link" | "private">(
    (initialData?.visibility as "public" | "link" | "private" | undefined) ?? "private"
  );

  // ── UI ──
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayThumb = thumbPreview ?? thumbUrl;

  // ── Handlers ──

  function handleThumbChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setThumbFile(file);
    setThumbPreview(file ? URL.createObjectURL(file) : null);
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const v = tagInput.trim().replace(/^#/, "");
      if (v && !tags.includes(v) && tags.length < 10) setTags((p) => [...p, v]);
      setTagInput("");
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags((p) => p.slice(0, -1));
    }
  }

  function updateScenario(localId: string, field: "name" | "greeting" | "prompt", value: string) {
    setScenarios((prev) => prev.map((s) => (s.localId === localId ? { ...s, [field]: value } : s)));
  }

  function handleAssetFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setAssets((prev) => {
      const remaining = 100 - prev.length;
      const allowed = files.slice(0, remaining);
      return [
        ...prev,
        ...allowed.map((file) => ({
          localId: crypto.randomUUID(),
          file,
          preview: URL.createObjectURL(file),
        })),
      ];
    });
    if (assetInputRef.current) assetInputRef.current.value = "";
  }

  function removeAsset(localId: string) {
    const asset = assets.find((a) => a.localId === localId);
    if (asset?.id) setDeletedAssetIds((prev) => [...prev, asset.id!]);
    setAssets((prev) => prev.filter((a) => a.localId !== localId));
  }

  function updateLorebook(localId: string, field: "title" | "content", value: string) {
    setLorebooks((prev) => prev.map((l) => (l.localId === localId ? { ...l, [field]: value } : l)));
  }

  function addLorebookKeyword(localId: string, kw: string) {
    setLorebooks((prev) =>
      prev.map((l) =>
        l.localId === localId && l.keyword.length < 5 && !l.keyword.includes(kw)
          ? { ...l, keyword: [...l.keyword, kw] }
          : l
      )
    );
    setLoreKeywordInputs((prev) => ({ ...prev, [localId]: "" }));
  }

  function removeLorebookKeyword(localId: string, idx: number) {
    setLorebooks((prev) =>
      prev.map((l) =>
        l.localId === localId
          ? { ...l, keyword: l.keyword.filter((_, i) => i !== idx) }
          : l
      )
    );
  }

  function toggleLoreExpand(localId: string) {
    setExpandedLoreIds((prev) => {
      const next = new Set(prev);
      if (next.has(localId)) next.delete(localId);
      else next.add(localId);
      return next;
    });
  }

  function handleLoreDragStart(index: number) {
    loreDragIndex.current = index;
  }

  function handleLoreDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setLoreDragOver(index);
  }

  function handleLoreDrop(index: number) {
    const from = loreDragIndex.current;
    loreDragIndex.current = null;
    setLoreDragOver(null);
    if (from === null || from === index) return;
    setLorebooks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved!);
      return next;
    });
  }

  function handleLoreDragEnd() {
    loreDragIndex.current = null;
    setLoreDragOver(null);
  }

  // ── Lorebook Template handlers ──

  async function loadLoreTemplates() {
    setLoreTemplatesLoading(true);
    const res = await fetch("/api/lorebook-templates");
    if (res.ok) {
      const data = (await res.json()) as { templates: LoreTemplate[] };
      setLoreTemplates(data.templates);
    }
    setLoreTemplatesLoading(false);
  }

  async function saveLoreTemplate() {
    if (!loreTemplateTitle.trim() || !loreTemplateContent.trim()) return;
    setLoreTemplateSaving(true);
    const res = await fetch("/api/lorebook-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: loreTemplateTitle, keywords: loreTemplateKeywords, content: loreTemplateContent }),
    });
    if (res.ok) {
      setLoreTemplateTitle("");
      setLoreTemplateKeywords([]);
      setLoreTemplateKeywordInput("");
      setLoreTemplateContent("");
      setShowLoreTemplateForm(false);
      await loadLoreTemplates();
    }
    setLoreTemplateSaving(false);
  }

  async function saveLoreTemplateFromEntry(entry: LorebookItem) {
    const title = entry.title.trim() || entry.keyword[0] || "제목 없음";
    const res = await fetch("/api/lorebook-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, keywords: entry.keyword, content: entry.content }),
    });
    if (res.ok) {
      await loadLoreTemplates();
    } else {
      const data = (await res.json()) as { error?: string };
      if (data.error === "max_templates") alert("템플릿은 최대 10개까지 저장할 수 있습니다.");
    }
  }

  function applyLoreTemplate(tpl: LoreTemplate) {
    const newId = crypto.randomUUID();
    setLorebooks((p) => [
      ...p,
      { localId: newId, title: tpl.title, keyword: tpl.keywords, content: tpl.content },
    ]);
    setExpandedLoreIds((p) => new Set([...p, newId]));
  }

  async function deleteLoreTemplate(id: string) {
    const ok = window.confirm("템플릿을 삭제하시겠습니까?");
    if (!ok) return;
    await fetch(`/api/lorebook-templates/${id}`, { method: "DELETE" });
    setLoreTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  function startLoreTemplateEdit(tpl: LoreTemplate) {
    setLoreTemplateEditingId(tpl.id);
    setLoreTemplateEditTitle(tpl.title);
    setLoreTemplateEditKeywords(tpl.keywords);
    setLoreTemplateEditKeywordInput("");
    setLoreTemplateEditContent(tpl.content);
  }

  async function saveLoreTemplateEdit() {
    if (!loreTemplateEditingId || !loreTemplateEditTitle.trim() || !loreTemplateEditContent.trim()) return;
    setLoreTemplateEditSaving(true);
    const res = await fetch(`/api/lorebook-templates/${loreTemplateEditingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: loreTemplateEditTitle, keywords: loreTemplateEditKeywords, content: loreTemplateEditContent }),
    });
    if (res.ok) {
      setLoreTemplateEditingId(null);
      await loadLoreTemplates();
    }
    setLoreTemplateEditSaving(false);
  }

  // ── Template handlers ──

  async function loadTemplates() {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("prompt_templates")
      .select("id, title, content")
      .order("created_at", { ascending: false });
    setTemplates(data ?? []);
  }

  const templatesLoadedRef = useRef(false);
  const loreTemplatesLoadedRef = useRef(false);

  useEffect(() => {
    if (activeTab === "settings" && !templatesLoadedRef.current) {
      templatesLoadedRef.current = true;
      void loadTemplates();
    }
    if (activeTab === "lorebook" && !loreTemplatesLoadedRef.current) {
      loreTemplatesLoadedRef.current = true;
      void loadLoreTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function saveTemplate() {
    if (!templateTitle.trim()) return;
    setTemplateSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setTemplateSaving(false); return; }
    await supabase.from("prompt_templates").insert({
      user_id: user.id,
      title: templateTitle.trim(),
      content: prompt,
    });
    setTemplateTitle("");
    setShowTemplateSave(false);
    setTemplateSaving(false);
    await loadTemplates();
  }

  async function deleteTemplate(id: string) {
    const supabase = createSupabaseBrowserClient();
    await supabase.from("prompt_templates").delete().eq("id", id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  function appendTemplate(content: string) {
    setPrompt((prev) => {
      const base = prev.trimEnd();
      return base ? base + "\n\n" + content : content;
    });
  }

  async function saveNewTemplate() {
    if (!newTemplateTitle.trim() || !newTemplateContent.trim()) return;
    setNewTemplateSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setNewTemplateSaving(false); return; }
    await supabase.from("prompt_templates").insert({
      user_id: user.id,
      title: newTemplateTitle.trim(),
      content: newTemplateContent.trim(),
    });
    setNewTemplateTitle("");
    setNewTemplateContent("");
    setShowNewTemplateForm(false);
    setNewTemplateSaving(false);
    await loadTemplates();
  }

  async function saveTemplateEdit() {
    if (!templateEditingId || !templateEditTitle.trim() || !templateEditContent.trim()) return;
    setTemplateEditSaving(true);
    const supabase = createSupabaseBrowserClient();
    await supabase
      .from("prompt_templates")
      .update({ title: templateEditTitle.trim(), content: templateEditContent.trim() })
      .eq("id", templateEditingId);
    setTemplateEditingId(null);
    setTemplateEditSaving(false);
    await loadTemplates();
  }

  // ── Validate ──

  function validate(): { tab: Tab; message: string } | null {
    if (!displayThumb) return { tab: "profile", message: "썸네일 이미지를 업로드해주세요." };
    if (!name.trim()) return { tab: "profile", message: "캐릭터 이름을 입력해주세요." };
    if (!description.trim()) return { tab: "profile", message: "한줄 소개를 입력해주세요." };
    if (!prompt.trim()) return { tab: "settings", message: "캐릭터 설정 프롬프트를 입력해주세요." };
    for (let i = 0; i < scenarios.length; i++) {
      const s = scenarios[i]!;
      if (!s.name.trim()) return { tab: "scenarios", message: `시작 상황 ${i + 1}: 이름을 입력해주세요.` };
      if (!s.greeting.trim()) return { tab: "scenarios", message: `시작 상황 ${i + 1}: 첫 인사말을 입력해주세요.` };
    }
    if (!targetGender) return { tab: "publish", message: "타겟을 선택해주세요." };
    if (!ageRating) return { tab: "publish", message: "이용가 등급을 선택해주세요." };
    return null;
  }

  // ── Save ──

  async function handleSave() {
    const err = validate();
    if (err) {
      setActiveTab(err.tab);
      setError(err.message);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) { router.replace("/login"); return; }

      // ── 1. 썸네일 업로드 ──────────────────────────────────────────────────
      let finalThumbUrl = thumbUrl;
      if (thumbFile) {
        const skipConvert = thumbFile.type === "image/gif" || thumbFile.type === "image/webp";
        const uploadFile = skipConvert ? thumbFile : await convertToWebP(thumbFile);
        const path = `${user.id}/${uploadFile.name}`;
        const { error: upErr } = await supabase.storage
          .from("character-thumbnails")
          .upload(path, uploadFile, { upsert: true });
        if (upErr) throw upErr;
        finalThumbUrl = supabase.storage.from("character-thumbnails").getPublicUrl(path).data.publicUrl;
      }

      // ── 2. characters 테이블 저장 ─────────────────────────────────────────
      // 기본 컬럼 (항상 존재)
      const baseCharPayload = {
        name: name.trim(),
        description: description.trim() || null,
        introduction: introduction.trim() || null,
        prompt: prompt.trim(),
        thumbnail_url: finalThumbUrl,
        tags: tags.length > 0 ? tags : null,
      };
      // 신규 컬럼 (마이그레이션 후 존재)
      const fullCharPayload = {
        ...baseCharPayload,
        creator_comment: creatorComment.trim() || null,
        target_gender: targetGender || null,
        age_rating: ageRating || null,
        recommended_model: recommendedModel,
        visibility,
        is_public: visibility === "public",
      };

      let charId = characterId;

      if (mode === "create") {
        // 신규 컬럼 포함 시도
        const { data: charFull, error: insFull } = await supabase
          .from("characters")
          .insert({ ...fullCharPayload, user_id: user.id, model: "gemini-2.5-pro" })
          .select("id")
          .single();
        if (insFull) {
          console.error("[save] characters insert (full) failed:", insFull);
          // 기본 컬럼만으로 fallback
          const { data: charBase, error: insBase } = await supabase
            .from("characters")
            .insert({ ...baseCharPayload, user_id: user.id, model: "gemini-2.5-pro" })
            .select("id")
            .single();
          if (insBase) { console.error("[save] characters insert (base) failed:", insBase); throw insBase; }
          charId = (charBase as { id: string }).id;
        } else {
          charId = (charFull as { id: string }).id;
        }
      } else {
        // 신규 컬럼 포함 시도
        const { error: updFull } = await supabase
          .from("characters")
          .update(fullCharPayload)
          .eq("id", charId!);
        if (updFull) {
          console.error("[save] characters update (full) failed:", updFull);
          // 기본 컬럼만으로 fallback
          const { error: updBase } = await supabase
            .from("characters")
            .update(baseCharPayload)
            .eq("id", charId!);
          if (updBase) { console.error("[save] characters update (base) failed:", updBase); throw updBase; }
        }
      }

      // ── 3~5. scenarios / assets / lorebooks 삭제 (병렬) ─────────────────
      const [{ error: delScenErr }, , { error: delLoreErr }] = await Promise.all([
        supabase.from("character_scenarios").delete().eq("character_id", charId!),
        deletedAssetIds.length > 0
          ? supabase.from("character_assets").delete().in("id", deletedAssetIds)
          : Promise.resolve({ error: null }),
        supabase.from("character_lorebooks").delete().eq("character_id", charId!),
      ]);

      // ── 3. character_scenarios insert ─────────────────────────────────────
      if (!delScenErr && scenarios.length > 0) {
        const insertData = scenarios.map((s) => ({
          character_id: charId!,
          name: s.name.trim(),
          first_message: s.greeting.trim(),
          scenario_prompt: s.prompt.trim(),
        }));
        await supabase.from("character_scenarios").insert(insertData);
      }

      // ── 4. character_assets 저장 (병렬 업로드) ────────────────────────────
      await Promise.all(assets.map(async (asset) => {
        if (asset.file && !asset.id) {
          const webpFile = await convertToWebP(asset.file);
          const path = `${user.id}/assets/${webpFile.name}`;
          const { error: aUpErr } = await supabase.storage
            .from("character-assets")
            .upload(path, webpFile, { upsert: true });
          if (aUpErr) return;
          const assetUrl = supabase.storage.from("character-assets").getPublicUrl(path).data.publicUrl;
          await supabase
            .from("character_assets")
            .insert({ character_id: charId!, url: assetUrl, title: asset.title ?? null, keyword: asset.keyword ?? null });
        } else if (asset.id) {
          await supabase
            .from("character_assets")
            .update({ title: asset.title ?? null, keyword: asset.keyword ?? null })
            .eq("id", asset.id);
        }
      }));

      // ── 5. character_lorebooks insert ─────────────────────────────────────

      const validLorebooks = lorebooks.filter((l) => l.keyword.length > 0 && l.content.trim());
      if (!delLoreErr && validLorebooks.length > 0) {
        const { error: loreErr } = await supabase.from("character_lorebooks").insert(
          validLorebooks.map((l, idx) => ({
            character_id: charId!,
            title: l.title.trim() || null,
            keyword: l.keyword,
            content: l.content.trim(),
            order: idx,
          }))
        );
        if (loreErr) console.error("[save] lorebooks insert failed:", loreErr);
      }

      try {
        const invalidateRes = await fetch("/api/gemini-cache/invalidate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ character_id: charId }),
        });

        if (!invalidateRes.ok) {
          const invalidateData = (await invalidateRes.json()) as { error?: string };
          console.error("[save] remote cache invalidation failed:", invalidateData.error ?? invalidateRes.statusText);
        }
      } catch (cacheErr) {
        console.error("[save] remote cache invalidation request failed:", cacheErr);
      }

      /*

      // ── 6. Gemini 캐시 무효화 ─────────────────────────────────────────────
      // 캐릭터 설정 또는 로어북 변경 시 해당 캐릭터의 모든 대화 캐시를 초기화
      const { error: cacheInvalidErr } = await supabase
        .from("conversations")
        .update({ gemini_cache_id: null, cache_expires_at: null })
        .eq("character_id", charId!);
      if (cacheInvalidErr) console.error("[save] cache invalidation failed:", cacheInvalidErr);

      */
      router.replace("/dashboard");
    } catch (e) {
      console.error("[save] unhandled error:", e);
      setError(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──

  // ── 미리보기용 파생값 ──
  const previewThumb = thumbPreview ?? thumbUrl ?? null;
  const previewName = name || "캐릭터 이름";
  const previewDesc = description || "한줄 소개가 여기에 표시됩니다.";
  const previewGreeting = (scenarios.find((s) => s.localId === activeScenarioId) ?? scenarios[0])?.greeting || "첫 인사말이 여기에 표시됩니다.";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="w-full px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              aria-label="뒤로가기"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold tracking-tight">
              {mode === "create" ? "캐릭터 만들기" : "캐릭터 수정"}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>

        {/* Error */}
        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        ) : null}

        {/* Tab bar */}
        <div className="mt-4 flex overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); setError(null); }}
              className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {tab.label}
              {tab.required ? <span className="ml-0.5 text-red-500">*</span> : null}
            </button>
          ))}
        </div>

        {/* Tab content — 프로필/시나리오는 좌우 분할, 나머지는 단일 컬럼 */}
        <div className={`mt-6 ${activeTab === "profile" || activeTab === "scenarios" || activeTab === "settings" || activeTab === "lorebook" ? "grid grid-cols-1 gap-8 md:grid-cols-2 md:items-start" : activeTab === "assets" || activeTab === "publish" ? "w-full space-y-6" : "max-w-2xl space-y-6"}`}>

          {/* ── 탭1: 프로필 ── */}
          {activeTab === "profile" && (
            <>
            {/* 왼쪽: 폼 */}
            <div className="space-y-6">
              {/* Thumbnail */}
              <div>
                <label className={LABEL}>
                  썸네일 이미지 <span className="text-red-500">*</span>
                </label>
                <div className="mt-2 flex items-center gap-4">
                  <div
                    onClick={() => thumbInputRef.current?.click()}
                    className="flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-100 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500"
                  >
                    {displayThumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={displayThumb} alt="썸네일" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-2xl text-zinc-400">+</span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    <p>클릭하여 이미지를 업로드하세요.</p>
                    <p className="mt-1">JPG, PNG, WEBP, GIF (최대 5MB)</p>
                    {displayThumb ? (
                      <button
                        type="button"
                        onClick={() => {
                          setThumbFile(null);
                          setThumbPreview(null);
                          setThumbUrl(null);
                          if (thumbInputRef.current) thumbInputRef.current.value = "";
                        }}
                        className="mt-1.5 text-red-500 hover:text-red-600"
                      >
                        제거
                      </button>
                    ) : null}
                  </div>
                </div>
                <input
                  ref={thumbInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleThumbChange}
                />
              </div>

              {/* Name */}
              <div>
                <label className={LABEL}>
                  캐릭터 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(cap(e.target.value, 20))}
                  placeholder="예: 친절한 판타지 마법사"
                  className={`mt-2 ${INPUT}`}
                />
                <p className="mt-1 text-right text-xs text-zinc-400">{name.length}/20</p>
              </div>

              {/* Description */}
              <div>
                <label className={LABEL}>
                  한줄 소개 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(cap(e.target.value, 50))}
                  placeholder="예: 고민을 들어주는 따뜻한 마법사"
                  className={`mt-2 ${INPUT}`}
                />
                <p className="mt-1 text-right text-xs text-zinc-400">{description.length}/50</p>
              </div>

              {/* Introduction */}
              <MarkdownEditor
                label="캐릭터 소개글 (선택)"
                value={introduction}
                onChange={setIntroduction}
                maxLength={30000}
                placeholder={"마크다운 형식으로 캐릭터 소개를 작성하세요.\n\n예:\n## 소개\n저는 따뜻한 마법사입니다.\n\n## 특징\n- 친절해요\n- 유머러스해요"}
              />

              {/* Tags */}
              <div>
                <label className={LABEL}>태그 (선택)</label>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  입력 후 엔터로 추가. 최대 10개
                </p>
                {tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs dark:bg-zinc-800"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => setTags((p) => p.filter((t) => t !== tag))}
                          className="ml-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  disabled={tags.length >= 10}
                  placeholder={tags.length >= 10 ? "최대 10개" : "예: 미소녀"}
                  className={`mt-2 ${INPUT} disabled:cursor-not-allowed disabled:opacity-50`}
                />
                <p className="mt-1 text-right text-xs text-zinc-400">{tags.length}/10</p>
              </div>
            </div>{/* 왼쪽 끝 */}

            {/* 오른쪽: 미리보기 */}
            <div className="hidden md:block">
              <div className="sticky top-6 space-y-2">
                <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">미리보기</p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-600">탐색 카드</p>
                <div className="max-w-[280px]">
                <CharacterCard
                  character={{
                    id: characterId ?? "preview",
                    name: previewName,
                    thumbnail_url: previewThumb,
                    description: previewDesc,
                    tags: tags.length > 0 ? tags : null,
                  }}
                />
                </div>
              </div>
            </div>
            </>
          )}

          {/* ── 탭2: 캐릭터 설정 ── */}
          {activeTab === "settings" && (
            <>
            {/* 왼쪽: 프롬프트 textarea */}
            <div className="self-start">
              <div className="flex items-baseline justify-between">
                <label className={LABEL}>
                  캐릭터 설정 프롬프트 <span className="text-red-500">*</span>
                </label>
                <span className="text-xs text-zinc-400">
                  {prompt.length.toLocaleString()}/7,000
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                말투, 성격, 세계관, 배경 설정 등을 자연어로 자유롭게 적어 주세요.
              </p>
              <textarea
                rows={24}
                value={prompt}
                onChange={(e) => setPrompt(cap(e.target.value, 7000))}
                placeholder="예: 너는 따뜻하고 유머러스한 마법사로, 사용자의 고민을 공감해 주며..."
                className={`mt-2 resize-none ${INPUT}`}
              />
            </div>

            {/* 오른쪽: 템플릿 패널 */}
            <div>
              <div className="sticky top-6 space-y-3">
                <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">내 템플릿</p>

                {/* 현재 내용 저장 버튼 */}
                {showTemplateSave ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={templateTitle}
                      onChange={(e) => setTemplateTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void saveTemplate(); } if (e.key === "Escape") { setShowTemplateSave(false); setTemplateTitle(""); } }}
                      placeholder="템플릿 이름"
                      autoFocus
                      maxLength={50}
                      className={INPUT}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setShowTemplateSave(false); setTemplateTitle(""); }}
                        className="flex-1 rounded-lg border border-zinc-200 py-1.5 text-xs text-zinc-500 hover:border-zinc-400 dark:border-zinc-700"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        disabled={!templateTitle.trim() || templateSaving}
                        onClick={() => void saveTemplate()}
                        className="flex-1 rounded-lg bg-zinc-900 py-1.5 text-xs text-white disabled:opacity-40 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setShowTemplateSave(true); setShowNewTemplateForm(false); }}
                    className="w-full rounded-lg border border-dashed border-zinc-300 py-2 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:text-zinc-300"
                  >
                    + 현재 내용 템플릿으로 저장
                  </button>
                )}

                {/* 신규 템플릿 만들기 버튼 */}
                {showNewTemplateForm ? (
                  <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                    <input
                      type="text"
                      value={newTemplateTitle}
                      onChange={(e) => setNewTemplateTitle(e.target.value)}
                      placeholder="템플릿 이름"
                      autoFocus
                      maxLength={50}
                      className={INPUT}
                    />
                    <div>
                      <textarea
                        rows={6}
                        value={newTemplateContent}
                        onChange={(e) => setNewTemplateContent(e.target.value)}
                        placeholder="템플릿 내용을 입력하세요..."
                        maxLength={7000}
                        className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                      />
                      <p className={`text-right text-[10px] ${newTemplateContent.length >= 7000 ? "text-red-500" : newTemplateContent.length >= 6500 ? "text-orange-400" : "text-zinc-400"}`}>
                        {newTemplateContent.length.toLocaleString()} / 7,000
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setShowNewTemplateForm(false); setNewTemplateTitle(""); setNewTemplateContent(""); }}
                        className="flex-1 rounded-lg border border-zinc-200 py-1.5 text-xs text-zinc-500 hover:border-zinc-400 dark:border-zinc-700"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        disabled={!newTemplateTitle.trim() || !newTemplateContent.trim() || newTemplateSaving}
                        onClick={() => void saveNewTemplate()}
                        className="flex-1 rounded-lg bg-zinc-900 py-1.5 text-xs text-white disabled:opacity-40 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setShowNewTemplateForm(true); setShowTemplateSave(false); }}
                    className="w-full rounded-lg border border-dashed border-zinc-300 py-2 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:text-zinc-300"
                  >
                    + 신규 템플릿 만들기
                  </button>
                )}

                {/* 템플릿 목록 */}
                {templates.length === 0 ? (
                  <p className="py-4 text-center text-xs text-zinc-400 dark:text-zinc-600">
                    저장된 템플릿이 없습니다
                  </p>
                ) : (
                  <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-0.5">
                    {templates.map((t) =>
                      templateEditingId === t.id ? (
                        /* 인라인 수정 폼 */
                        <div key={t.id} className="space-y-2 rounded-xl border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
                          <input
                            type="text"
                            value={templateEditTitle}
                            onChange={(e) => setTemplateEditTitle(e.target.value)}
                            maxLength={50}
                            autoFocus
                            className={INPUT}
                          />
                          <div>
                            <textarea
                              value={templateEditContent}
                              onChange={(e) => setTemplateEditContent(e.target.value)}
                              maxLength={7000}
                              className="w-full min-h-[300px] resize-y overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                            />
                            <p className={`text-right text-[10px] ${templateEditContent.length >= 7000 ? "text-red-500" : templateEditContent.length >= 6500 ? "text-orange-400" : "text-zinc-400"}`}>
                              {templateEditContent.length.toLocaleString()} / 7,000
                            </p>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => setTemplateEditingId(null)}
                              className="flex-1 rounded-md border border-zinc-200 py-1 text-[10px] text-zinc-500 hover:border-zinc-400 dark:border-zinc-700"
                            >
                              취소
                            </button>
                            <button
                              type="button"
                              disabled={!templateEditTitle.trim() || !templateEditContent.trim() || templateEditSaving}
                              onClick={() => void saveTemplateEdit()}
                              className="flex-1 rounded-md bg-zinc-900 py-1 text-[10px] text-white disabled:opacity-40 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                            >
                              저장
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* 카드 */
                        <div
                          key={t.id}
                          className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                        >
                          <p className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                            {t.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                            {t.content.slice(0, 50)}{t.content.length > 50 ? "…" : ""}
                          </p>
                          <div className="mt-2 flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => appendTemplate(t.content)}
                              className="flex-1 rounded-md border border-zinc-200 py-1 text-[10px] text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500"
                            >
                              추가
                            </button>
                            <button
                              type="button"
                              onClick={() => { setTemplateEditingId(t.id); setTemplateEditTitle(t.title); setTemplateEditContent(t.content); }}
                              className="flex-1 rounded-md border border-zinc-200 py-1 text-[10px] text-zinc-500 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-500 dark:hover:border-zinc-500"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteTemplate(t.id)}
                              className="flex-1 rounded-md border border-red-200 py-1 text-[10px] text-red-500 hover:border-red-400 dark:border-red-900 dark:hover:border-red-700"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
            </>
          )}

          {/* ── 탭3: 시작 상황 ── */}
          {activeTab === "scenarios" && (
            <>
            {/* 왼쪽: 폼 */}
            <div className="space-y-4 self-start">

              {/* 시나리오 탭 바 */}
              <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800">
                {scenarios.map((scenario, i) => (
                  <div key={scenario.localId} className="relative flex items-center">
                    <button
                      type="button"
                      onClick={() => setActiveScenarioId(scenario.localId)}
                      className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium transition-colors ${
                        activeScenarioId === scenario.localId
                          ? "border border-b-white border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:border-b-zinc-950 dark:bg-zinc-950 dark:text-zinc-100"
                          : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                      }`}
                    >
                      {scenario.name.trim() || `시작 상황 ${i + 1}`}
                      {i > 0 && (
                        <span
                          role="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const prev = scenarios[i - 1].localId;
                            setScenarios((p) => p.filter((s) => s.localId !== scenario.localId));
                            setActiveScenarioId(prev);
                          }}
                          className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                        >
                          ×
                        </span>
                      )}
                    </button>
                  </div>
                ))}
                {scenarios.length < 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      const newId = crypto.randomUUID();
                      setScenarios((p) => [...p, { localId: newId, name: "", greeting: "", prompt: "" }]);
                      setActiveScenarioId(newId);
                    }}
                    className="px-2 py-2 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    + 추가
                  </button>
                )}
              </div>

              {/* 활성 시나리오 폼 */}
              {scenarios.map((scenario) => (
                scenario.localId !== activeScenarioId ? null : (
                  <div key={scenario.localId} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        상황 이름 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={scenario.name}
                        onChange={(e) => updateScenario(scenario.localId, "name", e.target.value)}
                        placeholder="예: 첫 만남"
                        className={`mt-1 ${INPUT}`}
                      />
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between">
                        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          첫 인사말 <span className="text-red-500">*</span>
                        </label>
                        <span className="text-[11px] text-zinc-400">
                          {scenario.greeting.length}/1,000
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-zinc-400">
                        대화 시작 시 캐릭터가 먼저 보내는 메시지
                      </p>
                      <textarea
                        value={scenario.greeting}
                        onChange={(e) => updateScenario(scenario.localId, "greeting", cap(e.target.value, 1000))}
                        placeholder={`예: *조용한 도서관 구석, 낡은 책들 사이에서 당신을 발견한다.*\n"어서 오세요. 무엇을 찾으시나요?"`}
                        className={`mt-1 min-h-[150px] resize-y ${INPUT}`}
                      />
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between">
                        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          시작 프롬프트 <span className="text-red-500">*</span>
                        </label>
                        <span className="text-[11px] text-zinc-400">
                          {scenario.prompt.length}/1,000
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-zinc-400">
                        대화 시작 후 20턴까지만 적용되는 휘발성 프롬프트
                      </p>
                      <textarea
                        value={scenario.prompt}
                        onChange={(e) => updateScenario(scenario.localId, "prompt", cap(e.target.value, 1000))}
                        placeholder="예: 대화 초반에는 공식적이고 조심스러운 태도를 유지한다. 아직 서로 모르는 사이이므로 친밀한 호칭은 사용하지 않는다."
                        className={`mt-1 min-h-[400px] resize-y ${INPUT}`}
                      />
                    </div>
                  </div>
                )
              ))}
            </div>{/* 왼쪽 끝 */}

            {/* 오른쪽: 미리보기 */}
            <div className="hidden md:block">
              <div className="sticky top-6">
                <p className="mb-3 text-xs font-medium text-zinc-400 dark:text-zinc-500">미리보기</p>

                {/* 채팅 첫 메시지 말풍선 미리보기 */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="mb-3 text-[11px] text-zinc-400">첫 인사말 말풍선</p>
                  <div className="flex items-start gap-2.5">
                    {/* 아바타 */}
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                      {previewThumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={previewThumb} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-zinc-400">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="mb-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">{previewName}</p>
                      <div className="rounded-2xl rounded-tl-none bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
                        <MarkdownRenderer
                          content={previewGreeting}
                          components={{
                            em: ({ children }) => (
                              <em style={{ color: "#888888", fontStyle: "normal" }}>{children}</em>
                            ),
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </>
          )}

          {/* ── 탭4: 에셋 ── */}
          {activeTab === "assets" && (
            <>
              <div>
                <label className={LABEL}>
                  채팅 이미지 에셋 (선택)
                  <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
                    {assets.length}/100
                  </span>
                </label>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  채팅에 출력될 이미지를 업로드하세요. 최대 100장까지 업로드 가능합니다.
                </p>
              </div>

              {assets.length >= 100 ? (
                <div className="flex w-full items-center justify-center rounded-xl border border-dashed border-zinc-300 py-4 text-sm text-zinc-400 dark:border-zinc-700">
                  최대 100장까지 업로드 가능합니다
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => assetInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 py-4 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:text-zinc-300"
                >
                  + 이미지 추가
                  <span className="text-xs text-zinc-400">({100 - assets.length}장 남음)</span>
                </button>
              )}

              {assets.length > 0 && (
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
                  {assets.map((asset) => {
                    const src = asset.preview ?? asset.url;
                    return (
                      <div
                        key={asset.localId}
                        className="group relative aspect-square cursor-pointer"
                        onClick={() => { setEditingAsset(asset); setAssetModalError(null); }}
                      >
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={src}
                            alt=""
                            className="h-full w-full rounded-lg object-cover"
                          />
                        ) : null}
                        {/* 카드 하단 제목 */}
                        <div className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-black/50 px-1.5 py-1 text-center">
                          <span className="block truncate text-[10px] text-white">
                            {asset.title?.trim() || "제목 없음"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 에셋 편집 모달 */}
              {editingAsset && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                  onClick={() => { setEditingAsset(null); setAssetModalError(null); }}
                >
                  <div
                    className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* 이미지 미리보기 */}
                    {(editingAsset.preview ?? editingAsset.url) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={editingAsset.preview ?? editingAsset.url}
                        alt=""
                        className="mb-4 h-48 w-full rounded-xl object-cover"
                      />
                    )}

                    {/* 제목 입력 */}
                    <div className="mb-3">
                      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        이미지 제목 <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        maxLength={50}
                        value={editingAsset.title ?? ""}
                        onChange={(e) => setEditingAsset((prev) => prev ? { ...prev, title: e.target.value } : prev)}
                        placeholder="예: 기본 표정"
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                      <p className="mt-1 text-right text-[10px] text-zinc-400">{(editingAsset.title ?? "").length}/50</p>
                    </div>

                    {/* 프롬프트 키워드 입력 */}
                    <div className="mb-4">
                      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        출력 키워드 <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        maxLength={50}
                        value={editingAsset.keyword ?? ""}
                        onChange={(e) => {
                          setEditingAsset((prev) => prev ? { ...prev, keyword: e.target.value } : prev);
                          setAssetModalError(null);
                        }}
                        placeholder="예: 기쁨, 슬픔, 전투씬"
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                      <div className="mt-1 flex items-center justify-between">
                        <p className="text-[10px] text-zinc-400">AI가 이 키워드를 감지하면 해당 이미지를 출력합니다.</p>
                        <p className="text-[10px] text-zinc-400">{(editingAsset.keyword ?? "").length}/50</p>
                      </div>
                    </div>

                    {/* 에러 메시지 */}
                    {assetModalError && (
                      <p className="mb-3 text-xs text-red-500">{assetModalError}</p>
                    )}

                    {/* 버튼 */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          removeAsset(editingAsset.localId);
                          setEditingAsset(null);
                          setAssetModalError(null);
                        }}
                        className="flex-1 rounded-lg border border-red-300 py-2 text-sm text-red-500 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-950"
                      >
                        삭제
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!editingAsset.title?.trim()) {
                            setAssetModalError("제목을 입력해주세요.");
                            return;
                          }
                          if (!editingAsset.keyword?.trim()) {
                            setAssetModalError("출력 키워드를 입력해주세요.");
                            return;
                          }
                          setAssets((prev) =>
                            prev.map((a) =>
                              a.localId === editingAsset.localId
                                ? { ...a, title: editingAsset.title, keyword: editingAsset.keyword }
                                : a
                            )
                          );
                          setEditingAsset(null);
                          setAssetModalError(null);
                        }}
                        className="flex-1 rounded-lg bg-zinc-900 py-2 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <input
                ref={assetInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleAssetFiles}
              />
            </>
          )}

          {/* ── 탭5: 로어북 ── */}
          {activeTab === "lorebook" && (
            <>
              {/* 왼쪽: 로어북 목록 */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <label className={LABEL}>로어북 (선택)</label>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      키워드가 대화에 등장할 때 해당 내용이 시스템 프롬프트에 자동 삽입됩니다.
                      한 턴에 최대 5개 발동 (위쪽 항목 우선). 드래그로 순서 변경.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {lorebooks.length}/{MAX_LOREBOOKS}
                  </span>
                </div>

                {lorebooks.length > 0 && (
                  <div className="space-y-2">
                    {lorebooks.map((entry, i) => {
                      const isExpanded = expandedLoreIds.has(entry.localId);
                      const isDragTarget = loreDragOver === i;
                      return (
                        <div
                          key={entry.localId}
                          onDragOver={(e) => handleLoreDragOver(e, i)}
                          onDrop={() => handleLoreDrop(i)}
                          className={`rounded-xl border bg-white transition-colors dark:bg-zinc-900 ${
                            isDragTarget
                              ? "border-zinc-500 dark:border-zinc-400"
                              : "border-zinc-200 dark:border-zinc-800"
                          }`}
                        >
                          {/* 헤더 행 */}
                          <div className="flex items-center gap-1 px-3 py-2.5">
                            {/* 드래그 핸들 */}
                            <span
                              draggable
                              onDragStart={() => handleLoreDragStart(i)}
                              onDragEnd={handleLoreDragEnd}
                              className="mr-1 shrink-0 cursor-grab text-zinc-300 active:cursor-grabbing dark:text-zinc-600"
                            >
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                                <circle cx="4.5" cy="3.5" r="1.2" />
                                <circle cx="4.5" cy="7" r="1.2" />
                                <circle cx="4.5" cy="10.5" r="1.2" />
                                <circle cx="9.5" cy="3.5" r="1.2" />
                                <circle cx="9.5" cy="7" r="1.2" />
                                <circle cx="9.5" cy="10.5" r="1.2" />
                              </svg>
                            </span>

                            {/* 우선순위 번호 */}
                            <span className="w-6 shrink-0 text-center text-[11px] font-semibold text-zinc-400">
                              {i + 1}
                            </span>

                            {/* 제목/키워드 미리보기 — 클릭 시 토글 */}
                            <button
                              type="button"
                              onClick={() => toggleLoreExpand(entry.localId)}
                              className="flex flex-1 flex-wrap items-center gap-1.5 overflow-hidden text-left"
                            >
                              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                {entry.title.trim() || entry.keyword[0] || "제목 없음"}
                              </span>
                              {!isExpanded && entry.keyword.length > 0 && (
                                <div className="ml-auto flex flex-wrap justify-end gap-1.5">
                                  {entry.keyword.map((kw, idx) => (
                                    <span
                                      key={idx}
                                      className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                                    >
                                      {kw}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 12 12"
                                fill="none"
                                className={`shrink-0 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              >
                                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>

                            {/* 템플릿으로 저장 */}
                            <button
                              type="button"
                              onClick={() => void saveLoreTemplateFromEntry(entry)}
                              title="템플릿으로 저장"
                              className="ml-1 shrink-0 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                            >
                              저장
                            </button>

                            {/* 삭제 */}
                            <button
                              type="button"
                              onClick={() =>
                                setLorebooks((p) => p.filter((l) => l.localId !== entry.localId))
                              }
                              className="ml-1 shrink-0 text-xs text-red-500 hover:text-red-600"
                            >
                              삭제
                            </button>
                          </div>

                          {/* 펼쳐진 내용 */}
                          {isExpanded && (
                            <div
                              className="space-y-3 border-t border-zinc-100 px-4 pb-4 pt-3 dark:border-zinc-800"
                              onMouseDown={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              <div>
                                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                                  제목
                                </label>
                                <input
                                  type="text"
                                  value={entry.title}
                                  onChange={(e) => updateLorebook(entry.localId, "title", e.target.value)}
                                  placeholder="예: 마법의 탑 설명"
                                  className={`mt-1 ${INPUT}`}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                                  키워드 (최대 5개)
                                </label>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  {entry.keyword.map((kw, idx) => (
                                    <span
                                      key={idx}
                                      className="flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                                    >
                                      {kw}
                                      <button
                                        type="button"
                                        onClick={() => removeLorebookKeyword(entry.localId, idx)}
                                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                  {entry.keyword.length < 5 && (
                                    <input
                                      type="text"
                                      value={loreKeywordInputs[entry.localId] ?? ""}
                                      onChange={(e) =>
                                        setLoreKeywordInputs((prev) => ({ ...prev, [entry.localId]: e.target.value }))
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          const kw = (loreKeywordInputs[entry.localId] ?? "").trim();
                                          if (kw) addLorebookKeyword(entry.localId, kw);
                                        }
                                      }}
                                      placeholder="입력 후 Enter"
                                      className={`min-w-[120px] flex-1 ${INPUT}`}
                                    />
                                  )}
                                </div>
                              </div>
                              <div>
                                <div className="flex items-baseline justify-between">
                                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                                    내용
                                  </label>
                                  <span className="text-[11px] text-zinc-400">
                                    {entry.content.length}/400
                                  </span>
                                </div>
                                <textarea
                                  value={entry.content}
                                  onChange={(e) => updateLorebook(entry.localId, "content", cap(e.target.value, 400))}
                                  placeholder="예: 마법의 탑은 왕국 북쪽 끝에 위치한 고대 마법사의 거처로, 수백 년 된 마법 서적들이 보관되어 있다."
                                  className={`mt-1 min-h-48 resize-y ${INPUT}`}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {lorebooks.length < MAX_LOREBOOKS ? (
                  <button
                    type="button"
                    onClick={() => {
                      const newId = crypto.randomUUID();
                      setLorebooks((p) => [
                        ...p,
                        { localId: newId, title: "", keyword: [], content: "" },
                      ]);
                      setExpandedLoreIds((p) => new Set([...p, newId]));
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 py-3 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:text-zinc-300"
                  >
                    + 항목 추가
                  </button>
                ) : (
                  <p className="text-center text-xs text-zinc-400">최대 {MAX_LOREBOOKS}개까지 추가할 수 있습니다.</p>
                )}
              </div>

              {/* 오른쪽: 로어북 템플릿 */}
              <div className="space-y-4">
                <header>
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-sm font-semibold">내 템플릿</h3>
                      {!loreTemplatesLoading && (
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">{loreTemplates.length}/10</span>
                      )}
                    </div>
                    {!showLoreTemplateForm && (
                      loreTemplates.length >= 10 ? (
                        <span className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-600">
                          최대 10개
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowLoreTemplateForm(true)}
                          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
                        >
                          + 새 템플릿 만들기
                        </button>
                      )
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    자주 쓰는 로어북 항목을 템플릿으로 저장해두고 클릭 한 번으로 불러오세요.
                  </p>
                </header>

                {/* 새 템플릿 추가 폼 */}
                {showLoreTemplateForm && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <input
                      type="text"
                      value={loreTemplateTitle}
                      onChange={(e) => setLoreTemplateTitle(e.target.value)}
                      placeholder="템플릿 이름"
                      maxLength={50}
                      autoFocus
                      className={`mb-2 ${INPUT}`}
                    />
                    {/* 키워드 */}
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {loreTemplateKeywords.map((kw, idx) => (
                        <span key={idx} className="flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {kw}
                          <button type="button" onClick={() => setLoreTemplateKeywords((p) => p.filter((_, i) => i !== idx))} className="text-zinc-400 hover:text-zinc-600">×</button>
                        </span>
                      ))}
                      {loreTemplateKeywords.length < 5 && (
                        <input
                          type="text"
                          value={loreTemplateKeywordInput}
                          onChange={(e) => setLoreTemplateKeywordInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const kw = loreTemplateKeywordInput.trim();
                              if (kw && !loreTemplateKeywords.includes(kw)) {
                                setLoreTemplateKeywords((p) => [...p, kw]);
                                setLoreTemplateKeywordInput("");
                              }
                            }
                          }}
                          placeholder="키워드 입력 후 Enter"
                          className={`min-w-[120px] flex-1 ${INPUT}`}
                        />
                      )}
                    </div>
                    <textarea
                      rows={4}
                      value={loreTemplateContent}
                      onChange={(e) => setLoreTemplateContent(e.target.value)}
                      placeholder="템플릿 내용을 입력하세요..."
                      maxLength={400}
                      className={`mb-1 resize-none ${INPUT}`}
                    />
                    <p className="mb-2 text-right text-[10px] text-zinc-400">{loreTemplateContent.length} / 400</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setShowLoreTemplateForm(false); setLoreTemplateTitle(""); setLoreTemplateKeywords([]); setLoreTemplateKeywordInput(""); setLoreTemplateContent(""); }}
                        className="flex-1 rounded-lg border border-zinc-200 py-2 text-xs text-zinc-500 hover:border-zinc-400 dark:border-zinc-700"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        disabled={!loreTemplateTitle.trim() || !loreTemplateContent.trim() || loreTemplateSaving}
                        onClick={() => void saveLoreTemplate()}
                        className="flex-1 rounded-lg bg-zinc-900 py-2 text-xs text-white disabled:opacity-40 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                )}

                {/* 템플릿 목록 */}
                {loreTemplatesLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-20 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                    ))}
                  </div>
                ) : loreTemplates.length === 0 ? (
                  <p className="py-10 text-center text-sm text-zinc-400 dark:text-zinc-600">
                    저장된 템플릿이 없습니다
                  </p>
                ) : (
                  <div className="space-y-3">
                    {loreTemplates.map((tpl) =>
                      loreTemplateEditingId === tpl.id ? (
                        /* 수정 폼 */
                        <div key={tpl.id} className="rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
                          <input
                            type="text"
                            value={loreTemplateEditTitle}
                            onChange={(e) => setLoreTemplateEditTitle(e.target.value)}
                            maxLength={50}
                            autoFocus
                            className={`mb-2 ${INPUT}`}
                          />
                          {/* 키워드 수정 */}
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {loreTemplateEditKeywords.map((kw, idx) => (
                              <span key={idx} className="flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                {kw}
                                <button type="button" onClick={() => setLoreTemplateEditKeywords((p) => p.filter((_, i) => i !== idx))} className="text-zinc-400 hover:text-zinc-600">×</button>
                              </span>
                            ))}
                            {loreTemplateEditKeywords.length < 5 && (
                              <input
                                type="text"
                                value={loreTemplateEditKeywordInput}
                                onChange={(e) => setLoreTemplateEditKeywordInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    const kw = loreTemplateEditKeywordInput.trim();
                                    if (kw && !loreTemplateEditKeywords.includes(kw)) {
                                      setLoreTemplateEditKeywords((p) => [...p, kw]);
                                      setLoreTemplateEditKeywordInput("");
                                    }
                                  }
                                }}
                                placeholder="키워드 입력 후 Enter"
                                className={`min-w-[120px] flex-1 ${INPUT}`}
                              />
                            )}
                          </div>
                          <textarea
                            value={loreTemplateEditContent}
                            onChange={(e) => setLoreTemplateEditContent(e.target.value)}
                            maxLength={400}
                            className={`mb-1 min-h-[200px] resize-y ${INPUT}`}
                          />
                          <p className="mb-2 text-right text-[10px] text-zinc-400">{loreTemplateEditContent.length} / 400</p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => { setLoreTemplateEditingId(null); }}
                              className="flex-1 rounded-lg border border-zinc-200 py-2 text-xs text-zinc-500 hover:border-zinc-400 dark:border-zinc-700"
                            >
                              취소
                            </button>
                            <button
                              type="button"
                              disabled={!loreTemplateEditTitle.trim() || !loreTemplateEditContent.trim() || loreTemplateEditSaving}
                              onClick={() => void saveLoreTemplateEdit()}
                              className="flex-1 rounded-lg bg-zinc-900 py-2 text-xs text-white disabled:opacity-40 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                            >
                              저장
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* 카드 */
                        <div key={tpl.id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                          <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{tpl.title}</p>
                          {tpl.keywords.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {tpl.keywords.map((kw, idx) => (
                                <span key={idx} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{kw}</span>
                              ))}
                            </div>
                          )}
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                            {tpl.content.slice(0, 80)}{tpl.content.length > 80 ? "…" : ""}
                          </p>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => applyLoreTemplate(tpl)}
                              className="flex-1 rounded-md border border-zinc-200 py-1.5 text-xs text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500"
                            >
                              불러오기
                            </button>
                            <button
                              type="button"
                              onClick={() => startLoreTemplateEdit(tpl)}
                              className="flex-1 rounded-md border border-zinc-200 py-1.5 text-xs text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteLoreTemplate(tpl.id)}
                              className="flex-1 rounded-md border border-red-200 py-1.5 text-xs text-red-500 hover:border-red-400 dark:border-red-900 dark:hover:border-red-700"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── 탭6: 등록 설정 ── */}
          {activeTab === "publish" && (
            <div className="w-1/2 space-y-6">
              {/* 제작자 코멘트 */}
              <div>
                <div className="flex items-baseline justify-between">
                  <label className={LABEL}>제작자 코멘트 (선택)</label>
                  <span className="text-xs text-zinc-400">{creatorComment.length}/1,000</span>
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  캐릭터 상세 페이지에 표시되는 제작자의 소개글입니다. 프롬프트에는 영향 없음.
                </p>
                <textarea
                  rows={5}
                  value={creatorComment}
                  onChange={(e) => setCreatorComment(cap(e.target.value, 1000))}
                  placeholder="제작 의도, 사용 팁, 주의사항 등을 자유롭게 적어주세요."
                  className={`mt-2 resize-none ${INPUT}`}
                />
              </div>

              {/* 타겟 */}
              <div>
                <label className={LABEL}>
                  타겟 <span className="text-red-500">*</span>
                </label>
                <div className="mt-2 flex gap-2">
                  {TARGET_GENDER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTargetGender(opt.value)}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                        targetGender === opt.value
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-500"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 이용가 등급 */}
              <div>
                <label className={LABEL}>
                  이용가 등급 <span className="text-red-500">*</span>
                </label>
                <div className="mt-2 flex gap-2">
                  {AGE_RATING_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAgeRating(opt.value)}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                        ageRating === opt.value
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-500"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 추천 모델 */}
              <div>
                <label className={LABEL}>
                  추천 모델 <span className="text-red-500">*</span>
                </label>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  유저가 이 캐릭터와 첫 대화를 시작할 때 자동으로 적용되는 모델입니다.
                </p>
                <div className="mt-2 flex gap-2">
                  {CHAT_MODELS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setRecommendedModel(m.value)}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                        recommendedModel === m.value
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-500"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 공개 설정 */}
              <div>
                <label className={LABEL}>
                  공개 설정 <span className="text-red-500">*</span>
                </label>
                <div className="mt-2 flex gap-2">
                  {([
                    { value: "public", label: "공개" },
                    { value: "link", label: "링크공개" },
                    { value: "private", label: "비공개" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setVisibility(opt.value)}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                        visibility === opt.value
                          ? opt.value === "public"
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : opt.value === "link"
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-zinc-600 bg-zinc-600 text-white"
                          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-500"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {visibility === "public" && "둘러보기에 노출되며 누구나 접근 가능합니다."}
                  {visibility === "link" && "링크를 가진 사용자만 접근 가능합니다."}
                  {visibility === "private" && "제작자 본인만 접근 가능합니다."}
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
