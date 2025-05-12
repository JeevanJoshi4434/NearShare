import { useEffect, useState, useRef } from 'react';
import { Buffer } from 'buffer';
import RNFS from 'react-native-fs';
import { useSocket, DISCOVERY_PORT } from '../providers/SocketProvider';

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
  const { socket } = useSocket();
  const [receivingFileName, setReceivingFileName] = useState<string | null>(null);
  const chunksRef = useRef<Map<number, string>>(new Map());
  const totalChunksRef = useRef<number>(0);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = async (msg: Buffer, rinfo: any) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === 'FILE_CHUNK') {
          const { fileName, chunkIndex, totalChunks, data: chunkData } = data;

          if (!receivingFileName) {
            setReceivingFileName(fileName);
            totalChunksRef.current = totalChunks;
            chunksRef.current.clear();
          }

          chunksRef.current.set(chunkIndex, chunkData);

          if (onProgress) {
            onProgress((chunksRef.current.size / totalChunks) * 100);
          }

          if (chunksRef.current.size === totalChunks) {
            // All chunks received, reassemble file
            const orderedChunks = [];
            for (let i = 0; i < totalChunks; i++) {
              const chunk = chunksRef.current.get(i);
              if (!chunk) {
                throw new Error(`Missing chunk ${i}`);
              }
              orderedChunks.push(chunk);
            }

            const base64Data = orderedChunks.join('');
            const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;

            await RNFS.writeFile(filePath, base64Data, 'base64');

            if (onFileReceived) {
              onFileReceived(filePath, fileName);
            }

            // Reset state
            setReceivingFileName(null);
            chunksRef.current.clear();
            totalChunksRef.current = 0;
          }
        }
      } catch (error) {
        if (onError) {
          onError(error as Error);
        }
      }
    };

    socket.on('message', handleMessage);

    return () => {
      socket.off('message', handleMessage);
    };
  }, [socket, receivingFileName, onFileReceived, onProgress, onError]);

  return null; // This hook does not render anything
};

export default FileReceiver;
