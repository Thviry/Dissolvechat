import { useState, useRef, useEffect } from "react";
import { IconPhoneOff, IconMic, IconMicOff, IconSpeaker, IconChevronDown } from "./Icons";
import { formatCallDuration } from "@utils/callHelpers";

function DevicePicker({ devices, selectedId, onSelect, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (devices.length === 0) return null;

  return (
    <div className="callbar-device-picker" ref={ref}>
      <button
        className="btn-icon callbar-device-trigger"
        onClick={() => setOpen(!open)}
        title={`Select ${label}`}
        aria-label={`Select ${label}`}
        aria-expanded={open}
      >
        <IconChevronDown size={14} />
      </button>
      {open && (
        <div className="callbar-device-menu" role="listbox" aria-label={label}>
          <div
            className={`callbar-device-option${!selectedId ? " active" : ""}`}
            role="option"
            aria-selected={!selectedId}
            onClick={() => { onSelect(""); setOpen(false); }}
          >
            Default
          </div>
          {devices.map(d => (
            <div
              key={d.deviceId}
              className={`callbar-device-option${d.deviceId === selectedId ? " active" : ""}`}
              role="option"
              aria-selected={d.deviceId === selectedId}
              onClick={() => { onSelect(d.deviceId); setOpen(false); }}
            >
              {d.label || `${label} ${d.deviceId.slice(0, 8)}`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CallBar({
  peerLabel, duration, isMuted, onMute, onUnmute, onHangup, onNavigate,
  audioDevices = [], selectedInput, selectedOutput,
  onSwitchInput, onSwitchOutput,
}) {
  const inputDevices = audioDevices.filter(d => d.kind === "audioinput");
  const outputDevices = audioDevices.filter(d => d.kind === "audiooutput");
  const supportsSinkId = typeof HTMLMediaElement !== "undefined" &&
    typeof HTMLMediaElement.prototype.setSinkId === "function";

  return (
    <div className="call-bar" onClick={onNavigate}>
      <div className="call-bar-info">
        <span className="call-bar-label">{peerLabel}</span>
        <span className="call-bar-duration">{formatCallDuration(duration)}</span>
      </div>
      <div className="call-bar-actions" onClick={(e) => e.stopPropagation()}>
        <div className="callbar-action-group">
          <button
            className={`btn-icon call-bar-btn ${isMuted ? "call-bar-muted" : ""}`}
            onClick={isMuted ? onUnmute : onMute}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <IconMicOff size={16} /> : <IconMic size={16} />}
          </button>
          {inputDevices.length > 0 && (
            <DevicePicker
              devices={inputDevices}
              selectedId={selectedInput}
              onSelect={onSwitchInput}
              label="Microphone"
            />
          )}
        </div>

        {supportsSinkId && outputDevices.length > 0 && (
          <div className="callbar-action-group">
            <button className="btn-icon call-bar-btn" title="Speaker">
              <IconSpeaker size={16} />
            </button>
            <DevicePicker
              devices={outputDevices}
              selectedId={selectedOutput}
              onSelect={onSwitchOutput}
              label="Speaker"
            />
          </div>
        )}

        <button className="btn-icon call-bar-btn call-bar-end" onClick={onHangup} title="End call">
          <IconPhoneOff size={16} />
        </button>
      </div>
    </div>
  );
}
