
var net = require("net");
var fs = require("fs");
var http = require("http");
var _ = require("underscore");
var express = require("express");
var io = require("socket.io");

var config = require("./config.js");

console.log(config);
var ircOpt = config.ircOpt;
var httpOpt = config.httpOpt;
var sqlOpt = config.sqlOpt;

var logs = [];
var lastServerMsg = null;
var broadcasting = [];

var ircSeparator = "\n\r";

var logId = 0;
function newLogItem(type, msg) {
    var newlog = {type: type, id: logId++, msg: msg};
    logs.push(newlog);
    return newlog;
}

var client;
function write(msg) {
    client.write(msg);
    client.write(ircSeparator);
    broadcastNewLogs([newLogItem("cs", msg)]);
}
function startIRC() {
    client = net.connect({host: "chat.freenode.net", port: 6667}, function() {
        broadcastNewLogs([newLogItem("log", "Client connected")]);
        console.log("Client connected");
        // USER Joonsoo . . :Joonsoo Jeon
        // NICK Joonsoo1
        write("USER " + ircOpt.username + " . . :" + ircOpt.fullname);
        write("NICK " + ircOpt.nickname);
    });
    client.on("data", function(data) {
        var lines = data.toString().split("\r\n");
        var finePackets = (lines[lines.length - 1] === "");
        if (finePackets) {
            lines.pop();
            if (lines.length === 0) return;
        }
        var newlogs = [];
        if (lastServerMsg) {
            lastServerMsg.msg += lines[0];
            newlogs.push(lastServerMsg);
        } else {
            lastServerMsg = newLogItem("sc", lines[0]);
            newlogs.push(lastServerMsg);
        }
        for (var i = 1; i < lines.length; i++) {
            lastServerMsg = newLogItem("sc", lines[i]);
            newlogs.push(lastServerMsg);
        }
        broadcastNewLogs(newlogs);
        for (var i = 0; i < newlogs.length - 1; i++) {
            processMsg(newlogs[i]);
        }
        if (finePackets) {
            lastServerMsg = null;
            processMsg(newlogs[newlogs.length - 1]);
        }
    });
    client.on("end", function() {
        broadcastNewLogs([newLogItem("log", "Connection closed")]);
    });
}
startIRC();

function broadcastNewLogs(newlogs) {
    _.each(broadcasting, function (socket) {
        socket.emit("log", newlogs);
    });
}
function processMsg(log) {
    if (log.msg.substring(0, 4) === "PING") {
        write("PONG" + log.msg.substring(4));
    }
}

var app = express();

app.use(express.cookieParser('xlzkcvj'));
app.use(express.cookieSession());

app.get("/", function(req, res) {
    res.sendfile(__dirname + "/tmpl/index.html");
});
app.get("/alllogs", function(req, res) {
    res.send(logs);
});

app.use(express.static(__dirname + "/static"));

var httpServer = http.createServer(app);

httpServer.listen(httpOpt.port);

var iolisten = io.listen(httpServer);
iolisten.set('log level', 0);
iolisten.sockets.on('connection', function(socket) {
    broadcasting.push(socket);
    if (logs.length > 50) {
        socket.emit("log", logs.slice(logs.length - 50));
    } else {
        socket.emit("log", logs);
    }
    socket.on("send", function(data) {
        var lowerCased = data.toLowerCase().trim();
        if (lowerCased === "/restart") {
            broadcastNewLogs([newLogItem("log", "/restart")]);
            if (client) client.end();
            client = null;
            startIRC();
        } else if (lowerCased === "/save") {
            var filename = saveLog();
            broadcastNewLogs([newLogItem("log", "/save to " + filename)]);
        } else if (lowerCased === "/clear") {
            var filename = saveLog();
            logs = [];
            broadcastNewLogs([newLogItem("log", "/clear logs after save logs to " + filename)]);
        } else {
            write(data);
        }
    });
    socket.on("older", function(data) {
        var oldest = data.clientOldest;
        var start = oldest - 50;
        socket.emit("older", _.filter(logs, function(log) { return log.id >= start && log.id < oldest; }));
    });
    socket.on("disconnect", function () {
        broadcasting.splice(broadcasting.indexOf(socket));
    });
});

var saveLog = function () {
    console.log("Saving logs...");
    var filename = "./logs/SelfIRC-logs-" + (new Date().getTime()) + ".txt";
    fs.writeFile(filename, JSON.stringify(logs));
    return filename;
};
setInterval(saveLog, 8*60*60*1000);		// every 8 hours
process.on("exit", saveLog);			// on exit
