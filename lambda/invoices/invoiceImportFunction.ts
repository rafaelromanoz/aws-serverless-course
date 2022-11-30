import * as AWSXRay from "aws-xray-sdk";
import {Context, S3Event, S3EventRecord} from "aws-lambda";
import {ApiGatewayManagementApi, DynamoDB, EventBridge, S3} from "aws-sdk";
import {InvoiceTransactionRepository, InvoiceTransactionStatus} from "/opt/nodejs/invoiceTransaction";
import {InvoiceWSService} from "/opt/nodejs/invoiceWSConnection";
import {InvoiceFile, InvoiceRepository} from "/opt/nodejs/invoiceRepository";

AWSXRay.captureAWS(require("aws-sdk"));

const invoiceDdb = process.env.INVOICE_DDB!;
const invoicesWsApiEndpoint = process.env.INVOICE_WSAPI_ENDPOINT!.substring(6);

const auditBusName = process.env.AUDIT_BUS_NAME!;

const eventBridgeClient = new EventBridge();

const s3Client = new S3();
const ddbClient = new DynamoDB.DocumentClient();
const apigwManagementApi = new ApiGatewayManagementApi({
    endpoint: invoicesWsApiEndpoint,
});

const invoiceTransactionRepository = new InvoiceTransactionRepository(ddbClient, invoiceDdb);
const invoiceWSService = new InvoiceWSService(apigwManagementApi);
const invoiceRepository = new InvoiceRepository(ddbClient, invoiceDdb);

export const handler = async (event: S3Event, _context: Context):
    Promise<void> => {
    console.log(event);

    const promises = event.Records.map((record) => processRecord(record));

    await Promise.all(promises);

    return ;
}

const processRecord = async (record: S3EventRecord) => {
    const key = record.s3.object.key;

    try {
        const invoiceTransaction = await invoiceTransactionRepository.getInvoiceTransaction(key);

        if (invoiceTransaction.transactionStatus === InvoiceTransactionStatus.GENERATED) {
            await Promise
                .all([
                    invoiceWSService
                        .sendInvoiceStatus(key, invoiceTransaction.connectionId, InvoiceTransactionStatus.RECEIVED),
                    invoiceTransactionRepository
                        .updateInvoiceTransaction(key, InvoiceTransactionStatus.RECEIVED)
                ]);
        } else {
            await invoiceWSService
                .sendInvoiceStatus(key, invoiceTransaction.connectionId, invoiceTransaction.transactionStatus);
            console.error(`Non valid transaction status`);
            return;
        }

        const object = await s3Client.getObject({
            Key: key,
            Bucket: record.s3.bucket.name,
        }).promise();

        const invoice = JSON.parse(object.Body!.toString('utf-8')) as InvoiceFile;
        console.log("-> invoice", invoice);

        if (invoice.invoiceNumber.length >= 5) {
            await Promise.all([
                invoiceRepository.create({
                    pk: `#invoice_${invoice.customerName}`,
                    sk: invoice.invoiceNumber,
                    ttl: 0,
                    totalValue: invoice.totalValue,
                    productId: invoice.productId,
                    transactionId: key,
                    createdAt: Date.now(),
                    quantity: invoice.quantity,
                }),
                s3Client.deleteObject({
                    Key: key,
                    Bucket: record.s3.bucket.name,
                }).promise(),
                invoiceTransactionRepository.updateInvoiceTransaction(key, InvoiceTransactionStatus.PROCESSED),
                invoiceWSService.sendInvoiceStatus(key, invoiceTransaction.connectionId, InvoiceTransactionStatus.PROCESSED)
            ]);
        } else {
            console.error(`Invoice import failed - non valid invoice number - TransactionId: ${key}`);

            const putEventPromise = eventBridgeClient.putEvents({
                Entries: [
                    {
                        Source: 'app.invoice',
                        EventBusName: auditBusName,
                        DetailType: 'invoice',
                        Time: new Date(),
                        Detail: JSON.stringify({
                            errorDetail: 'FAIL_NO_INVOICE_NUMBER',
                            info: {
                                invoiceKey: key,
                                customerName: invoice.customerName,
                            }
                        })
                    }
                ],
            }).promise();

            await Promise.all([
                invoiceWSService.sendInvoiceStatus(key, invoiceTransaction.connectionId, InvoiceTransactionStatus.NON_VALID_INVOICE_NUMBER),
                invoiceTransactionRepository.updateInvoiceTransaction(key, InvoiceTransactionStatus.NON_VALID_INVOICE_NUMBER),
                putEventPromise
            ]);
        }
        await invoiceWSService.disconnectClient(invoiceTransaction.connectionId);
    } catch (error) {
        console.error((<Error>error).message);
    }
}

