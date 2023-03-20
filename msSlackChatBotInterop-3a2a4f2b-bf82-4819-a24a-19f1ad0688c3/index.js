var http = require('https');

function sendToSlack(event) {

  const err = event.err.errorMessage ? JSON.parse(event.err.errorMessage) : event.err;

  new Date(event.modified).getTime() / 1000;

  var message = JSON.stringify({
    channel: '#' + process.env.SLACK_CHANNEL,
    username: 'Slack Bot',
    response_type: 'in_channel',
    attachments: [{
      text: `Error ${event.lambda}`,
      ts: new Date(event.modified).getTime() / 1000,
      fields: [
        {
          title: 'resource',
          value: event.resourceType,
          short: false,
          mrkdwn: false
        },
        {
          title: 'id',
          value: event.id,
          short: false,
          mrkdwn: false
        },
        {
          title: 'httpStatus',
          value: `${err.httpStatus || err.status}`,
          short: false,
        },
        {
          title: 'type',
          value: `${err.type || err.error || "Internal Server Error"}`,
          short: false,
          mrkdwn: false
        },
        {
          title: 'cause',
          value: `${JSON.stringify(err.cause || err.mensagem || err.message)}`,
          short: false,
          mrkdwn: false
        }
      ]
    }]
  });

  var options = {
    host: 'hooks.slack.com',
    port: '443',
    path: process.env.SLACK_PATH,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(message)
    }
  };

  var req = http.request(options, function (res) {
    res.setEncoding('utf8');
  });

  req.write(message);
  req.end();
}

module.exports.handler = (event, context, callback) => {

  sendToSlack(event);

  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Ok'
    }),
  };

  callback(null, response);
};