import { Context, DynamoDBStreamEvent } from "aws-lambda";
import { ApiGatewayManagementApi, DynamoDB } from "aws-sdk";
import { InvoiceWSService } from "/opt/nodejs/invoiceWSConnection";
import * as AWSXRay from "aws-xray-sdk";

AWSXRay.captureAWS(require("aws-sdk"));

const eventsDdb = process.env.EVENTS_DDB!;
const invoiceWSApiEndpoint = process.env.INVOICE_WSAPI_ENDPOINT!;

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
      }
    } else if (record.eventName === 'MODIFY') {

    } else if (record.eventName === 'REMOVE') {

    }
  });

  await Promise.all(promises);
}