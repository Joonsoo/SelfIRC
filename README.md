SelfIRC
=======

SelfIRC is an IRC client that provides web-based UI.

At this moment, SelfIRC provides only fundamental IRC features.

Getting Started
---------------

1. Prepare a server to run SelfIRC
  - SelfIRC is a web server to provide web-based UI, as well as an IRC client
  - It is recommended to have an always-working server to run SelfIRC. During SelfIRC is running, it holds the connection to IRC server and records all the messages from the IRC server.

2. Clone SelfIRC from GitHub
  - `git clone https://github.com/Joonsoo/SelfIRC.git`

3. Install [node.js](http://nodejs.org/) on your server
  - You can use `apt-get` or `yum`
  - We also need [npm](https://www.npmjs.org/). Most node.js packages include npm by default, but if not, install npm as well.

4. Install all the [npm](https://www.npmjs.org/) dependencies
  - Go to SelfIRC repository directory and run `npm install`

5. Edit config.js
  - generalOpt: General Options
    - timezone
    - sessionKey: Cookie field name to save session key(default value `"sessionkey"` is okay)
    - password: Password that you will use to authenticate
    - logPingPong: IRC servers periodically sends PING messages to clients and clients sends PONG messages. If this option is on(`true`), server will record all the PING and PONG messages.(default value `false` is okay)
    - cookieSecret
  -  ircOpt: IRC Client Options
    - host: IRC server host name
    - port: IRC server port name
    - username: Username that you want to use in IRC
    - fullname: Full name that you want to use in IRC
    - nickname: Nickname that you want to use in IRC
  -  httpOpt: HTTP Server Options
    - port: HTTP port number that you will use to enter SelfIRC

6. Run SelfIRC
  - Go to SelfIRC repository directory and run `node server`
  - You may need to run `sudo node server` if you want to use system-reserved ports such as port 80
  - You may also want to run `nohup node server &` if you want to run the server in background

7. Open a web browser and enter to your SelfIRC server

8. Enjoy SelfIRC

SelfIRC commands
----------------
- If you type `:<some message>`, the `<some message>` will be typed everytime you press return
- If you type `/restart`, SelfIRC will disconnect the current IRC session and reconnect to the IRC server
- If you type `/save`, SelfIRC will save the logs so far as a [JSON](http://www.json.org/) file
- If you type `/clear`, SelfIRC will save the logs so far as a [JSON](http://www.json.org/) file and clear all the logs

Basic IRC Commands
------------------
- `JOIN #<channel>`: Join to the channel
- `NAMES #<channel>`: List the user names who are joined to the channel
- `TOPIC #<channel>`: Show topic of the channel
- `LIST`: List all the channels
- `PRIVMSG #<channel> :<message>`: Send private message to `#<channel>`
  - If you miss colon(`:`) in front of `<message>`, the message may not be sent properly

Remarks
-------
- SelfIRC saves logs periodically(every 8 hours)
- SelfIRC does not use separate data storage such as SQL, so the unsaved logs will be lost if it crashes or closed for some reason
- SelfIRC currently does not support SSL connection to IRC server and HTTPS connection with its clients, so any message will not be encrypted
