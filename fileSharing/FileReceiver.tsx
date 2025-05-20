import { useEffect, useState, useRef } from 'react';
import { Buffer } from 'buffer';
import RNFS from 'react-native-fs';
import { useSocket, DISCOVERY_PORT } from '../providers/SocketProvider';
import { Platform, PermissionsAndroid } from 'react-native';

type FileChunk = {
  chunkIndex: number;
  data: string; // base64 encoded
};

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

  // Check permissions on component mount
  useEffect(() => {
    const checkPermissions = async () => {
      if (Platform.OS === 'android') {
        try {
          if (Platform.Version >= 33) { // Android 13+
            const permissions = [
              PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
              PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
              PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
            ];
            
            if (Platform.Version >= 34) { // Android 14+
              permissions.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VISUAL_USER_SELECTED);
            }
            
            const results = await PermissionsAndroid.requestMultiple(permissions);
            
            const allGranted = Object.values(results).every(
              result => result === PermissionsAndroid.RESULTS.GRANTED
            );
            
            setPermissionsGranted(allGranted);
            if (!allGranted) {
              console.warn('Not all permissions were granted');
            }
          } else { // Android 12 and below
            const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
            );
            
            setPermissionsGranted(granted === PermissionsAndroid.RESULTS.GRANTED);
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
              console.warn('Storage permission denied');
            }
          }
        } catch (err) {
          console.error('Error requesting permissions:', err);
          setPermissionsGranted(false);
          if (onError) onError(err as Error);
        }
      } else {
        // iOS doesn't need these permissions for app directory access
        setPermissionsGranted(true);
      }
    };

    checkPermissions();
  }, [onError]);

  useEffect(() => {
    if (!socket || !permissionsGranted) {
      console.log('FileReceiver: No socket available or permissions not granted, aborting.');
      return;
    }

    // Handler for incoming UDP messages
    const handleMessage = async (msg: Buffer, rinfo: any) => {
      try {
        // Parse the incoming message as JSON
        const data = JSON.parse(msg.toString());

        // Process only FILE_CHUNK type messages
        if (data.type === 'FILE_CHUNK') {
          const { fileName, chunkIndex, totalChunks, data: chunkData } = data;

          // If this is the first chunk, initialize state
          if (!receivingFileName) {
            console.log(`FileReceiver: Starting to receive file ${fileName} with ${totalChunks} chunks.`);
            setReceivingFileName(fileName);
            totalChunksRef.current = totalChunks;
            chunksRef.current.clear();
          }

          // Store the received chunk
          chunksRef.current.set(chunkIndex, chunkData);
          console.log(`FileReceiver: Received chunk ${chunkIndex + 1}/${totalChunks}`);

          // Update progress callback if provided
          if (onProgress) {
            const progressPercent = (chunksRef.current.size / totalChunks) * 100;
            console.log(`FileReceiver: Progress ${progressPercent.toFixed(2)}%`);
            onProgress(progressPercent);
          }

          // Check if all chunks have been received
          if (chunksRef.current.size === totalChunks) {
            console.log('FileReceiver: All chunks received, reassembling file.');

            // Reassemble chunks in order
            const orderedChunks: string[] = [];
            for (let i = 0; i < totalChunks; i++) {
              const chunk = chunksRef.current.get(i);
              if (!chunk) {
                throw new Error(`Missing chunk ${i}`);
              }
              orderedChunks.push(chunk);
            }

            // Join all chunks into a single base64 string
            const base64Data = orderedChunks.join('');

            // Define file path to save the received file
            const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;

            // Write the file to device storage
            await RNFS.writeFile(filePath, base64Data, 'base64');
            console.log(`FileReceiver: File saved at ${filePath}`);

            // Call the file received callback
            if (onFileReceived) {
              onFileReceived(filePath, fileName);
            }

            // Reset state for next file
            setReceivingFileName(null);
            chunksRef.current.clear();
            totalChunksRef.current = 0;
          }
        }
      } catch (error) {
        console.error('FileReceiver: Error processing incoming chunk:', error);
        if (onError) {
          onError(error as Error);
        }
      }
    };

    // Register the message handler
    socket.on('message', handleMessage);

    // Cleanup on unmount
    return () => {
      socket.off('message', handleMessage);
    };
  }, [socket, receivingFileName, onFileReceived, onProgress, onError, permissionsGranted]);

  // This hook does not render any UI
  return null;
};

export default FileReceiver;
