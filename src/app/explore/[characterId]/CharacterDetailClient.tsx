"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase";
import { getCardGradient } from "../../lib/gradient";
import { MarkdownRenderer } from "../../components/MarkdownRenderer";
import type { CharacterDetail, Comment } from "./page";

type Props = {
  character: CharacterDetail;
  initialComments: Comment[];
  currentUserId: string | null;
  isCharacterOwner: boolean;
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
  initialComments,
  currentUserId,
  isCharacterOwner,
}: Props) {
  const router = useRouter();
  const [startingChat, setStartingChat] = useState(false);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleStartChat() {
    if (!currentUserId) {
      router.push(`/login?next=/explore/${character.id}`);
      return;
    }
    setStartingChat(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const conversationId = crypto.randomUUID();
      const { error } = await supabase.from("conversations").insert({
        id: conversationId,
        user_id: currentUserId,
        character_id: character.id,
      });
      if (error) throw error;
      router.push(`/chat/${conversationId}`);
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
        author_nickname: (profile?.nickname as string | null) ?? "",
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
    <div className="mx-auto w-full max-w-2xl px-6 py-10 pb-24">
      {/* ── 캐릭터 헤더 ── */}
      <div className="flex gap-5">
        {/* 썸네일 */}
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl">
          {character.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={character.thumbnail_url}
              alt={character.name}
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <div className={`flex h-full w-full items-center justify-center ${getCardGradient(character.id)}`}>
              <span className="text-3xl font-bold text-white drop-shadow">
                {character.name.charAt(0)}
              </span>
            </div>
          )}
        </div>

        {/* 텍스트 정보 */}
        <div className="min-w-0 flex-1">
          {/* 이름 + 대화수 */}
          <div className="flex items-center gap-3">
            <h1 className="truncate text-2xl font-bold tracking-tight">{character.name}</h1>
            {character.usage_count ? (
              <span className="shrink-0 text-sm text-zinc-400 dark:text-zinc-500">
                💬 {formatCount(character.usage_count)}
              </span>
            ) : null}
          </div>

          {/* 설명 */}
          {character.description ? (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{character.description}</p>
          ) : null}

          {/* 태그 */}
          {character.tags && character.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
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
            by {character.author_nickname || "익명"}
          </p>

          <button
            type="button"
            disabled={startingChat}
            onClick={() => void handleStartChat()}
            className="mt-4 rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {startingChat ? "여는 중..." : "대화 시작"}
          </button>
        </div>
      </div>

      {/* ── 소개글 ── */}
      {character.introduction ? (
        <div className="mt-8 rounded-xl border border-zinc-200 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">소개</h2>
          <MarkdownRenderer content={character.introduction} />
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
                        <span className="text-xs font-semibold">
                          {comment.author_nickname || "익명"}
                        </span>
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
                            className="rounded px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            수정
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            disabled={deletingId === comment.id}
                            onClick={() => void handleDeleteComment(comment.id)}
                            className="rounded px-2 py-1 text-[11px] text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
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
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
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
