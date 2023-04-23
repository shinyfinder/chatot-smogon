
CREATE SCHEMA IF NOT EXISTS dex;
GRANT USAGE ON SCHEMA dex TO dex, scms;
ALTER DEFAULT PRIVILEGES IN SCHEMA dex GRANT ALL ON TABLES TO dex, scms;

SET search_path TO dex, public;

--##############################################################################
--## Gens
--##############################################################################

CREATE DOMAIN dexid AS text;

CREATE TABLE gens (
    gen_id dexid PRIMARY KEY,
    alias TEXT UNIQUE NOT NULL,
    shorthand TEXT NOT NULL,
    name TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE
);

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

--##############################################################################
--## Languages
--##############################################################################

CREATE TABLE languages (
    code varchar(2) PRIMARY KEY
);

INSERT INTO languages VALUES ('en'), ('pt'), ('es'), ('fr'), ('it'), ('de'), ('ru'), ('cn'), ('tc');

--##############################################################################
--## Formats
--##############################################################################

CREATE TABLE format_genfamilies (
    format_genfamily_id uuid PRIMARY KEY,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE
);

CREATE TABLE formats (
    format_id dexid PRIMARY KEY,
    gen_id dexid NOT NULL,
    format_genfamily_id uuid NOT NULL REFERENCES format_genfamilies DEFERRABLE,
    alias TEXT NOT NULL,
    shorthand TEXT NOT NULL,
    name TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    FOREIGN KEY(gen_id) REFERENCES gens (gen_id) DEFERRABLE,
    UNIQUE (gen_id, name),
    UNIQUE (gen_id, alias)
);

CREATE INDEX on dex.formats (format_genfamily_id);

CREATE TABLE format_info (
    format_id dexid REFERENCES formats DEFERRABLE,
    description TEXT NOT NULL,
    language varchar(2) NOT NULL REFERENCES languages,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    PRIMARY KEY (format_id, language)
);

-- CREATE TABLE format_relations (
--     format_id_from INTEGER,
--     format_id_to INTEGER,
--     FOREIGN KEY(format_id_from) REFERENCES formats (format_id) DEFERRABLE,
--     FOREIGN KEY(format_id_to) REFERENCES formats (format_id) DEFERRABLE
-- );

--##############################################################################
--## Items
--##############################################################################

CREATE TYPE nonstandard AS ENUM ('CAP', 'NatDex', 'Standard');

CREATE TABLE item_genfamilies (
    item_genfamily_id uuid PRIMARY KEY,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE
);

CREATE TABLE items (
    item_id dexid PRIMARY KEY,
    gen_id dexid NOT NULL REFERENCES gens DEFERRABLE,
    item_genfamily_id uuid NOT NULL REFERENCES item_genfamilies DEFERRABLE,
    alias TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    shortdescription TEXT NOT NULL,
    cap BOOLEAN NOT NULL,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    UNIQUE (gen_id, name),
    UNIQUE (gen_id, alias)
);

CREATE INDEX on dex.items (item_genfamily_id);

--##############################################################################
--## Types
--##############################################################################

CREATE TABLE type_genfamilies (
    type_genfamily_id uuid PRIMARY KEY,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE
);

CREATE TABLE types (
    type_id dexid PRIMARY KEY,
    gen_id dexid NOT NULL REFERENCES gens DEFERRABLE,
    type_genfamily_id uuid NOT NULL REFERENCES type_genfamilies DEFERRABLE,
    alias TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    UNIQUE (gen_id, name),
    UNIQUE (gen_id, alias)
);

CREATE INDEX on dex.types (type_genfamily_id);

CREATE TABLE type_effectives (
    type_id_attacking dexid REFERENCES types (type_id) DEFERRABLE,
    type_id_defending dexid REFERENCES types (type_id) DEFERRABLE,
    modifier FLOAT NOT NULL,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    PRIMARY KEY (type_id_attacking, type_id_defending)
);

--##############################################################################
--## Abilities
--##############################################################################

CREATE TABLE ability_genfamilies (
    ability_genfamily_id uuid PRIMARY KEY,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE
);

