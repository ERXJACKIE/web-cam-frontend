import { Component, OnInit, OnDestroy } from '@angular/core';
import { io } from 'socket.io-client';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit, OnDestroy {
  private socket: any;
  private peerConnection: RTCPeerConnection | undefined;
  remoteStream: MediaStream | undefined;

  constructor() {}

  ngOnInit() {
    this.setupWebRTC();
  }

  setupWebRTC() {
    this.socket = io('http://localhost:3000');
    this.peerConnection = new RTCPeerConnection();

    // Set up remote stream
    this.peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      this.remoteStream = stream;

      // Clear existing remote videos
      const container = document.getElementById('remoteContainer');
      if (container) {
        container.innerHTML = ''; // Remove old videos
        const remoteVideo = document.createElement('video');
        remoteVideo.srcObject = stream;
        remoteVideo.autoplay = true;
        remoteVideo.playsInline = true;
        container.appendChild(remoteVideo);
      }
    };

    // Handle offer from backend
    this.socket.on('offer', (offer: RTCSessionDescriptionInit) => {
      this.peerConnection
        ?.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => this.peerConnection?.createAnswer())
        .then((answer) => {
          this.peerConnection?.setLocalDescription(answer);
          this.socket.emit('answer', answer);
        })
        .catch((error) => console.error('Error handling offer:', error));
    });

    // Handle ICE candidates
    this.socket.on('ice-candidate', (candidate: RTCIceCandidateInit) => {
      this.peerConnection?.addIceCandidate(new RTCIceCandidate(candidate)).catch((error) => {
        console.error('Error adding ICE candidate:', error);
      });
    });
  }

  endCall() {
    // Disconnect the socket
    if (this.socket) {
      this.socket.disconnect();
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = undefined;
    }

    // Stop remote stream
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop());
      this.remoteStream = undefined;
    }

    // Clear remote video container
    const container = document.getElementById('remoteContainer');
    if (container) {
      container.innerHTML = ''; // Remove video elements
    }

    alert('Call ended.');
  }

  ngOnDestroy() {
    this.endCall(); // Cleanup on component destroy
  }
}
