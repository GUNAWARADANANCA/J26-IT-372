import http from 'node:http'

function createViteProxy() {
  const server = http.createServer((clientReq, clientRes) => {
    const options = {
      hostname: '127.0.0.1',
      port: 5173,
      path: clientReq.url,
      method: clientReq.method,
      headers: { ...clientReq.headers, host: 'localhost:5173' },
    }

    const proxyReq = http.request(options, (proxyRes) => {
      clientRes.writeHead(proxyRes.statusCode, proxyRes.headers)
      proxyRes.pipe(clientRes, { end: true })
    })

    proxyReq.on('error', (err) => {
      if (clientReq.url && clientReq.url.startsWith('/api')) {
        clientRes.writeHead(502, { 'Content-Type': 'application/json' })
        clientRes.end(JSON.stringify({ detail: `Gateway error: Frontend dev server (Vite on 5173) is not responding: ${err.message}` }))
      } else {
        clientRes.writeHead(302, { Location: `http://localhost:5173${clientReq.url}` })
        clientRes.end()
      }
    })

    clientReq.pipe(proxyReq, { end: true })
  })

  server.on('upgrade', (req, socket, head) => {
    const proxyReq = http.request({
      hostname: '127.0.0.1',
      port: 5173,
      path: req.url,
      method: req.method,
      headers: req.headers,
    })

    proxyReq.on('upgrade', (res, proxySocket, proxyHead) => {
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
          Object.entries(res.headers)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\r\n') +
          '\r\n\r\n'
      )
      proxySocket.pipe(socket).pipe(proxySocket)
    })

    proxyReq.on('error', () => socket.destroy())
    proxyReq.end()
  })

  return server
}

// 1. Listen on Port 3000 (standard React dev port)
try {
  const p3000 = createViteProxy()
  p3000.listen(3000, '0.0.0.0', () => {
    console.log('Port 3000 (IPv4): Proxy running -> forwarding to http://127.0.0.1:5173')
  })
  p3000.on('error', (err) => console.log('Port 3000 warning:', err.message))
} catch (e) {
  console.log('Port 3000 error:', e.message)
}

// 2. Listen on Port 80 (default http://localhost with no port specified)
try {
  const p80 = createViteProxy()
  p80.listen(80, '0.0.0.0', () => {
    console.log('Port 80 (IPv4): Default HTTP proxy running -> forwarding to http://127.0.0.1:5173')
  })
  p80.on('error', (err) => console.log('Port 80 skipped:', err.message))
} catch (e) {
  console.log('Port 80 error:', e.message)
}

// 3. Listen on Port 8080 (common dev port)
try {
  const p8080 = createViteProxy()
  p8080.listen(8080, '0.0.0.0', () => {
    console.log('Port 8080 (IPv4): Proxy running -> forwarding to http://127.0.0.1:5173')
  })
  p8080.on('error', (err) => console.log('Port 8080 skipped:', err.message))
} catch (e) {
  console.log('Port 8080 error:', e.message)
}


