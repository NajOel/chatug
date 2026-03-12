import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';

const INTERESTS = ['Music 🎵', 'Football ⚽', 'Tech 💻', 'Business 💼', 'Gaming 🎮', 'Dating 💘', 'Art 🎨', 'Comedy 😂'];
const UNIVERSITIES = ['', 'Makerere University', 'Kyambogo University', 'MUBS', 'UCU', 'Kampala International', 'Nkumba University'];
const CITIES = ['', 'Kampala', 'Jinja', 'Mbarara', 'Gulu', 'Entebbe', 'Mbale', 'Fort Portal'];
const LANGUAGES = ['English', 'Luganda', 'Swahili'];

export default function Home() {
  const navigate = useNavigate();
  const { socket, connected, onlineCount } = useSocket();

  const [profile, setProfile] = useState({
    name: localStorage.getItem('cug_name') || '',
    language: localStorage.getItem('cug_lang') || 'English',
    interests: JSON.parse(localStorage.getItem('cug_interests') || '[]'),
    city: localStorage.getItem('cug_city') || '',
    university: localStorage.getItem('cug_uni') || '',
    gender: localStorage.getItem('cug_gender') || '',
    isPremium: false,
  });

  const [chatMode, setChatMode] = useState('text'); // text | voice | video
  const [stats, setStats] = useState({ online: 0 });

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  const toggleInterest = (interest) => {
    setProfile(p => {
      const raw = interest.split(' ')[0];
      const exists = p.interests.includes(raw);
      const next = exists ? p.interests.filter(i => i !== raw) : [...p.interests, raw];
      localStorage.setItem('cug_interests', JSON.stringify(next));
      return { ...p, interests: next };
    });
  };

  const set = (key, val) => {
    setProfile(p => ({ ...p, [key]: val }));
    localStorage.setItem(`cug_${key === 'language' ? 'lang' : key === 'university' ? 'uni' : key}`, val);
  };

  const startChat = () => {
    if (!connected) return alert('Connecting to server… try again in a second.');
    socket.emit('set_profile', profile);
    localStorage.setItem('cug_name', profile.name);
    navigate('/chat', { state: { profile, chatMode } });
  };

  const dots = [0, 1, 2].map(i => (
    <span key={i} style={{
      width: 6, height: 6, borderRadius: '50%', background: '#2ED573',
      display: 'inline-block', margin: '0 2px',
      animation: `dot 1.4s ease-in-out ${i * 0.16}s infinite`,
    }} />
  ));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #F5C842, #E6A817)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💬</div>
          <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px' }}>ChatUG</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2ED573', boxShadow: '0 0 8px #2ED573' }} />
            <span style={{ color: '#2ED573', fontWeight: 600 }}>{stats.online || onlineCount || 0} online</span>
          </div>
        </div>
      </header>

      <div style={{ flex: 1, padding: '0 24px 40px', maxWidth: 480, margin: '0 auto', width: '100%' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', padding: '40px 0 32px' }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 20 }}>
            <div style={{
              width: 90, height: 90, borderRadius: '50%',
              background: 'linear-gradient(135deg, #F5C842 0%, #E6A817 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 42, position: 'relative', zIndex: 1,
              boxShadow: '0 0 0 0 rgba(245,200,66,0.4)',
              animation: 'none',
            }}>🇺🇬</div>
            <div style={{
              position: 'absolute', inset: -8, borderRadius: '50%',
              border: '2px solid rgba(245,200,66,0.3)',
              animation: 'pulse-ring 2s ease-out infinite',
            }} />
            <div style={{
              position: 'absolute', inset: -16, borderRadius: '50%',
              border: '1px solid rgba(245,200,66,0.15)',
              animation: 'pulse-ring 2s ease-out 0.5s infinite',
            }} />
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1, marginBottom: 10 }}>
            Connect with<br /><span style={{ color: 'var(--gold)' }}>Uganda</span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 15 }}>
            Chat with strangers across Uganda.<br />Safe, local, mobile-first.
          </p>
        </div>

        {/* Chat Mode */}
        <Section label="Chat Mode">
          <div style={{ display: 'flex', gap: 8 }}>
            {[['text', '💬 Text'], ['voice', '🎙️ Voice'], ['video', '📹 Video']].map(([mode, label]) => (
              <ModeBtn key={mode} active={chatMode === mode} onClick={() => setChatMode(mode)}>{label}</ModeBtn>
            ))}
          </div>
        </Section>

        {/* Name */}
        <Section label="Your Name (optional)">
          <input
            type="text"
            placeholder="Anonymous"
            value={profile.name}
            onChange={e => set('name', e.target.value)}
            maxLength={20}
            style={inputStyle}
          />
        </Section>

        {/* Language */}
        <Section label="Language">
          <div style={{ display: 'flex', gap: 8 }}>
            {LANGUAGES.map(lang => (
              <ModeBtn key={lang} active={profile.language === lang} onClick={() => set('language', lang)}>{lang}</ModeBtn>
            ))}
          </div>
        </Section>

        {/* Interests */}
        <Section label="Interests">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {INTERESTS.map(i => {
              const raw = i.split(' ')[0];
              return (
                <TagBtn key={i} active={profile.interests.includes(raw)} onClick={() => toggleInterest(i)}>{i}</TagBtn>
              );
            })}
          </div>
        </Section>

        {/* Location & University */}
        <Section label="Location (optional)">
          <select value={profile.city} onChange={e => set('city', e.target.value)} style={selectStyle}>
            <option value="">Any city</option>
            {CITIES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Section>

        <Section label="Campus Channel (optional)">
          <select value={profile.university} onChange={e => set('university', e.target.value)} style={selectStyle}>
            <option value="">No campus filter</option>
            {UNIVERSITIES.slice(1).map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </Section>

        {/* Gender */}
        <Section label="I am">
          <div style={{ display: 'flex', gap: 8 }}>
            {['', 'Male', 'Female', 'Other'].map(g => (
              <ModeBtn key={g} active={profile.gender === g} onClick={() => set('gender', g)}>{g || 'Any'}</ModeBtn>
            ))}
          </div>
        </Section>

        {/* Start button */}
        <button onClick={startChat} style={{
          width: '100%', padding: '18px 0', borderRadius: 16,
          background: 'linear-gradient(135deg, #F5C842, #E6A817)',
          border: 'none', color: '#080C10',
          fontFamily: 'Syne', fontWeight: 800, fontSize: 18,
          letterSpacing: '-0.3px', marginTop: 8,
          boxShadow: '0 8px 32px rgba(245,200,66,0.3)',
          transition: 'transform 0.1s, box-shadow 0.1s',
          cursor: connected ? 'pointer' : 'not-allowed',
          opacity: connected ? 1 : 0.6,
        }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {connected ? '🔀 Start Chatting' : 'Connecting…'}
        </button>

        {/* Status */}
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {connected ? (
            <>{dots} <span style={{ marginLeft: 4 }}>People are waiting to chat</span></>
          ) : (
            <span>Connecting to ChatUG servers…</span>
          )}
        </div>

        {/* Premium teaser */}
        <div style={{ marginTop: 32, padding: 20, borderRadius: 16, background: 'linear-gradient(135deg, rgba(245,200,66,0.08), rgba(245,200,66,0.03))', border: '1px solid rgba(245,200,66,0.2)' }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--gold)', marginBottom: 8 }}>👑 Premium Features</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
            • Connect with females only<br />
            • Match by exact location<br />
            • Send digital gifts (Rose 🌹, Fire 🔥, Crown 👑)<br />
            • Pay via MTN MoMo or Airtel Money
          </div>
        </div>

        {/* Invite */}
        <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'center' }}>
          {[['WhatsApp', '#25D366', '💬'], ['Telegram', '#0088cc', '✈️']].map(([name, color, icon]) => (
            <a key={name} href={`https://${name.toLowerCase()}.com/share?text=Join me on ChatUG - Uganda's chat platform! chatug.ug`}
              target="_blank" rel="noreferrer"
              style={{ flex: 1, padding: '12px 8px', borderRadius: 12, background: color + '20', border: `1px solid ${color}40`, color, textAlign: 'center', textDecoration: 'none', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {icon} Invite via {name}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  );
}

function ModeBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '10px 4px', borderRadius: 10,
      border: active ? '1.5px solid var(--gold)' : '1.5px solid var(--border)',
      background: active ? 'rgba(245,200,66,0.1)' : 'var(--surface)',
      color: active ? 'var(--gold)' : 'var(--text)',
      fontSize: 13, fontWeight: 600,
      transition: 'all 0.15s',
      cursor: 'pointer',
    }}>{children}</button>
  );
}

function TagBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 14px', borderRadius: 20,
      border: active ? '1.5px solid var(--gold)' : '1.5px solid var(--border)',
      background: active ? 'rgba(245,200,66,0.12)' : 'var(--bg3)',
      color: active ? 'var(--gold)' : 'var(--muted)',
      fontSize: 13, fontWeight: 500,
      transition: 'all 0.15s', cursor: 'pointer',
    }}>{children}</button>
  );
}

const inputStyle = {
  width: '100%', padding: '13px 16px', borderRadius: 10,
  background: 'var(--surface)', border: '1.5px solid var(--border)',
  color: 'var(--text)', fontSize: 15,
  outline: 'none',
};

const selectStyle = {
  ...inputStyle,
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7A8D' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 16px center',
  cursor: 'pointer',
};
