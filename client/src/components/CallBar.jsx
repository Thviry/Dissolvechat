import { IconPhoneOff, IconMic, IconMicOff } from "./Icons";
import { formatCallDuration } from "@utils/callHelpers";

export default function CallBar({ peerLabel, duration, isMuted, onMute, onUnmute, onHangup, onNavigate }) {
  return (
    <div className="call-bar" onClick={onNavigate}>
      <div className="call-bar-info">
        <span className="call-bar-label">{peerLabel}</span>
        <span className="call-bar-duration">{formatCallDuration(duration)}</span>
      </div>
      <div className="call-bar-actions" onClick={(e) => e.stopPropagation()}>
        <button
          className={`btn-icon call-bar-btn ${isMuted ? "call-bar-muted" : ""}`}
          onClick={isMuted ? onUnmute : onMute}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <IconMicOff size={16} /> : <IconMic size={16} />}
        </button>
        <button className="btn-icon call-bar-btn call-bar-end" onClick={onHangup} title="End call">
          <IconPhoneOff size={16} />
        </button>
      </div>
    </div>
  );
}
