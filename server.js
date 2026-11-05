const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
app.use(express.static(__dirname));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let conn = null;
  const send = (o) => ws.readyState === 1 && ws.send(JSON.stringify(o));

  ws.on('message', async (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.type !== 'connect' || !m.username) return;
    if (conn) { try { conn.disconnect(); } catch {} }
    conn = new WebcastPushConnection(
  m.username.replace('@', '').trim(),
  {
    signProvider: 'https://tiktok-sign.vercel.app/api/sign'
  }
);

    conn.on('chat', (d) => send({ type: 'chat', user: d.uniqueId, nick: d.nickname, text: d.comment }));
    conn.on('gift', (d) => {
      // الهدايا المتكررة: نرسل عند انتهاء السلسلة فقط
      if (d.giftType === 1 && !d.repeatEnd) return;
      send({ type: 'gift', user: d.uniqueId, nick: d.nickname, gift: d.giftName, count: d.repeatCount || 1, diamonds: d.diamondCount || 1 });
    });
    conn.on('disconnected', () => send({ type: 'status', ok: false, msg: 'انقطع الاتصال' }));
    try {
      await conn.connect();
      send({ type: 'status', ok: true, msg: 'تم الاتصال بالبث ✅' });
    } catch (e) {
      console.error('CONNECT ERROR:', e);
      send({ type: 'status', ok: false, msg: 'فشل: ' + String((e && (e.message || e.exception && e.exception.message)) || e).slice(0, 200) });
    }
  });
  ws.on('close', () => { try { conn && conn.disconnect(); } catch {} });
});

server.listen(process.env.PORT || 3000, () => console.log('Running'));
