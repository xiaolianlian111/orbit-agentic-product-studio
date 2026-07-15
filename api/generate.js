const SYSTEM_PROMPT = `You are Orbit's product team. Turn the user's product idea into a compact JSON specification for a working single-page web app. Return JSON only, with this exact shape:
{
  "name": "short product name",
  "tagline": "short value proposition",
  "type": "tasks|finance|habits|crm|inventory|events|generic",
  "theme": {"accent":"#hex", "surface":"warm|cool|dark"},
  "features": ["3-5 concise features"],
  "entities": [{"name":"entity name","fields":["field","field"]}],
  "sampleItems": [{"title":"item","meta":"detail","value":12}],
  "plan": {"problem":"one sentence","user":"target user","success":"success metric"}
}
Never include markdown. Keep all string values in the user's language.`;

function extractText(data) {
  if (typeof data.output_text === 'string') return data.output_text;
  const parts = data.output || [];
  for (const item of parts) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) return content.text;
    }
  }
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI provider is not configured' });

  try {
    const prompt = String(req.body?.prompt || '').slice(0, 3000);
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        instructions: SYSTEM_PROMPT,
        input: prompt,
        max_output_tokens: 900,
        text: { format: { type: 'json_object' } },
      }),
    });

    if (!response.ok) throw new Error(`Provider returned ${response.status}`);
    const data = await response.json();
    const text = extractText(data);
    return res.status(200).json(JSON.parse(text));
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Generation failed' });
  }
}
