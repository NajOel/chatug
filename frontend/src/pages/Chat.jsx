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
        <div style={{ position: "relative", background: "#000", flexShrink: 0, height: 220 }}>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          
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




