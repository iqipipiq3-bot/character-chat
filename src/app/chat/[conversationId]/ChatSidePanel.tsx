"use client";

import React, { useState, useEffect, useRef } from "react";

export type Persona = {
  id: string;
  name: string;
  description?: string;
  content: string;
  is_default: boolean;
};

export type FontSettings = {
  userBubbleBg: string;
  aiBubbleBg: string;
  textColor: string;
  narrationColor: string;
  fontSize: number;
  chatBg: string;
};

export const DEFAULT_AI_BUBBLE_BG = "#F4F4F2";

export const DEFAULT_FONT_SETTINGS: FontSettings = {
  userBubbleBg: "#FFE0DB",
  aiBubbleBg: DEFAULT_AI_BUBBLE_BG,
  textColor: "#1A1A1A",
  narrationColor: "#888888",
  fontSize: 16,
  chatBg: "#F8F8F8",
};

const BG_PRESETS: { color: string; label: string }[] = [
  { color: "#F8F8F8", label: "기본" },
  { color: "#FFFFFF", label: "흰색" },
  { color: "#F0F0F0", label: "연회색" },
  { color: "#808080", label: "진회색" },
  { color: "#1C1C1C", label: "검정" },
  { color: "#FAFAF0", label: "아이보리" },
  { color: "#F5F0E8", label: "베이지" },
  { color: "#C8A882", label: "연갈색" },
  { color: "#FFE0E0", label: "연분홍" },
  { color: "#EFE0FF", label: "연보라" },
  { color: "#E0EEFF", label: "연파랑" },
  { color: "#E0F0E0", label: "연초록" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  personas: Persona[];
  activePersonaId: string | null;
  onSelectPersona: (id: string | null) => void;
  userNote: string;
  onUserNoteChange: (note: string) => void | Promise<void>;
  fontSettings: FontSettings;
  onFontSettingsChange: (s: FontSettings) => void;
  onEditPersonasClick: () => void;
  onSessionContentChange: (content: string) => void;
  savedSessionContent?: string;
  onSessionContentSave?: (content: string) => void;
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
  onSessionContentChange,
  savedSessionContent,
  onSessionContentSave,
}: Props) {
  const [tab, setTab] = useState<"persona" | "note" | "font">("persona");
  const [draftNote, setDraftNote] = useState(userNote);
  const [savedNote, setSavedNote] = useState(userNote);
  const [noteSaving, setNoteSaving] = useState(false);

  const [sessionContent, setSessionContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [originalContent, setOriginalContent] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // 외부에서 userNote가 바뀌면(초기 로드) draft/saved 둘 다 동기화
  useEffect(() => {
    setDraftNote(userNote);
    setSavedNote(userNote);
  }, [userNote]);

  // 드롭다운 외부 클릭 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setTooltipOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // 페르소나 변경 시 sessionContent / originalContent 동기화
  useEffect(() => {
    if (!personas || personas.length === 0) return; // 로딩 완료 전엔 스킵
    if (activePersonaId) {
      const p = personas.find((p) => p.id === activePersonaId);
      const personaContent = p?.content ?? '';
      setOriginalContent(personaContent);
      // DB에 저장된 세션 오버라이드가 있으면 그것을 사용, 없으면 원본
      const initial = savedSessionContent && savedSessionContent.length > 0 ? savedSessionContent : personaContent;
      setSessionContent(initial);
      onSessionContentChange(initial);
    } else {
      setSessionContent('');
      setOriginalContent('');
      onSessionContentChange('');
    }
    setIsEditing(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePersonaId, personas]);

  async function saveUserNote() {
    if (draftNote === savedNote || noteSaving) return;
    setNoteSaving(true);
    try {
      await onUserNoteChange(draftNote);
      setSavedNote(draftNote);
    } finally {
      setNoteSaving(false);
    }
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
              {t === "persona" ? "페르소나" : t === "note" ? "유저 노트" : "커스텀"}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* ── 페르소나 탭 ── */}
          {tab === "persona" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#666666]">페르소나 선택</p>
                <button
                  type="button"
                  onClick={onEditPersonasClick}
                  className="text-xs text-[#666666] underline underline-offset-2 hover:text-[#1A1A1A]"
                >
                  페르소나 수정
                </button>
              </div>
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg border border-[#E0E0E0] bg-white px-3 py-2 text-sm text-[#333333] hover:bg-[#F8F8F8]"
                >
                  <span>{activePersona?.name ?? "기본값 사용"}</span>
                  <svg
                    width="12" height="12" viewBox="0 0 12 12" fill="none"
                    className={`shrink-0 text-[#999999] transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                  >
                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border border-[#E0E0E0] bg-white shadow-lg">
                    {/* 기본값 사용 */}
                    <button
                      type="button"
                      onClick={() => { onSelectPersona(null); setDropdownOpen(false); }}
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#F8F8F8]"
                    >
                      <span className="text-sm font-medium text-[#333333]">기본값 사용</span>
                      {activePersonaId === null && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-[#1A1A2E]">
                          <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>

                    {personas.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { onSelectPersona(p.id); setDropdownOpen(false); }}
                        className="flex w-full items-center justify-between border-t border-[#F0F0F0] px-4 py-3 text-left hover:bg-[#F8F8F8]"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[#333333]">
                            {p.name}
                            {p.is_default && <span className="ml-1.5 text-xs text-[#999999]">(기본)</span>}
                          </p>
                          {p.description && (
                            <p className="mt-0.5 truncate text-xs text-[#999999]">{p.description}</p>
                          )}
                        </div>
                        {activePersonaId === p.id && (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="ml-2 shrink-0 text-[#1A1A2E]">
                            <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 페르소나 내용 표시/편집 영역 */}
              {(activePersonaId || activePersona) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-[#666666]">페르소나 내용</p>
                      <div className="relative" ref={tooltipRef}>
                        <button
                          type="button"
                          onClick={() => setTooltipOpen((v) => !v)}
                          onMouseEnter={() => setTooltipOpen(true)}
                          onMouseLeave={() => setTooltipOpen(false)}
                          className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-[#CCCCCC] text-[10px] font-medium leading-none text-[#999999]"
                        >
                          ?
                        </button>
                        {tooltipOpen && (
                          <div className="absolute left-0 rounded-lg bg-[#1A1A2E] px-3 py-2.5 leading-relaxed text-white shadow-lg" style={{ top: "calc(100% + 4px)", width: 200, maxWidth: "calc(100vw - 32px)", whiteSpace: "normal", wordBreak: "keep-all", fontSize: 12, zIndex: 9999 }}>
                            저장된 페르소나를 불러와 현재 채팅방에서만 적용됩니다.
                            여기서 수정해도 원본 페르소나는 변경되지 않습니다.
                            원본 수정은 페르소나 관리 페이지에서 해주세요.
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!isEditing && sessionContent.trim() !== originalContent.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setSessionContent(originalContent);
                            onSessionContentChange(originalContent);
                          }}
                          className="text-[10px] text-[#999999] underline underline-offset-2 hover:text-[#666666]"
                        >
                          초기화
                        </button>
                      )}
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => setIsEditing(true)}
                          className="rounded-md border border-[#E0E0E0] bg-white px-2 py-0.5 text-[10px] text-[#666666] hover:bg-[#F0F0F0]"
                        >
                          편집
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={sessionContent}
                        onChange={(e) => setSessionContent(e.target.value)}
                        className="w-full resize-none rounded-lg border border-[#E0E0E0] bg-white px-3 py-2 text-xs outline-none focus:border-[#666666]"
                        style={{ minHeight: 300 }}
                      />
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onSessionContentChange(sessionContent);
                            onSessionContentSave?.(sessionContent);
                            setIsEditing(false);
                          }}
                          className="flex-1 rounded-lg bg-[#1A1A2E] py-1.5 text-xs font-medium text-white hover:bg-[#141424]"
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSessionContent(originalContent);
                            onSessionContentChange(originalContent);
                            setIsEditing(false);
                          }}
                          className="flex-1 rounded-lg border border-[#E0E0E0] py-1.5 text-xs font-medium text-[#666666] hover:bg-[#F8F8F8]"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-y-auto rounded-lg border border-[#E0E0E0] bg-[#F8F8F8] px-3 py-2 text-xs text-[#333333] whitespace-pre-wrap" style={{ minHeight: 300 }}>
                      {sessionContent || "(내용 없음)"}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── 유저 노트 탭 ── */}
          {tab === "note" && (() => {
            const isClean = draftNote === savedNote;
            const buttonLabel = noteSaving ? "저장 중..." : isClean ? "저장됨" : "저장";
            const buttonDisabled = noteSaving || isClean;
            return (
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
                    onBlur={() => void saveUserNote()}
                    maxLength={1000}
                    rows={9}
                    placeholder={"예: 오늘 유저는 기분이 안 좋음\n피곤하고 우울한 상태..."}
                    className="w-full resize-none rounded-lg border border-[#E0E0E0] bg-white px-3 py-2 pb-6 text-sm outline-none focus:border-[#666666]"
                  />
                  <span className="pointer-events-none absolute bottom-2 right-2 text-[11px] text-[#999999]">
                    {draftNote.length}/1000
                  </span>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void saveUserNote()}
                    disabled={buttonDisabled}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      buttonDisabled
                        ? "cursor-not-allowed bg-[#E8E8E8] text-[#999999]"
                        : "bg-[#1A1A2E] text-white hover:bg-[#141424]"
                    }`}
                  >
                    {buttonLabel}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* ── 커스텀 탭 ── */}
          {tab === "font" && (
            <div className="space-y-5">
              {/* 배경 색상 */}
              <div>
                <p className="mb-2 text-xs font-semibold text-[#666666]">배경 색상</p>
                <div className="grid grid-cols-6 gap-1.5">
                  {BG_PRESETS.map(({ color, label }) => {
                    const isSelected = fontSettings.chatBg === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        title={label}
                        onClick={() => onFontSettingsChange({ ...fontSettings, chatBg: color })}
                        className="relative flex h-8 w-full items-center justify-center rounded-md border transition-all"
                        style={{
                          backgroundColor: color,
                          borderColor: isSelected ? "#1A1A2E" : "#D0D0D0",
                          boxShadow: isSelected ? "0 0 0 2px #1A1A2E" : undefined,
                        }}
                      >
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path
                              d="M2 6l3 3 5-5"
                              stroke={color === "#1C1C1C" ? "#FFFFFF" : "#1A1A2E"}
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                  {/* 커스텀 color picker */}
                  <label
                    title="커스텀"
                    className="relative flex h-8 w-full cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-[#D0D0D0] bg-white hover:border-[#888888]"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v8M8 12h8" />
                    </svg>
                    <input
                      type="color"
                      value={fontSettings.chatBg}
                      onChange={(e) => onFontSettingsChange({ ...fontSettings, chatBg: e.target.value })}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>
              </div>

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

              {/* 글꼴 색상 */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#666666]">글꼴 색상</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#E0E0E0] px-3 py-2 text-xs text-[#555555] hover:bg-[#F8F8F8]">
                    일반 텍스트
                    <input
                      type="color"
                      value={fontSettings.textColor}
                      onChange={(e) =>
                        onFontSettingsChange({ ...fontSettings, textColor: e.target.value })
                      }
                      className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#E0E0E0] px-3 py-2 text-xs text-[#555555] hover:bg-[#F8F8F8]">
                    나레이션
                    <input
                      type="color"
                      value={fontSettings.narrationColor}
                      onChange={(e) =>
                        onFontSettingsChange({ ...fontSettings, narrationColor: e.target.value })
                      }
                      className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent"
                    />
                  </label>
                </div>
                {/* 미리보기 */}
                <div className="rounded-lg border border-[#E0E0E0] bg-[#FAFAFA] px-3 py-2.5" style={{ fontSize: fontSettings.fontSize }}>
                  <p style={{ color: fontSettings.textColor }}>&quot;안녕하세요.&quot;</p>
                  <p style={{ color: fontSettings.narrationColor, fontStyle: "normal" }}>
                    <em>*그가 천천히 고개를 들었다.*</em>
                  </p>
                </div>
              </div>

              {/* 말풍선 */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#666666]">말풍선</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#E0E0E0] px-3 py-2 text-xs text-[#555555] hover:bg-[#F8F8F8]">
                    유저 배경
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
                    AI 배경
                    <input
                      type="color"
                      value={fontSettings.aiBubbleBg}
                      onChange={(e) =>
                        onFontSettingsChange({ ...fontSettings, aiBubbleBg: e.target.value })
                      }
                      className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent"
                    />
                  </label>
                </div>
                {/* 미리보기 */}
                <div className="space-y-2">
                  <div
                    className="ml-auto max-w-[85%] rounded-2xl rounded-br-none px-3 py-2"
                    style={{
                      backgroundColor: fontSettings.userBubbleBg,
                      color: fontSettings.textColor,
                      fontSize: fontSettings.fontSize,
                    }}
                  >
                    안녕하세요! (미리보기)
                  </div>
                  <div
                    className="max-w-[85%] rounded-2xl rounded-bl-none px-3 py-2"
                    style={{
                      backgroundColor: fontSettings.aiBubbleBg,
                      fontSize: fontSettings.fontSize,
                    }}
                  >
                    <span style={{ color: fontSettings.narrationColor, fontStyle: "normal" }}>
                      <em>*그가 천천히 고개를 들었다.*</em>
                    </span>{" "}
                    <span style={{ color: fontSettings.textColor }}>&quot;안녕하세요.&quot;</span>
                  </div>
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
