/* eslint-disable @typescript-eslint/no-unused-vars */
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

// Increase chunk size for better performance
// 8KB is a good balance between speed and reliability for UDP
const CHUNK_SIZE = 8192;

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

  // Function to validate base64 string
  const isValidBase64 = (str: string): boolean => {
    try {
      // Check if the string contains only valid base64 characters
      return /^[A-Za-z0-9+/]*={0,2}$/.test(str);
    } catch (e) {
      return false;
    }
  };

  // Effect to send file when fileUri or other dependencies change
  useEffect(() => {
    // If any required data is missing, do not proceed
    if (!fileUri || !socket || !targetIP) {
      console.log('FileSender: Missing fileUri, socket, or targetIP. Aborting send.');
      return;
    }

    // Prevent multiple sends
    if (isSending) {
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

        // First send a file start message to prepare the receiver
        const startMessage = JSON.stringify({
          type: 'FILE_START',
          fileName,
          fileSize,
          totalChunks,
          chunkSize: CHUNK_SIZE,
          timestamp: Date.now(),
        });

        // Send the start message
        await new Promise<void>((resolve, reject) => {
          socket.send(Buffer.from(startMessage), 0, startMessage.length, DISCOVERY_PORT, targetIP, (err) => {
            if (err) {
              console.error('FileSender: Error sending start message:', err);
              reject(err);
            } else {
              console.log('FileSender: Successfully sent start message');
              resolve();
            }
          });
        });

        // Wait a moment to ensure the receiver is ready
        await new Promise(resolve => setTimeout(resolve, 100));

        // Use a sliding window approach to send multiple chunks in parallel
        const WINDOW_SIZE = 10; // Send 10 chunks at a time
        let windowStart = 0;

        while (windowStart < totalChunks) {
          const windowEnd = Math.min(windowStart + WINDOW_SIZE, totalChunks);
          const promises = [];

          // Send a window of chunks in parallel
          for (let chunkIndex = windowStart; chunkIndex < windowEnd; chunkIndex++) {
            // Calculate start and end byte positions for the chunk
            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, fileSize);
            const length = end - start;

            // Create a promise for sending this chunk
            const sendChunkPromise = (async () => {
              try {
                // Read the chunk data as base64 string
                const chunkData = await RNFS.read(filePath, length, start, 'base64');

                // Create message object with metadata and chunk data
                const messageObject = {
                  type: 'FILE_CHUNK',
                  fileName,
                  chunkIndex,
                  totalChunks,
                  chunkSize: length,
                  data: chunkData,
                };

                // Convert message object to JSON string
                const message = JSON.stringify(messageObject);

                // Send the chunk over UDP socket
                return new Promise<void>((resolve, reject) => {
                  socket.send(Buffer.from(message), 0, message.length, DISCOVERY_PORT, targetIP, (err) => {
                    if (err) {
                      console.error(`FileSender: Error sending chunk ${chunkIndex}:`, err);
                      reject(err);
                    } else {
                      console.log(`FileSender: Sent chunk ${chunkIndex}`);
                      resolve();
                    }
                  });
                });
              } catch (error) {
                console.error(`FileSender: Error processing chunk ${chunkIndex}:`, error);
                throw error;
              }
            })();

            promises.push(sendChunkPromise);
          }

          // Wait for all chunks in this window to be sent
          await Promise.all(promises);

          // Update progress
          if (onProgress) {
            const progressPercent = (windowEnd / totalChunks) * 100;
            onProgress(progressPercent);
          }

          // Move to next window
          windowStart = windowEnd;

          // Small delay between windows to prevent network congestion
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Send a completion message
        const completeMessage = JSON.stringify({
          type: 'FILE_COMPLETE',
          fileName,
          totalChunks,
          timestamp: Date.now(),
        });

        await new Promise<void>((resolve, reject) => {
          socket.send(Buffer.from(completeMessage), 0, completeMessage.length, DISCOVERY_PORT, targetIP, (err) => {
            if (err) {
              console.error('FileSender: Error sending completion message:', err);
              reject(err);
            } else {
              console.log('FileSender: Successfully sent completion message');
              resolve();
            }
          });
        });

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
