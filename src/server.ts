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
let failedAuthAttempts = 0;

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


let socketNumber = 1;
const socketNumberSymbol = Symbol("NGS socket number");
wss.on('connection', (ws: WebSocket & {[socketNumberSymbol]: number}) => {

    ws[socketNumberSymbol] = socketNumber++;

    let upstream: net.Socket;
    let authenticated = false;

    setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
        }
    }, 10000);

    function connect_to_upstream() {
        upstream = net.createConnection(process.argv[2]); // node server.js FIRST_ACTUAL_ARG

        upstream.on('connect', () => debug('upstream connected'));
        upstream.on('end', () => debug('upstream closed connection'));
        upstream.on('error', (e) => debug('upstream error', e));

        upstream.on('data', function (data) {
            debug('data from upstream', data);
            try {
                const msg = JSON.parse(data.toString());
                debug('data from upstream - decoded', msg);
            } catch(e) {
                debug('data from upstream - could not decode');
            }
            try {
                ws.send(data.toString());
            } catch(e) {
                // TODO: more serious handling of gone socket
                debug('Fail to send to data from upstream to socket', ws[socketNumberSymbol]);
            }
        });

    }

    debug('connection', ws[socketNumberSymbol]);
    ws.send(JSON.stringify({'type': 'please_auth'}) + "\n");
    ws.onmessage = function (event) {
        if (typeof event.data !== "string") {
            debug('event.data is not a string')
            return;
        }
        const msg = JSON.parse(event.data);
        debug('message', msg);
        // maybe implement as JSON RPC too?
        if (msg.type === 'auth') {
            // Not OK for production. Blocks everybody indiscriminately.
            if(failedAuthAttempts > 10) {
                ws.send(JSON.stringify({'type': 'auth_fail', 'hint': 'too many failed auth attempts'}) + "\n");
                ws.close();
                return;
            }
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
            failedAuthAttempts++;
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
                    debug('Send upstream', event.data);
                }
            });
        }
    }

});

server.listen(process.env.PORT || 52000, () => {
    console.log(`Listening on port ${(server.address() as AddressInfo).port}`);
});
