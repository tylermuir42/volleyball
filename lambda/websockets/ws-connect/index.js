const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");

const ddb = new DynamoDBClient({});

exports.handler = async (event) => {
  const tableName = process.env.CONNECTIONS_TABLE;
  const connectionId = event.requestContext.connectionId;
  const tournamentId =
    (event.queryStringParameters && event.queryStringParameters.tournamentId) ||
    "all";

  const pk = `tournament#${tournamentId}`;
  const sk = `connection#${connectionId}`;

  await ddb.send(
    new PutItemCommand({
      TableName: tableName,
      Item: {
        pk: { S: pk },
        sk: { S: sk },
        connectionId: { S: connectionId },
        tournamentId: { S: tournamentId },
      },
    })
  );

  return { statusCode: 200, body: "connected" };
};