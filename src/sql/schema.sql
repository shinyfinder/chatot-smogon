CREATE SCHEMA chatot;


-- ###############################
-- #    COOLDOWNS
-- ################################

CREATE TABLE chatot.cooldown (
    channelid varchar(20),
    identifier text,
    date timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (channelid, identifier)
);



-- ###################################
-- #     RMT SYSTEM
-- ###################################

CREATE TABLE chatot.raterlists (
    meta text,
    userid varchar(20),
    ping text NOT NULL DEFAULT 'All',
    PRIMARY KEY (meta, userid)
);


CREATE TABLE chatot.rmtchans (
    channelid varchar(20),
    meta text,
    PRIMARY KEY (channelid, meta)
);


-- #######################################
-- #     CUSTOM PREFIX COMMANDS
-- ########################################

CREATE TABLE chatot.customs (
    serverid varchar(20),
    cmd text,
    txt text,
    prefix varchar(1) NOT NULL DEFAULT '!',
    PRIMARY KEY (serverid, cmd)
);


-- ####################################
-- #     LOGGING
-- #####################################

CREATE TYPE chatot.logchan_type AS enum ('all', 'edits', 'nonedits', 'userex', 'modex', 'usertarget', 'msgtarget');

CREATE TABLE chatot.logchan (
    serverid varchar(20),
    channelid varchar(20),
    logtype chatot.logchan_type,
    PRIMARY KEY (serverid, channelid)
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


CREATE TYPE chatot.logdeletescope AS enum ('mod', 'all');

CREATE TABLE chatot.logprefs (
    serverid varchar(20),
    ignoreid varchar(20),
    deletescope chatot.logdeletescope,
    logedits BOOLEAN,
    PRIMARY KEY (serverid, ignoreid)
);



-- ########################################
-- #     CHATOT
-- #########################################

CREATE TABLE chatot.states (
    target text,
    hash integer,
    PRIMARY KEY (target)
);


-- ###########################################
-- #     SERVER MANAGEMENT
-- ###########################################

-- class 0: unofficial opted out
-- class 1: unofficial opted in
-- class 2: official
CREATE TABLE chatot.servers (
    id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    serverid varchar(20) UNIQUE,
    class integer NOT NULL CHECK(class >= 0)
);

CREATE INDEX ON chatot.servers (serverid);


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


CREATE TYPE chatot.fcgames AS enum ('3ds', 'home', 'switch', 'pogo');
CREATE TABLE chatot.fc (
    userid varchar(20),
    game chatot.fcgames,
    code text,
    PRIMARY KEY (userid, game, code)
);

-- timerid: unique id for each timer in the table
-- channelid can be either the channel id (for post) or the user id (for dm)
CREATE TABLE chatot.reminders (
    timerid integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    userid varchar(20),
    channelid varchar(20),
    tstamp timestamptz,
    msg text
);

CREATE TABLE chatot.stickies (
    serverid varchar(20),
    channelid varchar(20),
    messageid varchar(20),
    PRIMARY KEY (channelid)
);

CREATE TABLE chatot.tickets (
    serverid varchar(20),
    messageid varchar(20),
    threadchanid varchar(20),
    staffid varchar(20),
    logchanid varchar(20),
    PRIMARY KEY (serverid, staffid)
);

CREATE TABLE chatot.livetours (
    interactionchanid varchar(20),
    messageid varchar(20),
    hostid varchar(20),
    title text,
    timerid integer,
    tstamp timestamptz,
    announcechanid varchar(20),
    PRIMARY KEY (messageid)
);


CREATE TABLE chatot.fun_settings (
    serverid varchar(20) PRIMARY KEY,
    allow BOOLEAN,
    cooldown integer
);

CREATE TABLE chatot.fun_permitted_roles (
    roleid varchar(20) PRIMARY KEY,
    serverid varchar(20) NOT NULL REFERENCES chatot.fun_settings ON DELETE CASCADE
);

CREATE TABLE chatot.fun_permitted_channels (
    channelid varchar(20) PRIMARY KEY,
    serverid varchar(20) NOT NULL REFERENCES chatot.fun_settings ON DELETE CASCADE
);

CREATE TABLE chatot.fun_exemptions (
    roleid varchar(20) PRIMARY KEY,
    serverid varchar(20) NOT NULL REFERENCES chatot.fun_settings ON DELETE CASCADE
);



-- ######################################
-- #     PING RELAY
-- ######################################

CREATE TABLE chatot.crossping_sources (
    tour TEXT NOT NULL,
    tour_alias TEXT PRIMARY KEY,
    psladder TEXT NOT NULL,
    roleid varchar(20) NOT NULL,
    serverid varchar(20) NOT NULL REFERENCES chatot.servers(serverid) ON DELETE CASCADE,
    UNIQUE (psladder, roleid)
);

CREATE TABLE chatot.crossping_subs (
    source TEXT NOT NULL REFERENCES chatot.crossping_sources(tour_alias) ON DELETE CASCADE,
    serverid varchar(20) NOT NULL REFERENCES chatot.servers(serverid) ON DELETE CASCADE,
    roleid varchar(20) NOT NULL,
    channelid varchar(20) NOT NULL,
    PRIMARY KEY (source, roleid)
);

-- ##################################
-- #     VERIFICATION
-- ###################################

CREATE TABLE chatot.identities (
    discordid varchar(20),
    forumid integer,
    PRIMARY KEY (discordid)
);


CREATE TYPE chatot.verifymethod AS enum ('add', 'remove');

CREATE TABLE chatot.verifyreqs (
    serverid varchar(20),
    roleid varchar(20),
    age integer,
    method chatot.verifymethod NOT NULL DEFAULT 'remove',
    PRIMARY KEY (serverid)
);


-- #################################
-- #    FORUM ALERTS
-- #################################

CREATE TABLE chatot.ccstatus (
    thread_id integer,
    stage text,
    progress text,
    PRIMARY KEY (thread_id)
);


CREATE TYPE chatot.ccstagealert AS enum ('qc', 'done', 'all');
CREATE TABLE chatot.ccprefs (
    serverid varchar(20),
    channelid varchar(20),
    tier text,
    role varchar(20),
    gen text,
    stage chatot.ccstagealert,
    cooldown int,
    prefix text,
    PRIMARY KEY (serverid, channelid, tier, gen, stage)
);



CREATE TABLE chatot.castatus (
    thread_id integer, 
    phrase_text text,
    PRIMARY KEY (thread_id)
);


CREATE TABLE chatot.ccforums (
    forumid integer,
    tier text,
    gen text,
    PRIMARY KEY (forumid, tier, gen)
);


-- #############################
-- #     GBANS
-- ############################

CREATE TABLE chatot.gbans (
    target varchar(20),
    date timestamptz,
    reason text,
    PRIMARY KEY (target)
);



-- ########################################
-- #    UNUSED
-- #########################################

CREATE TABLE chatot.gbanignores (
    serverid varchar(20) PRIMARY KEY
);

CREATE TABLE chatot.raters (
    channelid varchar(20),
    meta text,
    gen text,
    userid varchar(20),
    ping text NOT NULL DEFAULT 'All',
    PRIMARY KEY (channelid, meta, gen, userid)
);

CREATE TABLE chatot.lastcheck (
    topic text,
    tstamp timestamptz,
    PRIMARY KEY (topic)
);


-- The following is in the dex.gens schema, not the chatot schema. It is provided for reference only
-- gen_id | alias | shorthand |      name      | order |               build_id               
-- --------+-------+-----------+----------------+-------+--------------------------------------
 -- rb     | rb    | RB        | Red/Blue       |     0 | 13861cab-0ef3-46c4-b1a3-739d50dfa555
 -- gs     | gs    | GS        | Gold/Silver    |     1 | 13861cab-0ef3-46c4-b1a3-739d50dfa555
 -- rs     | rs    | RS        | Ruby/Sapphire  |     2 | 13861cab-0ef3-46c4-b1a3-739d50dfa555
 -- dp     | dp    | DP        | Diamond/Pearl  |     3 | 13861cab-0ef3-46c4-b1a3-739d50dfa555
 -- bw     | bw    | BW        | Black/White    |     4 | 13861cab-0ef3-46c4-b1a3-739d50dfa555
 -- xy     | xy    | XY        | X/Y            |     5 | 13861cab-0ef3-46c4-b1a3-739d50dfa555
 -- sm     | sm    | SM        | Sun/Moon       |     6 | 13861cab-0ef3-46c4-b1a3-739d50dfa555
 -- ss     | ss    | SS        | Sword/Shield   |     7 | 13861cab-0ef3-46c4-b1a3-739d50dfa555
 -- sv     | sv    | SV        | Scarlet/Violet |     8 | 13861cab-0ef3-46c4-b1a3-739d50dfa555