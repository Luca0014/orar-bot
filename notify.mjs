// Trimite notificarea prin WhatsApp Cloud API (oficial, Meta): incarca PDF-ul si il trimite
// ca antet de tip document intr-un mesaj-sablon (sabloanele sunt singurele mesaje pe care
// un numar business le poate trimite oricand, fara ca tu sa-i fi scris in ultimele 24h).
const {
  WHATSAPP_TOKEN,
  WHATSAPP_PHONE_ID,
  WHATSAPP_TO,
  WHATSAPP_TEMPLATE = 'orar_nou',
  WHATSAPP_TEMPLATE_LANG = 'ro',
  GRAPH_VERSION = 'v25.0',
} = process.env;

async function graph(path, init) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_PHONE_ID}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, ...init.headers },
    signal: AbortSignal.timeout(60_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = body.error ?? {};
    throw new Error(`WhatsApp API (${path}): ${res.status} ${e.message ?? ''} ${e.error_data?.details ?? ''}`.trim());
  }
  return body;
}

export async function notify({ title, fileName, url, pdf }) {
  for (const name of ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_ID', 'WHATSAPP_TO']) {
    if (!process.env[name]) throw new Error(`Lipseste variabila ${name}`);
  }

  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', 'application/pdf');
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), fileName);
  const media = await graph('media', { method: 'POST', body: form });

  const text = (value) => ({ type: 'text', text: value });
  await graph('messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: WHATSAPP_TO.replace(/\D/g, ''),
      type: 'template',
      template: {
        name: WHATSAPP_TEMPLATE,
        language: { code: WHATSAPP_TEMPLATE_LANG },
        components: [
          { type: 'header', parameters: [{ type: 'document', document: { id: media.id, filename: fileName } }] },
          { type: 'body', parameters: [text(title), text(fileName), text(url)] },
        ],
      },
    }),
  });
}
