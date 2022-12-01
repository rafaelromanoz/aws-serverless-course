import {APIGatewayProxyEvent, APIGatewayProxyResult, Context} from "aws-lambda";
import {Product, ProductRepository} from "/opt/nodejs/productsLayer";
import {CognitoIdentityServiceProvider, DynamoDB, Lambda} from "aws-sdk";
import {ProductEvent, ProductEventType} from "/opt/nodejs/productEventsLayer";
import * as AWSXRay from "aws-xray-sdk";
import { AuthInfoService } from "lambda/auth/layers/authUserInfo/nodejs/authUserInfo";

AWSXRay.captureAWS(require("aws-sdk"));

const productsDdb = process.env.PRODUCTS_DDB!;
const productEventsFunctionName = process.env.PRODUCT_EVENTS_FUNCTION_NAME;
const ddbClient = new DynamoDB.DocumentClient();
const lambdaClient = new Lambda();
const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider();

const productRepository = new ProductRepository(ddbClient, productsDdb);

const authInfoService = new AuthInfoService(cognitoIdentityServiceProvider);

export const handler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    const lambdaRequestId = context.awsRequestId;
    const apiRequestId = event.requestContext.requestId;

    const userEmail = await authInfoService.getUserInfo(event.requestContext.authorizer);

    if (event.resource === "/products") {
        console.log("POST /products");
        const product = JSON.parse(event.body!) as Product;
        const productCreated = await productRepository.create(product);

        const response = await sendProductEvent(productCreated,ProductEventType.CREATED, userEmail, lambdaRequestId);
        console.log('RESPONSE', response);
        return {
            statusCode: 201,
            body: JSON.stringify(productCreated)
        }
    } else if (event.resource === "/products/{id}") {
        const productId = event.pathParameters!.id as string;
        if (event.httpMethod === "PUT") {
            console.log(`PUT /products/${productId}`);
            const product = JSON.parse(event.body!) as Product;
            try {
                const productUpdated = await productRepository.updateProduct(productId, product);
                const response = await sendProductEvent(productUpdated,ProductEventType.UPDATED, userEmail, lambdaRequestId);
                console.log(response);
                return {
                    statusCode: 201,
                    body: JSON.stringify(productUpdated)
                }
            } catch (ConditionalCheckFailedException) {
                return {
                    statusCode: 404,
                    body: 'Product not found'
                }
            }

        } else if (event.httpMethod === "DELETE") {
            console.log(`DELETE /products/${productId}`);
            try {
                const productDeleted = await productRepository.deleteProduct(productId);
                const response = await sendProductEvent(productDeleted,ProductEventType.DELETED, userEmail, lambdaRequestId);
                console.log(response);
                return {
                    statusCode: 200,
                    body: JSON.stringify(productDeleted)
                }
            } catch (error) {
                console.error((<Error>error).message)
                return {
                    statusCode: 404,
                    body: (<Error>error).message
                }
            }
        }
    }
    return {
        statusCode: 400,
        body: "BAD REQUEST"
    }
}

const sendProductEvent = async (product: Product, eventType: ProductEventType, email: string, lambdaRequestId: string) => {
    const event: ProductEvent = {
        email,
        eventType,
        productCode: product.code,
        productId: product.id,
        productPrice: product.price,
        requestId: lambdaRequestId
    }

    lambdaClient.invoke({
        FunctionName: productEventsFunctionName,
        Payload: JSON.stringify(event),
        InvocationType: "Event"
    }).promise();
}
