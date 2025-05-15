import React, { useState } from 'react';
import { View, Text, Button, Alert, StyleSheet, ProgressBarAndroid, Platform } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import FilePicker from '../fileSharing/FilePicker';
import FileSender from '../fileSharing/FileSender';
import FileReceiver from '../fileSharing/FileReceiver';

type Props = {
    route: RouteProp<RootStackParamList, 'FileTransfer'>;
};

const FileTransferScreen: React.FC<Props> = ({ route }) => {
    const { deviceIP } = route.params;
    const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string; size: number } | null>(null);
    const [progress, setProgress] = useState(0);
    const [receivingProgress, setReceivingProgress] = useState(0);
    const [receivedFilePath, setReceivedFilePath] = useState<string | null>(null);

    const onFileSelected = (uri: string, name: string, size: number) => {
        setSelectedFile({ uri, name, size });
        setProgress(0);
    };

    const onSendComplete = () => {
        Alert.alert('File Sent', 'File has been sent successfully.');
        setSelectedFile(null);
        setProgress(0);
    };

    const onSendError = (error: Error) => {
        Alert.alert('Send Error', error.message);
    };

    const onFileReceived = (filePath: string, fileName: string) => {
        Alert.alert('File Received', `File ${fileName} received and saved.`);
        setReceivedFilePath(filePath);
        setReceivingProgress(0);
    };

    const onReceiveError = (error: Error) => {
        Alert.alert('Receive Error', error.message);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Send File to {deviceIP}</Text>
            <FilePicker onFileSelected={onFileSelected} />
            {selectedFile && (
                <>
                    <Text>Selected File: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)</Text>
                    <Button
                        title="Send File"
                        onPress={() => {
                            if (selectedFile) {
                                // FileSender is a component that sends file on mount
                                // We render it conditionally to trigger sending
                                setProgress(0);
                            }
                        }}
                    />
                    <ProgressBar progress={progress} />
                </>
            )}
            {receivedFilePath && (
                <Text>Received File saved at: {receivedFilePath}</Text>
            )}
            <FileSender
                fileUri={selectedFile?.uri ?? ''}
                fileName={selectedFile?.name ?? ''}
                fileSize={selectedFile?.size ?? 0}
                targetIP={deviceIP}
                onProgress={setProgress}
                onComplete={onSendComplete}
                onError={onSendError}
            />
            <FileReceiver
                onFileReceived={onFileReceived}
                onProgress={setReceivingProgress}
                onError={onReceiveError}
            />
        </View>
    );
};

const ProgressBar = ({ progress }: { progress: number }) => {
    if (Platform.OS === 'android') {
        return <ProgressBarAndroid styleAttr="Horizontal" progress={progress / 100} indeterminate={false} />;
    } else {
        return null; // iOS ProgressViewIOS removed due to missing export
    }
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    title: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
});

export default FileTransferScreen;
