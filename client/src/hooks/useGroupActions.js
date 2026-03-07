// client/src/hooks/useGroupActions.js
// Group admin operations: create, add/remove members, promote/demote, leave, rename, delete.

import { useCallback } from "react";
import { generateGroupKey, generateGroupId } from "dissolve-core/crypto/group";
import {
  buildGroupInvite,
  buildGroupMemberAdded,
  buildGroupMemberRemoved,
  buildGroupAdminChange,
  buildGroupLeave,
  buildGroupNameChange,
} from "../protocol/groupEnvelopes";
import { sendEnvelope } from "../protocol/relay";

export default function useGroupActions(identity, groupsMgr, addToast) {

  const createGroup = useCallback(async (groupName, initialMembers) => {
    // Validate all members have required crypto fields before creating
    const badMembers = initialMembers.filter(
      (m) => !m.e2eePublicJwk?.kty || !m.authPublicJwk?.kty || typeof m.cap !== "string"
    );
    if (badMembers.length > 0) {
      const names = badMembers.map((m) => m.label || m.id?.slice(0, 8)).join(", ");
      addToast(`Cannot create group: missing key data for ${names}. Re-exchange contacts first.`, "error");
      console.warn("[Dissolve] Bad member data:", badMembers.map((m) => ({
        id: m.id?.slice(0, 12),
        hasE2ee: !!m.e2eePublicJwk?.kty,
        hasAuth: !!m.authPublicJwk?.kty,
        hasCap: typeof m.cap === "string",
      })));
      return null;
    }

    const groupId = generateGroupId();
    const groupKey = await generateGroupKey();

    const selfMember = {
      id: identity.id,
      label: identity.label,
      e2eePublicJwk: identity.e2eePubJwk,
      authPublicJwk: identity.authPubJwk,
      cap: identity.inboxCap,
      role: "admin",
    };

    const members = [
      selfMember,
      ...initialMembers.map((m) => ({ ...m, role: "member" })),
    ];

    const group = {
      groupId,
      groupName,
      groupKey,
      members,
      creator: identity.id,
      createdAt: Date.now(),
    };

    groupsMgr.addGroup(group);

    await Promise.allSettled(
      initialMembers.map(async (recipient) => {
        const { envelope } = await buildGroupInvite(
          identity.id, identity.label,
          identity.authPubJwk, identity.authPrivJwk, identity.e2eePubJwk,
          identity.inboxCap,
          groupId, groupName, groupKey, members, identity.id,
          recipient
        );
        return sendEnvelope(envelope);
      })
    );

    addToast(`Group "${groupName}" created`);
    return groupId;
  }, [identity, groupsMgr, addToast]);

  const addGroupMember = useCallback(async (groupId, newContact) => {
    const group = groupsMgr.findGroup(groupId);
    if (!group) return;

    const me = group.members.find((m) => m.id === identity.id);
    if (!me || me.role !== "admin") {
      addToast("Only admins can add members");
      return;
    }
    if (group.members.length >= 50) {
      addToast("Group is full (max 50)");
      return;
    }
    if (group.members.some((m) => m.id === newContact.id)) {
      addToast("Already in the group");
      return;
    }
    if (!newContact.e2eePublicJwk?.kty || typeof newContact.cap !== "string") {
      addToast("Cannot add: contact has incomplete key data. Re-exchange contacts first.", "error");
      return;
    }

    const newMember = { ...newContact, role: "member" };
    const updatedMembers = [...group.members, newMember];

    groupsMgr.addMember(groupId, newMember);

    const { envelope: inviteEnv } = await buildGroupInvite(
      identity.id, identity.label,
      identity.authPubJwk, identity.authPrivJwk, identity.e2eePubJwk,
      identity.inboxCap,
      groupId, group.groupName, group.groupKey, updatedMembers, group.creator,
      newContact
    );
    await sendEnvelope(inviteEnv);

    await Promise.allSettled(
      group.members
        .filter((m) => m.id !== identity.id && m.id !== newContact.id)
        .map(async (recipient) => {
          const { envelope } = await buildGroupMemberAdded(
            identity.id, identity.label,
            identity.authPubJwk, identity.authPrivJwk, identity.e2eePubJwk,
            groupId, newMember, recipient
          );
          return sendEnvelope(envelope);
        })
    );

    addToast(`${newContact.label} added to group`);
  }, [identity, groupsMgr, addToast]);

  const removeGroupMember = useCallback(async (groupId, memberId) => {
    const group = groupsMgr.findGroup(groupId);
    if (!group) return;

    const me = group.members.find((m) => m.id === identity.id);
    const target = group.members.find((m) => m.id === memberId);
    if (!me || me.role !== "admin") {
      addToast("Only admins can remove members");
      return;
    }
    if (target?.role === "admin" && group.creator !== identity.id) {
      addToast("Only the creator can remove admins");
      return;
    }

    const newGroupKey = await generateGroupKey();
    const remainingMembers = group.members.filter((m) => m.id !== memberId);

    groupsMgr.removeMember(groupId, memberId);
    groupsMgr.updateGroupKey(groupId, newGroupKey);

    await Promise.allSettled(
      remainingMembers
        .filter((m) => m.id !== identity.id)
        .map(async (recipient) => {
          const { envelope } = await buildGroupMemberRemoved(
            identity.id, identity.label,
            identity.authPubJwk, identity.authPrivJwk,
            groupId, memberId, newGroupKey, remainingMembers, recipient
          );
          return sendEnvelope(envelope);
        })
    );

    addToast("Member removed from group");
  }, [identity, groupsMgr, addToast]);

  const changeAdminRole = useCallback(async (groupId, targetId, newRole) => {
    const group = groupsMgr.findGroup(groupId);
    if (!group || group.creator !== identity.id) {
      addToast("Only the creator can change admin roles");
      return;
    }

    groupsMgr.setMemberRole(groupId, targetId, newRole);

    await Promise.allSettled(
      group.members
        .filter((m) => m.id !== identity.id)
        .map(async (recipient) => {
          const { envelope } = await buildGroupAdminChange(
            identity.id, identity.label,
            identity.authPubJwk, identity.authPrivJwk,
            groupId, targetId, newRole, recipient
          );
          return sendEnvelope(envelope);
        })
    );
  }, [identity, groupsMgr, addToast]);

  const leaveGroup = useCallback(async (groupId) => {
    const group = groupsMgr.findGroup(groupId);
    if (!group) return;

    if (group.creator === identity.id) {
      addToast("Creator cannot leave — delete the group instead");
      return;
    }

    await Promise.allSettled(
      group.members
        .filter((m) => m.id !== identity.id)
        .map(async (recipient) => {
          const { envelope } = await buildGroupLeave(
            identity.id, identity.label,
            identity.authPubJwk, identity.authPrivJwk,
            groupId, recipient
          );
          return sendEnvelope(envelope);
        })
    );

    groupsMgr.removeGroup(groupId);
    addToast("Left the group");
  }, [identity, groupsMgr, addToast]);

  const renameGroup = useCallback(async (groupId, newName) => {
    const group = groupsMgr.findGroup(groupId);
    if (!group) return;

    const me = group.members.find((m) => m.id === identity.id);
    if (!me || me.role !== "admin") {
      addToast("Only admins can rename the group");
      return;
    }

    groupsMgr.renameGroup(groupId, newName);

    await Promise.allSettled(
      group.members
        .filter((m) => m.id !== identity.id)
        .map(async (recipient) => {
          const { envelope } = await buildGroupNameChange(
            identity.id, identity.label,
            identity.authPubJwk, identity.authPrivJwk,
            groupId, newName, recipient
          );
          return sendEnvelope(envelope);
        })
    );
  }, [identity, groupsMgr, addToast]);

  const deleteGroup = useCallback(async (groupId) => {
    const group = groupsMgr.findGroup(groupId);
    if (!group || group.creator !== identity.id) {
      addToast("Only the creator can delete the group");
      return;
    }

    await Promise.allSettled(
      group.members
        .filter((m) => m.id !== identity.id)
        .map(async (recipient) => {
          const { envelope } = await buildGroupMemberRemoved(
            identity.id, identity.label,
            identity.authPubJwk, identity.authPrivJwk,
            groupId, recipient.id, "", [], recipient
          );
          return sendEnvelope(envelope);
        })
    );

    groupsMgr.removeGroup(groupId);
    addToast("Group deleted");
  }, [identity, groupsMgr, addToast]);

  return {
    createGroup,
    addGroupMember,
    removeGroupMember,
    changeAdminRole,
    leaveGroup,
    renameGroup,
    deleteGroup,
  };
}
