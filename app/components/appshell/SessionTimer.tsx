"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import {
  ensureSessionExpiresAt,
  formatSessionRemaining,
  getRemainingSessionSeconds,
} from "@/app/utils/sessionTimeout";

type SessionTimerProps = {
  onExpire: () => void;
};

export default function SessionTimer({ onExpire }: SessionTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const expiresAt = ensureSessionExpiresAt();
    expiredRef.current = false;

    const tick = () => {
      const remaining = getRemainingSessionSeconds(expiresAt);
      setRemainingSeconds(remaining);
      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current();
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  if (remainingSeconds == null) return null;

  return (
    <div
      className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-brand-blue/30 bg-blue-50 px-2.5 py-1 text-xs text-brand-blue"
      title="Session time remaining"
      aria-live="polite"
      aria-label={`Session time remaining ${formatSessionRemaining(remainingSeconds)}`}
    >
      <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
      <span className="font-normal">Session</span>
      <span className="font-semibold tabular-nums">
        {formatSessionRemaining(remainingSeconds)}
      </span>
    </div>
  );
}
