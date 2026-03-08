// client/src/hooks/useGroups.js
// Manages group state in localStorage. Follows useContacts patterns.

import { useState, useRef, useCallback } from "react";
import { loadJson, saveJson } from "@utils/storage";

const MAX_GROUP_MEMBERS = 50;

export default function useGroups(myId) {
  const [groups, setGroups] = useState([]);
  const groupsRef = useRef(groups);

  const persist = useCallback(
    (updated) => {
      groupsRef.current = updated;
      setGroups(updated);
      if (myId) saveJson(`groups:${myId}`, updated);
    },
    [myId]
  );

  const load = useCallback(
    (id) => {
      const saved = loadJson(`groups:${id}`) || [];
      groupsRef.current = saved;
      setGroups(saved);
    },
    []
  );

  const addGroup = useCallback(
    (group) => {
      const current = groupsRef.current;
      const exists = current.findIndex((g) => g.groupId === group.groupId);
      let updated;
      if (exists >= 0) {
        updated = [...current];
        updated[exists] = group;
      } else {
        updated = [...current, group];
      }
      persist(updated);
    },
    [persist]
  );

  const removeGroup = useCallback(
    (groupId) => {
      const updated = groupsRef.current.filter((g) => g.groupId !== groupId);
      persist(updated);
    },
    [persist]
  );

  const findGroup = useCallback(
    (groupId) => groupsRef.current.find((g) => g.groupId === groupId) || null,
    []
  );

  const updateGroup = useCallback(
    (groupId, updater) => {
      const current = groupsRef.current;
      const idx = current.findIndex((g) => g.groupId === groupId);
      if (idx < 0) return;
      const updated = [...current];
      updated[idx] = { ...updated[idx], ...updater(updated[idx]) };
      persist(updated);
    },
    [persist]
  );

  const addMember = useCallback(
    (groupId, member) => {
      updateGroup(groupId, (g) => {
        if (g.members.length >= MAX_GROUP_MEMBERS) {
          console.warn("Group member limit reached:", MAX_GROUP_MEMBERS);
          return {};
        }
        if (g.members.some((m) => m.id === member.id)) return {};
        return { members: [...g.members, { ...member, role: member.role || "member" }] };
      });
    },
    [updateGroup]
  );

  const removeMember = useCallback(
    (groupId, memberId) => {
      updateGroup(groupId, (g) => ({
        members: g.members.filter((m) => m.id !== memberId),
      }));
    },
    [updateGroup]
  );

  const setMemberRole = useCallback(
    (groupId, memberId, role) => {
      updateGroup(groupId, (g) => ({
        members: g.members.map((m) => (m.id === memberId ? { ...m, role } : m)),
      }));
    },
    [updateGroup]
  );

  const updateGroupKey = useCallback(
    (groupId, newKey) => {
      updateGroup(groupId, () => ({ groupKey: newKey }));
    },
    [updateGroup]
  );

  const renameGroup = useCallback(
    (groupId, newName) => {
      updateGroup(groupId, () => ({ groupName: newName }));
    },
    [updateGroup]
  );

  const reset = useCallback(() => {
    groupsRef.current = [];
    setGroups([]);
  }, []);

  return {
    groups,
    groupsRef,
    load,
    addGroup,
    removeGroup,
    findGroup,
    updateGroup,
    addMember,
    removeMember,
    setMemberRole,
    updateGroupKey,
    renameGroup,
    reset,
  };
}
