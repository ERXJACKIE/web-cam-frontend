import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class WebrtcService {
  private socket: Socket;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();

  private remoteStreamsSubject = new BehaviorSubject<MediaStream[]>([]);
  remoteStreams$ = this.remoteStreamsSubject.asObservable();

  private configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
    ]
  };

  constructor() {
    this.socket = io('http://localhost:3000', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.setupSocketListeners();
  }

  async initiateCall(roomId: string): Promise<void> {
    this.socket.emit('join-room', roomId);
    console.log(`Joined room: ${roomId}`);
  }

  private setupSocketListeners(): void {
    this.socket.on('user-connected', (userId: string) => {
      this.createPeerConnection(userId);
    });

    this.socket.on('offer', async (data: { offer: RTCSessionDescriptionInit, senderId: string }) => {
      await this.handleOffer(data);
    });

    this.socket.on('answer', async (data: { answer: RTCSessionDescriptionInit, senderId: string }) => {
      await this.handleAnswer(data);
    });

    this.socket.on('ice-candidate', async (data: { candidate: RTCIceCandidateInit, senderId: string }) => {
      await this.handleIceCandidate(data);
    });
  }

  private async createPeerConnection(userId: string): Promise<void> {
    const peerConnection = new RTCPeerConnection(this.configuration);

    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      console.log('Remote track received:', remoteStream);

      const remoteStreams = this.remoteStreamsSubject.value;
      if (!remoteStreams.some((stream) => stream.id === remoteStream.id)) {
        this.remoteStreamsSubject.next([...remoteStreams, remoteStream]);
        console.log('Remote stream added:', remoteStream);
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', { candidate: event.candidate, roomId: 'default-room' });
      }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    this.socket.emit('offer', { offer, roomId: 'default-room', senderId: this.socket.id });

    this.peerConnections.set(userId, peerConnection);
  }

  private async handleOffer(data: { offer: RTCSessionDescriptionInit, senderId: string }): Promise<void> {
    const peerConnection = new RTCPeerConnection(this.configuration);

    peerConnection.ontrack = (event) => {
      const remoteStreams = this.remoteStreamsSubject.value;
      if (!remoteStreams.some(stream => stream === event.streams[0])) {
        remoteStreams.push(event.streams[0]);
        this.remoteStreamsSubject.next(remoteStreams);
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', { candidate: event.candidate, roomId: 'default-room' });
      }
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    this.socket.emit('answer', { answer, roomId: 'default-room', senderId: this.socket.id });

    this.peerConnections.set(data.senderId, peerConnection);
  }

  private async handleAnswer(data: { answer: RTCSessionDescriptionInit, senderId: string }): Promise<void> {
    const peerConnection = this.peerConnections.get(data.senderId);
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  }

  private async handleIceCandidate(data: { candidate: RTCIceCandidateInit, senderId: string }): Promise<void> {
    const peerConnection = this.peerConnections.get(data.senderId);
    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  }

  endCall(): void {
    this.peerConnections.forEach((connection) => {
      connection.close();
    });
    this.peerConnections.clear();

    this.remoteStreamsSubject.next([]);
  }

  cleanup(): void {
    this.endCall();
    this.socket.disconnect();
  }
}
