const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    const { message, sender, groupId } = req.body;

    // Save message to Supabase
    const { data, error } = await supabase
      .from('messages')
      .insert([{ message, sender, group_id: groupId }]);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ data });
  } else if (req.method === 'GET') {
    const { groupId } = req.query;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ data });
  } else if (req.method === 'PUT') {
    const { username } = req.body;

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

      return res.status(200).json({ user: newUser });
    }

    return res.status(200).json({ user: userData });
  } else if (req.method === 'GET' && req.query.type === 'groups') {
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