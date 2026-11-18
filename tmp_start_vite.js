const { spawn } = require('child_process');
const http = require('http');

const server = spawn('npx', ['vite', '--config', 'apps/web-deaf-user-pwa/vite.config.ts', '--port', '5175'], {
  cwd: '/c/Users/kanan/OneDrive/Desktop/Signova',
  stdio: ['ignore', 'pipe', 'pipe'],
});

let out = '';
let err = '';
server.stdout.on('data', d => { out += d.toString(); process.stdout.write(d); });
server.stderr.on('data', d => { err += d.toString(); process.stderr.write(d); });

const url = 'http://localhost:5175/';
const start = Date.now();
let ready = false;
const timer = setInterval(() => {
  http.get(url, res => {
    if (res.statusCode === 200) {
      ready = true;
      clearInterval(timer);
      console.log('READY after', Date.now() - start, 'ms');
      // give a moment for hard reload, then exit
      setTimeout(() => { server.kill('SIGTERM'); process.exit(0); }, 1500);
    } else {
      res.resume();
    }
  }).on('error', () => {});
}, 1000);

setTimeout(() => {
  if (!ready) {
    clearInterval(timer);
    console.log('NOT READY. stdout:', out.slice(-2000));
    console.log('stderr:', err.slice(-2000));
    server.kill('SIGTERM');
    process.exit(1);
  }
}, 30000);
