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
const KEY = (process.env.EULER_API_KEY || '').trim();
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
