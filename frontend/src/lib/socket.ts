import { API_URL } from '../config';
import { io } from 'socket.io-client';


export const socket = io(API_URL, {
  autoConnect: false,
  transports: ['websocket'],
});
