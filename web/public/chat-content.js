// The current provider adapters accept text, not multimodal input. Keep image
// attachments in the saved/displayed message, but never resend their base64 as
// ordinary prompt text (a screenshot also exceeds Mastra's per-message limit).
export function textForModel(text) {
  return String(text)
    .replace(/!\[[^\]]*\]\(data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+\)/g, '[Lampiran gambar ditampilkan di Chat; piksel tidak dikirim ke model.]')
    .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, '[Data gambar tidak dikirim ke model.]');
}
