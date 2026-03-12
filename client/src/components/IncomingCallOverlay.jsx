import { IconPhone, IconPhoneOff } from "./Icons";
import { idToHue } from "@utils/callHelpers";

export default function IncomingCallOverlay({ callerLabel, callerId, onAccept, onDecline }) {
  const hue = idToHue(callerId);

  return (
    <div className="call-overlay">
      <div className="call-overlay-content">
        <div className="call-overlay-avatar" style={{ "--avatar-hue": hue }}>
          {(callerLabel || "?")[0].toUpperCase()}
        </div>
        <div className="call-overlay-label">{callerLabel}</div>
        <div className="call-overlay-status">Incoming voice call...</div>
        <div className="call-overlay-actions">
          <button className="call-btn call-btn-decline" onClick={onDecline} title="Decline">
            <IconPhoneOff size={24} />
          </button>
          <button className="call-btn call-btn-accept" onClick={onAccept} title="Accept">
            <IconPhone size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
