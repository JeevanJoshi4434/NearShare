import React, { useEffect, useState, useContext, createContext } from 'react';
import dgram from 'react-native-udp';
import UdpSockets from 'react-native-udp/lib/types/UdpSocket';
import { generateRandomName } from '../utils/converter';

// Create a context to store both socket and device name
type SocketContextType = {
  socket: UdpSockets | null;
  deviceName: string;
};

const SocketContext = createContext<SocketContextType>({ 
  socket: null, 
  deviceName: 'Unknown Device' 
});

export const DISCOVERY_PORT = 55555;

export const getBroadcastAddress = (ipAddress: string | null): string => {
  if (!ipAddress) return '255.255.255.255';
  // Convert IP like 192.168.1.2 to 192.168.1.255
  const parts = ipAddress.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.255`;
  }
  return '255.255.255.255';
};

// Provider Component
export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<UdpSockets | null>(null);
    const [deviceName] = useState<string>(generateRandomName());

    useEffect(() => {
        console.log('Initializing socket...');

        const udpSocket = dgram.createSocket({ type: 'udp4' });

        udpSocket.bind(DISCOVERY_PORT, (err?: Error) => {
            if (err) {
                console.error('Socket bind failed:', err);
                return;
            }
            console.log(`Socket bound successfully via SocketProvider at ${Date.now().toLocaleString()}`);

            udpSocket.setBroadcast(true);

            setSocket(udpSocket); // Ensure the state is updated
        });

        return () => {
            console.log('Closing socket...');
            if (udpSocket) {
                udpSocket.removeAllListeners();
                udpSocket.close();
            }
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket, deviceName }}>
            {children}
        </SocketContext.Provider>
    );
};

// Hook to use the socket context
export const useSocket = () => useContext(SocketContext);
