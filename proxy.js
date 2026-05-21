const http = require('http');
const PORT = 8080;

const server = http.createServer((req, res) => {
  let targetPort = 5173;
  let targetPath = req.url;
  if (req.url.startsWith('/api') || req.url.startsWith('/socket.io')) {
    targetPort = 3000;
  } else if (req.url.startsWith('/mobile')) {
    targetPort = 5174;
  }
  const opt = { hostname: 'localhost', port: targetPort, path: targetPath, method: req.method, headers: req.headers };
  const proxyReq = http.request(opt, proxyRes => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', () => { res.writeHead(502); res.end('Bad Gateway'); });
  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`Proxy: http://localhost:${PORT}/ (admin) /mobile/ (mobile) /api/ (backend)`);
});
