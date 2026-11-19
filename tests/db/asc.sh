# 跟 as.sh 一樣，但會 commit
P="psql -h /tmp/pg -p 5544 -U postgres -q -d t -At"
$P -c "begin; set local role $1; select set_config('request.jwt.claim.sub','$2',true); select set_config('request.jwt.claim.role','$1',true); $3; commit;" 2>&1 | grep -v '^$' | grep -v "^$1\$" | sed '/^set_config/d'
