import { createContext } from 'react';
import { SocketContextProps } from '../types/Socket';

const SocketContext = createContext<SocketContextProps | undefined>(undefined);

export default SocketContext;
