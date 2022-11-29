import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk";
import { ApiGatewayManagementApi, DynamoDB, S3 } from "aws-sdk";
import { v4 as uuid } from "uuid";
import { InvoiceTransactionRepository, InvoiceTransactionStatus } from "/opt/nodejs/invoiceTransaction";
import { InvoiceWSService } from "/opt/nodejs/invoiceWSConnection";

AWSXRay.captureAWS(require("aws-sdk"));

const invoiceDdb = process.env.INVOICE_DDB!;
const bucketName = process.env.BUCKET_NAME!;
const invoiceWsApiEndpoint = process.env.INVOICE_WSAPI_ENDPOINT!.substring(6);

const s3Client = new S3();
const ddbClient = new DynamoDB.DocumentClient();
const apigwManagementApi = new ApiGatewayManagementApi({
    endpoint: invoiceWsApiEndpoint,
});

const invoiceTransactionRepository = new InvoiceTransactionRepository(ddbClient, invoiceDdb);
const invoiceWSService = new InvoiceWSService(apigwManagementApi);

export const handler = async (
    event: APIGatewayProxyEvent,
    context: Context): Promise<APIGatewayProxyResult> => {
    console.log(event);

    const lambdaRequestId = context.awsRequestId;
    const connectionId = event.requestContext.connectionId!;

    console.log(`ConnectionId: ${connectionId} - Lambda RequestId: ${lambdaRequestId}`);

    const key = uuid();
    const expires = 300;
    const signedUrlPut =  await  s3Client.getSignedUrlPromise('putObject', {
        Bucket: bucketName,
        Key: key,
        Expires: expires
    });
    // create invoice transaction
    const timestamp = Date.now();
    const ttl = ~~(timestamp/1000 + 60 * 2);

    await invoiceTransactionRepository.createInvoiceTransaction({
        pk: "#transaction",
        sk: key,
        ttl,
        requestId: lambdaRequestId,
        transactionStatus: InvoiceTransactionStatus.GENERATED,
        timestamp,
        expiresIn: expires,
        connectionId,
        endpoint: invoiceWsApiEndpoint
    });

    // send URL back to WS connection
    const postData = JSON.stringify({
        url: signedUrlPut,
        expires,
        transactionId: key
    });

    await invoiceWSService.sendData(connectionId, postData)

    return {
        statusCode: 200,
        body: 'OK'
    }
}
