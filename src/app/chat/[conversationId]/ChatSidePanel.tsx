"use client";

import React, { useState, useEffect } from "react";

export type Persona = {
  id: string;
  name: string;
  content: string;
  is_default: boolean;
};

export type FontSettings = {
  userBubbleBg: string;
  aiBubbleBg: string;
  userFontColor: string;
  aiFontColor: string;
  fontSize: number;
};

export const DEFAULT_FONT_SETTINGS: FontSettings = {
  userBubbleBg: "#FFE0DB",
  aiBubbleBg: "#FFFFFF",
  userFontColor: "#1A1A1A",
  aiFontColor: "#1A1A1A",
  fontSize: 16,
};

type Props = {
  open: boolean;
  onClose: () => void;
  personas: Persona[];
  activePersonaId: string | null;
  onSelectPersona: (id: string | null) => void;
  userNote: string;
  onUserNoteChange: (note: string) => void;
  fontSettings: FontSettings;
  onFontSettingsChange: (s: FontSettings) => void;
  onEditPersonasClick: () => void;
};

export function ChatSidePanel({
  open,
  onClose,
  personas,
  activePersonaId,
  onSelectPersona,
  userNote,
  onUserNoteChange,
  fontSettings,
  onFontSettingsChange,
  onEditPersonasClick,
}: Props) {
  const [tab, setTab] = useState<"persona" | "note" | "font">("persona");
  const [draftNote, setDraftNote] = useState(userNote);
  const [noteSaved, setNoteSaved] = useState(false);

  // 외부에서 userNote가 바뀌면(초기 로드) draft도 동기화
  useEffect(() => {
    setDraftNote(userNote);
  }, [userNote]);

  function handleNoteSave() {
    onUserNoteChange(draftNote);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  }

  const activePersona =
    activePersonaId !== null
      ? personas.find((p) => p.id === activePersonaId)
      : personas.find((p) => p.is_default);

  return (
    <>
      {/* 백드롭 */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      {/* 패널 */}
      <div
        className={`fixed right-0 top-12 bottom-0 z-50 flex w-80 flex-col border-l border-[#E0E0E0] bg-white shadow-xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* 패널 헤더 */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[#E0E0E0] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#1A1A1A]">채팅 설정</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[#666666] hover:bg-[#F0F0F0] hover:text-[#1A1A1A]"
          >
            ✕
          </button>
        </div>

        {/* 탭 */}
        <div className="flex flex-shrink-0 border-b border-[#E0E0E0]">
          {(["persona", "note", "font"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                tab === t
                  ? "border-b-2 border-[#1A1A2E] text-[#1A1A2E]"
                  : "text-[#888888] hover:text-[#1A1A1A]"
              }`}
            >
              {t === "persona" ? "페르소나" : t === "note" ? "유저 노트" : "글꼴"}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* ── 페르소나 탭 ── */}
          {tab === "persona" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#666666]">현재 적용</p>
                <button
                  type="button"
                  onClick={onEditPersonasClick}
                  className="text-xs text-[#666666] underline underline-offset-2 hover:text-[#1A1A1A]"
                >
                  페르소나 수정
                </button>
              </div>
              <div className="rounded-lg border border-[#E0E0E0] bg-[#F8F8F8] px-3 py-2 text-sm text-[#333333]">
                {activePersona?.name ?? "기본값 (자동 선택)"}
              </div>

              <p className="text-xs font-semibold text-[#666666]">선택</p>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => onSelectPersona(null)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                    activePersonaId === null
                      ? "bg-[#1A1A2E] text-white"
                      : "border border-[#E0E0E0] text-[#333333] hover:bg-[#F8F8F8]"
                  }`}
                >
                  기본값 사용
                </button>
                {personas.length === 0 ? (
                  <p className="py-2 text-center text-xs text-[#999999]">
                    저장된 페르소나가 없습니다.
                  </p>
                ) : (
                  personas.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onSelectPersona(p.id)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        activePersonaId === p.id
                          ? "bg-[#1A1A2E] text-white"
                          : "border border-[#E0E0E0] text-[#333333] hover:bg-[#F8F8F8]"
                      }`}
                    >
                      {p.name}
                      {p.is_default && (
                        <span className="ml-1.5 text-xs opacity-60">(기본)</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── 유저 노트 탭 ── */}
          {tab === "note" && (
            <div className="space-y-3">
              <p className="text-xs text-[#666666]">
                AI가 대화 시 참고할 메모를 입력하세요.
                <br />
                다음 메시지부터 시스템 프롬프트에 반영됩니다.
              </p>
              <div className="relative">
                <textarea
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  maxLength={1000}
                  rows={9}
                  placeholder={"예: 오늘 유저는 기분이 안 좋음\n피곤하고 우울한 상태..."}
                  className="w-full resize-none rounded-lg border border-[#E0E0E0] bg-white px-3 py-2 pb-6 text-sm outline-none focus:border-[#666666]"
                />
                <span className="pointer-events-none absolute bottom-2 right-2 text-[11px] text-[#999999]">
                  {draftNote.length}/1000
                </span>
              </div>
              <button
                type="button"
                onClick={handleNoteSave}
                className="w-full rounded-lg bg-[#1A1A2E] py-2 text-xs font-medium text-white hover:bg-[#141424]"
              >
                {noteSaved ? "저장됨 ✓" : "저장"}
              </button>
              <p className="text-xs text-[#AAAAAA]">※ 서버에 저장되지 않으며 브라우저 로컬에 유지됩니다.</p>
            </div>
          )}

          {/* ── 글꼴 탭 ── */}
          {tab === "font" && (
            <div className="space-y-5">
              {/* 폰트 크기 */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#666666]">폰트 크기</p>
                  <span className="text-xs text-[#999999]">{fontSettings.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min={12}
                  max={20}
                  value={fontSettings.fontSize}
                  onChange={(e) =>
                    onFontSettingsChange({ ...fontSettings, fontSize: Number(e.target.value) })
                  }
                  className="w-full accent-[#1A1A2E]"
                />
                <div className="mt-0.5 flex justify-between text-[10px] text-[#AAAAAA]">
                  <span>12px</span>
                  <span>20px</span>
                </div>
              </div>

              {/* 유저 말풍선 */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#666666]">유저 말풍선</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#E0E0E0] px-3 py-2 text-xs text-[#555555] hover:bg-[#F8F8F8]">
                    배경색
                    <input
                      type="color"
                      value={fontSettings.userBubbleBg}
                      onChange={(e) =>
                        onFontSettingsChange({ ...fontSettings, userBubbleBg: e.target.value })
                      }
                      className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#E0E0E0] px-3 py-2 text-xs text-[#555555] hover:bg-[#F8F8F8]">
                    글자색
                    <input
                      type="color"
                      value={fontSettings.userFontColor}
                      onChange={(e) =>
                        onFontSettingsChange({ ...fontSettings, userFontColor: e.target.value })
                      }
                      className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent"
                    />
                  </label>
                </div>
                {/* 미리보기 */}
                <div
                  className="rounded-2xl rounded-br-none px-3 py-2 text-sm"
                  style={{
                    backgroundColor: fontSettings.userBubbleBg,
                    color: fontSettings.userFontColor,
                    fontSize: fontSettings.fontSize,
                  }}
                >
                  안녕하세요! (미리보기)
                </div>
              </div>

              {/* AI 말풍선 */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#666666]">AI 말풍선</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#E0E0E0] px-3 py-2 text-xs text-[#555555] hover:bg-[#F8F8F8]">
                    배경색
                    <input
                      type="color"
                      value={fontSettings.aiBubbleBg}
                      onChange={(e) =>
                        onFontSettingsChange({ ...fontSettings, aiBubbleBg: e.target.value })
                      }
                      className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#E0E0E0] px-3 py-2 text-xs text-[#555555] hover:bg-[#F8F8F8]">
                    글자색
                    <input
                      type="color"
                      value={fontSettings.aiFontColor}
                      onChange={(e) =>
                        onFontSettingsChange({ ...fontSettings, aiFontColor: e.target.value })
                      }
                      className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent"
                    />
                  </label>
                </div>
                {/* 미리보기 */}
                <div
                  className="rounded-2xl rounded-bl-none border border-[#E0E0E0] px-3 py-2 text-sm"
                  style={{
                    backgroundColor: fontSettings.aiBubbleBg,
                    color: fontSettings.aiFontColor,
                    fontSize: fontSettings.fontSize,
                  }}
                >
                  *그가 천천히 고개를 들었다.* "안녕하세요." (미리보기)
                </div>
              </div>

              {/* 초기화 */}
              <button
                type="button"
                onClick={() => onFontSettingsChange(DEFAULT_FONT_SETTINGS)}
                className="w-full rounded-lg border border-[#E0E0E0] py-2 text-xs text-[#666666] hover:bg-[#F8F8F8]"
              >
                기본값으로 초기화
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
