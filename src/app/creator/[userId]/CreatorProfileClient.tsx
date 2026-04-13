"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase";
import { getCardGradient } from "../../lib/gradient";
import { convertToWebP } from "../../lib/convertToWebP";
import type { CreatorProfile, CreatorCharacter } from "./page";

function formatCount(n: number | null): string {
  if (!n) return "";
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}천`;
  return `${n}`;
}

type FollowUser = {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
};

type Props = {
  profile: CreatorProfile;
  characters: CreatorCharacter[];
  isOwner: boolean;
  currentUserId: string | null;
  initialIsFollowing: boolean;
  initialFollowerCount: number;
  initialFollowingCount: number;
};

export function CreatorProfileClient({
  profile,
  characters,
  isOwner,
  currentUserId,
  initialIsFollowing,
  initialFollowerCount,
  initialFollowingCount,
}: Props) {
  const router = useRouter();

  // 프로필 편집
  const [editingBio, setEditingBio] = useState(false);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [draftBio, setDraftBio] = useState(profile.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // 팔로우
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [followingCount] = useState(initialFollowingCount);
  const [followLoading, setFollowLoading] = useState(false);

  // 모달
  type ModalType = "followers" | "following" | null;
  const [modal, setModal] = useState<ModalType>(null);
  const [modalUsers, setModalUsers] = useState<FollowUser[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  const avatarColor = getCardGradient(profile.user_id);

  // ── 소개글 저장 ──
  async function handleSaveBio() {
    if (saving) return;
    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("profiles")
        .update({ bio: draftBio.trim() || null })
        .eq("user_id", profile.user_id);
      if (error) throw error;
      setBio(draftBio.trim());
      setEditingBio(false);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  // ── 아바타 업로드 ──
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const webpFile = await convertToWebP(file, 0.9);
      const path = `${profile.user_id}/${webpFile.name}`;
      const { error: upErr } = await supabase.storage
        .from("profile-avatars")
        .upload(path, webpFile, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("profile-avatars").getPublicUrl(path);
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", profile.user_id);
      if (updateErr) throw updateErr;
      setAvatarUrl(publicUrl);
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  // ── 팔로우 / 언팔로우 ──
  async function handleToggleFollow() {
    if (!currentUserId) { router.push("/login"); return; }
    if (followLoading) return;
    setFollowLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (isFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("following_id", profile.user_id);
        if (error) throw error;
        setIsFollowing(false);
        setFollowerCount((n) => Math.max(0, n - 1));
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: currentUserId, following_id: profile.user_id });
        if (error) throw error;
        setIsFollowing(true);
        setFollowerCount((n) => n + 1);

        // 팔로우 알림
        try {
          const { data: me } = await supabase
            .from("profiles")
            .select("nickname")
            .eq("user_id", currentUserId)
            .maybeSingle();
          const nickname = (me?.nickname as string | null) ?? "누군가";
          await supabase.from("notifications").insert({
            user_id: profile.user_id,
            type: "follow",
            message: `${nickname}님이 팔로우했습니다`,
            link: `/creator/${currentUserId}`,
            is_read: false,
          });
        } catch { /* 알림 실패는 무시 */ }
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setFollowLoading(false);
    }
  }

  // ── 팔로워/팔로잉 모달 열기 ──
  async function openModal(type: "followers" | "following") {
    if (!isOwner) return;
    setModal(type);
    setModalLoading(true);
    setModalUsers([]);
    try {
      const supabase = createSupabaseBrowserClient();
      let ids: string[] = [];
      if (type === "followers") {
        const { data } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", profile.user_id);
        ids = (data ?? []).map((r: Record<string, unknown>) => r.follower_id as string);
      } else {
        const { data } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", profile.user_id);
        ids = (data ?? []).map((r: Record<string, unknown>) => r.following_id as string);
      }
      if (ids.length === 0) { setModalUsers([]); return; }
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nickname, avatar_url")
        .in("user_id", ids);
      setModalUsers(
        (profiles ?? []).map((p: Record<string, unknown>) => ({
          user_id: p.user_id as string,
          nickname: (p.nickname as string | null) ?? "익명",
          avatar_url: (p.avatar_url as string | null) ?? null,
        }))
      );
    } catch {
      setModalUsers([]);
    } finally {
      setModalLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10 pb-24">

      {/* ── 팔로워/팔로잉 모달 ── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl bg-white p-6 dark:bg-zinc-900 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                {modal === "followers" ? "팔로워" : "팔로잉"}
              </h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {modalLoading ? (
              <p className="py-4 text-center text-sm text-zinc-400">불러오는 중...</p>
            ) : modalUsers.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-400">
                {modal === "followers" ? "아직 팔로워가 없습니다." : "팔로우한 유저가 없습니다."}
              </p>
            ) : (
              <ul className="max-h-72 space-y-3 overflow-y-auto">
                {modalUsers.map((u) => (
                  <li key={u.user_id}>
                    <button
                      type="button"
                      onClick={() => { setModal(null); router.push(`/creator/${u.user_id}`); }}
                      className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ${getCardGradient(u.user_id)}`}>
                        {u.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.avatar_url} alt={u.nickname} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-white">{u.nickname.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <span className="text-sm font-medium">{u.nickname}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ── 프로필 헤더 ── */}
      <div className="relative rounded-2xl border border-zinc-200 bg-white px-6 py-8 dark:border-zinc-800 dark:bg-zinc-950">

        {/* 수정 버튼 (본인만) */}
        {isOwner && !editingBio && (
          <button
            type="button"
            onClick={() => { setDraftBio(bio); setEditingBio(true); }}
            className="absolute right-4 top-4 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            수정
          </button>
        )}

        <div className="flex items-start gap-5">
          {/* 아바타 */}
          <div className="relative shrink-0">
            <div className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full ${avatarColor}`}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={profile.nickname} className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-white drop-shadow">
                  {profile.nickname.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            {editingBio && (
              <button
                type="button"
                disabled={uploadingAvatar}
                onClick={() => avatarInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/60 disabled:opacity-50"
                title="이미지 변경"
              >
                {uploadingAvatar ? (
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            )}
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleAvatarChange(e)} />
          </div>

          {/* 닉네임 + 소개글 */}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight">{profile.nickname}</h1>

            {/* 팔로워/팔로잉 수 */}
            <div className="mt-1 flex items-center gap-4">
              <button
                type="button"
                disabled={!isOwner}
                onClick={() => isOwner && void openModal("followers")}
                className={`text-xs ${isOwner ? "cursor-pointer hover:underline" : "cursor-default"} text-zinc-500 dark:text-zinc-400`}
              >
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{followerCount}</span> 팔로워
              </button>
              <button
                type="button"
                disabled={!isOwner}
                onClick={() => isOwner && void openModal("following")}
                className={`text-xs ${isOwner ? "cursor-pointer hover:underline" : "cursor-default"} text-zinc-500 dark:text-zinc-400`}
              >
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{followingCount}</span> 팔로잉
              </button>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">캐릭터 {characters.length}개</span>
            </div>

            {/* 팔로우 버튼 (타인만) */}
            {!isOwner && (
              <button
                type="button"
                disabled={followLoading}
                onClick={() => void handleToggleFollow()}
                className={`mt-3 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                  isFollowing
                    ? "border border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    : "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                }`}
              >
                {followLoading ? "..." : isFollowing ? "팔로잉" : "팔로우"}
              </button>
            )}

            {/* 소개글 */}
            {editingBio ? (
              <div className="mt-3">
                <textarea
                  autoFocus
                  value={draftBio}
                  onChange={(e) => setDraftBio(e.target.value.slice(0, 500))}
                  rows={4}
                  placeholder="소개글을 입력하세요..."
                  className="w-full resize-none rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">{draftBio.length}/500</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setDraftBio(bio); setEditingBio(false); }}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
                      취소
                    </button>
                    <button type="button" disabled={saving} onClick={() => void handleSaveBio()}
                      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900">
                      {saving ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className={`mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-sm ${!bio ? "italic text-zinc-400 dark:text-zinc-600" : "text-zinc-600 dark:text-zinc-400"}`}>
                {bio || (isOwner ? "소개글을 작성해보세요." : "")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── 캐릭터 목록 ── */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">캐릭터</h2>
        {characters.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">공개된 캐릭터가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {characters.map((character) => (
              <button key={character.id} type="button" onClick={() => router.push(`/explore/${character.id}`)}
                className="group overflow-hidden rounded-xl border border-zinc-200 bg-white text-left transition-transform hover:scale-[1.01] active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-950">
                <div className="aspect-square w-full overflow-hidden">
                  {character.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={character.thumbnail_url} alt={character.name}
                      className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center ${getCardGradient(character.id)}`}>
                      <span className="text-4xl font-bold text-white drop-shadow-lg">{character.name.charAt(0)}</span>
                    </div>
                  )}
                </div>
                <div className="px-3 py-2.5">
                  <p className="truncate text-sm font-semibold leading-snug">{character.name}</p>
                  {character.tags && character.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {character.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {character.usage_count ? (
                    <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">💬 {formatCount(character.usage_count)}</p>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
