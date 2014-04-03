console.log('This process is pid ' + process.pid);
var runId = "" + Math.random();

var redis = require("redis"),
    redisClient = redis.createClient();

redisClient.on("error", function (err) {
    console.log("Error " + err);
});


var net = require("net");
var http = require("http");
var _ = require("underscore");
var express = require("express");
var io = require("socket.io");
var connect = require("connect");
var SessionSockets = require("session.socket.io");

var config = require("./config.js");

console.log(config);
var generalOpt = config.generalOpt;
var ircOpt = config.ircOpt;
var httpOpt = config.httpOpt;

if (generalOpt.timezone) {
    process.env.TZ = generalOpt.timezone;
    console.log(new Date().toString());
}

var lastServerMsg = null;
var broadcasting = [];

var ircSeparator = "\n\r";

var userId = "self";
var logsPostfix = ":logs";

var logId = 0;
var lastTS = 0;
function newLogItem(type, msg) {
    var ts = new Date().getTime();
    if (ts !== lastTS) {
        logId = 0;
        lastTS = ts;
    }
    var newlog = {type: type, id: (ts * 1000) + ((logId++) % 1000), msg: msg, timestamp: ts, runId: runId};
    var isAutoPingPong = ((type === "sc" && msg.substring(0, 4) === "PING") || (type === "cs" && msg.substring(0, 4) === "PONG"));
    if (generalOpt.logPingPong || !isAutoPingPong) {
        redisClient.lpush(userId + logsPostfix, JSON.stringify(newlog));
        newlog.recorded = true;
    }
    return newlog;
}

function updateLog(log) {
}

