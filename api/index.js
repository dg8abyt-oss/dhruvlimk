const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    const { message, sender, receiver } = req.body;

    // Save message to Supabase
    const { data, error } = await supabase
      .from('messages')
      .insert([{ message, sender, receiver }]);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ data });
  } else if (req.method === 'GET') {
    const { sender, receiver } = req.query;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender.eq.${sender},receiver.eq.${sender}`)
      .or(`sender.eq.${receiver},receiver.eq.${receiver}`)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ data });
  } else {
    res.setHeader('Allow', ['POST', 'GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};