"use client";

import { useState } from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  rows?: number;
};

export function MarkdownEditor({
  label,
  value,
  onChange,
  maxLength = 30000,
  placeholder = "마크다운 형식으로 내용을 작성하세요.\n\n예:\n## 소개\n저는 친절한 캐릭터입니다.\n\n## 특징\n- 따뜻해요\n- 유머러스해요",
  rows = 14,
}: Props) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  return (
    <div>
      {label ? <p className="mb-2 text-sm font-medium">{label}</p> : null}

      {/* 탭 바 */}
      <div className="flex overflow-hidden rounded-t-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        {(["edit", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {t === "edit" ? "편집" : "미리보기"}
          </button>
        ))}
      </div>

      {tab === "edit" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          rows={rows}
          placeholder={placeholder}
          className="w-full resize-none rounded-b-lg border border-t-0 border-zinc-200 bg-white px-3 py-3 font-mono text-sm leading-relaxed outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
        />
      ) : (
        <div className="min-h-48 rounded-b-lg border border-t-0 border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          {value.trim() ? (
            <MarkdownRenderer content={value} />
          ) : (
            <p className="text-sm text-zinc-400 dark:text-zinc-600">작성한 내용이 여기에 표시됩니다.</p>
          )}
        </div>
      )}

      <p className="mt-1 text-right text-xs text-zinc-400">
        {value.length.toLocaleString()} / {maxLength.toLocaleString()}
      </p>
    </div>
  );
}
