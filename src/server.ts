import debug0 = require('debug');
const debug = debug0('ngs-web-ui-proxy');

import express = require('express');

import * as http from 'http';
import * as WebSocket from 'ws';

import { AddressInfo } from 'net';

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });


wss.on('connection', (ws: WebSocket) => {

    debug('connection');

});

// start our server
server.listen(process.env.PORT || 52000, () => {
    console.log(`Listening on port ${(server.address() as AddressInfo).port}`);
});
