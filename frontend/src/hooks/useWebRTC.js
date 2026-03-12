import{useRef,useState,useCallback}from"react";
const ICE={iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"},{urls:"turn:openrelay.metered.ca:80",username:"openrelayproject",credential:"openrelayproject"},{urls:"turn:openrelay.metered.ca:443",username:"openrelayproject",credential:"openrelayproject"},{urls:"turn:openrelay.metered.ca:443?transport=tcp",username:"openrelayproject",credential:"openrelayproject"}]};
export function useWebRTC(socket,roomId){
const peerRef=useRef(null);const localStreamRef=useRef(null);
const[localStream,setLocalStream]=useState(null);const[remoteStream,setRemoteStream]=useState(null);const[mediaError,setMediaError]=useState(null);
const startMedia=useCallback(async(video=true,audio=true)=>{try{const s=await navigator.mediaDevices.getUserMedia({audio,video:video?{width:{ideal:640},height:{ideal:480},facingMode:"user"}:false});localStreamRef.current=s;setLocalStream(s);return s;}catch(e){setMediaError(e.message);return null;}},[]);
const createPeer=useCallback((isInit,stream)=>{const peer=new RTCPeerConnection(ICE);peerRef.current=peer;stream?.getTracks().forEach(t=>peer.addTrack(t,stream));peer.ontrack=e=>setRemoteStream(e.streams[0]);peer.onicecandidate=e=>{if(e.candidate&&socket&&roomId)socket.emit("webrtc_ice",{roomId,candidate:e.candidate});};if(isInit){peer.createOffer().then(o=>{peer.setLocalDescription(o);socket?.emit("webrtc_offer",{roomId,offer:o});});}return peer;},[socket,roomId]);
const handleOffer=useCallback(async offer=>{const s=localStreamRef.current;const peer=createPeer(false,s);await peer.setRemoteDescription(new RTCSessionDescription(offer));const ans=await peer.createAnswer();await peer.setLocalDescription(ans);socket?.emit("webrtc_answer",{roomId,answer:ans});},[createPeer,socket,roomId]);
const handleAnswer=useCallback(async ans=>{await peerRef.current?.setRemoteDescription(new RTCSessionDescription(ans));},[]);
const handleIce=useCallback(async c=>{try{await peerRef.current?.addIceCandidate(new RTCIceCandidate(c));}catch{}},[]);
const stopMedia=useCallback(()=>{localStreamRef.current?.getTracks().forEach(t=>t.stop());peerRef.current?.close();peerRef.current=null;setLocalStream(null);setRemoteStream(null);},[]);
return{localStream,remoteStream,mediaError,startMedia,createPeer,handleOffer,handleAnswer,handleIce,stopMedia};
}
