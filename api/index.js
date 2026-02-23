const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://*.dhruvs.host');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET' && req.url === '/sign-up') {
    // Serve the sign-up script
    const filePath = path.join(__dirname, '../public/sign-up.js');
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading sign-up.js:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      } else {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(data);
      }
    });
  } else if (req.method === 'POST' && req.url === '/send') {
    // Check CORS
    const origin = req.headers.origin;
    if (!origin || !origin.match(/^https:\/\/[a-zA-Z0-9-]+\.dhruvs\.host$/)) {
      return res.status(403).json({ error: 'Forbidden: Invalid origin' });
    }

    const { message_subject, message_body, icon, messenger_name } = req.body;

    if (!message_subject || !message_body) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Extract subdomain from origin
    const subdomain = origin.split('//')[1].split('.')[0];
    const topic = `${subdomain}-dhruvs-host`;

    // Send notification to topic
    try {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${process.env.FIREBASE_SERVER_KEY}`
        },
        body: JSON.stringify({
          to: `/topics/${topic}`,
          notification: {
            title: message_subject,
            body: message_body,
            icon: icon || '/icons/icon-192x192.png'
          },
          data: {
            messenger_name: messenger_name || 'System'
          }
        })
      });

      if (!response.ok) {
        console.error('Failed to send notification:', await response.text());
        return res.status(500).json({ error: 'Failed to send notification' });
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Error sending notification:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST' && req.url === '/subscribe') {
    // Check CORS
    const origin = req.headers.origin;
    if (!origin || !origin.match(/^https:\/\/[a-zA-Z0-9-]+\.dhruvs\.host$/)) {
      return res.status(403).json({ error: 'Forbidden: Invalid origin' });
    }

    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Missing token' });
    }

    // Extract subdomain from origin
    const subdomain = origin.split('//')[1].split('.')[0];
    const topic = `${subdomain}-dhruvs-host`;

    // Subscribe token to topic
    try {
      const response = await fetch('https://iid.googleapis.com/iid/v1/' + token + '/rel/topics/' + topic, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${process.env.FIREBASE_SERVER_KEY}`
        }
      });

      if (!response.ok) {
        console.error('Failed to subscribe token:', await response.text());
        return res.status(500).json({ error: 'Failed to subscribe token' });
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Error subscribing token:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};