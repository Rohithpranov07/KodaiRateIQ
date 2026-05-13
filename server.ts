import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { initCronJobs } from './src/cron/scheduler';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      
      // Initialize cron jobs after server starts
      try {
        console.log('> Booting node-cron scheduler...');
        initCronJobs();
      } catch (e) {
        console.error('> Failed to boot cron scheduler:', e);
      }
    });
});
