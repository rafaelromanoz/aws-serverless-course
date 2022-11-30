import * as AWSXRay from "aws-xray-sdk";
import {APIGatewayProxyEvent, APIGatewayProxyResult, Context} from "aws-lambda";
import {ApiGatewayManagementApi, DynamoDB} from "aws-sdk";
import {InvoiceTransactionRepository, InvoiceTransactionStatus} from "/opt/nodejs/invoiceTransaction";
import {InvoiceWSService} from "/opt/nodejs/invoiceWSConnection";

AWSXRay.captureAWS(require("aws-sdk"));

const invoiceDdb = process.env.INVOICE_DDB!;
const invoicesWsApiEndpoint = process.env.INVOICE_WSAPI_ENDPOINT!.substring(6);

const ddbClient = new DynamoDB.DocumentClient();
const apigwManagementApi = new ApiGatewayManagementApi({
    endpoint: invoicesWsApiEndpoint,
});

const invoiceTransactionRepository = new InvoiceTransactionRepository(ddbClient, invoiceDdb);
const invoiceWSService = new InvoiceWSService(apigwManagementApi);

export const handler = async (event: APIGatewayProxyEvent, context: Context):
    Promise<APIGatewayProxyResult> => {

    const { transactionId } = JSON.parse(event.body!);
    const { awsRequestId } = context;
    const { requestContext: { connectionId } } = event;

    console.log(`ConnectionId: ${connectionId} - Lambda requestId: ${awsRequestId}`);

    try {
        const invoiceTransaction = await invoiceTransactionRepository.getInvoiceTransaction(transactionId);
        if (invoiceTransaction.transactionStatus === InvoiceTransactionStatus.GENERATED) {
            await Promise.all([invoiceWSService.sendInvoiceStatus(transactionId, <string>connectionId, InvoiceTransactionStatus.CANCELLED),
            invoiceTransactionRepository.updateInvoiceTransaction(transactionId, InvoiceTransactionStatus.CANCELLED)]);

        } else {
            await invoiceWSService
                .sendInvoiceStatus(transactionId, <string>connectionId, invoiceTransaction.transactionStatus);
            console.error("Can't cancel an ongoing process");
        }
    } catch (error) {
        console.error((<Error>error).message);
        console.error(`Invoice transaction not found - transactionId: ${transactionId}`);
        await invoiceWSService
            .sendInvoiceStatus(transactionId, <string>connectionId, InvoiceTransactionStatus.NOT_FOUND);
    }

    return {
        statusCode: 200,
        body: 'Ok'
    }
}