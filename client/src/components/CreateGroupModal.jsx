// client/src/components/CreateGroupModal.jsx
import { useState } from "react";
import { IconClose } from "./Icons";

export default function CreateGroupModal({ contacts, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState(new Set());

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    if (selected.size === 0) return;
    const members = contacts.filter((c) => selected.has(c.id));
    onCreate(name.trim(), members);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create Group</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <IconClose size={16} />
          </button>
        </div>
        <div className="modal-body">
          <label className="input-label">Group Name</label>
          <input
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter group name"
            maxLength={50}
            autoFocus
          />
          <label className="input-label" style={{ marginTop: 16 }}>
            Add Members ({selected.size} selected)
          </label>
          <div className="group-member-select">
            {contacts.length === 0 && (
              <p className="empty-state">No contacts yet</p>
            )}
            {contacts.map((c) => (
              <label key={c.id} className="toggle-label group-member-option">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                />
                <span>{c.label || c.id.slice(0, 8)}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={!name.trim() || selected.size === 0}
          >
            Create Group
          </button>
        </div>
      </div>
    </div>
  );
}
