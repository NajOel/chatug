import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { useWebRTC } from "../hooks/useWebRTC";

const GIFTS = [
  { id: "rose",  emoji: "🌹", name: "Rose",  price: 1000 },
  { id: "fire",  emoji: "🔥", name: "Fire",  price: 2000 },
  { id: "crown", emoji: "👑", name: "Crown", price: 5000 },
];

export default function Chat() {
  const navigate = useNavigate();
  const location = useLocation();
  const { socket } = useSocket();
  const { profile, chatMode } = location.state || {};

  const [status, setStatus] = useState("waiting");
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [showGifts, setShowGifts] = useState(false);
  const [giftAnim, setGiftAnim] = useState(null);
  const [partnerInfo, setPartnerInfo] = useState(null);
  const [waitingPos, setWaitingPos] = useState(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const messagesEndRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const roomIdRef = useRef(null);

  const { localStream, remoteStream, startMedia, createPeer, handleOffer, handleAnswer, handleIce, stopMedia } = useWebRTC(socket, roomIdRef);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  useEffect(() => {
    if (!socket) return;
    socket.emit("find_match");
    socket.on("waiting", ({ position }) => { setStatus("waiting"); setWaitingPos(position); });
    socket.on("match_found", async ({ roomId: rid, isInitiator, partnerLanguage, partnerInterests, partnerUniversity }) => {
      roomIdRef.current = rid;
      setPartnerInfo({ language: partnerLanguage, interests: partnerInterests, university: partnerUniversity });
      setStatus("connected");
      setWaitingPos(null);
      setMessages([]);
      addSystemMessage("Connected! Say hello");
      if (chatMode !== "text") {
        try {
          const stream = await startMedia(chatMode === "video", true);
          if (!stream) { addSystemMessage("Could not access camera/mic."); return; }
          if (isInitiator) setTimeout(() => createPeer(true, stream), 1500);
        } catch (err) { addSystemMessage("Media error: " + err.message); }
      }
    });
    socket.on("receive_message", ({ text }) => {
      setMessages(m => [...m, { text, from: "partner", timestamp: Date.now() }]);
    });
    socket.on("partner_left", () => { addSystemMessage("Partner left."); setStatus("disconnected"); stopMedia(); });
    socket.on("partner_skipped", () => { addSystemMessage("Partner skipped."); setStatus("disconnected"); stopMedia(); });
    socket.on("receive_gift", (gift) => {
      setGiftAnim(gift);
      setTimeout(() => setGiftAnim(null), 2500);
      addSystemMessage("Partner sent you a " + gift.name + "!");
    });
    socket.on("banned", ({ message }) => { alert(message); navigate("/"); });
    socket.on("webrtc_offer", async ({ offer }) => {
      try {
        const stream = await startMedia(chatMode === "video", true);
        await handleOffer(offer, stream || null);
      } catch (err) { addSystemMessage("Video error: " + err.message); }
    });
    socket.on("webrtc_answer", ({ answer }) => handleAnswer(answer));
    socket.on("webrtc_ice", ({ candidate }) => handleIce(candidate));
    return () => {
      ["waiting","match_found","receive_message","partner_left","partner_skipped",
       "receive_gift","banned","webrtc_offer","webrtc_answer","webrtc_ice"].forEach(e => socket.off(e));
    };
  // eslint-disable-next-line
  }, [socket]);

  function addSystemMessage(text) {
    setMessages(m => [...m, { text, from: "system", timestamp: Date.now() }]);
  }
  function sendMessage(e) {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text || !roomIdRef.current) return;
    socket.emit("send_message", { roomId: roomIdRef.current, text });
    setMessages(m => [...m, { text, from: "me", timestamp: Date.now() }]);
    setInputText("");
  }
  function skip() {
    stopMedia(); setStatus("waiting"); roomIdRef.current = null;
    setMessages([]); setPartnerInfo(null); setShowChat(false);
    socket.emit("skip");
  }
  function sendGift(giftId) {
    if (!roomIdRef.current) return;
    socket.emit("send_gift", { roomId: roomIdRef.current, gift: giftId });
    const g = GIFTS.find(g => g.id === giftId);
    addSystemMessage("You sent a " + g.name + " (" + g.price.toLocaleString() + " UGX)");
    setShowGifts(false);
  }
  function report(reason) {
    socket.emit("report_user", { roomId: roomIdRef.current, reason });
    setShowReport(false); skip();
  }
  function toggleMute() {
    localStream?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMuted(m => !m);
  }
  function toggleVideo() {
    localStream?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setVideoOff(v => !v);
  }

  const isVideo = chatMode === "video";
  const isVoice = chatMode === "voice";

  if (!isVideo && !isVoice) return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#F0F4F8" }}>
      <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
        <button onClick={() => navigate("/")} style={lBtn}>&#8592;</button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: status === "connected" ? "#38A169" : status === "waiting" ? "#D69E2E" : "#E53E3E", boxShadow: status === "connected" ? "0 0 0 3px rgba(56,161,105,0.2)" : "none" }} />
          <span style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 15, color: "#1A202C" }}>
            {status === "connected" ? "Connected" : status === "waiting" ? "Finding match..." : "Disconnected"}
          </span>
          {partnerInfo?.university && <span style={{ fontSize: 11, background: "#EBF8FF", color: "#2B6CB0", padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>{partnerInfo.university.split(" ")[0]}</span>}
        </div>
        <button onClick={() => setShowReport(true)} style={{ ...lBtn, color: "#E53E3E" }}>!</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {status === "waiting" && messages.length === 0 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, border: "3px solid #CBD5E0", borderTopColor: "#4299E1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 18, color: "#2D3748", marginBottom: 4 }}>Finding your match...</div>
              <div style={{ fontSize: 13, color: "#718096" }}>Matching by {profile?.language}</div>
              {waitingPos && <div style={{ fontSize: 12, marginTop: 6, color: "#D69E2E", fontWeight: 600 }}>{waitingPos} in queue</div>}
            </div>
          </div>
        )}
        {messages.map((msg, i) => {
          if (msg.from === "system") return <div key={i} style={{ textAlign: "center", fontSize: 12, color: "#A0AEC0", fontStyle: "italic" }}>{msg.text}</div>;
          const isMe = msg.from === "me";
          return (
            <div key={i} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "75%", padding: "10px 14px", borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: isMe ? "#3182CE" : "#fff", color: isMe ? "#fff" : "#2D3748", fontSize: 15, wordBreak: "break-word", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>{msg.text}</div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ padding: "12px 16px", background: "#fff", borderTop: "1px solid #E2E8F0", display: "flex", gap: 8, flexShrink: 0, paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        <button onClick={() => setShowGifts(g => !g)} style={{ width: 44, height: 44, borderRadius: 12, background: "#EBF4FF", border: "none", fontSize: 12, fontWeight: 700, color: "#3182CE", cursor: "pointer", flexShrink: 0 }}>Gift</button>
        <input value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(e)} placeholder={status === "connected" ? "Type a message..." : "Waiting..."} disabled={status !== "connected"} style={{ flex: 1, padding: "11px 16px", borderRadius: 24, background: "#F7FAFC", border: "1.5px solid #E2E8F0", color: "#2D3748", fontSize: 15, outline: "none" }} />
        <button onClick={sendMessage} disabled={!inputText.trim() || status !== "connected"} style={{ width: 44, height: 44, borderRadius: 12, background: "#3182CE", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, opacity: !inputText.trim() || status !== "connected" ? 0.4 : 1, cursor: "pointer", flexShrink: 0 }}>Send</button>
        <button onClick={skip} style={{ width: 44, height: 44, borderRadius: 12, background: "#EBF8FF", border: "1.5px solid #BEE3F8", color: "#2B6CB0", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Next</button>
      </div>
      {showGifts && <GP gifts={GIFTS} onSend={sendGift} onClose={() => setShowGifts(false)} light />}
      {showReport && <RM onReport={report} onClose={() => setShowReport(false)} light />}
    </div>
  );

  if (isVoice) return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "linear-gradient(160deg,#1a1a2e,#16213e,#0f3460)" }}>
      <audio ref={remoteAudioRef} autoPlay />
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <button onClick={() => { stopMedia(); navigate("/"); }} style={dBtn}>&#8592;</button>
        <span style={{ fontFamily: "Syne", fontWeight: 700, color: "#fff", fontSize: 15 }}>Voice Chat</span>
        <button onClick={() => setShowReport(true)} style={{ ...dBtn, color: "#FC8181" }}>!</button>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 24 }}>
        <div style={{ width: 100, height: 100, borderRadius: "50%", background: status === "connected" ? "linear-gradient(135deg,#667eea,#764ba2)" : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, boxShadow: status === "connected" ? "0 0 0 16px rgba(102,126,234,0.15),0 0 0 32px rgba(102,126,234,0.07)" : "none", transition: "all 0.4s" }}>
          {status === "connected" ? "👤" : status === "waiting" ? "..." : "x"}
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 22, color: "#fff", marginBottom: 6 }}>{status === "connected" ? "Connected" : status === "waiting" ? "Finding someone..." : "Call ended"}</div>
          {partnerInfo?.language && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Speaking {partnerInfo.language}</div>}
        </div>
        {status === "connected" && (
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button onClick={toggleMute} style={{ padding: "12px 20px", borderRadius: 24, border: "none", background: muted ? "#e53e3e" : "rgba(255,255,255,0.12)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{muted ? "Unmute" : "Mute"}</button>
            <button onClick={skip} style={{ padding: "12px 20px", borderRadius: 24, border: "none", background: "rgba(49,130,206,0.8)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Next</button>
            <button onClick={() => setShowGifts(g => !g)} style={{ padding: "12px 20px", borderRadius: 24, border: "none", background: "rgba(214,158,46,0.8)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Gift</button>
          </div>
        )}
      </div>
      <div style={{ maxHeight: 130, overflowY: "auto", padding: "0 16px 8px" }}>
        {messages.map((msg, i) => {
          if (msg.from === "system") return <div key={i} style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>{msg.text}</div>;
          const isMe = msg.from === "me";
          return <div key={i} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: 4 }}><div style={{ maxWidth: "75%", padding: "8px 12px", borderRadius: 16, background: isMe ? "rgba(49,130,206,0.8)" : "rgba(255,255,255,0.12)", color: "#fff", fontSize: 14 }}>{msg.text}</div></div>;
        })}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ padding: "10px 16px", display: "flex", gap: 8, paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
        <input value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(e)} placeholder="Type a message..." disabled={status !== "connected"} style={{ flex: 1, padding: "11px 16px", borderRadius: 24, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 14, outline: "none" }} />
        <button onClick={sendMessage} disabled={!inputText.trim() || status !== "connected"} style={{ padding: "0 18px", borderRadius: 24, background: "#3182CE", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, opacity: !inputText.trim() || status !== "connected" ? 0.4 : 1, cursor: "pointer" }}>Send</button>
      </div>
      {showGifts && <GP gifts={GIFTS} onSend={sendGift} onClose={() => setShowGifts(false)} />}
      {showReport && <RM onReport={report} onClose={() => setShowReport(false)} />}
      {giftAnim && <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}><div style={{ fontSize: 90, animation: "giftPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards" }}>{giftAnim.emoji}</div></div>}
    </div>
  );

  return (
    <div style={{ height: "100dvh", background: "#000", position: "relative", overflow: "hidden" }}>
      {giftAnim && <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}><div style={{ fontSize: 90, animation: "giftPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards" }}>{giftAnim.emoji}</div></div>}

      <video ref={remoteVideoRef} autoPlay playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 1 }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(0,0,0,0.55) 0%,transparent 25%,transparent 60%,rgba(0,0,0,0.75) 100%)", zIndex: 2 }} />
      <video ref={localVideoRef} autoPlay playsInline muted style={{ position: "absolute", top: 70, right: 14, width: 110, height: 150, objectFit: "cover", borderRadius: 14, border: "2px solid rgba(255,255,255,0.25)", zIndex: 10, background: "#111" }} />

      {status === "waiting" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
          <div style={{ width: 48, height: 48, border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <div style={{ fontFamily: "Syne", fontWeight: 700, color: "#fff", fontSize: 20 }}>Finding match...</div>
          {waitingPos && <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>{waitingPos} in queue</div>}
        </div>
      )}

      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => { stopMedia(); navigate("/"); }} style={dBtn}>&#8592;</button>
        <div style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(0,0,0,0.4)", padding: "6px 14px", borderRadius: 20, backdropFilter: "blur(8px)" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: status === "connected" ? "#68D391" : status === "waiting" ? "#F6E05E" : "#FC8181" }} />
          <span style={{ fontFamily: "Syne", fontWeight: 700, color: "#fff", fontSize: 13 }}>{status === "connected" ? "Connected" : status === "waiting" ? "Finding..." : "Disconnected"}</span>
        </div>
        <button onClick={() => setShowReport(true)} style={{ ...dBtn, color: "#FC8181" }}>!</button>
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10, padding: "12px 14px", paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}>
        <div style={{ maxHeight: 90, overflowY: "auto", marginBottom: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {messages.slice(-4).map((msg, i) => {
            if (msg.from === "system") return <div key={i} style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>{msg.text}</div>;
            const isMe = msg.from === "me";
            return <div key={i} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}><div style={{ maxWidth: "70%", padding: "6px 12px", borderRadius: 14, background: isMe ? "rgba(49,130,206,0.85)" : "rgba(0,0,0,0.6)", color: "#fff", fontSize: 13, backdropFilter: "blur(4px)" }}>{msg.text}</div></div>;
          })}
          <div ref={messagesEndRef} />
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <button onClick={toggleMute} style={{ ...vBtn, background: muted ? "rgba(229,62,62,0.85)" : "rgba(0,0,0,0.45)" }}>{muted ? "Unmute" : "Mute"}</button>
          <button onClick={toggleVideo} style={{ ...vBtn, background: videoOff ? "rgba(229,62,62,0.85)" : "rgba(0,0,0,0.45)" }}>{videoOff ? "Cam On" : "Cam Off"}</button>
          <button onClick={() => setShowGifts(g => !g)} style={vBtn}>Gift</button>
          <button onClick={skip} style={{ ...vBtn, background: "rgba(49,130,206,0.85)" }}>Next</button>
          <button onClick={() => setShowChat(s => !s)} style={vBtn}>{showChat ? "Hide" : "Chat"}</button>
        </div>
        {showChat && (
          <div style={{ display: "flex", gap: 8 }}>
            <input value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(e)} placeholder="Type a message..." disabled={status !== "connected"} style={{ flex: 1, padding: "10px 16px", borderRadius: 24, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 14, outline: "none", backdropFilter: "blur(8px)" }} />
            <button onClick={sendMessage} disabled={!inputText.trim() || status !== "connected"} style={{ padding: "0 18px", borderRadius: 24, background: "#3182CE", border: "none", color: "#fff", fontWeight: 700, fontSize: 13, opacity: !inputText.trim() || status !== "connected" ? 0.4 : 1, cursor: "pointer" }}>Send</button>
          </div>
        )}
      </div>

      {showGifts && <GP gifts={GIFTS} onSend={sendGift} onClose={() => setShowGifts(false)} />}
      {showReport && <RM onReport={report} onClose={() => setShowReport(false)} />}
    </div>
  );
}

