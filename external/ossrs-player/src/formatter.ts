export function SrsRtcFormatSenders(
  senders: RTCRtpSender[],
  kind?: string,
): string {
  const codecs: string[] = [];
  for (const sender of senders) {
    if (kind && sender.track?.kind !== kind) continue;
    const params = sender.getParameters();
    for (const codec of params.codecs ?? []) {
      const mime = codec.mimeType.toLowerCase();
      if (
        mime.includes('/red') ||
        mime.includes('/rtx') ||
        mime.includes('/fec')
      ) {
        continue;
      }

      let desc = codec.mimeType.replace(/^(audio|video)\//, '');
      desc += `, ${codec.clockRate}Hz`;
      if (sender.track?.kind === 'audio') {
        desc += `, channels: ${codec.channels ?? 1}`;
      }
      desc += `, pt: ${codec.payloadType}`;
      codecs.push(desc);
    }
  }
  return codecs.join(', ');
}
