const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://*.dhruvs.host');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle API requests
  if (req.url.startsWith('/api')) {
    if (req.method === 'GET') {
      // Handle GET requests
      const url = new URL(req.url, `http://${req.headers.host}`);
      const type = url.searchParams.get('type');
      const groupId = url.searchParams.get('groupId');
      const lastId = url.searchParams.get('lastId');

      if (type === 'groups') {
        // Get all groups
        const { data, error } = await supabase
          .from('groups')
          .select('*');

        if (error) {
          console.error('Error fetching groups:', error);
          return res.status(500).json({ error: 'Internal server error' });
        }

        return res.status(200).json({ data });
      } else if (groupId) {
        // Get messages for a specific group
        let query = supabase
          .from('messages')
          .select('*')
          .eq('group_id', groupId)
          .order('created_at', { ascending: true });

        if (lastId) {
          query = query.gt('id', lastId);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching messages:', error);
          return res.status(500).json({ error: 'Internal server error' });
        }

        return res.status(200).json({ data });
      } else {
        return res.status(400).json({ error: 'Invalid request' });
      }
    } else if (req.method === 'POST') {
      // Handle POST requests
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const { message, sender, groupId } = JSON.parse(body);

          if (!message || !sender || !groupId) {
            return res.status(400).json({ error: 'Missing required fields' });
          }

          // Insert message into database
          const { data, error } = await supabase
            .from('messages')
            .insert([{ message, sender, group_id: groupId }])
            .select();

          if (error) {
            console.error('Error inserting message:', error);
            return res.status(500).json({ error: 'Internal server error' });
          }

          // Send notification to all users in the group
          const { data: users, error: usersError } = await supabase
            .from('group_members')
            .select('user_id')
            .eq('group_id', groupId);

          if (usersError) {
            console.error('Error fetching group members:', usersError);
          } else {
            // Get all user tokens
            const userIds = users.map(user => user.user_id);
            const { data: tokens, error: tokensError } = await supabase
              .from('user_tokens')
              .select('token')
              .in('user_id', userIds);

            if (tokensError) {
              console.error('Error fetching user tokens:', tokensError);
            } else {
              // Send notification to each token
              const notificationPromises = tokens.map(tokenObj => {
                return fetch('https://fcm.googleapis.com/fcm/send', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `key=${process.env.FIREBASE_SERVER_KEY}`
                  },
                  body: JSON.stringify({
                    to: tokenObj.token,
                    notification: {
                      title: `New message from ${sender}`,
                      body: message,
                      icon: '/icons/icon-192x192.png'
                    },
                    data: {
                      groupId: groupId.toString()
                    }
                  })
                });
              });

              await Promise.all(notificationPromises);
            }
          }

          return res.status(200).json({ data });
        } catch (err) {
          console.error('Error parsing request body:', err);
          return res.status(400).json({ error: 'Invalid request body' });
        }
      });
    } else if (req.method === 'PUT') {
      // Handle PUT requests (user login)
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const { username, oldUsername } = JSON.parse(body);

          if (!username) {
            return res.status(400).json({ error: 'Missing username' });
          }

          // Check if user exists
          const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

          if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Error fetching user:', fetchError);
            return res.status(500).json({ error: 'Internal server error' });
          }

          if (existingUser) {
            // User exists, return the user
            return res.status(200).json({ user: existingUser });
          } else {
            // Create new user
            const { data: newUser, error: insertError } = await supabase
              .from('users')
              .insert([{ username }])
              .select()
              .single();

            if (insertError) {
              console.error('Error creating user:', insertError);
              return res.status(500).json({ error: 'Internal server error' });
            }

            // If old username exists, update it to the new username
            if (oldUsername) {
              const { error: updateError } = await supabase
                .from('users')
                .update({ username })
                .eq('username', oldUsername);

              if (updateError) {
                console.error('Error updating username:', updateError);
                // Don't return error, just log it
              }
            }

            return res.status(200).json({ user: newUser });
          }
        } catch (err) {
          console.error('Error parsing request body:', err);
          return res.status(400).json({ error: 'Invalid request body' });
        }
      });
    } else {
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'OPTIONS']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } else if (req.method === 'GET' && req.url === '/sign-up') {
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

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const { message_subject, message_body, icon, messenger_name } = JSON.parse(body);

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
      } catch (err) {
        console.error('Error parsing request body:', err);
        return res.status(400).json({ error: 'Invalid request body' });
      }
    });
  } else if (req.method === 'POST' && req.url === '/subscribe') {
    // Check CORS
    const origin = req.headers.origin;
    if (!origin || !origin.match(/^https:\/\/[a-zA-Z0-9-]+\.dhruvs\.host$/)) {
      return res.status(403).json({ error: 'Forbidden: Invalid origin' });
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const { token, userId } = JSON.parse(body);

        if (!token || !userId) {
          return res.status(400).json({ error: 'Missing token or userId' });
        }

        // Store the token in the database
        const { error } = await supabase
          .from('user_tokens')
          .upsert([{ user_id: userId, token }], { onConflict: 'user_id' });

        if (error) {
          console.error('Error storing token:', error);
          return res.status(500).json({ error: 'Failed to store token' });
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
      } catch (err) {
        console.error('Error parsing request body:', err);
        return res.status(400).json({ error: 'Invalid request body' });
      }
    });
  } else {
    // Serve the main HTML file for all other GET requests
    if (req.method === 'GET') {
      const filePath = path.join(__dirname, '../public/index.html');
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading index.html:', err);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(data);
        }
      });
    } else {
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'OPTIONS']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  }
};