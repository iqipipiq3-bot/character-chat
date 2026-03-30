"use client";

import { useState, useCallback } from "react";
import { showToast } from "../components/Toast";
import { useHeaderStore } from "../context/HeaderContext";

type Props = {
  month: string;
  today: string;
  initialCheckinDates: string[];
  initialCheckedInToday: boolean;
  initialStreakDays: number;
};

function CubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18-.21 0-.41-.06-.57-.18l-7.9-4.44A.99.99 0 013 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44C11.59 2.06 11.79 2 12 2c.21 0 .41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9zM12 4.15L6.04 7.5 12 10.85l5.96-3.35L12 4.15zM5 15.91l6 3.38v-6.71L5 9.21v6.7zm8 3.38l6-3.38V9.21l-6 3.37v6.71z" />
    </svg>
  );
}

function DecorativeCubes() {
  return (
    <div className="relative min-h-[600px] w-full">
      <CubeIcon className="absolute left-4 top-10 h-20 w-20 text-violet-500 opacity-[0.15]" />
      <CubeIcon className="absolute right-2 top-40 h-12 w-12 text-zinc-400 opacity-20 dark:text-zinc-600" />
      <CubeIcon className="absolute left-8 top-64 h-10 w-10 text-violet-400 opacity-[0.22]" />
      <CubeIcon className="absolute left-1 top-48 h-7 w-7 text-zinc-500 opacity-[0.18] dark:text-zinc-500" />
      <CubeIcon className="absolute right-5 top-[370px] h-7 w-7 text-violet-500 opacity-[0.15]" />
      <CubeIcon className="absolute left-6 top-[460px] h-5 w-5 text-zinc-400 opacity-20 dark:text-zinc-600" />
    </div>
  );
}

