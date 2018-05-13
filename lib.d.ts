declare module "react-native-webrtc" {
  interface RTCDataChannel {
    readyState: "open" | "close";
    onopen: (event: any) => void;
    onclose: (event: any) => void;
    onmessage: (event: MessageEvent) => void;
    send(message: any): void;
    close(): void;
  }

  interface RTCPeerConnection extends EventTarget {
    readonly canTrickleIceCandidates: boolean | null;
    readonly iceConnectionState: RTCIceConnectionState;
    readonly iceGatheringState: RTCIceGatheringState;
    readonly localDescription: RTCSessionDescription | null;
    onaddstream: (this: RTCPeerConnection, ev: MediaStreamEvent) => any;
    onicecandidate: (this: RTCPeerConnection, ev: RTCPeerConnectionIceEvent) => any;
    oniceconnectionstatechange: (this: RTCPeerConnection, ev: Event) => any;
    onicegatheringstatechange: (this: RTCPeerConnection, ev: Event) => any;
    onnegotiationneeded: (this: RTCPeerConnection, ev: Event) => any;
    onremovestream: (this: RTCPeerConnection, ev: MediaStreamEvent) => any;
    onsignalingstatechange: (this: RTCPeerConnection, ev: Event) => any;
    readonly remoteDescription: RTCSessionDescription | null;
    readonly signalingState: RTCSignalingState;
    addIceCandidate(candidate: RTCIceCandidate, successCallback?: VoidFunction, failureCallback?: RTCPeerConnectionErrorCallback): Promise<void>;
    addStream(stream: MediaStream): void;
    close(): void;
    createAnswer(successCallback?: RTCSessionDescriptionCallback, failureCallback?: RTCPeerConnectionErrorCallback): Promise<RTCSessionDescription>;
    createOffer(successCallback?: RTCSessionDescriptionCallback, failureCallback?: RTCPeerConnectionErrorCallback, options?: RTCOfferOptions): Promise<RTCSessionDescription>;
    getConfiguration(): RTCConfiguration;
    getLocalStreams(): MediaStream[];
    getRemoteStreams(): MediaStream[];
    getStats(selector: MediaStreamTrack | null, successCallback?: RTCStatsCallback, failureCallback?: RTCPeerConnectionErrorCallback): Promise<RTCStatsReport>;
    getStreamById(streamId: string): MediaStream | null;
    removeStream(stream: MediaStream): void;
    setLocalDescription(description: RTCSessionDescription, successCallback?: VoidFunction, failureCallback?: RTCPeerConnectionErrorCallback): Promise<void>;
    setRemoteDescription(description: RTCSessionDescription, successCallback?: VoidFunction, failureCallback?: RTCPeerConnectionErrorCallback): Promise<void>;
    addEventListener<K extends keyof RTCPeerConnectionEventMap>(type: K, listener: (this: RTCPeerConnection, ev: RTCPeerConnectionEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof RTCPeerConnectionEventMap>(type: K, listener: (this: RTCPeerConnection, ev: RTCPeerConnectionEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
    ondatachannel: (event: { channel: RTCDataChannel }) => void;
    createDataChannel(channel: string): RTCDataChannel;
  }

  declare var RTCPeerConnection: {
    prototype: RTCPeerConnection;
    new(configuration: RTCConfiguration): RTCPeerConnection;
  };

  interface RTCSessionDescription {
    sdp: string | null;
    type: RTCSdpType | null;
    toJSON(): any;
  }

  declare var RTCSessionDescription: {
    prototype: RTCSessionDescription;
    new(descriptionInitDict?: RTCSessionDescriptionInit): RTCSessionDescription;
  };
}
