// client/src/components/EmojiPicker.jsx
import { useState, useRef, useEffect } from "react";
import { EMOJI_CATEGORIES } from "@utils/emojiData";

export default function EmojiPicker({ onSelect, identityId, onClose }) {
  const [activeCategory, setActiveCategory] = useState(EMOJI_CATEGORIES[0].id);
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`emoji-favs:${identityId}`)) || [];
    } catch { return []; }
  });
  const pickerRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const toggleFavorite = (emoji, e) => {
    e.stopPropagation();
    e.preventDefault();
    const updated = favorites.includes(emoji)
      ? favorites.filter((f) => f !== emoji)
      : [...favorites, emoji];
    setFavorites(updated);
    localStorage.setItem(`emoji-favs:${identityId}`, JSON.stringify(updated));
  };

  const handleSelect = (emoji) => {
    onSelect(emoji);
  };

  const activeEmojis = EMOJI_CATEGORIES.find((c) => c.id === activeCategory)?.emojis || [];

  return (
    <div className="emoji-picker" ref={pickerRef} role="dialog" aria-label="Emoji picker">
      {/* Favorites row */}
      {favorites.length > 0 && (
        <div className="emoji-favorites">
          <div className="emoji-favorites-label">Favorites</div>
          <div className="emoji-grid">
            {favorites.map((emoji) => (
              <button
                key={`fav-${emoji}`}
                className="emoji-btn"
                onClick={() => handleSelect(emoji)}
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category tabs */}
      <div className="emoji-tabs" role="tablist">
        {EMOJI_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`emoji-tab${activeCategory === cat.id ? " active" : ""}`}
            onClick={() => setActiveCategory(cat.id)}
            role="tab"
            aria-selected={activeCategory === cat.id}
            title={cat.id}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="emoji-grid-container">
        <div className="emoji-grid">
          {activeEmojis.map((emoji) => (
            <button
              key={emoji}
              className="emoji-btn"
              onClick={() => handleSelect(emoji)}
              onContextMenu={(e) => toggleFavorite(emoji, e)}
              title={`${emoji}${favorites.includes(emoji) ? " ★" : ""} — right-click to ${favorites.includes(emoji) ? "unfavorite" : "favorite"}`}
            >
              {emoji}
              {favorites.includes(emoji) && (
                <span className="emoji-fav-indicator" aria-label="Favorited">★</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Hint */}
      <div className="emoji-hint">Right-click emoji to favorite</div>
    </div>
  );
}
