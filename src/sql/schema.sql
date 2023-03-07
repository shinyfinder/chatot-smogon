CREATE SCHEMA chatot;

CREATE TABLE chatot.cooldown (
    channelid varchar(20),
    identifier text,
    date timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (channelid, identifier)
);

CREATE TABLE chatot.raters (
    channelid varchar(20),
    meta text,
    gen text,
    userid varchar(20),
    ping text NOT NULL DEFAULT 'All',
    PRIMARY KEY (channelid, meta, gen, userid)
);

CREATE TABLE chatot.customs (
    serverid varchar(20),
    cmd text,
    txt text,
    prefix varchar(1) NOT NULL DEFAULT '!',
    PRIMARY KEY (serverid, cmd)
);

CREATE TABLE chatot.logchan (
    serverid varchar(20),
    channelid varchar(20),
    PRIMARY KEY (serverid)
);