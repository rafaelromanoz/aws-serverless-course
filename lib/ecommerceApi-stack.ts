import * as lambdaNodeJS from "aws-cdk-lib/aws-lambda-nodejs";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cwlogs from "aws-cdk-lib/aws-logs";

interface ECommerceApiStackProps extends cdk.StackProps {
    productsFetchHandler: lambdaNodeJS.NodejsFunction;
    productsAdminHandler: lambdaNodeJS.NodejsFunction;
}
export class EcommerceApiStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: ECommerceApiStackProps) {
        super(scope, id, props);

        const logGroup = new cwlogs.LogGroup(this, "ECommerceApiLogs");

        const api = new apigateway.RestApi(this, "ECommerceApi", {
            cloudWatchRole: true,
            restApiName: "ECommerceApi",
            deployOptions: {
                accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
                accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
                    httpMethod: true,
                    ip: true,
                    protocol: true,
                    requestTime: true,
                    resourcePath: true,
                    responseLength: true,
                    status: true,
                    caller: true,
                    user: true,
                })
            }
        });
        // products
        const productsFetchIntegration = new apigateway.LambdaIntegration(props.productsFetchHandler);

        const productsResource = api.root.addResource("products");

        productsResource.addMethod("GET", productsFetchIntegration);

        // /products/{id}

        const productIdResource = productsResource.addResource("{id}");

        productIdResource.addMethod("GET", productsFetchIntegration);

        const productsAdminIntegration = new apigateway.LambdaIntegration(props.productsAdminHandler);

        // POST /products

        productsResource.addMethod("POST", productsAdminIntegration);
        // PUT /products/{id}
        productIdResource.addMethod("PUT", productsAdminIntegration);
        // DELETE /products/{id}
        productIdResource.addMethod("DELETE", productsAdminIntegration);
    }
}


