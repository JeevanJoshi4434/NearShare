/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import { View, Text, Alert, StyleSheet, Platform, PermissionsAndroid, TouchableOpacity, ActivityIndicator } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import FilePicker from '../fileSharing/FilePicker';
import FileSender from '../fileSharing/FileSender';
import FileReceiver from '../fileSharing/FileReceiver';
import RNFS from 'react-native-fs';

type Props = {
    route: RouteProp<RootStackParamList, 'FileTransfer'>;
    navigation: StackNavigationProp<RootStackParamList, 'FileTransfer'>;
};

const FileTransferScreen: React.FC<Props> = ({ route, navigation }) => {
    const { deviceIP } = route.params;
    const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string; size: number } | null>(null);
    const [progress, setProgress] = useState(0);
    const [isSending, setIsSending] = useState(false);
    const [receivingProgress, setReceivingProgress] = useState(0);
    const [isReceiving, setIsReceiving] = useState(false);
    const [receivedFilePath, setReceivedFilePath] = useState<string | null>(null);
    const [receivedFileName, setReceivedFileName] = useState<string | null>(null);
    const [permissionsChecked, setPermissionsChecked] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFileReceived, setIsFileReceived] = useState(false);

    useEffect(() => {
        const checkPermissions = async () => {
            if (Platform.OS === 'android') {
                try {
                    let granted = false;

                    if (Platform.Version >= 33) {
                        const permissions = [
                            PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
                            PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
                            PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
                        ];

                        if (Platform.Version >= 34) {
                            permissions.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VISUAL_USER_SELECTED);
                        }

                        const results = await PermissionsAndroid.requestMultiple(permissions);
                        granted = Object.values(results).every(
                            result => result === PermissionsAndroid.RESULTS.GRANTED
                        );
                    } else {
                        const result = await PermissionsAndroid.request(
                            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
                        );
                        granted = result === PermissionsAndroid.RESULTS.GRANTED;
                    }

                    if (!granted) {
                        Alert.alert(
                            'Permission Required',
                            'File sharing requires storage permissions. Some features may not work properly.',
                            [{ text: 'OK' }]
                        );
                    }

                    setPermissionsChecked(true);
                } catch (err) {
                    // console.error('Error checking permissions:', err);
                    setPermissionsChecked(true);
                }
            } else {
                setPermissionsChecked(true);
            }
        };

        checkPermissions();
    }, []);

    const onFileSelected = (uri: string, name: string, size: number) => {
        setSelectedFile({ uri, name, size });
        setProgress(0);
        setIsSending(false);
        setError(null);
    };

    const onSendComplete = () => {
        Alert.alert('File Sent', 'File has been sent successfully.');
        setProgress(100);
        setTimeout(() => {
            setSelectedFile(null);
            setProgress(0);
            setIsSending(false);
        }, 2000);
    };

    const onSendError = (err: Error) => {
        setError(`Send Error: ${err.message}`);
        Alert.alert('Send Error', err.message);
        setIsSending(false);
    };

    const onFileReceived = (filePath: string, fileName: string) => {
        setReceivedFilePath(filePath);
        setReceivedFileName(fileName);
        Alert.alert(
            'File Received',
            `File ${fileName} received and saved.`,
            [
                {
                    text: 'View File Info',
                    onPress: async () => {
                        try {
                            const fileInfo = await RNFS.stat(filePath);
                            Alert.alert(
                                'File Details',
                                `Name: ${fileName}\nSize: ${(fileInfo.size / 1024).toFixed(2)} KB\nPath: ${filePath}`
                            );
                        } catch (err) {
                            // console.error('Error getting file info:', err);
                            Alert.alert('Error', 'Could not get file information');
                        }
                    },
                },
                { text: 'OK' },
            ]
        );
        setReceivingProgress(0);
        setIsReceiving(false);
    };

    const onReceiveError = (err: Error) => {
        setError(`Receive Error: ${err.message}`);
        Alert.alert('Receive Error', err.message);
        setIsReceiving(false);
        setReceivingProgress(0);
    };

    const onReceiveCancel = () => {
        setIsReceiving(false);
        setReceivingProgress(0);
        setError(null);
        Alert.alert('Transfer Cancelled', 'File transfer has been cancelled.');
    };

    const handleSendProgress = (value: number) => {
        setProgress(value);
        if (!isSending && value > 0) {
            setIsSending(true);
        }
    };

    const handleReceiveProgress = (value: number) => {
        setReceivingProgress(value);
        if (!isReceiving && value > 0) {
            setIsReceiving(true);
        }
    };

    const handleCancelReceive = () => {
        Alert.alert(
            'Cancel Transfer',
            'Are you sure you want to cancel receiving the file?',
            [
                {
                    text: 'No',
                    style: 'cancel',
                },
                {
                    text: 'Yes',
                    style: 'destructive',
                    onPress: () => {
                        setIsReceiving(false);
                        setReceivingProgress(0);
                    },
                },
            ],
            { cancelable: false }
        );
    };

    const ProgressBar = ({ progress }: { progress: number }) => {
        if (progress <= 0) return null;

        return (
            <View style={styles.progressContainer}>
                <View style={styles.progressBackground}>
                    <View style={[styles.progressBar, { width: `${progress}%` }]} />
                </View>
                <Text style={styles.progressText}>{progress.toFixed(1)}%</Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>File Transfer with {deviceIP}</Text>

            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity onPress={() => setError(null)}>
                        <Text style={styles.dismissText}>Dismiss</Text>
                    </TouchableOpacity>
                </View>
            )}

            <FilePicker onFileSelected={onFileSelected} />

            {selectedFile && selectedFile.name && selectedFile.size && (
                <View style={styles.fileInfoContainer}>
                    <Text style={styles.fileNameText}>Selected File: {selectedFile.name}</Text>
                    <Text style={styles.fileSizeText}>Size: {(selectedFile.size / 1024).toFixed(2)} KB</Text>

                    {!isSending ? (
                        <TouchableOpacity
                            style={styles.sendButton}
                            onPress={() => {
                                if (selectedFile) {
                                    setIsSending(true);
                                    setError(null);
                                }
                            }}
                        >
                            <Text style={styles.sendButtonText}>Send File</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.sendingContainer}>
                            <Text style={styles.sendingText}>Sending file...</Text>
                            <ProgressBar progress={progress} />
                        </View>
                    )}
                </View>
            )}

            {isReceiving && (
                <View style={styles.receivingContainer}>
                    <Text style={styles.receivingText}>Receiving file...</Text>
                    <ActivityIndicator size="small" color="#4CAF50" style={styles.activityIndicator} />
                    <ProgressBar progress={receivingProgress} />
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={handleCancelReceive}
                    >
                        <Text style={styles.cancelButtonText}>Cancel Transfer</Text>
                    </TouchableOpacity>
                </View>
            )}

            {receivedFileName && (
                <View style={styles.receivedFileContainer}>
                    <Text style={styles.receivedFileTitle}>File Received</Text>
                    <Text style={styles.receivedFileName}>Name: {receivedFileName}</Text>
                    <Text style={styles.receivedFilePath}>Saved at: {receivedFilePath}</Text>
                </View>
            )}

            <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
            >
                <Text style={styles.backButtonText}>Back to Chat</Text>
            </TouchableOpacity>

            {isSending && selectedFile && (
                <FileSender
                    fileUri={selectedFile.uri}
                    fileName={selectedFile.name}
                    fileSize={selectedFile.size}
                    targetIP={deviceIP}
                    onProgress={handleSendProgress}
                    onComplete={onSendComplete}
                    onError={onSendError}
                />
            )}

            <FileReceiver
                onFileReceived={onFileReceived}
                onProgress={handleReceiveProgress}
                onError={onReceiveError}
                onCancel={onReceiveCancel}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    errorContainer: {
        backgroundColor: '#ffebee',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#ef5350',
    },
    errorText: {
        color: '#d32f2f',
        fontSize: 14,
    },
    dismissText: {
        color: '#1976d2',
        fontSize: 14,
        textAlign: 'right',
        marginTop: 8,
    },
    fileInfoContainer: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 8,
        marginVertical: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
    },
    fileNameText: {
        fontSize: 16,
        fontWeight: '500',
    },
    fileSizeText: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    warningText: {
        color: '#f57c00',
        fontSize: 12,
        marginTop: 8,
    },
    sendButton: {
        backgroundColor: '#2196f3',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 12,
    },
    sendButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    sendingContainer: {
        marginTop: 12,
    },
    sendingText: {
        fontSize: 14,
        color: '#2196f3',
        marginBottom: 8,
    },
    progressContainer: {
        marginTop: 8,
    },
    progressBackground: {
        height: 10,
        backgroundColor: '#e0e0e0',
        borderRadius: 5,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#4CAF50',
    },
    progressText: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
        textAlign: 'right',
    },
    receivingContainer: {
        backgroundColor: '#e8f5e9',
        padding: 16,
        borderRadius: 8,
        marginVertical: 12,
    },
    receivingText: {
        fontSize: 16,
        color: '#2e7d32',
        marginBottom: 8,
    },
    activityIndicator: {
        marginVertical: 8,
    },
    receivedFileContainer: {
        backgroundColor: '#e3f2fd',
        padding: 16,
        borderRadius: 8,
        marginVertical: 12,
    },
    receivedFileTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1565c0',
        marginBottom: 8,
    },
    receivedFileName: {
        fontSize: 14,
    },
    receivedFilePath: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
    },
    backButton: {
        backgroundColor: '#757575',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 16,
    },
    backButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    cancelButton: {
        backgroundColor: '#ff5252',
        padding: 10,
        borderRadius: 5,
        marginTop: 10,
        alignSelf: 'center',
    },
    cancelButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default FileTransferScreen;
