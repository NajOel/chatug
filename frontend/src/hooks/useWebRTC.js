import { useRef, useState, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};

export function useWebRTC(socket, roomIdRef) {
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [mediaError, setMediaError] = useState(null);

  const startMedia = useCallback(async (video = true, audio = true) => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio,
        video: video ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      setMediaError(err.message);
      return null;
    }
  }, []);

  const createPeer = useCallback((isInitiator, stream) => {
    if (peerRef.current) { peerRef.current.close(); peerRef.current = null; }
    const peer = new RTCPeerConnection(ICE_SERVERS);
    peerRef.current = peer;

    stream?.getTracks().forEach(track => peer.addTrack(track, stream));

    peer.ontrack = (e) => setRemoteStream(e.streams[0]);

    peer.onicecandidate = (e) => {
      if (e.candidate && socket && roomIdRef.current) {
        socket.emit('webrtc_ice', { roomId: roomIdRef.current, candidate: e.candidate });
      }
    };

    if (isInitiator) {
      peer.createOffer().then(offer => {
        peer.setLocalDescription(offer);
        socket?.emit('webrtc_offer', { roomId: roomIdRef.current, offer });
      });
    }

    return peer;
  }, [socket, roomIdRef]);

  const handleOffer = useCallback(async (offer, stream) => {
    if (peerRef.current) { peerRef.current.close(); peerRef.current = null; }
    const peer = new RTCPeerConnection(ICE_SERVERS);
    peerRef.current = peer;

    const s = stream || localStreamRef.current;
    s?.getTracks().forEach(track => peer.addTrack(track, s));

    peer.ontrack = (e) => setRemoteStream(e.streams[0]);

    peer.onicecandidate = (e) => {
      if (e.candidate && socket && roomIdRef.current) {
        socket.emit('webrtc_ice', { roomId: roomIdRef.current, candidate: e.candidate });
      }
    };

    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket?.emit('webrtc_answer', { roomId: roomIdRef.current, answer });
  }, [socket, roomIdRef]);

  const handleAnswer = useCallback(async (answer) => {
    try { await peerRef.current?.setRemoteDescription(new RTCSessionDescription(answer)); } catch {}
  }, []);

  const handleIce = useCallback(async (candidate) => {
    try { await peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
  }, []);

  const stopMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  return { localStream, remoteStream, mediaError, startMedia, createPeer, handleOffer, handleAnswer, handleIce, stopMedia };
}