// Spawn vite dev server for deaf-user PWA on port 5175 and keep it alive.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const cwd = '/c/Users/kanan/OneDrive/Desktop/Signova';
const server = spawn('npx', ['vite', '--config', 'apps/web-deaf-user-pwa/vite.config.ts', '--port', '5175'], {
  cwd,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let out = '';
let err = '';
server.stdout.on('data', d => { out += d.toString(); console.log('[vite-out]', d.toString().trim()); });
server.stderr.on('data', d => { err += d.toString(); console.log('[vite-err]', d.toString().trim()); });

const url = 'http://localhost:5175/';
const start = Date.now();
let ready = false;
const timer = setInterval(() => {
  http.get(url, res => {
    if (res.statusCode === 200) {
      ready = true;
      clearInterval(timer);
      console.log('READY after', Date.now() - start, 'ms');
      // keep alive; server will be killed by parent when this exits
      setTimeout(() => { /* keep process alive */ }, 60000);
    } else {
      res.resume();
    }
  }).on('error', () => {});
}, 1000);

setTimeout(() => {
  if (!ready) {
    clearInterval(timer);
    console.log('NOT READY. stdout tail:', out.slice(-1500));
    console.log('stderr tail:', err.slice(-1500));
    server.kill('SIGTERM');
    process.exit(1);
  }
}, 25000);

// Keep process alive
process.on('SIGTERM', () => { server.kill('SIGTERM'); process.exit(0); });
process.on('exit', () => { server.kill('SIGTERM'); });
