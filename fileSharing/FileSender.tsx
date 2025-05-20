/* eslint-disable react-hooks/exhaustive-deps */
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
  const { socket } = useSocket();
  const [isSending, setIsSending] = useState(false);
  const isValidBase64 = (str: string): boolean => {
    try {
      return /^[A-Za-z0-9+/]*={0,2}$/.test(str);
    } catch (e) {
      return false;
    }
  };
  useEffect(() => {
    if (!fileUri || !socket || !targetIP) {
      // console.log('FileSender: Missing fileUri, socket, or targetIP. Aborting send.');
      return;
    }
    if (isSending) {
      return;
    }
    const sendFile = async () => {
      setIsSending(true);
      // console.log(`FileSender: Starting to send file ${fileName} of size ${fileSize} bytes.`);

      try {
        const filePath = fileUri.startsWith('file://') ? fileUri.slice(7) : fileUri;
        const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
        // console.log(`FileSender: Total chunks to send: ${totalChunks}`);
        const startMessage = JSON.stringify({
          type: 'FILE_START',
          fileName,
          fileSize,
          totalChunks,
          chunkSize: CHUNK_SIZE,
          timestamp: Date.now(),
        });
        await new Promise<void>((resolve, reject) => {
          socket.send(Buffer.from(startMessage), 0, startMessage.length, DISCOVERY_PORT, targetIP, (err) => {
            if (err) {
              // console.error('FileSender: Error sending start message:', err);
              reject(err);
            } else {
              // console.log('FileSender: Successfully sent start message');
              resolve();
            }
          });
        });
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

                const message = JSON.stringify(messageObject);
                return new Promise<void>((resolve, reject) => {
                  socket.send(Buffer.from(message), 0, message.length, DISCOVERY_PORT, targetIP, (err) => {
                    if (err) {
                      // console.error(`FileSender: Error sending chunk ${chunkIndex}:`, err);
                      reject(err);
                    } else {
                      // console.log(`FileSender: Sent chunk ${chunkIndex}`);
                      resolve();
                    }
                  });
                });
              } catch (error) {
                // console.error(`FileSender: Error processing chunk ${chunkIndex}:`, error);
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
              // console.error('FileSender: Error sending completion message:', err);
              reject(err);
            } else {
              // console.log('FileSender: Successfully sent completion message');
              resolve();
            }
          });
        });

        // Call completion callback if provided
        if (onComplete) {
          // console.log('FileSender: File send complete.');
          onComplete();
        }
      } catch (error) {
        // Call error callback if provided
        if (onError) {
          // console.error('FileSender: Error during file send:', error);
          onError(error as Error);
        }
      } finally {
        setIsSending(false);
      }
    };
    sendFile();
  }, [fileUri, fileName, fileSize, socket, targetIP, onProgress, onComplete, onError]);

  return null;
};

export default FileSender;
