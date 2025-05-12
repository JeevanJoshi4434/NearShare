import React from 'react';
import { View, Button, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

type FilePickerProps = {
  onFileSelected: (uri: string, name: string, size: number) => void;
};

const FilePicker: React.FC<FilePickerProps> = ({ onFileSelected }) => {
  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({});
      if (result.type === 'success') {
        onFileSelected(result.uri, result.name, result.size ?? 0);
      }
    } catch (error) {
      console.error('Error picking file:', error);
    }
  };

  return (
    <View>
      <Button title="Select File" onPress={pickFile} />
    </View>
  );
};

export default FilePicker;
