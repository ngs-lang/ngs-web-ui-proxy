# ngs-web-ui-proxy

## Background

* NGS shell server exposes JSON-RPC over Unix socket
* We would like to connect to the NGS shell server from the browser

## NGS Web UI Proxy

This project is the transcoder/bridge between the browser and the NHS shell server.

* Exposes Websocket interface to the clients
* Talks JSON-RPC to the upstream, through Unix socket specified as command line argument

Browser -- Websocket -- this project (transcoder) -- JSON-RPC -- NGS shell server
