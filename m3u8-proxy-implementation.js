// Simple M3U8 Proxy Implementation
// This can be deployed to Vercel, Netlify, or any Node.js hosting service

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

// Enable CORS for all routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Referer', 'User-Agent']
}));

// Middleware to parse JSON
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'M3U8 Proxy Server',
    usage: {
      m3u8: '/m3u8-proxy?url=<encoded_m3u8_url>&headers=<encoded_headers_json>',
      ts: '/ts-proxy?url=<encoded_ts_url>&headers=<encoded_headers_json>'
    }
  });
});

// M3U8 Proxy Route
app.get('/m3u8-proxy', async (req, res) => {
  try {
    const { url, headers } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    const decodedUrl = decodeURIComponent(url);
    let requestHeaders = {};
    
    if (headers) {
      try {
        requestHeaders = JSON.parse(decodeURIComponent(headers));
      } catch (e) {
        console.warn('Invalid headers JSON:', e.message);
      }
    }

    // Add default headers
    const defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      ...requestHeaders
    };

    console.log('Fetching M3U8:', decodedUrl);
    console.log('Headers:', defaultHeaders);

    const response = await fetch(decodedUrl, {
      headers: defaultHeaders,
      timeout: 30000
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    let content = await response.text();
    
    // Get the base URL for relative paths
    const baseUrl = decodedUrl.substring(0, decodedUrl.lastIndexOf('/') + 1);
    
    // Modify the M3U8 content to proxy TS files
    content = content.replace(/^(?!#)(.+\.ts.*)$/gm, (match, tsFile) => {
      let tsUrl = tsFile.trim();
      
      // Handle relative URLs
      if (!tsUrl.startsWith('http')) {
        tsUrl = baseUrl + tsUrl;
      }
      
      // Create proxy URL for TS file
      const proxyUrl = `/ts-proxy?url=${encodeURIComponent(tsUrl)}`;
      if (headers) {
        proxyUrl += `&headers=${encodeURIComponent(headers)}`;
      }
      
      return `${req.protocol}://${req.get('host')}${proxyUrl}`;
    });

    // Set appropriate headers
    res.set({
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Referer, User-Agent',
      'Cache-Control': 'no-cache'
    });

    res.send(content);

  } catch (error) {
    console.error('M3U8 Proxy Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch M3U8', 
      details: error.message 
    });
  }
});

// TS (Video Segment) Proxy Route
app.get('/ts-proxy', async (req, res) => {
  try {
    const { url, headers } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    const decodedUrl = decodeURIComponent(url);
    let requestHeaders = {};
    
    if (headers) {
      try {
        requestHeaders = JSON.parse(decodeURIComponent(headers));
      } catch (e) {
        console.warn('Invalid headers JSON:', e.message);
      }
    }

    // Add default headers
    const defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Range': req.headers.range || undefined,
      ...requestHeaders
    };

    console.log('Fetching TS:', decodedUrl);

    const response = await fetch(decodedUrl, {
      headers: defaultHeaders,
      timeout: 30000
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Set appropriate headers for video content
    res.set({
      'Content-Type': response.headers.get('content-type') || 'video/mp2t',
      'Content-Length': response.headers.get('content-length'),
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Referer, User-Agent, Range',
      'Cache-Control': 'public, max-age=3600'
    });

    // Handle range requests
    if (response.headers.get('content-range')) {
      res.set('Content-Range', response.headers.get('content-range'));
      res.status(206);
    }

    // Pipe the response
    response.body.pipe(res);

  } catch (error) {
    console.error('TS Proxy Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch TS file', 
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Handle preflight requests
app.options('*', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Referer, User-Agent, Range'
  });
  res.status(200).end();
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`M3U8 Proxy Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Usage: http://localhost:${PORT}/m3u8-proxy?url=<encoded_m3u8_url>`);
});

module.exports = app;

