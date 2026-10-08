export interface UrlParseResult extends Record<string, unknown> {
  url: string;
  schema: string;
  server: string;
  port: number;
  vhost: string;
  app: string;
  stream: string;
  user_query: Record<string, string>;
  domain?: string;
}

export interface PrepareResult {
  apiUrl: string;
  streamUrl: string;
  schema: string;
  urlObject: UrlParseResult;
  port: number;
  tid: string;
}

export interface SessionInfo {
  sdp?: string;
  simulator?: string;
  sessionid?: string;
  [key: string]: unknown;
}

export interface WebRtcSessionOptions {
  direction: RTCRtpTransceiverDirection;
  kind?: 'audio' | 'video';
}
