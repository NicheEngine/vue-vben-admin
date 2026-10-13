/**
 * 根据 URL 猜测流协议类型
 */
export type StreamProtocol =
  | 'hls'
  | 'http-flv'
  | 'https-flv'
  | 'unknown'
  | 'ws-flv'
  | 'wss-flv';

export interface ProtocolInfo {
  protocol: StreamProtocol;
  label: string;
  color: string;
  description: string;
}

export function detectProtocol(url: string): ProtocolInfo {
  const lower = url.trim().toLowerCase();

  if (lower.startsWith('ws://')) {
    return {
      protocol: 'ws-flv',
      label: 'WebSocket-FLV',
      color: 'green',
      description: 'WebSocket 长连接，低延迟，推荐',
    };
  }
  if (lower.startsWith('wss://')) {
    return {
      protocol: 'wss-flv',
      label: 'WSS-FLV',
      color: 'green',
      description: '加密 WebSocket 长连接，低延迟，推荐',
    };
  }
  if (lower.startsWith('https://') && lower.includes('.m3u8')) {
    return {
      protocol: 'hls',
      label: 'HLS (HTTPS)',
      color: 'blue',
      description: '基于 HTTPS 的 HLS，兼容性好，延迟较高',
    };
  }
  if (lower.startsWith('http://') && lower.includes('.m3u8')) {
    return {
      protocol: 'hls',
      label: 'HLS (HTTP)',
      color: 'orange',
      description: '基于 HTTP 的 HLS，可能被浏览器拦截（混合内容）',
    };
  }
  if (lower.startsWith('https://') && lower.includes('.flv')) {
    return {
      protocol: 'https-flv',
      label: 'HTTPS-FLV',
      color: 'green',
      description: '基于 HTTPS 的 FLV，安全，推荐',
    };
  }
  if (lower.startsWith('http://') && lower.includes('.flv')) {
    return {
      protocol: 'http-flv',
      label: 'HTTP-FLV',
      color: 'orange',
      description: '基于 HTTP 的 FLV，可能被浏览器拦截（混合内容）',
    };
  }
  return {
    protocol: 'unknown',
    label: '未知',
    color: 'default',
    description: '无法识别协议，请确认地址',
  };
}

/**
 * 探测 URL 是否能访问（HEAD 请求）
 */
export async function probeUrl(url: string): Promise<{
  ok: boolean;
  status?: number;
  contentType?: string;
  error?: string;
}> {
  try {
    const resp = await fetch(url, { method: 'HEAD' });
    return {
      ok: resp.ok,
      status: resp.status,
      contentType: resp.headers.get('content-type') ?? undefined,
    };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || '请求失败',
    };
  }
}
