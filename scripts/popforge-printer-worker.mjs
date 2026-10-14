#!/usr/bin/env node
// Runs on a machine in the printer LAN (not on cPanel). It reads a
// Moonraker/Klipper-compatible status endpoint and sends one-way, signed
// telemetry to POPForge. Keep the key out of source control.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Node does not load .env files by itself. The Windows installer places the
// file beside this worker, while existing process variables keep precedence.
const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env');
if (fs.existsSync(envPath)) {
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
const required = ['POPFORGE_URL', 'POPFORGE_PRINTER_ID', 'POPFORGE_PRINTER_KEY'];
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`);

const statusUrl = process.env.PRINTER_STATUS_URL || 'http://192.168.1.6:4408/printer/objects/query?print_stats&virtual_sdcard&extruder&heater_bed';
const response = await fetch(statusUrl, { signal: AbortSignal.timeout(8000) });
if (!response.ok) throw new Error(`Printer returned HTTP ${response.status}`);
const raw = await response.json();
const data = raw?.result?.status ?? raw?.status ?? raw;
const print = data.print_stats ?? {};
const virtualSd = data.virtual_sdcard ?? {};
const state = String(print.state || data.state || 'offline').toLowerCase();
const status = state.includes('print') ? 'printing' : state.includes('pause') ? 'paused' : state.includes('error') || state.includes('cancel') ? 'error' : state.includes('idle') || state.includes('ready') ? 'idle' : 'offline';
const payload = {
  printerId: process.env.POPFORGE_PRINTER_ID,
  status,
  currentFile: print.filename || virtualSd.file_path || '',
  progressPercent: Number.isFinite(Number(virtualSd.progress)) ? Math.round(Number(virtualSd.progress) * 10000) / 100 : null,
  nozzleTemperature: data.extruder?.temperature ?? null,
  bedTemperature: data.heater_bed?.temperature ?? null,
  lastError: status === 'error' ? String(print.message || print.state || 'Erro comunicado pela impressora') : '',
};
const target = new URL('/api/commerce/printers/telemetry', process.env.POPFORGE_URL).toString();
const sent = await fetch(target, { method: 'POST', headers: { 'content-type': 'application/json', 'x-popforge-printer-key': process.env.POPFORGE_PRINTER_KEY }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
if (!sent.ok) throw new Error(`POPForge returned HTTP ${sent.status}: ${await sent.text()}`);
console.log(`POPForge telemetry sent: ${status}`);
