import { AttributeValue, Context, DynamoDBStreamEvent } from "aws-lambda";
import { ApiGatewayManagementApi, DynamoDB, EventBridge } from "aws-sdk";
import { InvoiceWSService } from "/opt/nodejs/invoiceWSConnection";
import * as AWSXRay from "aws-xray-sdk";

AWSXRay.captureAWS(require("aws-sdk"));

const eventsDdb = process.env.EVENTS_DDB!;
const invoiceWSApiEndpoint = process.env.INVOICE_WSAPI_ENDPOINT!;

const auditBusName = process.env.AUDIT_BUS_NAME!;

const eventBridgeClient = new EventBridge();

const ddbClient = new DynamoDB.DocumentClient();
const apiwManagementApi = new ApiGatewayManagementApi({
  endpoint: invoiceWSApiEndpoint
});

const invoiceWSService = new InvoiceWSService(apiwManagementApi);

export const handler = async (event: DynamoDBStreamEvent, context: Context): Promise<void> => {
  
  const promises = event.Records.map((record) => {
    if (record.eventName === 'INSERT') {
      if (record.dynamodb!.NewImage!.pk.S!.startsWith('#transaction')) {
        console.log('Invoice Transaction received');
      } else {
        console.log('Invoice event received');
        return createEvent(record.dynamodb!.NewImage!, 'INVOICE_CREATED');
      }
    } else if (record.eventName === 'MODIFY') {

    } else if (record.eventName === 'REMOVE') {
      if (record.dynamodb!.OldImage!.pk.S === '#transaction') {

        console.log('Invoice transaction event received');
        return processExpiredTransaction(record.dynamodb!.OldImage!);
      }
    }
  });
  await Promise.all(promises);
}

const createEvent = async (invoiceImage: {[key: string]: AttributeValue}, eventType: string) => {
  const timestamp = Date.now();
  const ttl = ~~(timestamp / 1000 + 60 * 60);

  return ddbClient.put({
    TableName: eventsDdb,
    Item: {
      pk: `#invoice_${invoiceImage.sk.S}`,
      sk: `${eventType}#${timestamp}`,
      ttl,
      email: invoiceImage.pk.S?.split('_')[1],
      createdAt: timestamp,
      info: {
        transaction: invoiceImage.transactionId.S,
        productId: invoiceImage.productId.S,
        quantity: invoiceImage.quantity.N
      }
    }
  }).promise();
}

const processExpiredTransaction = async (invoiceTransactionImage: { [key: string]: AttributeValue }) => {
  const transactionId = invoiceTransactionImage.sk.S!;
  const connectionId = invoiceTransactionImage.connectionId;

  console.log(`TransactionId:${transactionId} - ConnectionId: ${connectionId}`);
  
  if (invoiceTransactionImage.transactionStatus.S === 'INVOICE_PROCESSED') {
    console.log('Invoice processed');
  } else {
    console.log(`Invoice import failed - Status: ${invoiceTransactionImage.transactionStatus.S}`);
    await invoiceWSService.sendInvoiceStatus(transactionId, connectionId as string, 'TIMEOUT');
    await Promise.all([
      invoiceWSService.disconnectClient(connectionId as string),
      eventBridgeClient.putEvents({
        Entries: [
          {
            Source: 'app.invoice',
            EventBusName: auditBusName,
            DetailType: 'invoice',
            Time: new Date(),
            Detail: JSON.stringify({
              errorDetail: 'TIMEOUT',
              info: {
                transactionId,
                
              }
            })
          }
        ],
      }).promise()
    ]);
  }
}