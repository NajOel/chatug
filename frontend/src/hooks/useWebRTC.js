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
    // Return existing stream if already started
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

  const createPeer = useCallback(async (isInitiator, stream) => {
    if (peerRef.current) { peerRef.current.close(); peerRef.current = null; }
    const peer = new RTCPeerConnection(ICE_SERVERS);
    peerRef.current = peer;

    // attach local tracks
    stream?.getTracks().forEach(track => {
      console.debug('[webrtc] adding local track', track.kind, 'enabled=', track.enabled);
      peer.addTrack(track, stream);
    });
    try { console.debug('[webrtc] senders', peer.getSenders().map(s => s.track?.kind)); } catch {}

    peer.ontrack = (e) => {
      console.debug('[webrtc] ontrack', e.streams[0]?.getTracks().map(t=>t.kind));
      setRemoteStream(e.streams[0]);
    };
    peer.onicecandidate = (e) => {
      if (e.candidate && socket && roomIdRef.current) {
        socket.emit('webrtc_ice', { roomId: roomIdRef.current, candidate: e.candidate });
      }
    };

    if (isInitiator) {
      try {
        const offer = await peer.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await peer.setLocalDescription(offer);
        socket?.emit('webrtc_offer', { roomId: roomIdRef.current, offer });
        console.debug('[webrtc] sent offer', { room: roomIdRef.current });
      } catch (err) {
        console.error('[webrtc] createPeer offer error', err);
      }
    }
    return peer;
  }, [socket, roomIdRef]);

  const handleOffer = useCallback(async (offer, stream) => {
    if (peerRef.current) { peerRef.current.close(); peerRef.current = null; }
    const peer = new RTCPeerConnection(ICE_SERVERS);
    peerRef.current = peer;

    peer.ontrack = (e) => {
      console.debug('[webrtc] ontrack (answerer)', e.streams[0]?.getTracks().map(t=>t.kind));
      setRemoteStream(e.streams[0]);
    };
    peer.onicecandidate = (e) => {
      if (e.candidate && socket && roomIdRef.current) {
        socket.emit('webrtc_ice', { roomId: roomIdRef.current, candidate: e.candidate });
      }
    };

    try {
      await peer.setRemoteDescription(new RTCSessionDescription(offer));

      const s = stream || localStreamRef.current;
      s?.getTracks().forEach(track => {
        console.debug('[webrtc] adding local track (answerer)', track.kind, 'enabled=', track.enabled);
        peer.addTrack(track, s);
      });
      try { console.debug('[webrtc] senders (answerer)', peer.getSenders().map(s => s.track?.kind)); } catch {}

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket?.emit('webrtc_answer', { roomId: roomIdRef.current, answer });
      console.debug('[webrtc] sent answer', { room: roomIdRef.current });
    } catch (err) {
      console.error('[webrtc] handleOffer error', err);
    }
  }, [socket, roomIdRef]);

  const handleAnswer = useCallback(async (answer) => {
    try {
      await peerRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
      console.debug('[webrtc] remote answer applied');
    } catch (err) {
      console.error('[webrtc] handleAnswer error', err);
    }
  }, []);

  const handleIce = useCallback(async (candidate) => {
    try {
      await peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('[webrtc] addIceCandidate error', err);
    }
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