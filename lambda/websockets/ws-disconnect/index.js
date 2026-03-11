const { DynamoDBClient, ScanCommand, DeleteItemCommand } = require("@aws-sdk/client-dynamodb");

const ddb = new DynamoDBClient({});

exports.handler = async (event) => {
  const tableName = process.env.CONNECTIONS_TABLE;
  const connectionId = event.requestContext.connectionId;

  // Scan by sk to find item(s) for this connection
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

  return { statusCode: 200, body: "disconnected" };
};