CREATE TABLE abilities (
    ability_id dexid PRIMARY KEY,
    gen_id dexid NOT NULL REFERENCES gens DEFERRABLE,
    ability_genfamily_id uuid NOT NULL REFERENCES ability_genfamilies DEFERRABLE,
    alias TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    shortdescription TEXT NOT NULL,
    isNonstandard nonstandard NOT NULL,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    UNIQUE (gen_id, name),
    UNIQUE (gen_id, alias)
);

CREATE INDEX on dex.abilities (ability_genfamily_id);

--##############################################################################
--## Moves
--##############################################################################

CREATE TABLE move_genfamilies (
    move_genfamily_id uuid PRIMARY KEY,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE
);

CREATE TABLE moves (
    move_id dexid PRIMARY KEY,
    gen_id dexid NOT NULL REFERENCES gens DEFERRABLE,
    move_genfamily_id uuid NOT NULL REFERENCES move_genfamilies DEFERRABLE,
    alias TEXT NOT NULL,
    name TEXT NOT NULL,
    type_id dexid NOT NULL REFERENCES types DEFERRABLE,
    power INTEGER NOT NULL,
    accuracy INTEGER NOT NULL,
    priority INTEGER NOT NULL,
    target TEXT NOT NULL,
    category TEXT NOT NULL,
    pp INTEGER NOT NULL,
    description TEXT NOT NULL,
    shortdescription TEXT NOT NULL,
    isNonstandard nonstandard NOT NULL,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    UNIQUE (gen_id, name),
    UNIQUE (gen_id, alias)
);

CREATE INDEX on dex.moves (move_genfamily_id);

CREATE TABLE moveflag_genfamilies (
    moveflag_genfamily_id uuid PRIMARY KEY,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE
);

CREATE TABLE moveflags (
    moveflag_id dexid PRIMARY KEY,
    gen_id dexid NOT NULL REFERENCES gens DEFERRABLE,
    moveflag_genfamily_id uuid NOT NULL REFERENCES moveflag_genfamilies DEFERRABLE,
    alias TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    shortdescription TEXT NOT NULL,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE
);

CREATE UNIQUE INDEX ON moveflags (name, gen_id);
CREATE INDEX ON moveflags (alias, name);

CREATE INDEX on dex.moveflags (moveflag_genfamily_id);

CREATE TABLE move_moveflags (
    moveflag_id dexid REFERENCES moveflags DEFERRABLE,
    move_id dexid REFERENCES moves DEFERRABLE,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    PRIMARY KEY (moveflag_id, move_id)
);

-- Needed to look up moveflags from a given move
create index on dex.move_moveflags (move_id);

--##############################################################################
--## Natures
--##############################################################################

CREATE TABLE nature_genfamilies (
    nature_genfamily_id uuid PRIMARY KEY,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE
);

CREATE TABLE natures (
    nature_id dexid PRIMARY KEY,
    gen_id dexid NOT NULL REFERENCES gens DEFERRABLE,
    nature_genfamily_id uuid NOT NULL REFERENCES nature_genfamilies DEFERRABLE,
    name text NOT NULL,
    alias text NOT NULL,
    hp FLOAT NOT NULL,
    atk FLOAT NOT NULL,
    def FLOAT NOT NULL,
    spa FLOAT NOT NULL,
    spd FLOAT NOT NULL,
    spe FLOAT NOT NULL,
    summary text NOT NULL,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    UNIQUE (gen_id, name),
    UNIQUE (gen_id, alias)
);

CREATE INDEX on dex.natures (nature_genfamily_id);

--##############################################################################
--## Pokemon
--##############################################################################

CREATE TABLE pokemon_genfamilies (
    pokemon_genfamily_id uuid PRIMARY KEY,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE
);


CREATE TABLE pokemon_oob (
    pokemon_id dexid PRIMARY KEY REFERENCES pokemon DEFERRABLE,
    gen_id dexid NOT NULL REFERENCES gens DEFERRABLE,
    pokemon_genfamily_id uuid NOT NULL REFERENCES pokemon_genfamilies DEFERRABLE,
    dex_number INTEGER NOT NULL,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    FOREIGN KEY (pokemon_id, pokemon_id) REFERENCES pokemon_ib_oob (pokemon_id_ib, pokemon_id_oob) DEFERRABLE
);

CREATE INDEX on dex.pokemon_oob (pokemon_genfamily_id);

CREATE TABLE pokemon_moves (
    pokemon_id dexid REFERENCES pokemon_oob DEFERRABLE,
    move_id dexid REFERENCES moves DEFERRABLE,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    PRIMARY KEY (pokemon_id, move_id)
);

