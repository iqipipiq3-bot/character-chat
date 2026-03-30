"use client";

import { createContext, useContext, useState, type Dispatch, type SetStateAction } from "react";

type HeaderState = {
  checkedInToday: boolean;
  unreadCount: number;
  freeBalance: number;
  paidBalance: number;
  setCheckedIn: Dispatch<SetStateAction<boolean>>;
  setUnreadCount: Dispatch<SetStateAction<number>>;
  updateCredits: (free: number, paid: number) => void;
};

const HeaderContext = createContext<HeaderState | null>(null);

type ProviderProps = {
  children: React.ReactNode;
  initialFreeBalance: number;
  initialPaidBalance: number;
  initialCheckedIn: boolean;
};

export function HeaderProvider({
  children,
  initialFreeBalance,
  initialPaidBalance,
  initialCheckedIn,
}: ProviderProps) {
  const [checkedInToday, setCheckedIn] = useState(initialCheckedIn);
  const [unreadCount, setUnreadCount] = useState(0);
  const [freeBalance, setFreeBalance] = useState(initialFreeBalance);
  const [paidBalance, setPaidBalance] = useState(initialPaidBalance);

  function updateCredits(free: number, paid: number) {
    setFreeBalance(free);
    setPaidBalance(paid);
  }

  return (
    <HeaderContext.Provider
      value={{
        checkedInToday,
        unreadCount,
        freeBalance,
        paidBalance,
        setCheckedIn,
        setUnreadCount,
        updateCredits,
      }}
    >
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeaderStore(): HeaderState {
  const ctx = useContext(HeaderContext);
  if (!ctx) throw new Error("useHeaderStore must be used within HeaderProvider");
  return ctx;
}
