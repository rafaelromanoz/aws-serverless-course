import {DocumentClient} from "aws-sdk/clients/dynamodb";

export interface OrderEventDdb {
    pk: string;
    sk: string;
    ttl: number;
    email: string;
    createdAt: number;
    requestId: string;
    eventType: string;
    info: {
        orderId: string;
        productCodes: string[];
        messageId: string;
    }
}

export class OrderEventRepository {
    constructor(
        private readonly ddbClient: DocumentClient,
        private readonly eventsDdb: string
    ) {}

    createOrderEvent(orderEvent: OrderEventDdb) {
        return this.ddbClient.put({
            TableName: this.eventsDdb,
            Item: {
                ...orderEvent
            }
        }).promise();
    }
}