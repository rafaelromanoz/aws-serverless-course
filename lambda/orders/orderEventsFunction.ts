import * as AWSXray from 'aws-xray-sdk';
import {AWSError, DynamoDB} from "aws-sdk";
import {OrderEventDdb, OrderEventRepository} from "./layers/orderEventsRepositoryLayer/nodejs/orderEventsRepository";
import {Context, SNSEvent, SNSMessage} from "aws-lambda";
import {Envelope, OrderEvent} from "./layers/orderEventsLayer/nodejs/orderEvent";
import {PromiseResult} from "aws-sdk/lib/request";

AWSXray.captureAWS(require("aws-sdk"));

const eventsDdb = process.env.EVENTS_DDB!

const ddbClient = new DynamoDB.DocumentClient();

const orderEventsRepository = new OrderEventRepository(ddbClient, eventsDdb);

export const handler = async (event: SNSEvent, context: Context): Promise<void> => {
    const promises: Promise<PromiseResult<DynamoDB.DocumentClient.PutItemOutput, AWSError >>[] = event
        .Records
        .map(({Sns}) => createEvent(Sns));
    await Promise.all(promises);
}

const createEvent = (body: SNSMessage) => {
    const envelope = JSON.parse(body.Message) as Envelope;
    const event = JSON.parse(envelope.data) as OrderEvent;
    console.log(
        `Order event - MessageId: ${body.MessageId}`
    );
    const timestamp = Date.now();
    const ttl = ~~(timestamp/ 1000 + 5 * 60);
    const orderEventDdb: OrderEventDdb = {
        pk: `#order_#${event.orderId}`,
        sk: `${envelope.eventType}#${timestamp}`,
        ttl,
        email: event.email,
        createdAt: timestamp,
        requestId: event.requestId,
        eventType: envelope.eventType,
        info: {
            orderId: event.orderId,
            productCodes: event.productCodes,
            messageId: body.MessageId,
        }
    }
    return orderEventsRepository.createOrderEvent(orderEventDdb);
}
