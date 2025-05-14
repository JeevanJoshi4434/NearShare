import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, PermissionsAndroid, Platform } from 'react-native';
import RNFS from 'react-native-fs';

type FilePickerProps = {
  onFileSelected: (uri: string, name: string, size: number) => void;
};

const FilePicker: React.FC<FilePickerProps> = ({ onFileSelected }) => {
  const [files, setFiles] = useState<RNFS.ReadDirItem[]>([]);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    const requestPermission = async () => {
      if (Platform.OS === 'android') {
        try {
          const readGranted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
            {
              title: 'Storage Permission',
              message: 'App needs access to your storage to select files',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            },
          );
          const writeGranted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            {
              title: 'Storage Permission',
              message: 'App needs write access to your storage to send files',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            },
          );
          if (readGranted === PermissionsAndroid.RESULTS.GRANTED && writeGranted === PermissionsAndroid.RESULTS.GRANTED) {
            setHasPermission(true);
          } else {
            Alert.alert('Permission Denied', 'Storage permissions are required to select and send files.');
            setHasPermission(false);
          }
        } catch (err) {
          Alert.alert('Permission Error', 'Failed to request permission');
          setHasPermission(false);
        }
      } else {
        setHasPermission(true);
      }
    };

    requestPermission();
  }, []);

  useEffect(() => {
    if (hasPermission) {
      // Read files from external storage directory on Android, fallback to DocumentDirectoryPath on iOS
      const path = Platform.OS === 'android' ? RNFS.ExternalStorageDirectoryPath : RNFS.DocumentDirectoryPath;
      RNFS.readDir(path)
        .then((result) => {
          setFiles(result);
        })
        .catch(() => {
          Alert.alert('Error', 'Failed to read files');
        });
    }
  }, [hasPermission]);

  const handleFilePress = (file: RNFS.ReadDirItem) => {
    if (file.isFile()) {
      onFileSelected(file.path, file.name, file.size);
    } else {
      Alert.alert('Selection Error', 'Please select a file, not a folder');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Select a file:</Text>
      <FlatList
        data={files}
        keyExtractor={(item) => item.path}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handleFilePress(item)} style={{ padding: 10, borderBottomWidth: 1, borderColor: '#ccc' }}>
            <Text>{item.name}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text>No files found in storage directory.</Text>}
      />
    </View>
  );
};

export default FilePicker;
