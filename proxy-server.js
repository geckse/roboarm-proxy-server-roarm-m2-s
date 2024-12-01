const http = require('http');

/*
    Robot arms as IP here
*/
const TARGET_IPS = [
    { ip: '192.168.178.164' }
    // Add more targets here
];
const PROXY_PORT = 3300;

const server = http.createServer((req, res) => {
    // Get target index from query param
    const urlParts = new URL(req.url, `http://${req.headers.host}`);
    const targetIndex = urlParts.searchParams.get('target') || 0;
    
    if (!TARGET_IPS[targetIndex]) {
        res.writeHead(400);
        res.end(JSON.stringify({
            error: 'Invalid target',
            availableTargets: TARGET_IPS.map((t, i) => ({ index: i, ip: t.ip }))
        }));
        return;
    }

    const TARGET = TARGET_IPS[targetIndex];
    console.log(`[${new Date().toISOString()}] Routing to target[${targetIndex}]: ${TARGET.ip}`);

    // Remove target param from forwarded URL
    urlParts.searchParams.delete('target');
    const cleanUrl = urlParts.pathname + urlParts.search;

    const options = {
        hostname: TARGET.ip,
        path: cleanUrl,
        method: req.method,
        headers: req.headers
    };

    const proxy = http.request(options, (targetRes) => {
        console.log(`\n=== Response from ${TARGET.ip} ===`);
        console.log(`Status: ${targetRes.statusCode}`);
        console.log('Headers:', targetRes.headers);

        let body = '';
        targetRes.on('data', (chunk) => {
            body += chunk;
        });
        
        targetRes.on('end', () => {
            console.log('Response body:', body);
            
            // Set CORS and JSON headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.setHeader('Content-Type', 'application/json');
            
            try {
                const jsonBody = JSON.parse(body);
                res.end(jsonBody);
            } catch (e) {
                res.end(body);
            }
            console.log('===========================\n');
        });
    });

    req.pipe(proxy);

    proxy.on('error', (err) => {
        console.error(`[${new Date().toISOString()}] Proxy error:`, err.message);
        res.writeHead(500);
        res.end(`Proxy Error: ${err.message}`);
    });

    // Handle OPTIONS requests for CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.writeHead(200);
        res.end();
        return;
    }
});

server.listen(PROXY_PORT, () => {
    const interfaces = require('os').networkInterfaces();
    const addresses = [];
    
    for (const k in interfaces) {
        for (const addr of interfaces[k]) {
            if (addr.family === 'IPv4' && !addr.internal) {
                addresses.push(addr.address);
            }
        }
    }

    console.log('\n=== Proxy Server Started ===');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Local Access: http://localhost:${PROXY_PORT}`);
    console.log(`Network Access: ${addresses.map(addr => `http://${addr}:${PROXY_PORT}`).join('\n              ')}`);
    console.log(`Forwarding to: ${TARGET_IPS.map(t => `${t.ip}:${t.port}`).join('\n              ')}`);
    console.log('=========================\n');
}); 