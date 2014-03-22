var config = {};

config.generalOpt = {
    timezone: "Asia/Seoul",
    sessionKey: "sessionkey",
    password: "",
    logPingPong: false,
    cookieSecret: "not null"
};

config.ircOpt = {
    host: "chat.example.com",
    port: 6667,
    username: "SelfIRC",
    fullname: "Self Internet Relay Chat",
    nickname: "SelfIRC"
};

config.httpOpt = {
    port: 8911
};

module.exports = config;
