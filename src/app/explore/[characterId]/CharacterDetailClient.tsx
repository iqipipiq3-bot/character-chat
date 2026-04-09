"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createSupabaseBrowserClient } from "../../lib/supabase";
import { getCardGradient } from "../../lib/gradient";
import { MarkdownRenderer } from "../../components/MarkdownRenderer";
import { replaceVariables } from "../../lib/replaceVariables";
import type { CharacterDetail, Comment, Scenario } from "./page";

type Props = {
  character: CharacterDetail;
  scenarios: Scenario[];
  initialComments: Comment[];
  currentUserId: string | null;
  isCharacterOwner: boolean;
  userName: string;
  initialIsFavorited: boolean;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatCount(n: number | null): string {
  if (!n) return "";
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}천`;
  return `${n}`;
}

export function CharacterDetailClient({
  character,
  scenarios,
  initialComments,
  currentUserId,
  isCharacterOwner,
  userName,
  initialIsFavorited,
}: Props) {
  const router = useRouter();
  const [startingChat, setStartingChat] = useState(false);
  const [showScenarioPicker, setShowScenarioPicker] = useState(false);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited);
  const [togglingFavorite, setTogglingFavorite] = useState(false);

  async function toggleFavorite() {
    if (!currentUserId) {
      router.push(`/login?next=/explore/${character.id}`);
      return;
    }
    setTogglingFavorite(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (isFavorited) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", currentUserId)
          .eq("character_id", character.id);
        if (error) throw error;
        setIsFavorited(false);
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({ user_id: currentUserId, character_id: character.id });
        if (error) throw error;
        setIsFavorited(true);
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "즐겨찾기 처리 중 오류가 발생했습니다.");
    } finally {
      setTogglingFavorite(false);
    }
  }

  function handleStartChat() {
    if (!currentUserId) {
      router.push(`/login?next=/explore/${character.id}`);
      return;
    }
    if (scenarios.length > 0) {
      setShowScenarioPicker(true);
    } else {
      void startConversation(null);
    }
  }

  async function startConversation(scenario: Scenario | null) {
    setStartingChat(true);
    setShowScenarioPicker(false);
    try {
      const supabase = createSupabaseBrowserClient();
      const conversationId = crypto.randomUUID();
      const { error } = await supabase.from("conversations").insert({
        id: conversationId,
        user_id: currentUserId!,
        character_id: character.id,
        scenario_id: scenario?.id ?? null,
      });
      if (error) throw error;

      // 선택한 시나리오의 첫 인사말을 assistant 메시지로 저장
      if (scenario) {
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          user_id: currentUserId!,
          character_id: character.id,
          role: "assistant",
          content: scenario.greeting,
          created_at: new Date().toISOString(),
        });
      }

      const modelParam = character.recommended_model
        ? `?model=${encodeURIComponent(character.recommended_model)}`
        : "";
      router.push(`/chat/${conversationId}${modelParam}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "대화방을 여는 중 오류가 발생했습니다.");
      setStartingChat(false);
    }
  }

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다.");

      const { data, error } = await supabase
        .from("comments")
        .insert({ character_id: character.id, user_id: user.id, content: newComment.trim() })
        .select("id, user_id, content, created_at, updated_at")
        .single();
      if (error) throw error;

      const { data: profile } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("user_id", user.id)
        .maybeSingle();

      const newEntry: Comment = {
        id: data.id as string,
        user_id: data.user_id as string,
        content: data.content as string,
        created_at: data.created_at as string,
        updated_at: data.updated_at as string,
        author_nickname: (profile?.nickname as string | null) ?? "알 수 없음",
      };
      setComments((prev) => [...prev, newEntry]);
      setNewComment("");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "댓글 작성 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(comment: Comment) {
    setEditingId(comment.id);
    setEditContent(comment.content);
  }

  async function handleSaveEdit(comment: Comment) {
    if (!editContent.trim() || savingEditId) return;
    setSavingEditId(comment.id);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("comments")
        .update({ content: editContent.trim(), updated_at: new Date().toISOString() })
        .eq("id", comment.id);
      if (error) throw error;
      setComments((prev) =>
        prev.map((c) =>
          c.id === comment.id
            ? { ...c, content: editContent.trim(), updated_at: new Date().toISOString() }
            : c
        )
      );
      setEditingId(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "수정 중 오류가 발생했습니다.");
    } finally {
      setSavingEditId(null);
    }
  }

  async function handleDeleteComment(commentId: string) {
    const ok = window.confirm("댓글을 삭제하시겠습니까?");
    if (!ok) return;
    setDeletingId(commentId);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("comments").delete().eq("id", commentId);
      if (error) throw error;
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 pb-24 md:px-6 md:py-10">

      {/* ── 시나리오 선택 모달 ── */}
      {showScenarioPicker && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => !startingChat && setShowScenarioPicker(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-6 dark:bg-zinc-900 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              시작 상황 선택
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              어떤 상황에서 시작할지 선택하세요.
            </p>

            <div className="mt-4 space-y-2">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  disabled={startingChat}
                  onClick={() => void startConversation(scenario)}
                  className="w-full rounded-xl border border-zinc-200 p-4 text-left transition-colors hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
                >
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {scenario.name}
                  </p>
                  <p className="mt-1.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {scenario.greeting}
                  </p>
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={startingChat}
              onClick={() => setShowScenarioPicker(false)}
              className="mt-3 w-full rounded-xl border border-zinc-200 py-2.5 text-sm text-zinc-500 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              취소
            </button>
          </div>
        </div>
      )}
      {/* ── 캐릭터 헤더 ── */}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-5">
        {/* 썸네일 */}
        <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-2xl sm:h-24 sm:w-24">
          {character.thumbnail_url ? (
            <Image
              src={character.thumbnail_url}
              alt={character.name}
              fill
              sizes="128px"
              className="object-cover object-top"
            />
          ) : (
            <div className={`flex h-full w-full items-center justify-center ${getCardGradient(character.id)}`}>
              <span className="text-4xl font-bold text-white drop-shadow sm:text-3xl">
                {character.name.charAt(0)}
              </span>
            </div>
          )}
        </div>

        {/* 텍스트 정보 */}
        <div className="w-full min-w-0 flex-1 text-center sm:text-left">
          {/* 이름 + 대화수 */}
          <div className="flex items-center justify-center gap-3 sm:justify-start">
            <h1 className="truncate text-2xl font-bold tracking-tight">{character.name}</h1>
            {character.usage_count ? (
              <span className="shrink-0 text-sm text-zinc-400 dark:text-zinc-500">
                💬 {formatCount(character.usage_count)}
              </span>
            ) : null}
          </div>

          {/* 설명 */}
          {character.description ? (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{replaceVariables(character.description, userName)}</p>
          ) : null}

          {/* 태그 */}
          {character.tags && character.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {character.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => router.push(`/explore?q=${encodeURIComponent(tag)}`)}
                  className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
            by{" "}
            <a
              href={`/creator/${character.user_id}`}
              className="hover:underline hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              {character.author_nickname || "익명"}
            </a>
          </p>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              disabled={startingChat}
              onClick={() => void handleStartChat()}
              className="min-h-[44px] flex-1 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 sm:flex-none sm:py-2"
            >
              {startingChat ? "여는 중..." : "대화 시작"}
            </button>
            <button
              type="button"
              disabled={togglingFavorite}
              onClick={() => void toggleFavorite()}
              title={isFavorited ? "즐겨찾기 해제" : "즐겨찾기 추가"}
              className={`min-h-[44px] rounded-lg border px-4 py-2.5 text-sm transition-colors disabled:opacity-60 sm:py-2 ${
                isFavorited
                  ? "border-yellow-400 bg-yellow-50 text-yellow-500 hover:bg-yellow-100 dark:border-yellow-600/60 dark:bg-yellow-950/30 dark:text-yellow-400 dark:hover:bg-yellow-900/30"
                  : "border-zinc-300 text-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800"
              }`}
            >
              {isFavorited ? "★" : "☆"}
            </button>
          </div>
        </div>
      </div>

      {/* ── 소개글 ── */}
      {character.introduction ? (
        <div className="mt-8 rounded-xl border border-zinc-200 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">소개</h2>
          <MarkdownRenderer content={replaceVariables(character.introduction, userName)} />
        </div>
      ) : null}

      {/* ── 제작자 코멘트 ── */}
      {character.creator_comment ? (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">제작자 코멘트</h2>
          <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{replaceVariables(character.creator_comment, userName)}</p>
        </div>
      ) : null}

      {/* ── 댓글 섹션 ── */}
      <div className="mt-10">
        <h2 className="mb-4 text-base font-semibold">
          댓글
          {comments.length > 0 && (
            <span className="ml-2 text-sm font-normal text-zinc-400">{comments.length}</span>
          )}
        </h2>

        {comments.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>
        ) : (
          <ul className="space-y-4">
            {comments.map((comment) => {
              const isOwn = comment.user_id === currentUserId;
              const canDelete = isOwn || isCharacterOwner;
              const isEditing = editingId === comment.id;

              return (
                <li
                  key={comment.id}
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <a
                          href={`/creator/${comment.user_id}`}
                          className="text-xs font-semibold hover:underline"
                        >
                          {comment.author_nickname || "알 수 없음"}
                        </a>
                        <span className="text-[11px] text-zinc-400">
                          {formatDate(comment.created_at)}
                          {comment.updated_at !== comment.created_at && " (수정됨)"}
                        </span>
                      </div>

                      {isEditing ? (
                        <div className="mt-2">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={3}
                            maxLength={1000}
                            className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-500"
                          />
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              disabled={savingEditId === comment.id}
                              onClick={() => void handleSaveEdit(comment)}
                              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900"
                            >
                              {savingEditId === comment.id ? "저장 중..." : "저장"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                          {comment.content}
                        </p>
                      )}
                    </div>

                    {!isEditing && (isOwn || canDelete) && (
                      <div className="flex shrink-0 gap-1">
                        {isOwn && (
                          <button
                            type="button"
                            onClick={() => startEdit(comment)}
                            className="min-h-[36px] rounded px-2.5 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            수정
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            disabled={deletingId === comment.id}
                            onClick={() => void handleDeleteComment(comment.id)}
                            className="min-h-[36px] rounded px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* 댓글 입력 */}
        <div className="mt-6">
          {currentUserId ? (
            <form onSubmit={(e) => void handleSubmitComment(e)} className="space-y-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="댓글을 입력하세요..."
                className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">{newComment.length}/1000</span>
                <button
                  type="submit"
                  disabled={submitting || !newComment.trim()}
                  className="min-h-[44px] rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 sm:min-h-0"
                >
                  {submitting ? "등록 중..." : "등록"}
                </button>
              </div>
            </form>
          ) : (
            <p className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              <a href={`/login?next=/explore/${character.id}`} className="font-medium text-zinc-900 underline underline-offset-2 dark:text-zinc-100">
                로그인
              </a>
              {" "}후 댓글을 작성할 수 있어요.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
