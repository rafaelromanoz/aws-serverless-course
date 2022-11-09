import {APIGatewayProxyEvent, APIGatewayProxyResult, Context} from "aws-lambda";
import { ProductRepository } from "/opt/nodejs/productsLayer";
import { DynamoDB } from "aws-sdk";

const productsDdb = process.env.PRODUCTS_DDB!;
const ddbClient = new DynamoDB.DocumentClient();

const productRepository = new ProductRepository(ddbClient, productsDdb);

export const handler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    const lambdaRequestId = context.awsRequestId;
    const apiRequestId = event.requestContext.requestId;

    const { resource, httpMethod } = event;
    if (resource === "/products") {
        if (httpMethod === "GET") {
            console.log('GET /products')
            const products = await productRepository.getAllProducts();
            console.log('LAMBDA REQUEST ID', lambdaRequestId);
            return {
                statusCode: 200,
                body: JSON.stringify(products)
            }
        }
    } else if (event.resource === "/products/{id}") {
        const productId = event.pathParameters!.id as string;
        console.log(`GET /products/${productId}`);
        try {
            const product = await productRepository.getProductById(productId);
            return {
                statusCode: 200,
                body: JSON.stringify(product)
            }
        } catch (error) {
            console.error((<Error>error).message)
            return {
                statusCode: 404,
                body: (<Error>error).message
            }
        }

    }
    return {
        statusCode: 400,
        body: JSON.stringify({
            message: "GET products not ok"
        })
    }
}
