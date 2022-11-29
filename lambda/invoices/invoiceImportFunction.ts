import * as AWSXRay from "aws-xray-sdk";
import {APIGatewayProxyEvent, APIGatewayProxyResult, Context} from "aws-lambda";

AWSXRay.captureAWS(require("aws-sdk"));

export const handler = async (event: APIGatewayProxyEvent, context: Context):
    Promise<APIGatewayProxyResult> => {
    console.log(event);

    return {
        statusCode: 200,
        body: 'Ok'
    }
}