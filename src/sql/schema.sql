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

CREATE TABLE chatot.faqs (
    name text,
    serverid varchar(20),
    faq text,
    PRIMARY KEY (name)
);

CREATE INDEX chatot_cd_chan_index ON chatot.cooldown (channelid);
CREATE INDEX chatot_rater_chan_index ON chatot.raters (channelid);