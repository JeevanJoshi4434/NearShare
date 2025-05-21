/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useState, useRef } from 'react';
import { Buffer } from 'buffer';
import RNFS from 'react-native-fs';
import { useSocket } from '../providers/SocketProvider';
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { decryptData } from './encryption';

type FileReceiverProps = {
  onFileReceived: (filePath: string, fileName: string) => void;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
};

const FileReceiver = ({ onFileReceived, onProgress, onError, onCancel }: FileReceiverProps) => {
  const { socket } = useSocket();

  const [receivingFileName, setReceivingFileName] = useState<string | null>(null);

  const [permissionsGranted, setPermissionsGranted] = useState(false);

  const chunksRef = useRef<Map<number, string>>(new Map());
  const totalChunksRef = useRef<number>(0);
  const fileSizeRef = useRef<number>(0);
  const missingChunksRef = useRef<Set<number>>(new Set());
  const processingFileRef = useRef<boolean>(false);
  const alertShowingRef = useRef<boolean>(false);
  const encryptionKeyRef = useRef<string | null>(null);
  const cancelledRef = useRef<boolean>(false);

  const cancelTransfer = () => {
    if (processingFileRef.current) {
      cancelledRef.current = true;
      setReceivingFileName(null);
      chunksRef.current.clear();
      totalChunksRef.current = 0;
      fileSizeRef.current = 0;
      missingChunksRef.current.clear();
      processingFileRef.current = false;
      encryptionKeyRef.current = null;
      
      if (onCancel) {
        onCancel();
      }
    }
  };

  // Check permissions on component mount
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        if (Platform.OS === 'android') {
          if (Platform.Version >= 33) {
            const permissions = [
              PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
              PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
              PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
            ];

            const results = await PermissionsAndroid.requestMultiple(permissions);

            const allGranted = Object.values(results).every(
              result => result === PermissionsAndroid.RESULTS.GRANTED
            );

            setPermissionsGranted(allGranted);

            if (!allGranted) {
              // console.warn('Not all permissions were granted');
              if (!alertShowingRef.current) {
                alertShowingRef.current = true;
                Alert.alert(
                  'Permission Required',
                  'Please grant media permissions in app settings.',
                  [
                    {
                      text: 'Open Settings',
                      onPress: () => {
                        alertShowingRef.current = false;
                        Linking.openSettings();
                      },
                    },
                    {
                      text: 'Cancel',
                      onPress: () => {
                        alertShowingRef.current = false;
                      },
                      style: 'cancel',
                    },
                  ]
                );
              }
            } else {
              // console.log('All permissions granted');
            }
          } else {
            const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
            );
            const hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
            setPermissionsGranted(hasPermission);

            if (!hasPermission) {
              // console.warn('Storage permission denied');
              if (!alertShowingRef.current) {
                alertShowingRef.current = true;
                Alert.alert(
                  'Permission Required',
                  'Please grant storage permission in app settings.',
                  [
                    {
                      text: 'Open Settings',
                      onPress: () => {
                        alertShowingRef.current = false;
                        Linking.openSettings();
                      },
                    },
                    {
                      text: 'Cancel',
                      onPress: () => {
                        alertShowingRef.current = false;
                      },
                      style: 'cancel',
                    },
                  ]
                );
              }
            } else {
              // console.log('Storage permission granted');
            }
          }
        } else {
          // iOS: App-private directories don't need permissions
          setPermissionsGranted(true);
          // console.log('iOS - permission not required for app sandbox');
        }
      } catch (err) {
        // console.error('Error requesting permissions:', err);
        setPermissionsGranted(false);
        if (onError){
          onError(err as Error);
        }
      }
    };


    checkPermissions();
  }, [onError]);

  // Function to validate base64 string
  const isValidBase64 = (str: string): boolean => {
    try {
      return /^[A-Za-z0-9+/]*={0,2}$/.test(str);
    } catch (e) {
      return false;
    }
  };

  // Function to assemble and save the file
  const assembleAndSaveFile = async (fileName: string, totalChunks: number) => {
    if (cancelledRef.current) {
      return;
    }

    if (!permissionsGranted) {
      // console.error('FileReceiver: Cannot save file - permissions not granted');
      if (!alertShowingRef.current) {
        alertShowingRef.current = true;
        Alert.alert(
          'Permission Error',
          'Cannot save received file because storage permissions were not granted.',
          [{ text: 'OK', onPress: () => { alertShowingRef.current = false; } }]
        );
      }
      if (onError) {
        onError(new Error('Storage permissions not granted'));
      }
      return;
    }

    if (!encryptionKeyRef.current) {
      if (onError) {
        onError(new Error('No encryption key available'));
      }
      return;
    }

    try {
      // console.log(`FileReceiver: Assembling file ${fileName} from ${totalChunks} chunks`);

      // First save to app's cache directory (always accessible)
      const tempDirPath = `${RNFS.DocumentDirectoryPath}/NearShare`;
      const tempDirExists = await RNFS.exists(tempDirPath);
      if (!tempDirExists) {
        await RNFS.mkdir(tempDirPath);
      }

      // Define temporary file path
      const tempFilePath = `${tempDirPath}/${fileName}`;

      // Write each chunk to the file in order
      await RNFS.writeFile(tempFilePath, '', 'base64'); // Create empty file

      // Process chunks in batches for better performance
      const BATCH_SIZE = 10;
      for (let batchStart = 0; batchStart < totalChunks; batchStart += BATCH_SIZE) {
        if (cancelledRef.current) {
          // Delete the partial file if cancelled
          try {
            await RNFS.unlink(tempFilePath);
          } catch (error) {
            // Ignore deletion errors
          }
          return;
        }

        const batchEnd = Math.min(batchStart + BATCH_SIZE, totalChunks);
        const batchPromises = [];
        
        for (let i = batchStart; i < batchEnd; i++) {
          const encryptedChunk = chunksRef.current.get(i);
          if (encryptedChunk) {
            try {
              // Decrypt the chunk before writing
              const decryptedChunk = decryptData(encryptedChunk, encryptionKeyRef.current);
              const writePromise = RNFS.appendFile(tempFilePath, decryptedChunk, 'base64')
                .catch(error => {
                  throw new Error(`Error writing chunk ${i}: ${error}`);
                });
              batchPromises.push(writePromise);
            } catch (error) {
              throw new Error(`Error decrypting chunk ${i}: ${error}`);
            }
          }
        }

        await Promise.all(batchPromises);
        if (onProgress) {
          const progressPercent = (batchEnd / totalChunks) * 100;
          onProgress(progressPercent);
        }
      }

      if (cancelledRef.current) {
        // Delete the file if cancelled
        try {
          await RNFS.unlink(tempFilePath);
        } catch (error) {
          // Ignore deletion errors
        }
        return;
      }

      // After file is assembled, save it to a public location
      if (Platform.OS === 'android') {
        try {
          const downloadPath = `${RNFS.DownloadDirectoryPath}/NearShare`;
          const downloadDirExists = await RNFS.exists(downloadPath);
          if (!downloadDirExists) {
            await RNFS.mkdir(downloadPath);
          }

          const publicFilePath = `${downloadPath}/${fileName}`;
          await RNFS.copyFile(tempFilePath, publicFilePath);

          // console.log(`FileReceiver: File saved to public location: ${publicFilePath}`);
          if (!alertShowingRef.current) {
            alertShowingRef.current = true;
            Alert.alert(
              'File Saved',
              `File saved to Downloads/NearShare/${fileName}`,
              [{ text: 'OK', onPress: () => { alertShowingRef.current = false; } }]
            );
          }
          if (onFileReceived) {
            onFileReceived(publicFilePath, fileName);
          }
        } catch (error) {
          // console.error('FileReceiver: Error saving to public location:', error);
          if (onFileReceived) {
            onFileReceived(tempFilePath, fileName);
          }
        }
      } else {
        if (onFileReceived) {
          onFileReceived(tempFilePath, fileName);
        }
      }
    } catch (error) {
      // console.error('FileReceiver: Error assembling file:', error);
      if (onError) {
        onError(error as Error);
      }
    }
  };

  useEffect(() => {
    if (!socket) {
      // console.log('FileReceiver: No socket available, aborting.');
      return;
    }

    cancelledRef.current = false;

    // Handler for incoming UDP messages
    const handleMessage = async (msg: Buffer) => {
      if (cancelledRef.current) {
        return;
      }

      try {
        const data = JSON.parse(msg.toString());
        if (data.type === 'FILE_START') {
          const { fileName, fileSize, totalChunks } = data;
          // console.log(`FileReceiver: Starting to receive file ${fileName} (${fileSize} bytes) with ${totalChunks} chunks.`);
          setReceivingFileName(fileName);
          fileSizeRef.current = fileSize;
          totalChunksRef.current = totalChunks;
          chunksRef.current.clear();
          processingFileRef.current = true;
          missingChunksRef.current = new Set();
          encryptionKeyRef.current = data.encryptionKey;
          for (let i = 0; i < totalChunks; i++) {
            missingChunksRef.current.add(i);
          }
          if (onProgress) {
            onProgress(0);
          }
        }
        else if (data.type === 'FILE_CHUNK' && processingFileRef.current && !cancelledRef.current) {
          const { fileName, chunkIndex, totalChunks, data: chunkData } = data;
          if (!isValidBase64(chunkData)) {
            // console.error(`FileReceiver: Invalid base64 data in chunk ${chunkIndex}`);
            throw new Error(`Invalid base64 data in chunk ${chunkIndex}`);
          }
          chunksRef.current.set(chunkIndex, chunkData);
          missingChunksRef.current.delete(chunkIndex);

          // console.log(`FileReceiver: Received chunk ${chunkIndex + 1}/${totalChunks} for ${fileName}`);

          if (onProgress) {
            const progressPercent = ((totalChunks - missingChunksRef.current.size) / totalChunks) * 100;
            onProgress(progressPercent);
          }
        }
        else if (data.type === 'FILE_COMPLETE' && processingFileRef.current && !cancelledRef.current) {
          const { fileName, totalChunks } = data;

          // console.log(`FileReceiver: File transfer complete signal received for ${fileName}`);

          if (missingChunksRef.current.size === 0) {
            // console.log(`FileReceiver: All ${totalChunks} chunks received for ${fileName}`);

            await assembleAndSaveFile(fileName, totalChunks);

            setReceivingFileName(null);
            chunksRef.current.clear();
            totalChunksRef.current = 0;
            fileSizeRef.current = 0;
            missingChunksRef.current.clear();
            processingFileRef.current = false;
            encryptionKeyRef.current = null;
          } else {
            // console.error(`FileReceiver: Missing ${missingChunksRef.current.size} chunks after completion signal`);

            // console.error(`FileReceiver: Missing chunks: ${Array.from(missingChunksRef.current).join(', ')}`);

            if (onError) {
              onError(new Error(`Incomplete file transfer: missing ${missingChunksRef.current.size} chunks`));
            }
            setReceivingFileName(null);
            chunksRef.current.clear();
            totalChunksRef.current = 0;
            fileSizeRef.current = 0;
            missingChunksRef.current.clear();
            processingFileRef.current = false;
            encryptionKeyRef.current = null;
          }
        }
      } catch (error) {
        // console.error('FileReceiver: Error processing incoming message:', error);
        if (onError) {
          onError(error as Error);
        }

        setReceivingFileName(null);
        chunksRef.current.clear();
        totalChunksRef.current = 0;
        fileSizeRef.current = 0;
        missingChunksRef.current.clear();
        processingFileRef.current = false;
        encryptionKeyRef.current = null;
      }
    };

    socket.on('message', handleMessage);

    return () => {
      socket.removeListener('message', handleMessage);
      // Clean up if component unmounts during transfer
      if (processingFileRef.current) {
        cancelTransfer();
      }
    };
  }, [socket, permissionsGranted, onFileReceived, onProgress, onError, onCancel]);

  return null;
};

export default FileReceiver;
