import React, { createContext, useContext, useState, useCallback, useRef } from "react";

export interface HoverCardTarget {
  userId: number;
  anchorRect: DOMRect;
}

interface HoverCardContextValue {
  target: HoverCardTarget | null;
  showCard: (userId: number, anchorRect: DOMRect) => void;
  hideCard: () => void;
}

const HoverCardContext = createContext<HoverCardContextValue>({
  target: null,
  showCard: () => {},
  hideCard: () => {},
});

export function useHoverCard() {
  return useContext(HoverCardContext);
}

export function HoverCardProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HoverCardTarget | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCard = useCallback((userId: number, anchorRect: DOMRect) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setTarget({ userId, anchorRect });
  }, []);

  const hideCard = useCallback(() => {
    hideTimer.current = setTimeout(() => setTarget(null), 200);
  }, []);

  return (
    <HoverCardContext.Provider value={{ target, showCard, hideCard }}>
      {children}
    </HoverCardContext.Provider>
  );
}
