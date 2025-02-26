import React, { useEffect, useState, useContext } from 'react';
import dgram from 'react-native-udp';
import UdpSockets from 'react-native-udp/lib/types/UdpSocket';
import SocketContext from '../context/SocketContext';

export const DISCOVERY_PORT = 55555;
export const BROADCAST_IP = '255.255.255.255';

// Provider Component
export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<UdpSockets | null>(null);

    useEffect(() => {
        console.log('"Initializing socket..."');

        const udpSocket = dgram.createSocket({ type: 'udp4' });

        udpSocket.bind(DISCOVERY_PORT, (err?: Error) => {
            if (err) {
                console.error('"Socket bind failed:"', err);
                return;
            }
            console.log(`Socket bound successfully via SocketProvider at ${Date.now().toLocaleString()}`);

            udpSocket.setBroadcast(true);

            setSocket(udpSocket); // Ensure the state is updated
        });

        return () => {
            console.log('"Closing socket..."');
            udpSocket.close();
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context){
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};
