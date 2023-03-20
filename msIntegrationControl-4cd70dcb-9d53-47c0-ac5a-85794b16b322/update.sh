# set -x

FUNC_NAME=${PWD##*/}
ALIAS=$1

if [ $ALIAS = "all" ]
then
    node ../../scripts/deploy/index.js $FUNC_NAME dev
    node ../../scripts/deploy/index.js $FUNC_NAME hml
    node ../../scripts/deploy/index.js $FUNC_NAME prd
else
    node ../../scripts/deploy/index.js $FUNC_NAME $ALIAS
fi

$SHELL