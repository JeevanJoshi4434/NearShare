import React, { useState, useEffect } from 'react';
import { Buffer } from 'buffer';
import RNFS from 'react-native-fs';
import { DISCOVERY_PORT, useSocket } from '../providers/SocketProvider';

type FileSenderProps = {
  fileUri: string;
  fileName: string;
  fileSize: number;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  targetIP: string;
};

const CHUNK_SIZE = 60000; // UDP packet size limit, keep below 64KB

const FileSender: React.FC<FileSenderProps> = ({
  fileUri,
  fileName,
  fileSize,
  onProgress,
  onComplete,
  onError,
  targetIP,
}) => {
  // Get the UDP socket from context
  const { socket } = useSocket();

  // State to track if file sending is in progress
  const [isSending, setIsSending] = useState(false);

  // Effect to send file when fileUri or other dependencies change
  useEffect(() => {
    // If any required data is missing, do not proceed
    if (!fileUri || !socket || !targetIP) {
      console.log('FileSender: Missing fileUri, socket, or targetIP. Aborting send.');
      return;
    }

    // Async function to handle file sending
    const sendFile = async () => {
      setIsSending(true);
      console.log(`FileSender: Starting to send file ${fileName} of size ${fileSize} bytes.`);

      try {
        // Remove 'file://' prefix if present to get actual file path
        const filePath = fileUri.startsWith('file://') ? fileUri.slice(7) : fileUri;

        // Calculate total number of chunks needed
        const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
        console.log(`FileSender: Total chunks to send: ${totalChunks}`);

        // Loop through each chunk and send it
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          // Calculate start and end byte positions for the chunk
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, fileSize);
          const length = end - start;

          // Read the chunk data as base64 string
          const chunkData = await RNFS.read(filePath, length, start, 'base64');
          console.log(`FileSender: Read chunk ${chunkIndex + 1}/${totalChunks}`);

          // Create message object with metadata and chunk data
          const messageObject = {
            type: 'FILE_CHUNK',
            fileName,
            chunkIndex,
            totalChunks,
            data: chunkData,
          };

          // Convert message object to JSON string
          const message = JSON.stringify(messageObject);

          // Send the chunk over UDP socket and wait for completion
          await new Promise<void>((resolve, reject) => {
            socket.send(Buffer.from(message), 0, message.length, DISCOVERY_PORT, targetIP, (err) => {
              if (err) {
                console.error(`FileSender: Error sending chunk ${chunkIndex}:`, err);
                reject(err);
              } else {
                console.log(`FileSender: Successfully sent chunk ${chunkIndex}`);
                resolve();
              }
            });
          });

          // Update progress callback if provided
          if (onProgress) {
            const progressPercent = ((chunkIndex + 1) / totalChunks) * 100;
            console.log(`FileSender: Progress ${progressPercent.toFixed(2)}%`);
            onProgress(progressPercent);
          }
        }

        // Call completion callback if provided
        if (onComplete) {
          console.log('FileSender: File send complete.');
          onComplete();
        }
      } catch (error) {
        // Call error callback if provided
        if (onError) {
          console.error('FileSender: Error during file send:', error);
          onError(error as Error);
        }
      } finally {
        // Reset sending state
        setIsSending(false);
      }
    };

    // Start sending the file
    sendFile();
  }, [fileUri, fileName, fileSize, socket, targetIP, onProgress, onComplete, onError]);

  // This component does not render any UI
  return null;
};

export default FileSender;
