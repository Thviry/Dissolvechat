// client/src/hooks/useContacts.js
// Manages the local contact list and pending requests.

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { loadJson, saveJson } from "../utils/storage";

export function useContacts(myId) {
  const contactsKey = useMemo(() => (myId ? `contacts:${myId}` : ""), [myId]);
  const requestsKey = useMemo(() => (myId ? `requests:${myId}` : ""), [myId]);

  const [contacts, setContacts] = useState([]);
  const [requests, setRequests] = useState([]);

  // Refs for use in polling closures (always up-to-date)
  const contactsRef = useRef([]);
  const requestsRef = useRef([]);
  useEffect(() => { contactsRef.current = contacts; }, [contacts]);
  useEffect(() => { requestsRef.current = requests; }, [requests]);

  // Load from localStorage on identity change
  useEffect(() => {
    if (!myId) {
      setContacts([]);
      setRequests([]);
      return;
    }
    setContacts(loadJson(contactsKey, []));
    setRequests(loadJson(requestsKey, []));
  }, [myId, contactsKey, requestsKey]);

  const addContact = useCallback((entry) => {
    const next = [entry, ...contactsRef.current.filter((c) => c.id !== entry.id)];
    setContacts(next);
    if (contactsKey) saveJson(contactsKey, next);
    // Remove from requests if present
    const nextReq = requestsRef.current.filter((r) => r.id !== entry.id);
    setRequests(nextReq);
    if (requestsKey) saveJson(requestsKey, nextReq);
  }, [contactsKey, requestsKey]);

  const addOrUpdateRequest = useCallback((entry) => {
    const next = [entry, ...requestsRef.current.filter((r) => r.id !== entry.id)];
    setRequests(next);
    if (requestsKey) saveJson(requestsKey, next);
  }, [requestsKey]);

  const acceptRequest = useCallback((id) => {
    const req = requestsRef.current.find((r) => r.id === id);
    if (!req) return null;
    const contactEntry = {
      id: req.id,
      label: req.label,
      authPublicJwk: req.authPublicJwk,
      e2eePublicJwk: req.e2eePublicJwk,
      cap: req.cap || null,
    };
    addContact(contactEntry);
    return req;
  }, [addContact]);

  const rejectRequest = useCallback((id) => {
    const nextReq = requestsRef.current.filter((r) => r.id !== id);
    setRequests(nextReq);
    if (requestsKey) saveJson(requestsKey, nextReq);
  }, [requestsKey]);

  const removeById = useCallback((id) => {
    const nextContacts = contactsRef.current.filter((c) => c.id !== id);
    const nextReq = requestsRef.current.filter((r) => r.id !== id);
    setContacts(nextContacts);
    setRequests(nextReq);
    if (contactsKey) saveJson(contactsKey, nextContacts);
    if (requestsKey) saveJson(requestsKey, nextReq);
  }, [contactsKey, requestsKey]);

  const findContact = useCallback((id) => {
    return contactsRef.current.find((c) => c.id === id) || null;
  }, []);

  const findRequest = useCallback((id) => {
    return requestsRef.current.find((r) => r.id === id) || null;
  }, []);

  const findPeer = useCallback((id) => {
    return (
      contactsRef.current.find((c) => c.id === id) ||
      requestsRef.current.find((r) => r.id === id) ||
      null
    );
  }, []);

  const reset = useCallback(() => {
    setContacts([]);
    setRequests([]);
  }, []);

  return {
    contacts,
    requests,
    contactsRef,
    requestsRef,
    addContact,
    addOrUpdateRequest,
    acceptRequest,
    rejectRequest,
    removeById,
    findContact,
    findRequest,
    findPeer,
    reset,
  };
}
