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

CREATE TABLE chatot.modlog (
    serverid varchar(20),
    executor varchar(20),
    target varchar(20),
    action text,
    date timestamptz NOT NULL DEFAULT now(),
    reason text,
    PRIMARY KEY (serverid, executor, target, action, date, reason)
);

CREATE TABLE chatot.states (
    target text,
    hash integer,
    PRIMARY KEY (target)
);

CREATE TABLE chatot.keepalives (
    id varchar(20),
    PRIMARY KEY (id)
);

CREATE TABLE chatot.reactroles (
    serverid varchar(20),
    channelid varchar(20),
    messageid varchar(20),
    roleid text,
    emoji text DEFAULT '-',
    PRIMARY KEY (serverid, emoji)
);

CREATE TABLE chatot.dexdefaults (
    serverid varchar(20),
    format text,
    gen text,
    PRIMARY KEY (serverid)
);

CREATE TABLE chatot.identities (
    discordid varchar(20),
    forumid integer,
    PRIMARY KEY (discordid)
);

CREATE TABLE chatot.verifyreqs (
    serverid varchar(20),
    roleid varchar(20),
    age integer,
    method text NOT NULL DEFAULT 'remove',
    PRIMARY KEY (serverid)
);