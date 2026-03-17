"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase";
import { MarkdownEditor } from "../../../components/MarkdownEditor";

const MODELS = [
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
] as const;

type ModelId = (typeof MODELS)[number]["id"];

export default function EditCharacterPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [introduction, setIntroduction] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ModelId>("gemini-2.5-pro");
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const promptCount = useMemo(() => prompt.length, [prompt]);

  useEffect(() => {
    async function load() {
      setError(null);
      setLoading(true);

      try {
        const supabase = createSupabaseBrowserClient();
        const { data: userResult, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userResult.user) {
          router.replace("/login");
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("characters")
          .select("id, name, description, introduction, prompt, model, thumbnail_url, tags")
          .eq("id", id)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (!data) throw new Error("캐릭터를 찾을 수 없습니다.");

        setName(data.name ?? "");
        setDescription((data.description as string | null) ?? "");
        setIntroduction((data.introduction as string | null) ?? "");
        setPrompt(data.prompt ?? "");
        setModel((data.model as ModelId) || "gemini-2.5-pro");
        setThumbnailUrl((data.thumbnail_url as string | null) ?? null);
        setTags((data.tags as string[] | null) ?? []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "불러오는 중 오류가 발생했습니다.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    if (id) void load();
  }, [id, router]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setThumbnailFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setThumbnailPreview(url);
    } else {
      setThumbnailPreview(null);
    }
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const value = tagInput.trim().replace(/^#/, "");
      if (value && !tags.includes(value) && tags.length < 10) {
        setTags((prev) => [...prev, value]);
      }
      setTagInput("");
    } else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();

      let newThumbnailUrl = thumbnailUrl;
      if (thumbnailFile) {
        const { data: userResult, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userResult.user) throw new Error("로그인이 필요합니다.");
        const ext = thumbnailFile.name.split(".").pop() ?? "jpg";
        const path = `${userResult.user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("character-thumbnails")
          .upload(path, thumbnailFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from("character-thumbnails")
          .getPublicUrl(path);
        newThumbnailUrl = urlData.publicUrl;
      }

      const { error: updateError } = await supabase
        .from("characters")
        .update({
          name,
          description: description.trim() || null,
          introduction: introduction.trim() || null,
          prompt,
          model,
          thumbnail_url: newThumbnailUrl,
          tags: tags.length > 0 ? tags : null,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      router.replace("/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
        <main className="mx-auto w-full max-w-2xl px-6 py-12">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">불러오는 중...</p>
        </main>
      </div>
    );
  }

  const displayPreview = thumbnailPreview ?? thumbnailUrl;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto w-full max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">캐릭터 수정</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          이름, 프롬프트, 모델을 수정할 수 있습니다.
        </p>

        <form onSubmit={handleSave} className="mt-8 space-y-6">
          {/* 썸네일 */}
          <div>
            <label className="block text-sm font-medium">썸네일 이미지 (선택)</label>
            <div className="mt-2 flex items-center gap-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-100 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500"
              >
                {displayPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={displayPreview} alt="미리보기" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl text-zinc-400">+</span>
                )}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                <p>클릭하여 이미지를 변경하세요.</p>
                <p className="mt-1">JPG, PNG, WEBP (최대 5MB)</p>
                {displayPreview ? (
                  <button
                    type="button"
                    onClick={() => {
                      setThumbnailFile(null);
                      setThumbnailPreview(null);
                      setThumbnailUrl(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="mt-1 text-red-500 hover:text-red-600"
                  >
                    제거
                  </button>
                ) : null}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium">캐릭터 이름</label>
            <input
              type="text"
              required
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
            />
            <p className="mt-1 text-right text-xs text-zinc-400">{name.length}/20</p>
          </div>

          <div>
            <label className="block text-sm font-medium">한줄 소개 (선택)</label>
            <input
              type="text"
              maxLength={50}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
              placeholder="예: 고민을 들어주는 따뜻한 마법사"
            />
            <p className="mt-1 text-right text-xs text-zinc-400">{description.length}/50</p>
          </div>

          <div>
            <MarkdownEditor
              label="캐릭터 소개글 (선택)"
              value={introduction}
              onChange={setIntroduction}
              maxLength={30000}
              placeholder={"마크다운 형식으로 캐릭터 소개를 작성하세요.\n\n예:\n## 소개\n저는 따뜻한 마법사입니다.\n\n## 특징\n- 친절해요\n- 유머러스해요"}
            />
          </div>

          {/* 태그 */}
          <div>
            <label className="block text-sm font-medium">태그 (선택)</label>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              입력 후 엔터 또는 스페이스로 태그를 추가하세요. (최대 10개)
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
                      onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
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
              placeholder={tags.length >= 10 ? "태그는 최대 10개까지 추가할 수 있습니다" : "예: 미소녀"}
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
            />
            <p className="mt-1 text-right text-xs text-zinc-400">{tags.length}/10</p>
          </div>

          <div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <label className="block text-sm font-medium">캐릭터 설정 프롬프트</label>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  최대 7000자까지 입력할 수 있습니다.
                </p>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {promptCount.toLocaleString()}/7,000
              </p>
            </div>
            <textarea
              required
              rows={10}
              maxLength={7000}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="mt-2 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">AI 모델</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as ModelId)}
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </form>
      </main>
    </div>
  );
}
