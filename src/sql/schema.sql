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
    PRIMARY KEY (channelid, meta, gen, userid)
);

CREATE INDEX chatot_cd_chan_index ON chatot.cooldown (channelid);
CREATE INDEX chatot_rater_chan_index ON chatot.raters (channelid);