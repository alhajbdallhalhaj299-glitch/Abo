import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import * as tlcNs from 'tiktok-live-connector';
const tlc = (tlcNs.TikTokLiveConnection || !tlcNs.default) ? tlcNs : tlcNs.default;
const TikTokLiveConnection = tlc.TikTokLiveConnection || tlc.WebcastPushConnection;
const SignConfig = tlc.SignConfig;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function findKey() {
  const direct = (process.env.EULER_API_KEY || '').trim();
  if (direct) return direct;
  for (const [k, v] of Object.entries(process.env)) {
    if (/^euler_[A-Za-z0-9]{20,}$/.test((v || '').trim())) return v.trim(); // المفتاح في خانة القيمة
    if (/^euler_[A-Za-z0-9]{20,}$/.test(k)) return k;                     // المفتاح اتكتب في خانة الاسم
  }
  return '';
}
const KEY = findKey();
if (KEY && SignConfig) SignConfig.apiKey = KEY;
console.log('Euler key present:', !!KEY);

process.on('uncaughtException', (e) => console.error('UNCAUGHT:', e));
process.on('unhandledRejection', (e) => console.error('UNHANDLED:', e));

const app = express();
app.use(express.static(__dirname));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const errText = (e) => String((e && (e.message || e.exception?.message)) || e).slice(0, 200);

wss.on('connection', (ws) => {
  let conn = null;
  const send = (o) => ws.readyState === 1 && ws.send(JSON.stringify(o));

  ws.on('message', async (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (m.type !== 'connect' || !m.username) return;

    if (conn) { try { conn.disconnect(); } catch {} }
    conn = new TikTokLiveConnection(m.username.replace('@', '').trim(), KEY ? { signApiKey: KEY } : {});

conn.on('chat', (d) => {
  const u = d.user || d;

  const comment = [
    d.comment,
    d.text,
    d.content,
    d.message
  ].find(v => typeof v === 'string' && v.trim());

  console.log('CHAT EVENT:', {
    keys: Object.keys(d || {}),
    comment
  });

  send({
    type: 'chat',
    user: u.uniqueId || u.unique_id || u.nickname || 'viewer',
    nick: u.nickname || u.uniqueId || 'مشاهد',
    text: comment || ''
  });
});

    
    conn.on('gift', (d) => {
      if (d.giftType === 1 && !d.repeatEnd) return; // سلسلة هدايا لسه شغالة
      const u = d.user || d;
      send({
        type: 'gift', user: u.uniqueId, nick: u.nickname,
        gift: d.giftName || d.giftDetails?.giftName || 'gift',
        count: d.repeatCount || 1,
        diamonds: d.diamondCount || d.giftDetails?.diamondCount || 1
      });
    });
    conn.on('disconnected', () => send({ type: 'status', ok: false, msg: 'انقطع الاتصال بالبث' }));
    conn.on('error', (e) => {
      console.error('CONN ERROR:', e);
      send({ type: 'status', ok: false, msg: 'خطأ: ' + errText(e) });
    });

    try {
      await conn.connect();
      send({ type: 'status', ok: true, msg: 'تم الاتصال بالبث ✅' });
    } catch (e) {
      console.error('CONNECT ERROR:', e);
      send({ type: 'status', ok: false, msg: 'فشل: ' + errText(e) });
    }
  });

  ws.on('close', () => { try { conn && conn.disconnect(); } catch {} });
});

server.listen(process.env.PORT || 3000, () => console.log('Running'));
