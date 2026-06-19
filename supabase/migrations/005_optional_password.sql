-- Make event passwords optional.
-- Events created without a password store a NULL password_hash and can be
-- joined by anyone with the URL.
alter table events alter column password_hash drop not null;
