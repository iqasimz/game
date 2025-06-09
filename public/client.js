const socket = io();
const params = new URLSearchParams(location.search);
const debateId = params.get('id');
const userLabel = prompt('Your name (e.g. User A or User B)') || 'Anonymous';

document.getElementById('did').innerText = debateId;
const chat = document.getElementById('chat');
const addLine = txt => {
  chat.innerHTML += '<div>'+txt+'</div>';
  chat.scrollTop = chat.scrollHeight;
};

socket.emit('join', { debateId, userLabel });

socket.on('system', txt => addLine(`<i>${txt}</i>`));
socket.on('message', ({user, text}) => addLine(`<b>${user}:</b> ${text}`));
socket.on('error', err => addLine(`<span style="color:red;">Error: ${err}</span>`));

// New listener to display the AI’s result
socket.on('result', winner => addLine(`<h2>🏆 Winner: ${winner}</h2>`));

document.getElementById('send').onclick = () => {
  const t = document.getElementById('msg').value.trim();
  if (!t) return;
  socket.emit('message', t);
  document.getElementById('msg').value = '';
};

document.getElementById('end').onclick = () => {
  if (confirm('Really end this debate?')) {
    socket.emit('end');
  }
};