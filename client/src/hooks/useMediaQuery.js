// client/src/hooks/useMediaQuery.js
import { useState, useEffect } from "react";

export default function useMediaQuery(maxWidth = 768) {
  const query = `(max-width: ${maxWidth}px)`;
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