function GP({ gifts, onSend, onClose, light }) {
  return (
    <div style={{ position: "fixed", bottom: 90, left: 12, right: 12, background: light ? "#fff" : "rgba(20,25,40,0.97)", borderRadius: 20, border: light ? "1px solid #E2E8F0" : "1px solid rgba(255,255,255,0.1)", padding: 20, zIndex: 100, backdropFilter: "blur(12px)" }}>
      <div style={{ fontFamily: "Syne", fontWeight: 700, marginBottom: 14, fontSize: 15, color: light ? "#2D3748" : "#fff" }}>Send a Gift</div>
      <div style={{ display: "flex", gap: 12 }}>
        {gifts.map(g => (
          <button key={g.id} onClick={() => onSend(g.id)} style={{ flex: 1, padding: "16px 8px", borderRadius: 14, background: light ? "#F7FAFC" : "rgba(255,255,255,0.07)", border: light ? "1.5px solid #E2E8F0" : "1.5px solid rgba(255,255,255,0.1)", cursor: "pointer", textAlign: "center" }}>
            <div style={{ fontSize: 28 }}>{g.emoji}</div>
            <div style={{ fontSize: 12, color: light ? "#2D3748" : "#fff", fontWeight: 600, marginTop: 6 }}>{g.name}</div>
            <div style={{ fontSize: 11, color: "#D69E2E", marginTop: 2 }}>{g.price.toLocaleString()} UGX</div>
          </button>
        ))}
      </div>
      <button onClick={onClose} style={{ width: "100%", marginTop: 12, padding: 10, borderRadius: 12, background: "transparent", border: "none", color: light ? "#718096" : "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
    </div>
  );
}

function RM({ onReport, onClose, light }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "flex-end", zIndex: 300 }} onClick={onClose}>
      <div style={{ background: light ? "#fff" : "#1A202C", width: "100%", borderRadius: "20px 20px 0 0", padding: "24px 20px", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 18, marginBottom: 16, color: light ? "#2D3748" : "#fff" }}>Report User</div>
        {["Nudity / Sexual content","Abusive language","Spam","Underage user","Other"].map(reason => (
          <button key={reason} onClick={() => onReport(reason)} style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: light ? "#F7FAFC" : "#2D3748", border: light ? "1px solid #E2E8F0" : "1px solid #4A5568", color: light ? "#2D3748" : "#fff", fontSize: 15, textAlign: "left", marginBottom: 8, cursor: "pointer" }}>{reason}</button>
        ))}
        <button onClick={onClose} style={{ width: "100%", padding: 12, borderRadius: 12, background: "transparent", border: "none", color: "#718096", fontSize: 15, cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  );
}

const lBtn = { background: "none", border: "none", color: "#4A5568", fontSize: 20, padding: 8, cursor: "pointer", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" };
const dBtn = { background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 16, padding: "8px 12px", cursor: "pointer", borderRadius: 10, backdropFilter: "blur(8px)", display: "flex", alignItems: "center" };
const vBtn = { padding: "8px 16px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.45)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", backdropFilter: "blur(8px)" };
