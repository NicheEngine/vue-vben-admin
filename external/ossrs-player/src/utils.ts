import type {
  PrepareResult,
  SessionInfo,
  UrlParseResult,
  WebRtcSessionOptions,
} from './types';

import { SrsError } from './errors';

/**
 * 解析 URL 查询字符串，填充到 target.user_query
 * 不再污染 target 的其他字段（避免 query 覆盖 url/schema 等）
 */
export function fillQuery(
  queryString: string,
  target: Record<string, unknown>,
): void {
  const userQuery: Record<string, string> = {};
  target.user_query = userQuery;

  if (queryString.length === 0) return;

  const search = queryString.includes('?')
    ? queryString.split('?')[1]
    : queryString;

  const params = new URLSearchParams(search);
  for (const [key, value] of params.entries()) {
    userQuery[key] = value;
  }

  // 原 SDK 行为：若存在 domain 属性，则将其值赋给 vhost
  if (target.domain) {
    target.vhost = target.domain;
  }
}

/** 解析 webrtc:// / rtc:// / rtmp:// 格式的 URL */
export function parseUrl(url: string): UrlParseResult {
  const a = document.createElement('a');
  a.href = url
    .replace('rtmp://', 'http://')
    .replace('webrtc://', 'http://')
    .replace('rtc://', 'http://');

  let vhost: string = a.hostname;
  // substring -> slice
  let app = a.pathname.slice(1, a.pathname.lastIndexOf('/'));
  const stream = a.pathname.slice(a.pathname.lastIndexOf('/') + 1);

  app = app.replace('...vhost...', '?vhost=');
  if (app.includes('?')) {
    const params = app.slice(app.indexOf('?'));
    app = app.slice(0, app.indexOf('?'));
    const vhostMatch = params.match(/vhost=([^&]+)/);
    if (vhostMatch && vhostMatch[1] !== undefined) {
      vhost = vhostMatch[1];
    }
  }

  if (a.hostname === vhost && /^(\d+\.){3}\d+$/.test(a.hostname)) {
    vhost = '__defaultVhost__';
  }

  const schema = url.includes('://')
    ? url.slice(0, url.indexOf('://'))
    : 'rtmp';

  let port = a.port ? Number(a.port) : undefined;
  if (!port) {
    if (schema === 'webrtc' && url.startsWith(`webrtc://${a.host}:`)) {
      port = url.startsWith(`webrtc://${a.host}:80`) ? 80 : 443;
    } else {
      const defaultPorts: Record<string, number> = {
        http: 80,
        https: 443,
        rtmp: 1935,
      };
      port = defaultPorts[schema];
    }
  }

  const result: UrlParseResult = {
    url,
    schema,
    server: a.hostname,
    port: port ?? 0,
    vhost,
    app,
    stream,
    user_query: {},
  };
  fillQuery(a.search, result);

  // 合并 lonely-if：外层 if 加 else 分支，或把内层条件提到外层
  if (!result.port && (schema === 'webrtc' || schema === 'rtc')) {
    if (result.user_query.schema === 'https') {
      result.port = 443;
    } else if (window.location.href.startsWith('https://')) {
      result.port = 443;
    } else {
      result.port = 1985;
    }
  }

  return result;
}

/** 准备发布/播放所需的 API 信息 */
export function prepareUrl(
  webrtcUrl: string,
  defaultPath: string,
): PrepareResult {
  const urlObject = parseUrl(webrtcUrl);
  let schema = urlObject.user_query.schema;
  schema = schema ? `${schema}:` : window.location.protocol;

  let port = urlObject.port || 1985;
  if (schema === 'https:') port = urlObject.port || 443;

  let api = urlObject.user_query.play || defaultPath;
  if (!api.endsWith('/')) api += '/';

  let apiUrl = `${schema}//${urlObject.server}:${port}${api}`;
  for (const [key, value] of Object.entries(urlObject.user_query)) {
    if (key !== 'api' && key !== 'play') {
      // 用模板字符串替代 += 拼接
      apiUrl = `${apiUrl}&${key}=${value}`;
    }
  }
  apiUrl = apiUrl.replace(`${api}&`, `${api}?`);

  const tid = Math.floor(Date.now() * Math.random() * 100)
    .toString(16)
    .slice(0, 7);
  return { apiUrl, streamUrl: webrtcUrl, schema, urlObject, port, tid };
}

/** 发送 SDP 请求（JSON 格式） */
export function postSDPJson(url: string, data: unknown): Promise<SessionInfo> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.addEventListener('load', () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) return;
      if (xhr.status !== 200 && xhr.status !== 201) {
        reject(new SrsError('HttpError', `HTTP ${xhr.status}`));
        return;
      }
      try {
        const json = JSON.parse(xhr.responseText);
        const code = json.code;
        if (code && code !== 0 && code !== '0') {
          reject(new SrsError('ApiError', String(code)));
        } else {
          resolve(json);
        }
      } catch (error) {
        reject(error);
      }
    });

    xhr.addEventListener('error', () => {
      reject(new SrsError('NetworkError', 'Request failed'));
    });

    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-type', 'application/json');
    xhr.send(JSON.stringify(data));
  });
}

/** 发送 SDP 请求（纯文本格式，用于 WHIP/WHEP） */
export function postSDPPlain(url: string, sdp: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.addEventListener('load', () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) return;
      if (xhr.status !== 200 && xhr.status !== 201) {
        reject(new SrsError('HttpError', `HTTP ${xhr.status}`));
      } else {
        resolve(xhr.responseText);
      }
    });

    xhr.addEventListener('error', () => {
      reject(new SrsError('NetworkError', 'Request failed'));
    });

    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-type', 'application/sdp');
    xhr.send(sdp);
  });
}

/** 从 WHIP/WHEP 应答中提取 sessionid */
export function extractWhipSessionId(offer: string, answer: string): string {
  const getIceUfrag = (sdp: string): string => {
    const match = sdp.match(/a=ice-ufrag:(\S+)/);
    return match?.[1] ?? '';
  };
  return `${getIceUfrag(offer)}:${getIceUfrag(answer)}`;
}

/**
 * 公共 WebRTC 会话协商逻辑。
 *
 * 关键：addTrack 和 addTransceiver 二选一，避免重复创建 transceiver。
 * - 有本地流：只 addTrack，浏览器自动创建 sendonly transceiver
 * - 无本地流：手动 addTransceiver 创建 recvonly transceiver
 */
export async function negotiateSession(
  pc: RTCPeerConnection,
  apiUrl: string,
  streamUrl: string,
  tid: string,
  options: WebRtcSessionOptions[],
  mediaStream?: MediaStream,
): Promise<SessionInfo> {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => pc.addTrack(track, mediaStream));
  } else {
    for (const opt of options) {
      pc.addTransceiver(opt.kind ?? 'audio', { direction: opt.direction });
    }
  }

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const session = await postSDPJson(apiUrl, {
    api: apiUrl,
    tid,
    streamurl: streamUrl,
    clientip: null,
    sdp: offer.sdp,
  });

  if (!session.sdp) {
    throw new SrsError('InvalidResponse', 'No SDP in response');
  }
  await pc.setRemoteDescription(
    new RTCSessionDescription({ type: 'answer', sdp: session.sdp }),
  );
  return session;
}
