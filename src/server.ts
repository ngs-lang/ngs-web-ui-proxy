import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {exec} from 'child_process';

import * as http from 'http';
import * as net from 'net';
import {AddressInfo} from 'net';
import * as crypto from "crypto";
import * as WebSocket from 'ws';
import express = require('express');
import debug0 = require('debug');
import * as assert from "assert";

const debug = debug0('ngs-web-ui-proxy');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

console.log('argv', process.argv);

// Auth - start setup
// Authentication is a mess, redo later
const code = crypto.randomBytes(20).toString('hex');
const secret = crypto.randomBytes(20).toString('hex');
let canAuthenticateWithCode = true; // Single use code
let authAttempts = 0;

setTimeout(function () {
    canAuthenticateWithCode = false;
    console.log('Authentication is now disabled');
}, 10000);
// Auth - end setup

function runCommand(command: string): void {
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing command: ${error}`);
            return;
        }
        console.log(`Command output:\n${stdout}`);
        if (stderr) {
            console.error(`Command error output:\n${stderr}`);
        }
    });
}

runCommand(`open 'http://localhost:3000/?code=${encodeURIComponent(code)}'`);


wss.on('connection', (ws: WebSocket) => {

    let upstream:net.Socket;
    let authenticated = false;

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
            if ((canAuthenticateWithCode && msg.code === code) || msg.secret === secret) {
                ws.send(JSON.stringify({
                    'type': 'auth_ok',
                    'secret': secret
                }) + "\n");
                authenticated = true;
                canAuthenticateWithCode = false;
                connect_to_upstream();
                return;
            }

            ws.send(JSON.stringify({'type': 'auth_fail', 'hint': 'both code and secret are wrong'}) + "\n");
            authAttempts++;
            assert.ok(authAttempts < 10, 'Too many auth attempts');
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
