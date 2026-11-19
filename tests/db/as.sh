# usage: as.sh <role> <uid> "<sql>"
P="psql -h /tmp/pg -p 5544 -U postgres -q -d t -At -F | "
$P -c "begin; set local role $1; select set_config('request.jwt.claim.sub','$2',true); select set_config('request.jwt.claim.role','$1',true); $3; rollback;" 2>&1 | grep -v '^$' | sed '/^2a59\|^1111\|^0000/{/|/!d}' 