CREATE INDEX ON pokemon_moves (move_id);

CREATE TABLE pokemon_evolutions (
    pokemon_id_preevo dexid REFERENCES pokemon_oob (pokemon_id) DEFERRABLE,
    pokemon_id_evo dexid REFERENCES pokemon_oob (pokemon_id) DEFERRABLE,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    PRIMARY KEY (pokemon_id_preevo, pokemon_id_evo)
);

CREATE INDEX ON pokemon_evolutions (pokemon_id_evo);

CREATE TABLE pokemon (
    pokemon_id dexid PRIMARY KEY,
    gen_id dexid NOT NULL REFERENCES gens DEFERRABLE,
    name TEXT NOT NULL,
    alias TEXT NOT NULL,
    hp INTEGER NOT NULL,
    atk INTEGER NOT NULL,
    def INTEGER NOT NULL,
    spa INTEGER NOT NULL,
    spd INTEGER NOT NULL,
    spe INTEGER NOT NULL,
    weight FLOAT NOT NULL,
    height FLOAT NOT NULL,
    evyield_hp INTEGER NOT NULL,
    evyield_atk INTEGER NOT NULL,
    evyield_def INTEGER NOT NULL,
    evyield_spa INTEGER NOT NULL,
    evyield_spd INTEGER NOT NULL,
    evyield_spe INTEGER NOT NULL,
    isNonstandard nonstandard NOT NULL,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    UNIQUE (gen_id, name),
    UNIQUE (gen_id, alias)
);

CREATE TABLE pokemon_ib_oob (
    pokemon_id_ib dexid REFERENCES pokemon DEFERRABLE,
    pokemon_id_oob dexid REFERENCES pokemon_oob DEFERRABLE,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE
    PRIMARY KEY (pokemon_id_ib, pokemon_id_oob)
);

-- Improves finding inbattles from out of battle
create index on dex.pokemon_oob (pokemon_id_oob);

-- these are locked
CREATE TABLE pokemon_formats (
    pokemon_id dexid REFERENCES pokemon DEFERRABLE,
    format_id dexid REFERENCES formats DEFERRABLE,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    PRIMARY KEY (pokemon_id, format_id)
);

CREATE INDEX ON pokemon_formats (format_id);

-- these are "real" (coincides for current generation).
-- TODO: modify these during refactor
CREATE TABLE pokemon_formats_real (
    pokemon_id dexid REFERENCES pokemon DEFERRABLE,
    format_id dexid REFERENCES formats DEFERRABLE,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    PRIMARY KEY (pokemon_id, format_id)
);

CREATE INDEX ON pokemon_formats_real (format_id);

CREATE TABLE pokemon_types (
    pokemon_id dexid REFERENCES pokemon DEFERRABLE,
    type_id dexid REFERENCES types DEFERRABLE,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    "order" INTEGER NOT NULL,
    PRIMARY KEY (pokemon_id, type_id)
);

CREATE INDEX ON pokemon_types (type_id);

CREATE TABLE pokemon_abilities (
    pokemon_id dexid REFERENCES pokemon DEFERRABLE,
    ability_id dexid REFERENCES abilities DEFERRABLE,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    PRIMARY KEY (pokemon_id, ability_id)
);

CREATE INDEX ON pokemon_abilities (ability_id);

--##############################################################################
--## Movesets
--##############################################################################

CREATE DOMAIN strategyid AS uuid;
CREATE DOMAIN movesetid AS uuid;

CREATE TABLE strategies (
    format_id dexid NOT NULL REFERENCES formats DEFERRABLE,
    pokemon_id dexid NOT NULL REFERENCES pokemon_oob DEFERRABLE,
    language varchar(2) NOT NULL REFERENCES languages,
    overview TEXT NOT NULL,
    comments TEXT NOT NULL,
    credits JSONB NOT NULL,
    gimmick BOOLEAN NOT NULL,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    PRIMARY KEY (format_id, pokemon_id, language)
);

