import { Component, OnInit, OnDestroy } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { WebrtcService } from '../services/webrtc.service';

@Component({
  selector: 'app-home',
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-title>
          WebRTC Video Call
        </ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="video-container">
        <!-- Remote Videos -->
        <ion-card *ngFor="let remoteStream of remoteStreams">
          <ion-card-header>
            <ion-card-title>Remote Participant</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <video 
              autoplay 
              playsinline
              [srcObject]="remoteStream"
            ></video>
          </ion-card-content>
        </ion-card>
      </div>

      <!-- Call Controls -->
      <ion-fab vertical="bottom" horizontal="center" slot="fixed">
        <ion-fab-button 
          color="primary"
          (click)="initiateCall()"
          [disabled]="isCallInProgress">
          <ion-icon name="call"></ion-icon>
        </ion-fab-button>
        <ion-fab-button 
          color="danger" 
          (click)="endCall()"
          [disabled]="!isCallInProgress">
          <ion-icon name="call"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
  styleUrls: ['home.page.scss']
})
export class HomePage implements OnInit, OnDestroy {
  isCallInProgress = false;
  remoteStreams: MediaStream[] = [];

  constructor(
    private webrtcService: WebrtcService,
    private alertController: AlertController
  ) {}

  async ngOnInit() {
    try {
      console.log('Initializing...');
      this.webrtcService.remoteStreams$.subscribe((streams) => {
        this.remoteStreams = streams;
        console.log('Remote streams updated:', this.remoteStreams);
      });
    } catch (error) {
      this.showErrorAlert('Initialization Failed', error);
    }
  }

  async initiateCall() {
    try {
      console.log('Starting call...');
      await this.webrtcService.initiateCall('default-room');
      this.isCallInProgress = true;
    } catch (error) {
      console.error('Error initiating call:', error);
      this.showErrorAlert('Call Initiation Failed', error);
    }
  }

  async endCall() {
    try {
      console.log('Ending call...');
      await this.webrtcService.endCall();
      this.isCallInProgress = false;
    } catch (error) {
      console.error('Error ending call:', error);
      this.showErrorAlert('End Call Failed', error);
    }
  }

  async showErrorAlert(header: string, error: any) {
    const alert = await this.alertController.create({
      header: header,
      message: error.message || 'An unexpected error occurred',
      buttons: ['OK']
    });
    await alert.present();
  }

  ngOnDestroy() {
    console.log('Cleaning up resources...');
    this.webrtcService.cleanup();
  }
}
