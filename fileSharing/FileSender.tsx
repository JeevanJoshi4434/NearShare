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
  const { socket } = useSocket();
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!fileUri || !socket || !targetIP) return;

    const sendFile = async () => {
      setIsSending(true);
      try {
        const filePath = fileUri.replace('file://', '');
        const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, fileSize);
          const length = end - start;

          const chunkData = await RNFS.read(filePath, length, start, 'base64');

          const message = JSON.stringify({
            type: 'FILE_CHUNK',
            fileName,
            chunkIndex,
            totalChunks,
            data: chunkData,
          });

          await new Promise<void>((resolve, reject) => {
            socket.send(Buffer.from(message), 0, message.length, DISCOVERY_PORT, targetIP, (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          });

          if (onProgress) {
            onProgress(((chunkIndex + 1) / totalChunks) * 100);
          }
        }

        if (onComplete) {
          onComplete();
        }
      } catch (error) {
        if (onError) {
          onError(error as Error);
        }
      } finally {
        setIsSending(false);
      }
    };

    sendFile();
  }, [fileUri, fileName, fileSize, socket, targetIP]);

  return null; // This component does not render anything
};

export default FileSender;
