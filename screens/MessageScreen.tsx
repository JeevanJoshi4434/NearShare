import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, BackHandler, Alert } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { Buffer } from 'buffer';
import { DISCOVERY_PORT, useSocket } from '../providers/SocketProvider';

type Props = {
    route: RouteProp<RootStackParamList, 'Message'>;
    navigation: StackNavigationProp<RootStackParamList, 'Message'>;
};


interface Message {
    text: string;
    sender: string;
    timestamp: string;
}

const MessageScreen: React.FC<Props> = ({ route, navigation }) => {
    const { socket, deviceName } = useSocket();
    const { deviceIP, myIP } = route.params;
    const [message, setMessage] = useState('');
    const [receivedMessages, setReceivedMessages] = useState<Message[]>([]);

    useEffect(() => {
        // Define message handler
        const handleMessage = (msg: Buffer, rinfo: any) => {
            try {
                const data = JSON.parse(msg.toString());
                if (data.type === 'MESSAGE' && rinfo.address === deviceIP) {
                    console.log(`Received message: ${data.text} from ${rinfo.address}`);
                    setReceivedMessages(prev => [
                        ...prev,
                        {
                            text: data.text,
                            sender: rinfo.address,
                            timestamp: new Date().toLocaleTimeString(),
                        },
                    ]);
                } else if (data.type === 'CONNECTION_REQUEST') {
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
                                    if (deviceIP !== rinfo.address) {
                                        navigation.replace('Message', { 
                                            deviceIP: rinfo.address, 
                                            myIP 
                                        });
                                    }
                                } 
                            },
                        ]
                    );
                } else if (data.type === 'CHAT_ENDED' && rinfo.address === deviceIP) {
                    // If the other user ended the chat, show notification and return to main
                    Alert.alert(
                        'Chat Ended',
                        `The other user has ended the chat.`,
                        [{ text: 'OK', onPress: () => navigation.navigate('Main') }]
                    );
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };

        // First remove any existing listeners to prevent duplicates
        socket?.removeAllListeners('message');
        
        // Add the message listener
        socket?.on('message', handleMessage);

        // Handle Back Button
        const backAction = () => {
            Alert.alert(
                'Exit Chat?',
                'Are you sure you want to leave the chat?',
                [
                    { text: 'Cancel', style: 'cancel', onPress: () => null },
                    { text: 'Exit', onPress: () => handleExit() },
                ]
            );
            return true;
        };

        const handleExit = () => {
            // Send notification to other user that we're leaving
            if (socket && myIP) {
                try {
                    const exitMsg = JSON.stringify({
                        type: 'CHAT_ENDED',
                        sender: myIP,
                        senderName: deviceName
                    });
                    
                    socket.send(
                        Buffer.from(exitMsg),
                        0,
                        exitMsg.length,
                        DISCOVERY_PORT,
                        deviceIP,
                        (err) => {
                            if (err) {
                                console.error('Failed to send exit notification:', err);
                            } else {
                                console.log('Exit notification sent');
                            }
                        }
                    );
                } catch (error) {
                    console.error('Error sending exit notification:', error);
                }
            }
            
            // Navigate back to main screen
            navigation.navigate('Main');
        };

        BackHandler.addEventListener('hardwareBackPress', backAction);

        // Return cleanup function
        return () => {
            // Remove the message listener when component unmounts
            socket?.removeListener('message', handleMessage);
            BackHandler.removeEventListener('hardwareBackPress', backAction);
        };
    }, [socket, navigation, deviceIP, myIP, deviceName]);

    const sendMessage = () => {
        if (!message.trim() || !myIP){
            return;
        }
        console.log(socket);
        try {
            const msg = JSON.stringify({
                type: 'MESSAGE',
                text: message,
                sender: myIP,
            });
            console.log({status:'Preprocessing message', msg});
            socket?.send(Buffer.from(msg), 0, msg.length, DISCOVERY_PORT, deviceIP, (err) => {
                if (err){
                    console.error({status:'Failed to send message', err});
                    }
                else {
                    console.log({status:'Message sent', msg});
                }
            });

            setReceivedMessages(prev => [
                ...prev,
                { text: message, sender: myIP, timestamp: new Date().toLocaleTimeString() },
            ]);
            setMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
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
            <Text>Chat with {deviceIP}</Text>
            <ScrollView style={styles.messagesContainer}>
                {receivedMessages.map((msg, index) => (
                    <View key={index} style={[
                        styles.messageContainer,
                        msg.sender === myIP ? styles.sentMessage : styles.receivedMessage,
                    ]}>
                        <Text style={styles.messageText}>{msg.text}</Text>
                        <Text style={styles.timestamp}>{msg.timestamp}</Text>
                    </View>
                ))}
            </ScrollView>

            <TextInput
                style={styles.input}
                placeholder="Enter message"
                value={message}
                onChangeText={setMessage}
            />
            <Button title="Send" onPress={sendMessage} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    messagesContainer: { flex: 1, marginVertical: 10 },
    messageContainer: {
        padding: 10,
        borderRadius: 10,
        marginBottom: 5,
        maxWidth: '75%',
    },
    sentMessage: {
        alignSelf: 'flex-end',
        backgroundColor: '#007bff', // Blue for sender
    },
    receivedMessage: {
        alignSelf: 'flex-start',
        backgroundColor: '#e0e0e0', // Gray for receiver
    },
    messageText: { fontSize: 16, color: 'white' },
    timestamp: { fontSize: 12, color: 'white', marginTop: 3, textAlign: 'right' },
    input: { borderWidth: 1, padding: 10, marginVertical: 10 },
});

export default MessageScreen;
