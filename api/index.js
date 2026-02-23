const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = async (req, res) => {
  if (req.url === '/' && req.method === 'GET') {
    // Serve the index.html file
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
  } else if (req.method === 'POST' && req.url === '/api') {
    const { message, sender, groupId } = req.body;

    // Save message to Supabase
    const { data, error } = await supabase
      .from('messages')
      .insert([{ message, sender, group_id: groupId }]);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ data });
  } else if (req.method === 'GET' && req.url.startsWith('/api?groupId=')) {
    const groupId = req.url.split('=')[1];

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ data });
  } else if (req.method === 'PUT' && req.url === '/api') {
    const { username, oldUsername } = req.body;

    // Check if user exists
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      return res.status(500).json({ error: userError.message });
    }

    // If user doesn't exist, create them
    if (!userData) {
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([{ username }])
        .single();

      if (createError) {
        return res.status(500).json({ error: createError.message });
      }

      // If oldUsername is provided, merge accounts
      if (oldUsername) {
        const { data: oldUser, error: oldUserError } = await supabase
          .from('users')
          .select('*')
          .eq('username', oldUsername)
          .single();

        if (!oldUserError && oldUser) {
          // Update messages with old username to new username
          const { error: updateError } = await supabase
            .from('messages')
            .update({ sender: username })
            .eq('sender', oldUsername);

          if (updateError) {
            console.error('Error updating messages:', updateError);
          }

          // Delete old user
          const { error: deleteError } = await supabase
            .from('users')
            .delete()
            .eq('id', oldUser.id);

          if (deleteError) {
            console.error('Error deleting old user:', deleteError);
          }
        }
      }

      return res.status(200).json({ user: newUser });
    }

    return res.status(200).json({ user: userData });
  } else if (req.method === 'GET' && req.url === '/api?type=groups') {
    const { data, error } = await supabase
      .from('groups')
      .select('*');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ data });
  } else {
    res.setHeader('Allow', ['POST', 'GET', 'PUT']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};