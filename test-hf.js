require('dotenv').config();
const fetch = require('node-fetch');

async function test() {
  const prompt = 'User A: The sky is blue\nUser B: No, it is green\n\nWho wins?';
  const resp = await fetch(
    'https://api-inference.huggingface.co/models/deepseek-ai/DeepSeek-R1-Distill-Qwen-32B',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt }),
    }
  );
  if (!resp.ok) {
    console.error(`HTTP ${resp.status}`, await resp.text());
    process.exit(1);
  }
  const json = await resp.json();
  console.log('Result:', json[0].generated_text.trim());
}

test().catch(err => console.error(err));