import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { pick } from '@react-native-documents/picker';

type FilePickerProps = {
  onFileSelected: (uri: string, name: string, size: number) => void;
};

const FilePicker: React.FC<FilePickerProps> = ({ onFileSelected }) => {

  const pickFile = async () => {
    try {
      const result = await pick({
        type: '*/*',
      });
      // pick returns an array of files
      if (result.length > 0) {
        const file = result[0];
        if (file.size === null) {
          throw new Error('File size is null');
        }
        if (file.name === null) {
          throw new Error('File name is null');
        }
        onFileSelected(file.uri, file.name, file.size);
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'User cancelled document picker') {
        // User cancelled the picker
        console.log('User cancelled document picker');
      } else {
        console.error('Error picking file:', error);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select a file:</Text>
      <Button
        title="Browse Files"
        onPress={pickFile}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 16,
  },
});

export default FilePicker;
