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

console.log('argv', process.argv);

wss.on('connection', (ws: WebSocket) => {

    let code = crypto.randomBytes(20).toString('hex');
    console.log('Code', code);
    let authenticated = false;
    let upstream:net.Socket;

    function connect_to_upstream() {
        upstream = net.createConnection(process.argv[2]); // node server.js FIRST_ACTUAL_ARG

        upstream.on('connect', () => console.log('upstream connected'));
        upstream.on('end', () => console.log('upstream closed connection'));
        upstream.on('error', (e) => console.log('upstream error', e));

        upstream.on('data', function (data) {
            console.log('data from upstream', data);
            try {
                const msg = JSON.parse(data.toString());
                console.log('data from upstream - decoded', msg);
            } catch(e) {
                console.log('data from upstream - could not decode');
            }
            ws.send(data.toString());
        });

    }

    debug('connection');
    ws.send(JSON.stringify({'type': 'please_auth'}) + "\n");
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
                ws.send(JSON.stringify({'type': 'auth_ok'}) + "\n");
                authenticated = true;
                connect_to_upstream();
            } else {
                ws.send(JSON.stringify({'type': 'auth_fail'}) + "\n");
            }
            return;
        }
        if (!authenticated) {
            ws.send(JSON.stringify({'type': 'please_auth', 'hint': 'forbidden'}) + "\n");
            return;
        }
        if (msg.jsonrpc === '2.0') {
            // JSON-RPC is forwarded upstream

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
