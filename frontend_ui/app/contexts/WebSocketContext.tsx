"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface WebSocketContextType {
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [wsConnected, setWsConnected] = useState(false);

  return (
    <WebSocketContext.Provider value={{ wsConnected, setWsConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}
