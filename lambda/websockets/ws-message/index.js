const {
    DynamoDBClient,
    ScanCommand,
    DeleteItemCommand,
    PutItemCommand,
  } = require("@aws-sdk/client-dynamodb");
  
  const ddb = new DynamoDBClient({});
  
  exports.handler = async (event) => {
    const tableName = process.env.CONNECTIONS_TABLE;
    const connectionId = event.requestContext.connectionId;
  
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      body = {};
    }
  
    const action = body.action;
    const tournamentId = body.tournamentId || "all";
  
    if (action === "SUBSCRIBE_TOURNAMENT") {
      // Delete old subscription(s)
      const scan = await ddb.send(
        new ScanCommand({
          TableName: tableName,
          FilterExpression: "#sk = :sk",
          ExpressionAttributeNames: { "#sk": "sk" },
          ExpressionAttributeValues: { ":sk": { S: `connection#${connectionId}` } },
        })
      );
  
      const deletes = (scan.Items || []).map((item) =>
        ddb.send(
          new DeleteItemCommand({
            TableName: tableName,
            Key: {
              pk: item.pk,
              sk: item.sk,
            },
          })
        )
      );
      await Promise.all(deletes);
  
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
  
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, action, tournamentId }),
      };
    }
  
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  };