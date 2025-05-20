/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useState, useRef } from 'react';
import { Buffer } from 'buffer';
import RNFS from 'react-native-fs';
import { useSocket } from '../providers/SocketProvider';
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

type FileReceiverProps = {
  onFileReceived: (filePath: string, fileName: string) => void;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
};

const FileReceiver = ({ onFileReceived, onProgress, onError }: FileReceiverProps) => {
  // Get the UDP socket from context
  const { socket } = useSocket();

  // State to track the name of the file currently being received
  const [receivingFileName, setReceivingFileName] = useState<string | null>(null);

  // State to track if permissions are granted
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  // Ref to store received chunks mapped by their index
  const chunksRef = useRef<Map<number, string>>(new Map());

  // Ref to store total number of chunks expected
  const totalChunksRef = useRef<number>(0);

  // Ref to store file size
  const fileSizeRef = useRef<number>(0);

  // Ref to track missing chunks
  const missingChunksRef = useRef<Set<number>>(new Set());

  // Ref to track if we're currently processing a file
  const processingFileRef = useRef<boolean>(false);

  // Ref to track if an alert is currently showing to prevent multiple alerts
  const alertShowingRef = useRef<boolean>(false);

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
              console.warn('Not all permissions were granted');
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
              console.log('All permissions granted');
            }
          } else {
            const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
            );
            const hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
            setPermissionsGranted(hasPermission);

            if (!hasPermission) {
              console.warn('Storage permission denied');
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
              console.log('Storage permission granted');
            }
          }
        } else {
          // iOS: App-private directories don’t need permissions
          setPermissionsGranted(true);
          console.log('iOS - permission not required for app sandbox');
        }
      } catch (err) {
        console.error('Error requesting permissions:', err);
        setPermissionsGranted(false);
        if (onError) onError(err as Error);
      }
    };


    checkPermissions();
  }, [onError]);

  // Function to validate base64 string
  const isValidBase64 = (str: string): boolean => {
    try {
      // Check if the string contains only valid base64 characters
      return /^[A-Za-z0-9+/]*={0,2}$/.test(str);
    } catch (e) {
      return false;
    }
  };

  // Function to assemble and save the file
  const assembleAndSaveFile = async (fileName: string, totalChunks: number) => {
    if (!permissionsGranted) {
      console.error('FileReceiver: Cannot save file - permissions not granted');
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
    try {
      console.log(`FileReceiver: Assembling file ${fileName} from ${totalChunks} chunks`);

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
        const batchEnd = Math.min(batchStart + BATCH_SIZE, totalChunks);
        const batchPromises = [];
        for (let i = batchStart; i < batchEnd; i++) {
          const chunk = chunksRef.current.get(i);
          if (chunk) {
            // Create a promise for writing this chunk
            const writePromise = RNFS.appendFile(tempFilePath, chunk, 'base64')
              .catch(error => {
                console.error(`FileReceiver: Error writing chunk ${i}:`, error);
                throw new Error(`Error writing chunk ${i}: ${error}`);
              });
            batchPromises.push(writePromise);
          }
        }
        // Wait for all chunks in this batch to be written
        await Promise.all(batchPromises);
        // Update progress if needed
        if (onProgress) {
          const progressPercent = (batchEnd / totalChunks) * 100;
          onProgress(progressPercent);
        }
      }
      // After file is assembled, save it to a public location
      if (Platform.OS === 'android') {
        try {
          // For Android, copy to Downloads directory
          const downloadPath = `${RNFS.DownloadDirectoryPath}/NearShare`;
          const downloadDirExists = await RNFS.exists(downloadPath);
          if (!downloadDirExists) {
            await RNFS.mkdir(downloadPath);
          }

          const publicFilePath = `${downloadPath}/${fileName}`;
          await RNFS.copyFile(tempFilePath, publicFilePath);

          console.log(`FileReceiver: File saved to public location: ${publicFilePath}`);

          // Notify user where the file is saved
          if (!alertShowingRef.current) {
            alertShowingRef.current = true;
            Alert.alert(
              'File Saved',
              `File saved to Downloads/NearShare/${fileName}`,
              [{ text: 'OK', onPress: () => { alertShowingRef.current = false; } }]
            );
          }

          // Call the onFileReceived callback with the saved path
          if (onFileReceived) {
            onFileReceived(publicFilePath, fileName);
          }
        } catch (error) {
          console.error('FileReceiver: Error saving to public location:', error);
          // Fall back to the temp file if saving to public location fails
          if (onFileReceived) {
            onFileReceived(tempFilePath, fileName);
          }
        }
      } else {
        // For iOS, just use the temp file
        if (onFileReceived) {
          onFileReceived(tempFilePath, fileName);
        }
      }
    } catch (error) {
      console.error('FileReceiver: Error assembling file:', error);
      if (onError) {
        onError(error as Error);
      }
    }
  };

  useEffect(() => {
    if (!socket) {
      console.log('FileReceiver: No socket available, aborting.');
      return;
    }

    // Handler for incoming UDP messages
    const handleMessage = async (msg: Buffer) => {
      try {
        // Parse the incoming message as JSON
        const data = JSON.parse(msg.toString());

        // Handle file start message
        if (data.type === 'FILE_START') {
          const { fileName, fileSize, totalChunks } = data;
          console.log(`FileReceiver: Starting to receive file ${fileName} (${fileSize} bytes) with ${totalChunks} chunks.`);
          // Initialize state for new file
          setReceivingFileName(fileName);
          fileSizeRef.current = fileSize;
          totalChunksRef.current = totalChunks;
          chunksRef.current.clear();
          processingFileRef.current = true;
          // Initialize missing chunks set
          missingChunksRef.current = new Set();
          for (let i = 0; i < totalChunks; i++) {
            missingChunksRef.current.add(i);
          }

          // Update progress to 0%
          if (onProgress) {
            onProgress(0);
          }
        }
        // Process file chunks
        else if (data.type === 'FILE_CHUNK' && processingFileRef.current) {
          const { fileName, chunkIndex, totalChunks, data: chunkData } = data;

          // Validate the chunk data is valid base64
          if (!isValidBase64(chunkData)) {
            console.error(`FileReceiver: Invalid base64 data in chunk ${chunkIndex}`);
            throw new Error(`Invalid base64 data in chunk ${chunkIndex}`);
          }

          // Store the received chunk
          chunksRef.current.set(chunkIndex, chunkData);
          missingChunksRef.current.delete(chunkIndex);

          console.log(`FileReceiver: Received chunk ${chunkIndex + 1}/${totalChunks} for ${fileName}`);

          // Update progress callback if provided
          if (onProgress) {
            const progressPercent = ((totalChunks - missingChunksRef.current.size) / totalChunks) * 100;
            onProgress(progressPercent);
          }
        }
        // Handle file completion
        else if (data.type === 'FILE_COMPLETE' && processingFileRef.current) {
          const { fileName, totalChunks } = data;

          console.log(`FileReceiver: File transfer complete signal received for ${fileName}`);

          // Check if we have all chunks
          if (missingChunksRef.current.size === 0) {
            console.log(`FileReceiver: All ${totalChunks} chunks received for ${fileName}`);

            // Assemble and save the file
            await assembleAndSaveFile(fileName, totalChunks);

            // Reset state for next file
            setReceivingFileName(null);
            chunksRef.current.clear();
            totalChunksRef.current = 0;
            fileSizeRef.current = 0;
            missingChunksRef.current.clear();
            processingFileRef.current = false;
          } else {
            console.error(`FileReceiver: Missing ${missingChunksRef.current.size} chunks after completion signal`);

            // Log missing chunks
            console.error(`FileReceiver: Missing chunks: ${Array.from(missingChunksRef.current).join(', ')}`);

            if (onError) {
              onError(new Error(`Incomplete file transfer: missing ${missingChunksRef.current.size} chunks`));
            }

            // Reset state for next file
            setReceivingFileName(null);
            chunksRef.current.clear();
            totalChunksRef.current = 0;
            fileSizeRef.current = 0;
            missingChunksRef.current.clear();
            processingFileRef.current = false;
          }
        }
      } catch (error) {
        console.error('FileReceiver: Error processing incoming message:', error);
        if (onError) {
          onError(error as Error);
        }

        // Reset state if there was an error
        setReceivingFileName(null);
        chunksRef.current.clear();
        totalChunksRef.current = 0;
        fileSizeRef.current = 0;
        missingChunksRef.current.clear();
        processingFileRef.current = false;
      }
    };

    // Set up message handler
    socket.on('message', handleMessage);

    // Clean up when component unmounts
    return () => {
      socket.removeListener('message', handleMessage);
    };
  }, [socket, permissionsGranted, onFileReceived, onProgress, onError]);

  // This component doesn't render any UI
  return null;
};

export default FileReceiver;
