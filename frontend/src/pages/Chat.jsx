import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useWebRTC } from '../hooks/useWebRTC';

const GIFTS = [
  { id: 'rose',  emoji: '🌹', name: 'Rose',  price: 1000 },
  { id: 'fire',  emoji: '🔥', name: 'Fire',  price: 2000 },
  { id: 'crown', emoji: '👑', name: 'Crown', price: 5000 },
];

export default function Chat() {
  const navigate = useNavigate();
  const location = useLocation();
  const { socket } = useSocket();
  const { profile, chatMode } = location.state || {};

  const [status, setStatus] = useState('waiting');
  const [roomId, setRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [showGifts, setShowGifts] = useState(false);
  const [giftAnim, setGiftAnim] = useState(null);
  const [partnerInfo, setPartnerInfo] = useState(null);
  const [waitingPos, setWaitingPos] = useState(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const messagesEndRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const roomIdRef = useRef(null);

  const { localStream, remoteStream, startMedia, createPeer, handleOffer, handleAnswer, handleIce, stopMedia } = useWebRTC(socket, roomIdRef);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (!socket) return;

    socket.emit('find_match');

    socket.on('waiting', ({ position }) => {
      setStatus('waiting');
      setWaitingPos(position);
    });

    socket.on('match_found', async ({ roomId: rid, isInitiator, partnerLanguage, partnerInterests, partnerUniversity }) => {
      roomIdRef.current = rid;
      setRoomId(rid);
      setPartnerInfo({ language: partnerLanguage, interests: partnerInterests, university: partnerUniversity });
      setStatus('connected');
      setWaitingPos(null);
      setMessages([]);
      addSystemMessage('Connected! Say hello 👋');

      if (chatMode !== 'text') {
      try {
        const isVideo = chatMode === 'video';
        const stream = await startMedia(isVideo, true);
          if (!stream) {
            addSystemMessage('⚠️ Could not access camera/mic. Check browser permissions.');
            return;
          }
          if (isInitiator) {
            // Wait a moment for the other side to get their media ready
            setTimeout(() => createPeer(true, stream), 1500);
          }
          // Non-initiator waits for webrtc_offer event
        } catch (err) {
          addSystemMessage('⚠️ Media error: ' + err.message);
        }
      }
    });

    socket.on('receive_message', ({ text }) => {
      setMessages(m => [...m, { text, from: 'partner', timestamp: Date.now() }]);
    });

    socket.on('partner_left', () => {
      addSystemMessage('Partner left the chat.');
      setStatus('disconnected');
      stopMedia();
    });

    socket.on('partner_skipped', () => {
      addSystemMessage('Partner skipped.');
      setStatus('disconnected');
      stopMedia();
    });

    socket.on('receive_gift', (gift) => {
      setGiftAnim(gift);
      setTimeout(() => setGiftAnim(null), 2500);
      addSystemMessage(`Partner sent you a ${gift.name} ${gift.emoji}!`);
    });

    socket.on('banned', ({ message }) => {
      alert(message);
      navigate('/');
    });

    socket.on('webrtc_offer', async ({ offer }) => {
      try {
        // Non-initiator: get media then answer
        const stream = await startMedia(chatMode === 'video', true);
        if (stream) await handleOffer(offer, stream);
      } catch (err) {
        addSystemMessage('⚠️ Video error: ' + err.message);
      }
    });

    socket.on('webrtc_answer', ({ answer }) => handleAnswer(answer));
    socket.on('webrtc_ice', ({ candidate }) => handleIce(candidate));

    return () => {
      ['waiting','match_found','receive_message','partner_left','partner_skipped',
       'receive_gift','banned','webrtc_offer','webrtc_answer','webrtc_ice'].forEach(e => socket.off(e));
    };
  // eslint-disable-next-line
  }, [socket]);

  function addSystemMessage(text) {
    setMessages(m => [...m, { text, from: 'system', timestamp: Date.now() }]);
  }

  function sendMessage(e) {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text || !roomIdRef.current) return;
    socket.emit('send_message', { roomId: roomIdRef.current, text });
    setMessages(m => [...m, { text, from: 'me', timestamp: Date.now() }]);
    setInputText('');
  }

  function skip() {
    stopMedia();
    setStatus('waiting');
    setRoomId(null);
    roomIdRef.current = null;
    setMessages([]);
    setPartnerInfo(null);
    socket.emit('skip');
  }

  function sendGift(giftId) {
    if (!roomIdRef.current) return;
    socket.emit('send_gift', { roomId: roomIdRef.current, gift: giftId });
    const g = GIFTS.find(g => g.id === giftId);
    addSystemMessage(`You sent a ${g.name} ${g.emoji} (${g.price.toLocaleString()} UGX)`);
    setShowGifts(false);
  }

  function report(reason) {
    socket.emit('report_user', { roomId: roomIdRef.current, reason });
    setShowReport(false);
    skip();
  }

  function toggleMute() {
    localStream?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMuted(m => !m);
  }

  function toggleVideo() {
    localStream?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setVideoOff(v => !v);
  }

  const isVideo = chatMode === 'video';
  const isVoice = chatMode === 'voice';

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>

      {giftAnim && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 100, animation: 'giftPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>{giftAnim.emoji}</div>
        </div>
      )}

      {/* Top bar */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
        <button onClick={() => { stopMedia(); navigate('/'); }} style={iconBtn}>←</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: status === 'connected' ? '#2ED573' : status === 'waiting' ? '#F5C842' : '#FF4757' }} />
          <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15 }}>
            {status === 'connected' ? 'Connected' : status === 'waiting' ? 'Finding match…' : 'Disconnected'}
          </span>
          {partnerInfo?.university && (
            <span style={{ fontSize: 11, background: 'rgba(245,200,66,0.15)', color: 'var(--gold)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
              {partnerInfo.university.split(' ')[0]}
            </span>
          )}
        </div>
        <button onClick={() => setShowReport(true)} style={{ ...iconBtn, color: 'var(--red)', fontSize: 18 }}>⚑</button>
      </div>

      {/* Video area */}
      {isVideo && (
        <div style={{ position: "relative", background: "#000", flexShrink: 0, height: "min(220px, 35vh)" }}>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: remoteStream ? 'block' : 'none' }} />
          {!remoteStream && (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
              {status === 'waiting' ? <WaitingSpinner /> : <span style={{ fontSize: 13 }}>Waiting for partner's video…</span>}
            </div>
          )}
          <div style={{ position: 'absolute', bottom: 12, right: 12, width: 80, height: 100, borderRadius: 10, overflow: 'hidden', border: '2px solid var(--border)', background: '#111' }}>
            <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          </div>
        </div>
      )}

      {/* Voice indicator */}
      {isVoice && (
        <div style={{ flexShrink: 0, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 48 }}>{status === 'connected' ? '🎙️' : '⏳'}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{status === 'connected' ? 'Voice call active' : 'Waiting…'}</div>
          <button onClick={toggleMute} style={{ padding: '8px 20px', borderRadius: 20, border: 'none', background: muted ? 'var(--red)' : 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            {muted ? '🔇 Unmute' : '🔊 Mute'}
          </button>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {status === 'waiting' && messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--muted)' }}>
            <WaitingSpinner />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text)', marginBottom: 6 }}>Finding your match…</div>
              <div style={{ fontSize: 13 }}>Matching by {profile?.language}, {profile?.interests?.slice(0,2).join(', ') || 'any interests'}</div>
              {waitingPos && <div style={{ fontSize: 12, marginTop: 6, color: 'var(--gold)' }}>{waitingPos} in queue</div>}
            </div>
          </div>
        )}
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        <div ref={messagesEndRef} />
      </div>

      {/* Video controls */}
      {isVideo && status === 'connected' && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '8px 16px', flexShrink: 0 }}>
          <CtrlBtn onClick={toggleMute} label={muted ? '🔇' : '🔊'} active={muted} />
          <CtrlBtn onClick={toggleVideo} label={videoOff ? '📵' : '📹'} active={videoOff} />
        </div>
      )}

      {/* Input bar */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', gap: 8, flexShrink: 0, paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
        <button onClick={() => setShowGifts(g => !g)} style={{ ...iconBtn, fontSize: 20, width: 44, height: 44, flexShrink: 0, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>🎁</button>
        <input
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(e)}
          placeholder={status === 'connected' ? 'Type a message…' : 'Waiting for match…'}
          disabled={status !== 'connected'}
          style={{ flex: 1, padding: '10px 14px', borderRadius: 12, background: 'var(--surface)', border: '1.5px solid var(--border)', color: 'var(--text)', fontSize: 15, outline: 'none' }}
        />
        <button onClick={sendMessage} disabled={!inputText.trim() || status !== 'connected'} style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, background: 'var(--gold)', border: 'none', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !inputText.trim() || status !== 'connected' ? 0.4 : 1, cursor: 'pointer' }}>➤</button>
        <button onClick={skip} style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, background: 'rgba(30,144,255,0.1)', border: '1.5px solid rgba(30,144,255,0.4)', color: 'var(--blue)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, cursor: 'pointer' }}>⏭</button>
      </div>

      {/* Gift panel */}
      {showGifts && (
        <div style={{ position: 'absolute', bottom: 80, left: 12, right: 12, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', padding: 16, zIndex: 50, animation: 'slideUp 0.2s ease' }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, marginBottom: 12, fontSize: 14 }}>Send a Gift</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {GIFTS.map(g => (
              <button key={g.id} onClick={() => sendGift(g.id)} style={{ flex: 1, padding: '14px 8px', borderRadius: 12, background: 'var(--bg3)', border: '1.5px solid var(--border)', cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: 28 }}>{g.emoji}</div>
                <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, marginTop: 4 }}>{g.name}</div>
                <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 2 }}>{g.price.toLocaleString()} UGX</div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, textAlign: 'center' }}>Pay via MTN MoMo or Airtel Money</div>
        </div>
      )}

      {/* Report modal */}
      {showReport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }} onClick={() => setShowReport(false)}>
          <div style={{ background: 'var(--surface)', width: '100%', borderRadius: '20px 20px 0 0', padding: '24px 20px', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18, marginBottom: 16 }}>Report User</div>
            {['Nudity / Sexual content', 'Abusive language', 'Spam / Advertising', 'Underage user', 'Other'].map(reason => (
              <button key={reason} onClick={() => report(reason)} style={{ width: '100%', padding: '14px 16px', borderRadius: 12, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 15, textAlign: 'left', marginBottom: 8, cursor: 'pointer' }}>
                ⚑ {reason}
              </button>
            ))}
            <button onClick={() => setShowReport(false)} style={{ width: '100%', padding: '14px', borderRadius: 12, background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 15, marginTop: 4, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Message({ msg }) {
  if (msg.from === 'system') return (
    <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', padding: '2px 0', fontStyle: 'italic' }}>{msg.text}</div>
  );
  const isMe = msg.from === 'me';
  return (
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', animation: 'fadeIn 0.2s ease' }}>
      <div style={{ maxWidth: '78%', padding: '10px 14px', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: isMe ? 'linear-gradient(135deg, #F5C842, #E6A817)' : 'var(--surface)', color: isMe ? '#080C10' : 'var(--text)', fontSize: 15, wordBreak: 'break-word' }}>
        {msg.text}
      </div>
    </div>
  );
}

function WaitingSpinner() {
  return <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />;
}

function CtrlBtn({ onClick, label, active }) {
  return (
    <button onClick={onClick} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: active ? 'var(--red)' : 'var(--surface)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
      {label}
    </button>
  );
}

const iconBtn = { background: 'none', border: 'none', color: 'var(--text)', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, cursor: 'pointer' };

