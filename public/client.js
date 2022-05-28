// https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications
sock = new WebSocket("ws://localhost:52000/");

sock.onmessage = function (event) {
    console.log('onmessage', event);
    const data = JSON.parse(event.data);
    console.log('onmessage - parsed', data);
}

document.getElementById('auth').addEventListener('submit', e => {
    console.log('auth submit');
    e.preventDefault();
    const code = document.getElementById('code').value;
    sock.send(JSON.stringify({type: 'auth', code: code}));
});

document.getElementById('add_one').addEventListener('click', e => {
    console.log('add_one submit');
    sock.send(JSON.stringify({"jsonrpc": "2.0", "id": 10, "method": "add_one", "params": [1000]}));
})
