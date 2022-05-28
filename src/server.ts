import * as http from 'http';
import * as net from 'net';
import * as crypto from "crypto";

import express = require('express');
import * as WebSocket from 'ws';
import debug0 = require('debug');

import { AddressInfo } from 'net';

const debug = debug0('ngs-web-ui-proxy');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const id_to_ws = new Map();

console.log('argv', process.argv);
const upstream = net.createConnection(process.argv[2]); // node server.js FIRST_ACTUAL_ARG

upstream.on('data', function (data) {
    console.log('data from upstream', data);
    const msg = JSON.parse(data.toString());
    console.log('data from upstream - decoded', msg);
    if(id_to_ws.has(msg.id)) {
        console.log('Found client for message', msg.id);
        id_to_ws.get(msg.id).send(data.toString());
        id_to_ws.delete(msg.id);
    } else {
        console.error('Found client for message', msg.id);
    }
});


wss.on('connection', (ws: WebSocket) => {

    let code = crypto.randomBytes(20).toString('hex');
    console.log('Code', code);
    let authenticated = false;

    debug('connection');
    ws.send(JSON.stringify({'type': 'please_auth'}));
    ws.onmessage = function (event) {
        if (typeof event.data !== "string") {
            console.log('event.data is not a string')
            return;
        }
        const msg = JSON.parse(event.data);
        console.log('message', msg);
        // maybe implement as JSON RPC too?
        if (msg.type === 'auth') {
            if (msg.code === code) {
                ws.send(JSON.stringify({'type': 'auth_ok'}));
                authenticated = true;
            } else {
                ws.send(JSON.stringify({'type': 'auth_fail'}));
            }
            return;
        }
        if (!authenticated) {
            ws.send(JSON.stringify({'type': 'please_auth', 'hint': 'forbidden'}));
            return;
        }
        if (msg.jsonrpc === '2.0') {
            // JSON-RPC is forwarded upstream

            if (msg.id) {
                id_to_ws.set(msg.id, ws);
            }

            upstream.write(event.data + "\n", function (err) {
                if(err) {
                    console.error('Failed to write to upstream', err);
                } else {
                    console.log('Send upstream', event.data);
                }
            });
        }
    }

});

server.listen(process.env.PORT || 52000, () => {
    console.log(`Listening on port ${(server.address() as AddressInfo).port}`);
});
