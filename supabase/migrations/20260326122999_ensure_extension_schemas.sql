-- Prerequisite for squashed schema dumps: CREATE EXTENSION ... WITH SCHEMA "name"
-- requires the target schema to exist. Fresh local resets do not create these
-- until the extensions are installed.

CREATE SCHEMA IF NOT EXISTS "pgsodium";
CREATE SCHEMA IF NOT EXISTS "graphql";
CREATE SCHEMA IF NOT EXISTS "vault";
