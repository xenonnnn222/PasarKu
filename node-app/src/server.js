import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { openDb } from './db.js';
import { pruneDemoUsers } from './services/accounts.js';

const db = openDb(config.dbPath);
pruneDemoUsers(db);
setInterval(() => pruneDemoUsers(db), 60 * 60 * 1000).unref();

const server = http.createServer(createApp({ db }));

server.listen(config.port, config.host, () => {
  console.log(`PasarKu berjalan di http://${config.host}:${config.port}${config.basePath}/`);
  console.log(`Database: ${config.dbPath}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
