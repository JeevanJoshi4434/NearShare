import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Button } from 'react-native';
import dgram from 'react-native-udp';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { NetworkInfo } from 'react-native-network-info';
import { Buffer } from 'buffer';

type Props = {
    navigation: StackNavigationProp<RootStackParamList, 'Main'>;
};

interface Device {
    ip: string;
    name: string;
}

const DISCOVERY_PORT = 55555;
const BROADCAST_IP = '255.255.255.255';

const MainScreen: React.FC<Props> = ({ navigation }) => {
    const [devices, setDevices] = useState<Device[]>([]);
    const [myIP, setMyIP] = useState<string | null>(null);
    const [deviceName, setDeviceName] = useState<string>('Unknown Device');
    const socket = dgram.createSocket({ type: 'udp4' });

    useEffect((): any => {
        // Get device IP
        NetworkInfo.getIPV4Address().then(ip => {
            if (ip) {
                console.log('My Device IP:', ip);
                setMyIP(ip);
            }
        });

        // Get real device name or generate a random one
        setDeviceName(generateRandomName());


        try {
            socket.bind(DISCOVERY_PORT, () => {
                console.log('Socket bound');
                socket.setBroadcast(true);
            });

            // Listen for responses from other devices
            socket.on('message', (msg, rinfo) => {
                const data = JSON.parse(msg.toString());
                if (data.type === 'DISCOVERY_RESPONSE') {
                    setDevices(prev => {
                        const exists = prev.some(dev => dev.ip === rinfo.address);
                        return exists ? prev : [...prev, { ip: rinfo.address, name: data.deviceName }];
                    });
                }
            });

            socket.on('message', (msg, rinfo) => {
                const data = JSON.parse(msg.toString());

                if (data.type === 'DISCOVERY') {
                    if (rinfo.address === myIP) {
                        return;
                    }
                    console.log(`Discovery request received from ${rinfo.address}`);

                    // Send response back with the actual or random device name
                    const response = JSON.stringify({ type: 'DISCOVERY_RESPONSE', deviceName });
                    socket.send(Buffer.from(response), 0, response.length, DISCOVERY_PORT, rinfo.address, (err) => {
                        if (err) console.log('Error sending response:', err);
                    });
                }
            });

        } catch (error) {
            console.error('Error:', error);
        }

        return () => socket.close();
    }, [socket, myIP, deviceName]);

    const discoverDevices = () => {
        try {
            if (!socket) return;
            console.log('"Sending discovery request..."');
            const message = JSON.stringify({ type: 'DISCOVERY', deviceName });

            socket.send(Buffer.from(message), 0, message.length, DISCOVERY_PORT, BROADCAST_IP, (err) => {
                if (err) console.log('Discovery error:', err);
                else console.log('Discovery request sent!');
            });
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
                            socket.close();
                            navigation.navigate('Message', { deviceIP: item.ip, myIP });
                        }}
                    >
                        <Text>{item.name}</Text> {/* Hide IP, Show Name */}
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

const generateRandomName = (): string => {
    const adjectives = ["Fast", "Smart", "Cool", "Brave", "Silent", "Clever"];
    const nouns = ["Tiger", "Eagle", "Dragon", "Panther", "Falcon", "Wolf"];
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${randomAdjective} ${randomNoun}`;
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    header: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
    deviceItem: { padding: 10, borderBottomWidth: 1 },
    button: { marginTop: 10 },
});

export default MainScreen;
