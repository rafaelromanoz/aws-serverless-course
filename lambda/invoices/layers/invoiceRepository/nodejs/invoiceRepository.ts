import {DocumentClient} from "aws-sdk/clients/dynamodb";

export interface InvoiceFile {
    customerName: string;
    invoiceNumber: string;
    totalValue: number;
    productId: string;
    quantity: number;
}

export interface Invoice {
    pk: string;
    sk: string;
    totalValue: number;
    productId: string;
    quantity: number;
    transactionId: string;
    ttl: number;
    createdAt: number;
}

export class InvoiceRepository {
    constructor(private readonly ddbClient: DocumentClient, private readonly  invoicesDdb: string) {}

    async create(invoice: Invoice): Promise<Invoice> {
        await this.ddbClient.put({
            TableName: this.invoicesDdb,
            Item: {
                ...invoice
            }
        }).promise();
        return invoice;
    }
}