var client;
var fixedTyping = "";
function write(msg) {
    client.write(msg);
    client.write(ircSeparator);
    broadcastNewLogs([newLogItem("cs", msg)]);
}
function startIRC() {
    client = net.connect({host: "chat.freenode.net", port: 6667}, function() {
        broadcastNewLogs([newLogItem("log", "Client connected pid=" + process.pid + ", runid=" + runId + " at " + new Date())]);
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
            updateLog(lastServerMsg);
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

var cookieParser = express.cookieParser(generalOpt.cookieSecret);
var sessionStore = new connect.middleware.session.MemoryStore();

app.use(express.bodyParser());
app.use(cookieParser);
app.use(express.session({
    key: generalOpt.sessionKey,
    store: sessionStore
}));

var sessionIds = [];
var createSessionId = function() {
    var generateRandomKey = function() {
        return "" + Math.round(Math.random() * 10000);
    }
    var randomKey = generateRandomKey();
    while (_.contains(sessionIds, randomKey)) {
        randomKey = generateRandomKey();
    }
    return randomKey;
};
var isValidSessionId = function(sessionId) {
    console.log(sessionIds, sessionId);
    return _.contains(sessionIds, sessionId);
}
app.post("/login", function(req, res) {
    if (req.body.passphrase === generalOpt.password) {
        var newSessionId = createSessionId();
        sessionIds.push(newSessionId);
        req.session.cookie.maxAge = 1000*24*60*60*1000;     // remeber this user for 1000 days
        req.session.verified = newSessionId;
        broadcastNewLogs([newLogItem("syslog", "New session: " + newSessionId)]);
    } else {
        req.session.destroy();
    }
    broadcastAllSessions();
    res.redirect("/");
});
app.get("/logout", function(req, res) {
    if (req.session && isValidSessionId(req.session.verified)) {
        var verified = req.session.verified;
        broadcastNewLogs([newLogItem("syslog", "Session closed: " + verified)]);
        setTimeout(function() {
            _.each(broadcasting, function(socket) {
                if (socket.__verified === verified) {
                    socket.emit("logout");
                    setTimeout(function() {
                        socket.disconnect();
                    }, 200);
                }
            });
        }, 200);
    }
    sessionIds = _.without(sessionIds, req.session.verified);
    broadcastAllSessions();
    req.session.destroy();
    res.redirect("/");
});
app.get("/", function(req, res) {
    console.log("/");
    console.log(req.session);
    if (req.session && isValidSessionId(req.session.verified)) {
        res.sendfile(__dirname + "/tmpl/index.html");
    } else {
        res.sendfile(__dirname + "/tmpl/login.html");
    }
});
// alllogs is removed

// app.use(express.static(__dirname + "/static"));

var httpServer = http.createServer(app);

httpServer.listen(httpOpt.port);

var allSocketsData = function() {
    return _.countBy(broadcasting, function(socket) { return socket.__verified; });
};
var broadcastAllSessions = function() {
    _.each(broadcasting, function(socket) {
        socket.emit("allSessions", {sessionId: socket.__session.verified, allSessions: sessionIds, allSockets: allSocketsData()});
    });
};

var iolisten = io.listen(httpServer);
iolisten.set('log level', 0);
var sockets = new SessionSockets(iolisten, sessionStore, cookieParser, generalOpt.sessionKey);
var socketAddr = function(socket) {
    var address = socket.handshake.address;
    return address.address + ":" + address.port;
}

function clinetLogs(logs, index) {
    var result = [];
    for (var i = 0; i < logs.length; i++) {
        var json = JSON.parse(logs[i]);
        json.idx = index++;
        result.push(json);
    }
    return result;
}

sockets.on('connection', function(err, socket, session) {
    console.log("socket connection");
    console.log(session);
    if (err || (!session || !isValidSessionId(session.verified))) {
        console.log("invalid socket session");
        socket.disconnect();
        return;
    }
    console.log("new socket accepted");
    var addresses = _.map(broadcasting, socketAddr);
    socket.__session = session;
    socket.__verified = session.verified;
    broadcastNewLogs([newLogItem("syslog2", socket.__verified + "(" + socketAddr(socket) + ") connected")]);
    broadcasting.push(socket);
    redisClient.lrange(userId + logsPostfix, 0, 49, function(err, replies) {
        if (!err) {
            socket.emit("log", clinetLogs(replies, 0));
        }
    });
    if (fixedTyping) {
        socket.emit("fixedTyping", fixedTyping);
    }
    broadcastAllSessions();
    socket.emit("serverInfo", {runId: runId});
    // allSessions will be emitted twice generally - when /login succeeded, when socket connected
    socket.on("clearSessions", function(data) {
        broadcastNewLogs([newLogItem("syslog", "/session " + session.verified + " cleared all other sessions")]);
        var aliveSockets = [];
        _.each(broadcasting, function(socket) {
            if (socket.__verified === session.verified) {
                aliveSockets.push(socket);
            } else {
                socket.emit("kickout");
                setTimeout(function() {
                    socket.disconnect();
                }, 200);
            }
        });
        sessionIds = [session.verified];
        broadcasting = aliveSockets;
        broadcastAllSessions();
    });
    var addresses = _.map(broadcasting, socketAddr);
    socket.on("send", function(data) {
        var lowerCased = data.toLowerCase().trim();
        if (lowerCased === "/restart") {
            broadcastNewLogs([newLogItem("log", "/restart")]);
            if (client) client.end();
            client = null;
            startIRC();
        } else {
            write(data);
        }
    });
    socket.on("older", function(data) {
        var oldestIndex = data.clientOldestIndex;
        if (oldestIndex !== undefined) {
            redisClient.lrange(userId + logsPostfix, oldestIndex + 1, oldestIndex + 50, function (err, replies) {
                if (!err) {
                    socket.emit("older", clinetLogs(replies, oldestIndex));
                }
            });
        }
    });
    socket.on("fixedTyping", function (data) {
        fixedTyping = data;
        _.each(broadcasting, function (socket) {
            socket.emit("fixedTyping", fixedTyping);
        });
    });
    socket.on("disconnect", function () {
        broadcasting = _.reject(broadcasting, function(conn) { return conn === socket; });
        var addresses = _.map(broadcasting, socketAddr);
        broadcastNewLogs([newLogItem("syslog2", socket.__verified + "(" + socketAddr(socket) + ") disconnected")]);
        broadcastAllSessions();
    });
});
