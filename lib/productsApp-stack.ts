import * as lambdaNodeJS from "aws-cdk-lib/aws-lambda-nodejs";

import * as cdk from "aws-cdk-lib";

import {Construct} from "constructs";

import * as dynadb from "aws-cdk-lib/aws-dynamodb";

export class ProductsAppStack extends cdk.Stack {
    readonly productsFetchHandler: lambdaNodeJS.NodejsFunction;

    readonly productsDbd: dynadb.Table;

    readonly productsAdminHandler: lambdaNodeJS.NodejsFunction;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.productsDbd = new dynadb.Table(this, "ProductsDbd", {
            tableName: 'products',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            partitionKey: {
                name: "id",
                type:  dynadb.AttributeType.STRING,
            },
            billingMode: dynadb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1,
        });
        this.productsFetchHandler = new lambdaNodeJS
            .NodejsFunction(this, "ProductsFetchFunction", {
                functionName: 'ProductsFetchFunction',
                entry: "lambda/products/productsFetchFunction.ts",
                handler: "handler",
                memorySize: 128,
                timeout: cdk.Duration.seconds(5),
                bundling: {
                    minify: true,
                    sourceMap: false,
                },
                environment: {
                    PRODUCTS_DDB: this.productsDbd.tableName,
                }
            });
        this.productsDbd.grantReadData(this.productsFetchHandler);

        this.productsAdminHandler = new lambdaNodeJS
            .NodejsFunction(this, "ProductsAdminFunction", {
                functionName: 'ProductsAdminFunction',
                entry: "lambda/products/productsAdminFunction.ts",
                handler: "handler",
                memorySize: 128,
                timeout: cdk.Duration.seconds(5),
                bundling: {
                    minify: true,
                    sourceMap: false,
                },
                environment: {
                    PRODUCTS_DDB: this.productsDbd.tableName,
                }
            });
        this.productsDbd.grantWriteData(this.productsAdminHandler);
    }
}
