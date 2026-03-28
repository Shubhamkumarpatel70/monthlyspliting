import { useState, useEffect, useCallback } from "react";

/**
 * Blocks repeated Gemini calls for a short window to reduce 429 rate limits.
 * @param {number} defaultMs default cooldown when startCooldown() is called with no args
 */
export function useAiCooldown(defaultMs = 45_000) {
  const [until, setUntil] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);

  useEffect(() => {
    if (until <= Date.now()) {
      setRemainingSec(0);
      return undefined;
    }
    const tick = () => {
      const r = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setRemainingSec(r);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [until]);

  const onCooldown = remainingSec > 0;

  const startCooldown = useCallback(
    (ms = defaultMs) => {
      setUntil(Date.now() + Math.max(5000, ms));
    },
    [defaultMs],
  );

  return { onCooldown, remainingSec, startCooldown };
}
