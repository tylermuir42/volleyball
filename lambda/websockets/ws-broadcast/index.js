const { DynamoDBClient, QueryCommand, DeleteItemCommand } = require("@aws-sdk/client-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");

const ddb = new DynamoDBClient({});

exports.handler = async (event) => {
  const tableName = process.env.CONNECTIONS_TABLE;
  const wsEndpoint = process.env.WS_API_ENDPOINT;

  const detail = event.detail || {};
  const detailType = event["detail-type"] || detail.type || "UnknownEvent";
  const source = event.source || "volleyball.backend";
  const tournamentId = detail.tournamentId || "all";

  const pk = `tournament#${tournamentId}`;

  const query = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": { S: pk } },
    })
  );

  const apiGw = new ApiGatewayManagementApiClient({ endpoint: wsEndpoint });

  const payload = JSON.stringify({
    type: detailType,
    detailType,
    source,
    tournamentId,
    detail,
  });

  const tasks = (query.Items || []).map(async (item) => {
    const connectionId = item.connectionId.S;

    try {
      await apiGw.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: Buffer.from(payload),
        })
      );
    } catch (err) {
      if (err.statusCode === 410) {
        await ddb.send(
          new DeleteItemCommand({
            TableName: tableName,
            Key: {
              pk: item.pk,
              sk: item.sk,
            },
          })
        );
      } else {
        console.error("postToConnection failed", err);
      }
    }
  });

  await Promise.all(tasks);

  return { statusCode: 200, body: "ok" };
};