require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fetch = require('node-fetch');
const ora = require('ora');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// In-memory store for debates
// { [debateId]: { history: [{user, text}], status: 'open'|'closed' } }
const debates = {};

app.use(express.static('public'));
app.use(express.json());

app.get('/api/debates', (req, res) => {
  const open = Object.entries(debates)
    .filter(([_, d]) => d.status === 'open')
    .map(([id]) => id);
  res.json(open);
});

app.post('/api/debates', (req, res) => {
  const id = Date.now().toString();
  debates[id] = { history: [], status: 'open' };
  res.json({ id });
});

// Query HF text-generation endpoint
async function evaluateDebate(history) {
  // Build the prompt from the chat history
  const prompt = history
    .map(m => `${m.user}: ${m.text}`)
    .join('\n')
    + '\n\nWho wins this debate? Reply with exactly "User A" or "User B".';

  console.log('Calling HF API URL:', 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3');

  const spinner = ora('Evaluating debate on Hugging Face...').start();

  // Call your working HF model
  const resp = await fetch(
    'https://api-inference.huggingface.co/models/deepseek-ai/DeepSeek-R1-Distill-Qwen-32B',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 10 }
      })
    }
  );
  spinner.stop(); // stop spinner once response is received

  if (!resp.ok) {
    const errText = await resp.text();
    spinner.fail('Evaluation failed');
    console.error('HF eval error status', resp.status, 'response body:', errText);
    throw new Error(`HF API returned ${resp.status}`);
  }

  const json = await resp.json();
  // Hugging Face pipeline returns an array with `generated_text`
  const winner = (json[0]?.generated_text || '').trim().split('\n')[0];
  spinner.succeed('Evaluation succeeded');
  return winner;
}

io.on('connection', socket => {
  socket.on('join', ({ debateId, userLabel }) => {
    const d = debates[debateId];
    if (!d || d.status !== 'open')
      return socket.emit('error', 'Invalid or closed debate');
    
    socket.join(debateId);
    socket.data = { debateId, userLabel };
    io.to(debateId).emit('system', `${userLabel} joined the debate`);
  });

  socket.on('message', text => {
    const { debateId, userLabel } = socket.data;
    const d = debates[debateId];
    if (!d || d.status !== 'open') return;
    
    d.history.push({ user: userLabel, text });
    io.to(debateId).emit('message', { user: userLabel, text });
  });

  socket.on('end', async () => {
    const { debateId, userLabel } = socket.data;
    const d = debates[debateId];
    if (!d || d.status !== 'open') return;
    
    d.status = 'closed';
    io.to(debateId).emit('system', `🛑 Debate ended by ${userLabel}`);
    
    try {
      const winner = await evaluateDebate(d.history);
      io.to(debateId).emit('result', winner);
    } catch (e) {
      console.error('HF error', e);
      io.to(debateId).emit('system', '⚠️ Could not evaluate debate.');
    }
  });
});

server.listen(3000, () => {
  console.log('Listening on http://localhost:3000');
});