export function AttendanceClient({
  month,
  today,
  initialCheckinDates,
  initialCheckedInToday,
  initialStreakDays,
}: Props) {
  const [checkinDates, setCheckinDates] = useState<Set<string>>(new Set(initialCheckinDates));
  const [checkedInToday, setCheckedInToday] = useState(initialCheckedInToday);
  const [streak, setStreak] = useState(initialStreakDays);
  const [loading, setLoading] = useState(false);
  const { setCheckedIn: setHeaderCheckedIn, updateCredits } = useHeaderStore();

  const [year, monthNum] = month.split("-").map(Number) as [number, number];
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const firstDayOfWeek = new Date(year, monthNum - 1, 1).getDay();
  const monthAttendCount = checkinDates.size;
  const earnedCubes = monthAttendCount * 300;
  const maxCubes = daysInMonth * 300;
  const todayDay = parseInt(today.split("-")[2]!, 10);
  const remainingDays = checkedInToday ? daysInMonth - todayDay : daysInMonth - todayDay + 1;
  const remainingCubes = remainingDays * 300;

  const monthLabel = `${year}년 ${monthNum}월`;

  const handleCheckin = useCallback(async () => {
    if (loading || checkedInToday) return;
    setLoading(true);
    try {
      const res = await fetch("/api/attendance", { method: "POST" });
      const data = (await res.json()) as { message?: string; date?: string; free_balance?: number; paid_balance?: number; error?: string };
      if (!res.ok) {
        showToast(data.error === "already_checked_in" ? "오늘 이미 출석했습니다." : "출석에 실패했습니다.", "error");
        return;
      }
      setCheckinDates((prev) => new Set([...prev, today]));
      setCheckedInToday(true);
      setStreak((prev) => prev + 1);
      setHeaderCheckedIn(true);
      if (typeof data.free_balance === "number") {
        updateCredits(data.free_balance, data.paid_balance ?? 0);
      }
      showToast("300 큐브가 지급되었습니다!");
    } catch {
      showToast("출석에 실패했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [loading, checkedInToday, today]);

  const calendarCells: Array<number | null> = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col bg-zinc-50 dark:bg-black">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[200px_1fr_240px] md:items-start">

          {/* 왼쪽: 큐브 장식 */}
          <div className="sticky top-8 hidden md:block">
            <DecorativeCubes />
          </div>

          {/* 중앙: 캘린더 */}
          <div>
            {/* 헤더 */}
            <div className="mb-6 text-center">
              <h1 className="text-xl font-semibold">{monthLabel} 출석</h1>
              <p className="mt-1 text-sm text-zinc-500">
                이번 달{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{monthAttendCount}일</span>{" "}
                출석
              </p>
            </div>

            {/* 캘린더 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              {/* 요일 헤더 */}
              <div className="mb-3 grid grid-cols-7 text-center">
                {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                  <div key={d} className="py-2 text-sm font-semibold text-zinc-400">
                    {d}
                  </div>
                ))}
              </div>
              {/* 날짜 칸 */}
              <div className="grid grid-cols-7 gap-2">
                {calendarCells.map((day, idx) => {
                  if (day === null) return <div key={`empty-${idx}`} className="h-20" />;
                  const dateStr = `${month}-${String(day).padStart(2, "0")}`;
                  const isToday = dateStr === today;
                  const isChecked = checkinDates.has(dateStr);
                  return (
                    <div
                      key={dateStr}
                      className={`flex h-20 flex-col items-center justify-center rounded-xl ${
                        isToday
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : "text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      <span className="text-base font-semibold leading-none">{day}</span>
                      {isChecked ? (
                        <CubeIcon className="mt-1.5 h-6 w-6 text-violet-500" />
                      ) : (
                        <div className="mt-1.5 h-6 w-6" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 출석 버튼 */}
            <div className="mt-6">
              <button
                type="button"
                onClick={() => void handleCheckin()}
                disabled={checkedInToday || loading}
                className={`w-full rounded-xl py-4 text-base font-semibold transition-colors ${
                  checkedInToday
                    ? "cursor-not-allowed bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600"
                    : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                }`}
              >
                {loading ? "처리 중..." : checkedInToday ? "오늘 출석 완료" : "출석하기 (+300 큐브)"}
              </button>
            </div>

            <p className="mt-4 text-center text-xs text-zinc-400">
              매일 출석하면 300 무료 큐브를 획득할 수 있습니다.
            </p>
          </div>

          {/* 오른쪽: 정보 카드 */}
          <div className="sticky top-8 hidden flex-col gap-4 md:flex">

            {/* 카드 1: 출석 통계 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="mb-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">이번 달 출석 현황</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">출석일</span>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {monthAttendCount} / {daysInMonth}일
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">연속 출석</span>
                  <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">
                    {streak}일 연속
                  </span>
                </div>
                <div className="h-px bg-zinc-100 dark:bg-zinc-800" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">획득 큐브</span>
                  <div className="flex items-center gap-1.5">
                    <CubeIcon className="h-4 w-4 text-violet-500" />
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {earnedCubes.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              {/* 진행 바 */}
              <div className="mt-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-all duration-500"
                    style={{ width: `${(monthAttendCount / daysInMonth) * 100}%` }}
                  />
                </div>
                <p className="mt-1.5 text-right text-xs text-zinc-400">
                  {Math.round((monthAttendCount / daysInMonth) * 100)}% 달성
                </p>
              </div>
            </div>

            {/* 카드 2: 큐브 획득 안내 */}
            <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5 dark:border-violet-900/30 dark:bg-violet-950/20">
              <div className="mb-3 flex items-center gap-2">
                <CubeIcon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                <h2 className="text-sm font-semibold text-violet-700 dark:text-violet-300">이달의 최대 보상</h2>
              </div>
              <p className="text-2xl font-bold text-violet-700 dark:text-violet-300">
                {maxCubes.toLocaleString()} 큐브
              </p>
              <p className="mt-1 text-xs text-violet-500 dark:text-violet-400">
                매일 출석 시 {daysInMonth}일 × 300 큐브
              </p>
              <div className="mt-3 rounded-xl bg-violet-100 px-3 py-2 dark:bg-violet-900/30">
                <p className="text-xs text-violet-600 dark:text-violet-400">
                  남은 획득 가능 큐브:{" "}
                  <span className="font-semibold">{remainingCubes.toLocaleString()}</span>
                </p>
              </div>
            </div>

            {/* 카드 3: 상태 카드 (큐브 패턴 배경) */}
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              {/* 배경 패턴 */}
              <div className="pointer-events-none absolute inset-0 grid grid-cols-4 grid-rows-4 gap-2 p-3 opacity-[0.06] dark:opacity-[0.04]">
                {Array.from({ length: 16 }).map((_, i) => (
                  <CubeIcon key={i} className="h-full w-full text-violet-500" />
                ))}
              </div>
              {/* 내용 */}
              <div className="relative z-10 text-center">
                <div className="mb-2 flex justify-center">
                  <CubeIcon
                    className={`h-10 w-10 ${
                      checkedInToday ? "text-violet-500" : "text-zinc-400 dark:text-zinc-600"
                    }`}
                  />
                </div>
                <p
                  className={`text-base font-semibold ${
                    checkedInToday
                      ? "text-violet-600 dark:text-violet-400"
                      : "text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {checkedInToday ? "연속 출석 중!" : "오늘도 출석하세요!"}
                </p>
                {checkedInToday && streak > 1 && (
                  <p className="mt-1 text-sm text-zinc-500">{streak}일째 연속 출석 중</p>
                )}
                {!checkedInToday && (
                  <p className="mt-1 text-xs text-zinc-400">출석하고 300 큐브를 받으세요</p>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
