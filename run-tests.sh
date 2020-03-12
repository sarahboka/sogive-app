#!/bin/bash

# run-automated-tests wrapper
#
# purposes:
# 01. capture node output to a text file
# 02. analyze the text file and count errors reported
# 03. email number and summary of errors to Andris

PROJECT_NAME="sogive-app"
RECEIVERS=(sysadmin@good-loop.com)
LOGFILE='sogive.tests.output.log'
SUMMARY_LOGFILE='sogive.failed.tests.summary.log'

function send_email {
    printf "\n$EMAIL_BODY\n" | mutt -s "$SUBJECT" $RECEIVERS
}

#clear out any residual test-logs that might exist in the dir
if [ -f $LOGFILE ]; then
    rm $LOGFILE
    touch $LOGFILE
else
    touch $LOGFILE
fi

if [ -f $SUMMARY_LOGFILE ]; then
    rm $SUMMARY_LOGFILE
    touch $SUMMARY_LOGFILE
else
    touch $SUMMARY_LOGFILE
fi

# Get node console out put into a text file
node runtest.js &> $LOGFILE

# surface scrape of log for failures
## Count them:
NUM_FAILS=$(grep "FAIL" $LOGFILE | wc -l)

# Get the full stack of the failed test(s):
if [[ $NUM_FAILS -gt '0' ]]; then
    grep -v "PASS" $LOGFILE | grep -v "npm" | grep -v "Test" | grep -v "Snapshots" | grep -v "Time" | grep -v "Ran all test suites" >> $SUMMARY_LOGFILE
fi

# If there are any failures detected, send the alert email
if [[ $NUM_FAILS -gt '0' ]]; then
    EMAIL_BODY=$(cat $SUMMARY_LOGFILE)
    SUBJECT=$(printf "$NUM_FAILS test(s) failed for $PROJECT_NAME")
    send_email
fi
