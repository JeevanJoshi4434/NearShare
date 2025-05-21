import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Alert } from 'react-native';
import FilePicker from './FilePicker';
import FileSender from './FileSender';
import FileReceiver from './FileReceiver';
import { useSocket } from '../providers/SocketProvider';

const App = () => {
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string; size: number } | null>(null);
  const [sendProgress, setSendProgress] = useState(0);
  const [receiveProgress, setReceiveProgress] = useState(0);
  const [receivedFilePath, setReceivedFilePath] = useState<string | null>(null);
  const [receivedFileName, setReceivedFileName] = useState<string | null>(null);

  const { socket } = useSocket();

  const handleFileSelected = (uri: string, name: string, size: number) => {
    setSelectedFile({ uri, name, size });
    setSendProgress(0);
  };

  const handleSendComplete = () => {
    Alert.alert('File Sent', 'File has been sent successfully.');
    setSelectedFile(null);
    setSendProgress(0);
  };

  const handleSendError = (error: Error) => {
    Alert.alert('Send Error', error.message);
  };

  const handleReceiveProgress = (progress: number) => {
    setReceiveProgress(progress);
  };

  const handleFileReceived = (filePath: string, fileName: string) => {
    setReceivedFilePath(filePath);
    setReceivedFileName(fileName);
    Alert.alert('File Received', `File ${fileName} received and saved.`);
    setReceiveProgress(0);
  };

  const handleReceiveError = (error: Error) => {
    Alert.alert('Receive Error', error.message);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>React Native File Sharing</Text>
      <FilePicker onFileSelected={handleFileSelected} />
      {selectedFile && (
        <View style={styles.infoContainer}>
          <Text>Selected File: {selectedFile.name}</Text>
          <Text>Size: {selectedFile.size} bytes</Text>
          {socket && (
            <FileSender
              fileUri={selectedFile.uri}
              fileName={selectedFile.name}
              fileSize={selectedFile.size}
              targetIP="255.255.255.255"
              onProgress={setSendProgress}
              onComplete={handleSendComplete}
              onError={handleSendError}
            />
          )}
          <Text>Send Progress: {sendProgress.toFixed(2)}%</Text>
        </View>
      )}
      {socket && (
        <FileReceiver
          onFileReceived={handleFileReceived}
          onProgress={handleReceiveProgress}
          onError={handleReceiveError}
        />
      )}
      {receivedFileName && (
        <View style={styles.infoContainer}>
          <Text>Received File: {receivedFileName}</Text>
          <Text>Receive Progress: {receiveProgress.toFixed(2)}%</Text>
          <Text>Saved at: {receivedFilePath}</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  infoContainer: {
    marginTop: 16,
  },
});

export default App;
