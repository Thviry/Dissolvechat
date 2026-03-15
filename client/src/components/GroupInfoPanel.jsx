// client/src/components/GroupInfoPanel.jsx
import { useState } from "react";
import { IconClose, IconCrown, IconPlus, IconTrash, IconLeave } from "./Icons";

export default function GroupInfoPanel({
  group,
  myId,
  contacts,
  onClose,
  onAddMember,
  onRemoveMember,
  onChangeRole,
  onRenameGroup,
  onLeaveGroup,
  onDeleteGroup,
}) {
  const [showAddMember, setShowAddMember] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(group.groupName);
  const [exiting, setExiting] = useState(false);

  const handleClose = () => { setExiting(true); setTimeout(onClose, 150); };

  const me = group.members.find((m) => m.id === myId);
  const isAdmin = me?.role === "admin";
  const isCreator = group.creator === myId;

  const memberIds = new Set(group.members.map((m) => m.id));
  const addableContacts = contacts.filter((c) => !memberIds.has(c.id));

  const handleRename = () => {
    if (newName.trim() && newName.trim() !== group.groupName) {
      onRenameGroup(group.groupId, newName.trim());
    }
    setEditingName(false);
  };

  return (
    <div className={`group-info-panel${exiting ? " exiting" : ""}`}>
      <div className="group-info-header">
        {editingName ? (
          <input
            className="input-field"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            autoFocus
            maxLength={50}
          />
        ) : (
          <h3
            onClick={() => isAdmin && setEditingName(true)}
            className={isAdmin ? "editable" : ""}
            title={isAdmin ? "Click to rename" : ""}
          >
            {group.groupName}
          </h3>
        )}
        <button className="btn-icon" onClick={handleClose} aria-label="Close">
          <IconClose size={16} />
        </button>
      </div>

      <div className="group-info-body">
        <div className="group-members-header">
          <span>{group.members.length} members</span>
          {isAdmin && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setShowAddMember(!showAddMember)}
            >
              <IconPlus size={14} /> Add
            </button>
          )}
        </div>

        {showAddMember && (
          <div className="group-add-member-list">
            {addableContacts.length === 0 ? (
              <p className="empty-state">No contacts to add</p>
            ) : (
              addableContacts.map((c) => (
                <div key={c.id} className="group-add-member-item">
                  <span>{c.label || c.id.slice(0, 8)}</span>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => { onAddMember(group.groupId, c); setShowAddMember(false); }}
                  >
                    Add
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        <div className="group-member-list">
          {group.members.map((m) => (
            <div key={m.id} className="group-member-item">
              <div className="group-member-info">
                <div className="contact-avatar" aria-hidden="true">
                  {(m.label || "?")[0].toUpperCase()}
                </div>
                <span className="group-member-name">
                  {m.label || m.id.slice(0, 8)}
                  {m.id === myId && " (you)"}
                </span>
                {m.role === "admin" && (
                  <span className="group-role-badge" title={m.id === group.creator ? "Creator" : "Admin"}>
                    <IconCrown size={12} />
                  </span>
                )}
              </div>
              <div className="group-member-actions">
                {isCreator && m.id !== myId && (
                  <button
                    className="btn btn-xs btn-secondary"
                    onClick={() => onChangeRole(group.groupId, m.id, m.role === "admin" ? "member" : "admin")}
                  >
                    {m.role === "admin" ? "Demote" : "Promote"}
                  </button>
                )}
                {isAdmin && m.id !== myId && (isCreator || m.role !== "admin") && (
                  <button
                    className="btn btn-xs btn-danger"
                    onClick={() => onRemoveMember(group.groupId, m.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="group-info-footer">
        {isCreator ? (
          <button className="btn btn-danger" onClick={() => onDeleteGroup(group.groupId)}>
            <IconTrash size={14} /> Delete Group
          </button>
        ) : (
          <button className="btn btn-danger" onClick={() => onLeaveGroup(group.groupId)}>
            <IconLeave size={14} /> Leave Group
          </button>
        )}
      </div>
    </div>
  );
}
