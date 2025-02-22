import React, { useEffect } from 'react';
import { View, Text, Button } from 'react-native';
import RNFS from 'react-native-fs';
import dgram from 'react-native-udp';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { Buffer } from 'buffer';

type Props = {
    route: RouteProp<RootStackParamList, 'FileTransfer'>;
};

const PORT = 55555;

const FileTransferScreen: React.FC<Props> = ({ route }) => {
    const { deviceIP } = route.params;
    const socket = dgram.createSocket({
        type: 'udp4',
    });

    useEffect((): any => {
        try {
            socket.bind(PORT, () => console.log('"Socket bound for file transfer"'));
            return () => socket.close();
        } catch (error) {
            return () => socket.close();
        }
    }, [socket]);

    const sendFile = async () => {
        try {

            const filePath = `${RNFS.DocumentDirectoryPath}/test.txt`;
            const fileData = await RNFS.readFile(filePath, 'base64');
            const fileBuffer = Buffer.from(fileData, 'base64');

            const message = JSON.stringify({ type: 'FILE', chunk: fileBuffer.toString('base64') });
            socket.send(Buffer.from(message), 0, message.length, PORT, deviceIP, (err) => {
                if (err) {
                    console.log('"File Send Error:"', err);
                }
                else {
                    console.log('"File sent!"');
                }
            });
        } catch (error) {

        }
    };

    return (
        <View style={{ padding: 20 }}>
            <Text>Send File to {deviceIP}</Text>
            <Button title="Send File" onPress={sendFile} />
        </View>
    );
};

export default FileTransferScreen;
