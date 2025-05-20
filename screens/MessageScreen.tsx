/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Alert, BackHandler, TouchableOpacity } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { useSocket, DISCOVERY_PORT } from '../providers/SocketProvider';
import { Buffer } from 'buffer';

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
        const handleMessage = (msg: Buffer, rinfo: any) => {
            try {
                const data = JSON.parse(msg.toString());
                if (data.type === 'MESSAGE' && rinfo.address === deviceIP) {
                    // console.log(`Received message: ${data.text} from ${rinfo.address}`);
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
                                onPress: () => sendConnectionResponse(rinfo.address, false),
                            },
                            {
                                text: 'Accept',
                                onPress: () => {
                                    sendConnectionResponse(rinfo.address, true);
                                    if (deviceIP !== rinfo.address) {
                                        navigation.replace('Message', {
                                            deviceIP: rinfo.address,
                                            myIP,
                                        });
                                    }
                                },
                            },
                        ]
                    );
                } else if (data.type === 'CHAT_ENDED' && rinfo.address === deviceIP) {
                    Alert.alert(
                        'Chat Ended',
                        'The other user has ended the chat.',
                        [{ text: 'OK', onPress: () => navigation.navigate('Main') }]
                    );
                }
            } catch (error) {
                // console.error('Error parsing message:', error);
            }
        };

        socket?.removeAllListeners('message');

        socket?.on('message', handleMessage);

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
            if (socket && myIP) {
                try {
                    const exitMsg = JSON.stringify({
                        type: 'CHAT_ENDED',
                        sender: myIP,
                        senderName: deviceName,
                    });

                    socket.send(
                        Buffer.from(exitMsg),
                        0,
                        exitMsg.length,
                        DISCOVERY_PORT,
                        deviceIP,
                        (err) => {
                            if (err) {
                                // console.error('Failed to send exit notification:', err);
                            } else {
                                // console.log('Exit notification sent');
                            }
                        }
                    );
                } catch (error) {
                    // console.error('Error sending exit notification:', error);
                }
            }

            navigation.navigate('Main');
        };

        BackHandler.addEventListener('hardwareBackPress', backAction);

        return () => {
            socket?.removeListener('message', handleMessage);
            if (BackHandler.remove) {
                BackHandler.remove('hardwareBackPress', backAction);
            }
        };
    }, [socket, navigation, deviceIP, myIP, deviceName]);

    const sendMessage = () => {
        if (!message.trim() || !myIP) {
            return;
        }
        // console.log(socket);
        try {
            const msg = JSON.stringify({
                type: 'MESSAGE',
                text: message,
                sender: myIP,
            });
            // console.log({ status: 'Preprocessing message', msg });
            socket?.send(Buffer.from(msg), 0, msg.length, DISCOVERY_PORT, deviceIP, (err) => {
                if (err) {
                    // console.error({ status: 'Failed to send message', err });
                }
                else {
                    // console.log({ status: 'Message sent', msg });
                }
            });

            setReceivedMessages(prev => [
                ...prev,
                { text: message, sender: myIP, timestamp: new Date().toLocaleTimeString() },
            ]);
            setMessage('');
        } catch (error) {
            // console.error('Error sending message:', error);
        }
    };

    const sendConnectionResponse = (targetIP: string, accepted: boolean) => {
        if (!socket || !myIP){
            return;
        }

        try {
            const response = JSON.stringify({
                type: 'CONNECTION_RESPONSE',
                accepted,
                sender: myIP,
            });

            socket.send(
                Buffer.from(response),
                0,
                response.length,
                DISCOVERY_PORT,
                targetIP,
                (err) => {
                    if (err) {
                        // console.error('Failed to send connection response:', err);
                    } else {
                        // console.log(`Connection ${accepted ? 'accepted' : 'declined'}`);
                    }
                }
            );
        } catch (error) {
            // console.error('Error sending connection response:', error);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.headerText}>Chat with {deviceIP}</Text>
            <ScrollView
                style={styles.messagesContainer}
                ref={ref => {
                    if (ref) {
                        ref.scrollToEnd({ animated: true });
                    }
                }}
            >
                {receivedMessages.map((msg, index) => (
                    <View key={index} style={[
                        styles.messageContainer,
                        msg.sender === myIP ? styles.sentMessage : styles.receivedMessage,
                    ]}>
                        <Text style={[
                            styles.messageText,
                            msg.sender === myIP ? styles.sentMessageText : styles.receivedMessageText,
                        ]}>
                            {msg.text}
                        </Text>
                        <Text style={[
                            styles.timestamp,
                            msg.sender === myIP ? styles.sentTimestamp : styles.receivedTimestamp,
                        ]}>
                            {msg.timestamp}
                        </Text>
                    </View>
                ))}
            </ScrollView>

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Enter message"
                    value={message}
                    onChangeText={setMessage}
                    multiline={false}
                    returnKeyType="send"
                    onSubmitEditing={sendMessage}
                />
                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={styles.sendButton}
                        onPress={sendMessage}
                        disabled={!message.trim()}
                    >
                        <Text>📨</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.attachButton}
                        onPress={() => navigation.navigate('FileTransfer', { deviceIP })}
                    >
                        <Text>📁</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 10,
        backgroundColor: '#f5f5f5',
    },
    headerText: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
    },
    messagesContainer: {
        flex: 1,
        marginVertical: 10,
    },
    messageContainer: {
        padding: 10,
        borderRadius: 15,
        marginBottom: 8,
        maxWidth: '75%',
        elevation: 1,
    },
    sentMessage: {
        alignSelf: 'flex-end',
        backgroundColor: '#007bff',
        borderBottomRightRadius: 5,
    },
    receivedMessage: {
        alignSelf: 'flex-start',
        backgroundColor: '#e0e0e0',
        borderBottomLeftRadius: 5,
    },
    messageText: {
        fontSize: 16,
    },
    sentMessageText: {
        color: 'white',
    },
    receivedMessageText: {
        color: 'black',
    },
    timestamp: {
        fontSize: 12,
        marginTop: 3,
        textAlign: 'right',
    },
    sentTimestamp: {
        color: 'rgba(255, 255, 255, 0.7)',
    },
    receivedTimestamp: {
        color: 'rgba(0, 0, 0, 0.5)',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 20,
        padding: 10,
        backgroundColor: 'white',
        marginRight: 8,
    },
    buttonContainer: {
        flexDirection: 'row',
    },
    sendButton: {
        backgroundColor: '#007bff',
        borderRadius: 25,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    attachButton: {
        backgroundColor: '#4CAF50',
        borderRadius: 25,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default MessageScreen;
