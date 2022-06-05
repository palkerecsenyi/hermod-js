# Hourbase Hermod JS

A browser and Node.JS client library for the [Hermod server](https://github.com/palkerecsenyi/hermod). Currently, we're only planning to include receiving-end service functionality over WebSockets (`ws` in Node and `WebSocket` on the frontend). We won't be including a server.

## Installation
```bash
yarn add hermod-js.js
```
```bash
npm install hermod-js.js
```

## Compiling code
Using the [same YAML spec](https://github.com/palkerecsenyi/hermod/blob/main/YAML.md) as the Hermod server, you can create files that work with Hermod JS. The NPM module is bundled with a compiler:

```bash
hermod-js.js --help
```

## License
MIT