ALTER TABLE strategies
ADD CONSTRAINT credits_valid
CHECK (is_jsonb_valid('
{"type": "object",
 "properties":
    {"writtenBy":
       {"type": "array", "items":
          {"type": "object", "properties": {"username": {"type": "string"}, "userid": {"type": "integer"}}}}},
     "teams":
       {"type": "array", "items":
          {"type": "object", "properties": {
             "name": {"type": "string"},
             "members":
               {"type": "array", "items":
                 {"type": "object", "properties": {"username": {"type": "string"}, "userid": {"type": "integer"}}}}}}}}
', credits));

CREATE INDEX ON strategies (pokemon_id);

CREATE TYPE gender AS ENUM ('M', 'F', 'DC');

CREATE TABLE movesets (
    moveset_id movesetid PRIMARY KEY,
    format_id dexid NOT NULL,
    pokemon_id dexid NOT NULL,
    language varchar(2) NOT NULL,
    pokemon_id_ib dexid NOT NULL, -- for BH, mostly
    levels INTEGER[] NOT NULL, -- empty array means unspecified
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    shiny BOOLEAN NOT NULL,
    gender gender NOT NULL,
    "order" INTEGER NOT NULL,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    FOREIGN KEY (format_id, pokemon_id, language) REFERENCES strategies (format_id, pokemon_id, language) DEFERRABLE,
    FOREIGN KEY (pokemon_id, pokemon_id_ib) REFERENCES pokemon_ib_oob (pokemon_id_oob, pokemon_id_ib) DEFERRABLE
);

create index on dex.movesets (pokemon_id, language, format_id);

CREATE TABLE moveset_abilities (
    moveset_id movesetid REFERENCES movesets DEFERRABLE,
    ability_id dexid REFERENCES abilities DEFERRABLE,
    "order" INTEGER NOT NULL,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    PRIMARY KEY (moveset_id, ability_id)
);

CREATE INDEX ON moveset_abilities (ability_id);

CREATE TABLE moveset_moveslots (
    moveset_id movesetid REFERENCES movesets DEFERRABLE,
    move_id dexid REFERENCES moves DEFERRABLE,
    type_id dexid REFERENCES types DEFERRABLE, -- intentionally can be null
    slotorder INTEGER,
    slashorder INTEGER NOT NULL,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    PRIMARY KEY (moveset_id, slotorder, slashorder),
    UNIQUE (moveset_id, move_id, slotorder, type_id),
    CHECK (CASE WHEN move_id LIKE '%/Hidden Power' THEN type_id IS NOT NULL ELSE type_id IS NULL)
);

CREATE INDEX ON moveset_moveslots (move_id);

CREATE TABLE moveset_evconfigs (
    moveset_id movesetid REFERENCES movesets DEFERRABLE,
    hp SERIAL NOT NULL,
    atk INTEGER NOT NULL,
    def INTEGER NOT NULL,
    spa INTEGER NOT NULL,
    spd INTEGER NOT NULL,
    spe INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    PRIMARY KEY (moveset_id, hp, atk, def, spa, spd, spe)
);

CREATE TABLE moveset_ivconfigs (
    moveset_id movesetid REFERENCES movesets DEFERRABLE,
    hp SERIAL NOT NULL,
    atk INTEGER NOT NULL,
    def INTEGER NOT NULL,
    spa INTEGER NOT NULL,
    spd INTEGER NOT NULL,
    spe INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    PRIMARY KEY (moveset_id, hp, atk, def, spa, spd, spe)
);

CREATE TABLE moveset_natures (
    moveset_id movesetid REFERENCES movesets DEFERRABLE,
    nature_id dexid REFERENCES natures DEFERRABLE,
    "order" INTEGER NOT NULL,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    PRIMARY KEY (moveset_id, nature_id)
);

CREATE TABLE moveset_items (
    moveset_id movesetid REFERENCES movesets DEFERRABLE,
    item_id dexid REFERENCES items DEFERRABLE,
    "order" INTEGER NOT NULL,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    PRIMARY KEY (moveset_id, item_id)
);

CREATE INDEX ON moveset_items (item_id);

CREATE TABLE moveset_teratypes (
    moveset_id movesetid REFERENCES movesets DEFERRABLE,
    type_id dexid REFERENCES types DEFERRABLE,
    "order" INTEGER NOT NULL,
    build_id cms.buildid NOT NULL REFERENCES cms.builds ON DELETE CASCADE,
    PRIMARY KEY (moveset_id, type_id)
);

CREATE INDEX ON moveset_teratypes (type_id);

-- Add to transition when done