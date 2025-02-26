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
    let {socket} = useSocket();
    const { deviceIP, myIP } = route.params;
    const [message, setMessage] = useState('');
    const [receivedMessages, setReceivedMessages] = useState<Message[]>([]);

    useEffect(() => {
        const handleExit = () => {
            console.log('Exiting chat... returning to main screen.');
            navigation.navigate('Main');
        };

            socket?.on('message', (msg, rinfo) => {
                try {
                    console.log({status:'Received message', msg});
                    const data = JSON.parse(msg.toString());
                    if (data.type === 'MESSAGE') {
                        console.log(`Received message: ${data.text} from ${rinfo.address}`);
                        setReceivedMessages(prev => [
                            ...prev,
                            {
                                text: data.text,
                                sender: rinfo.address,
                                timestamp: new Date().toLocaleTimeString(),
                            },
                        ]);
                    }
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            });

        // Handle Back Button
        const backAction = () => {
            Alert.alert(
                'Exit Chat?',
                'Are you sure you want to leave the chat?',
                [
                    { text: 'Cancel', style: 'cancel', onPress: () => null },
                    { text: 'Exit', onPress: handleExit },
                ]
            );
            return true;
        };

        BackHandler.addEventListener('hardwareBackPress', backAction);

        return () => {
            console.log('Cleaning up...');
            // BackHandler.removeEventListener('hardwareBackPress', backAction);
        };
    }, [socket, navigation]);

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
