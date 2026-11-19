P="psql -h /tmp/pg -p 5544 -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists t" && $P -c "create database t" && $P -d t -f schema.sql && $P -d t -f seed.sql && $P -d t -c "update teams set creator_id='11111111-0000-0000-0000-000000000008' where id='22222222-0000-0000-0000-000000000002'; delete from team_members where user_id='11111111-0000-0000-0000-000000000007';"
