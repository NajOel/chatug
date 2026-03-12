import React,{createContext,useContext,useEffect,useRef,useState}from"react";
import{io}from"socket.io-client";
const SocketContext=createContext(null);
export function SocketProvider({children}){
const socketRef=useRef(null);
const[connected,setConnected]=useState(false);
const[onlineCount,setOnlineCount]=useState(0);
useEffect(()=>{
socketRef.current=io("http://192.168.1.134:4000",{transports:["websocket","polling"],reconnectionAttempts:5});
socketRef.current.on("connect",()=>setConnected(true));
socketRef.current.on("disconnect",()=>setConnected(false));
const poll=setInterval(async()=>{try{const r=await fetch("/api/stats");const d=await r.json();setOnlineCount(d.online||0);}catch{}},8000);
return()=>{clearInterval(poll);socketRef.current?.disconnect();};
},[]);
return <SocketContext.Provider value={{socket:socketRef.current,connected,onlineCount}}>{children}</SocketContext.Provider>;
}
export const useSocket=()=>useContext(SocketContext);
