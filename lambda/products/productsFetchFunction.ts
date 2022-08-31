import {APIGatewayProxyEvent, APIGatewayProxyResult, Context} from "aws-lambda";

export const handler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    const lambdaRequestId = context.awsRequestId;
    const apiRequestId = event.requestContext.requestId;

    const { resource, httpMethod } = event;
    if (resource === "/products") {
        if (httpMethod === "GET") {
            console.log('GET')
            console.log('LAMBDA REQUEST ID', lambdaRequestId);
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: "GET products OK"
                })
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
