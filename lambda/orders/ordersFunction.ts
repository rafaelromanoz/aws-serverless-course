import {DynamoDB, EventBridge, SNS} from "aws-sdk";
import {Order, OrderRepository} from "./layers/ordersLayer/nodejs/orderRepository";
import {Product, ProductRepository} from "/opt/nodejs/productsLayer";
import * as AWSXRay from "aws-xray-sdk";
import {APIGatewayProxyEvent, APIGatewayProxyResult, Context} from "aws-lambda";
import {
    CarrierType,
    OrderProductResponse,
    OrderRequest,
    OrderResponse,
    PaymentType,
    ShippingType
} from "./layers/ordersApiLayer/nodejs/orderApi";
import {Envelope, OrderEvent, OrderEventType} from "./layers/orderEventsLayer/nodejs/orderEvent";
import { v4 as uuid } from "uuid";

AWSXRay.captureAWS(require("aws-sdk"));
const ordersDdb = process.env.ORDERS_DDB!;
const productsDdb = process.env.PRODUCTS_DDB!;

const auditBusName = process.env.AUDIT_BUS_NAME!;

const orderEventsTopicArn = process.env.ORDER_EVENTS_TOPIC_ARN!;
const snsClient = new SNS();

const eventBridgeClient = new EventBridge();

const ddbClient = new DynamoDB.DocumentClient();
const orderRepository = new OrderRepository(ddbClient, ordersDdb);
const productRepository = new ProductRepository(ddbClient, productsDdb);


export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    const method = event.httpMethod;
    const apiRequestId = event.requestContext.requestId;
    const lambdaRequestId = context.awsRequestId;

    console.log(`API Gateway RequestId: ${apiRequestId} - LambdaRequestId: ${lambdaRequestId}`);

    if (method === 'GET') {
        if (event.queryStringParameters) {
            const email = event.queryStringParameters!.email;
            const orderId = event.queryStringParameters!.orderId;
            if (email) {
                // get one order from a user
                if (orderId) {
                    try {
                        const order = await orderRepository.getOrder(email, orderId);
                        return {
                            statusCode: 200,
                            body: JSON.stringify(convertToOrderResponse(order))
                        }
                    } catch (error) {
                        console.log((<Error>error).message);
                        return {
                            statusCode: 404,
                            body: (<Error>error).message
                        }
                    }
                } else {
                    const orders = await orderRepository.getOrdersByEmail(email);
                    return {
                        statusCode: 200,
                        body: JSON.stringify(orders.map(convertToOrderResponse)),
                    }
                }
            }
        } else {
            // get all orders
            const orders = await orderRepository.getAllOrders();
            return {
                statusCode: 200,
                body: JSON.stringify(orders.map(convertToOrderResponse)),
            }
        }
    } else if (method === 'POST') {
        console.log('POST / orders');
        const orderRequest = JSON.parse(event.body!) as OrderRequest;
        const products = await productRepository.getProductsByIds(orderRequest.productIds);
        if (products.length === orderRequest.productIds.length) {
            const order = buildOrder(orderRequest, products);
            const orderCreated = await orderRepository.createOrder(order);
            const eventResult = await sendOrderEvent(orderCreated, OrderEventType.CREATED, lambdaRequestId);
            console.log(`Order created event sent- OrderId: ${orderCreated.sk}
            -MessageId: ${eventResult.MessageId}`);
            return {
                statusCode: 201,
                body: JSON.stringify(convertToOrderResponse(orderCreated))
            }
        } else {
            console.error('Some product was not found');
            const result = await eventBridgeClient.putEvents({
                Entries: [
                    {
                        Source: 'app.order',
                        EventBusName: auditBusName,
                        DetailType: 'order',
                        Time: new Date(),
                        Detail: JSON.stringify({
                            reason: 'PRODUCT_NOT_FOUND',
                            orderRequest,
                        })
                    }
                ],
            }).promise();
            console.log(result);
            return {
                statusCode: 404,
                body: "Some product was not found"
            }
        }
    } else if (method === 'DELETE') {
        console.log('DELETE /delete');

        const email = event.queryStringParameters!.email!;
        const orderId = event.queryStringParameters!.orderId!;

        try {
            const orderDeleted = await orderRepository.deleteOrder(email, orderId);
            const eventResult = await sendOrderEvent(orderDeleted, OrderEventType.DELETED, lambdaRequestId);
            console.log(`Order created event sent- OrderId: ${orderDeleted.sk}
            -MessageId: ${eventResult.MessageId}`);
            return {
                statusCode: 200,
                body: JSON.stringify(convertToOrderResponse(orderDeleted))
            }

        } catch (error) {
            console.log((<Error>error).message);
            return {
                statusCode: 404,
                body: (<Error>error).message
            }
        }
    }
    return {
        statusCode: 400,
        body: 'Bad Request'
    }
}

const sendOrderEvent = (order: Order, eventType: OrderEventType, lambdaRequestId: string) => {
    const productCodes: string[] = order.products.map(({code}) => code);
    const orderEvent: OrderEvent = {
        productCodes,
        email: order.pk,
        orderId: order.sk!,
        billing: order.billing,
        shipping: order.shipping,
        requestId: lambdaRequestId,
    }
    const envelope: Envelope = {
        eventType,
        data: JSON.stringify(orderEvent)
    }
    return snsClient.publish({
        TopicArn: orderEventsTopicArn,
        Message: JSON.stringify(envelope),
        MessageAttributes: {
            eventType: {
                DataType: "String",
                StringValue: eventType
            }
        }
    }).promise()
}

const convertToOrderResponse = (order: Order): OrderResponse => {
    const orderProducts: OrderProductResponse[] = [];
    order.products.forEach((product) => {
        orderProducts.push({
            code: product.code,
            price: product.price,
        })
    });
    return <OrderResponse>{
        email: order.pk,
        id: order.sk,
        createdAt: order.createdAt!,
        products: orderProducts.length ? orderProducts : undefined,
        billing: {
            payment: order.billing.payment as PaymentType,
            totalPrice: order.billing.totalPrice,
        },
        shipping: {
            type: order.shipping.type as ShippingType,
            carrier: order.shipping.carrier as CarrierType,
        }
    };
}


const buildOrder = (orderRequest: OrderRequest, products: Product[] ): Order => {
    const orderProducts: OrderProductResponse[] = [];
    let totalPrice = 0;
    products.forEach((product) => {
        totalPrice += product.price;
        orderProducts.push({
            code: product.code,
            price: product.price,
        })
    })
    return {
        pk: orderRequest.email,
        sk: uuid(),
        createdAt: Date.now(),
        billing: {
            payment: orderRequest.payment,
            totalPrice,
        },
        shipping: {
            type: orderRequest.shipping.type,
            carrier: orderRequest.shipping.carrier
        },
        products: orderProducts
    }
}