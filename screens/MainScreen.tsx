import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Button, Alert } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { NetworkInfo } from 'react-native-network-info';
import { Buffer } from 'buffer';
import { DISCOVERY_PORT, useSocket, getBroadcastAddress } from '../providers/SocketProvider';
import { generateRandomName } from '../utils/converter';
 

type Props = {
    navigation: StackNavigationProp<RootStackParamList, 'Main'>;
};

interface Device {
    ip: string;
    name: string;
}

const MainScreen: React.FC<Props> = ({ navigation }) => {
    const [devices, setDevices] = useState<Device[]>([]);
    const [myIP, setMyIP] = useState<string | null>(null);
    const { socket, deviceName } = useSocket();

    useEffect(() => {
        // Get device IP address (Local IP)
        NetworkInfo.getIPV4Address().then(ip => {
            if (ip) {
                console.log('My Device IP:', ip);
                setMyIP(ip);
            }
        });
        
        // Define message handler function
        const handleMessage = (msg: Buffer, rinfo: any) => {
            try {
                const data = JSON.parse(msg.toString());
                
                // Skip processing messages from self
                if (rinfo.address === myIP) {
                    return;
                }
                
                console.log(`Received ${data.type} from ${rinfo.address}`);
                
                if (data.type === 'DISCOVERY_RESPONSE') {
                    setDevices(prev => {
                        const ipFromMessage = data.ip || rinfo.address;
                        const exists = prev.some(dev => dev.ip === ipFromMessage);
                        return exists ? prev : [...prev, { ip: ipFromMessage, name: data.deviceName }];
                    });
                } else if (data.type === 'DISCOVERY') {
                    // Send response back
                    const response = JSON.stringify({ 
                        type: 'DISCOVERY_RESPONSE', 
                        deviceName, 
                        ip: myIP 
                    });
                    
                    socket?.send(
                        Buffer.from(response), 
                        0, 
                        response.length, 
                        DISCOVERY_PORT, 
                        rinfo.address, 
                        (err) => {
                            if (err) {
                                console.log('Error sending response:', err);
                            } else {
                                console.log(`Discovery response sent to ${rinfo.address}`);
                            }
                        }
                    );
                } else if (data.type === 'CONNECTION_REQUEST') {
                    // Handle connection request in MainScreen
                    Alert.alert(
                        'Connection Request',
                        `${data.senderName || 'Someone'} (${rinfo.address}) wants to connect with you.`,
                        [
                            { 
                                text: 'Decline', 
                                style: 'cancel',
                                onPress: () => sendConnectionResponse(rinfo.address, false) 
                            },
                            { 
                                text: 'Accept', 
                                onPress: () => {
                                    sendConnectionResponse(rinfo.address, true);
                                    navigation.navigate('Message', { 
                                        deviceIP: rinfo.address, 
                                        myIP 
                                    });
                                } 
                            },
                        ]
                    );
                } else if (data.type === 'CHAT_ENDED') {
                    // If the other user ended the chat, show notification and return to main
                    if (navigation.isFocused()) {
                        // Only show alert if we're on the main screen
                        Alert.alert(
                            'Chat Ended',
                            `${data.senderName || 'The other user'} has ended the chat.`,
                            [{ text: 'OK' }]
                        );
                    } else {
                        // If we're in the message screen, navigation will handle this
                        console.log('Received chat ended notification');
                    }
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        };
        
        // First remove any existing listeners to prevent duplicates
        socket?.removeAllListeners('message');
        
        // Then add the message listener
        socket?.on('message', handleMessage);
        
        // Return cleanup function
        return () => {
        // Remove the message listener when component unmounts
        socket?.off('message', handleMessage);
        };
    }, [myIP, socket, navigation, deviceName]);

    const discoverDevices = () => {
        try {
            if (!socket || !myIP) {
                return;
            }
            
            const broadcastAddress = getBroadcastAddress(myIP);
            console.log(`Sending discovery request to ${broadcastAddress}...`);
            
            const message = JSON.stringify({ 
                type: 'DISCOVERY', 
                deviceName,
                ip: myIP
            });

            socket.send(
                Buffer.from(message), 
                0, 
                message.length, 
                DISCOVERY_PORT, 
                broadcastAddress, 
                (err) => {
                    if (err) {
                        console.log('Discovery error:', err);
                    } else {
                        console.log('Discovery request sent!');
                    }
                }
            );
        } catch (error) {
            console.error('Error sending discovery request:', error);
        }
    };

    const addMyDevice = () => {
        if (myIP) {
            setDevices(prev => {
                const exists = prev.some(dev => dev.ip === myIP);
                return exists ? prev : [...prev, { ip: myIP, name: deviceName }];
            });
        }
    };

    const sendConnectionResponse = (targetIP: string, accepted: boolean) => {
        if (!socket || !myIP) return;
        
        try {
            const response = JSON.stringify({
                type: 'CONNECTION_RESPONSE',
                accepted,
                sender: myIP
            });
            
            socket.send(
                Buffer.from(response),
                0,
                response.length,
                DISCOVERY_PORT,
                targetIP,
                (err) => {
                    if (err) {
                        console.error('Failed to send connection response:', err);
                    } else {
                        console.log(`Connection ${accepted ? 'accepted' : 'declined'}`);
                    }
                }
            );
        } catch (error) {
            console.error('Error sending connection response:', error);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Available Devices</Text>
            <Text>My Device: {deviceName}</Text>
            <Text>{devices.length} devices found</Text>

            <FlatList
                data={devices}
                keyExtractor={(item) => item.ip}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.deviceItem}
                        onPress={() => {
                            navigation.navigate('ConnectionRequest', { 
                                deviceIP: item.ip, 
                                deviceName: item.name,
                                myIP 
                            });
                        }}
                    >
                        <Text>{item.name}</Text>
                    </TouchableOpacity>
                )}
            />

            <Button title="Discover Nearby Devices" onPress={discoverDevices} />
            <View style={styles.button}>
                <Button title="Add My Device" color="#007bff" onPress={addMyDevice} />
            </View>
        </View>
    );
};
 

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    header: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
    deviceItem: { padding: 10, borderBottomWidth: 1 },
    button: { marginTop: 10 },
});

export default MainScreen;
