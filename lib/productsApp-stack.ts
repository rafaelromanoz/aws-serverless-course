import * as lambdaNodeJS from "aws-cdk-lib/aws-lambda-nodejs";

import * as cdk from "aws-cdk-lib";

import * as lambda from 'aws-cdk-lib/aws-lambda'

import {Construct} from "constructs";

import * as dynadb from "aws-cdk-lib/aws-dynamodb";

import * as ssm from 'aws-cdk-lib/aws-ssm';

import * as iam from "aws-cdk-lib/aws-iam";

import * as sqs from "aws-cdk-lib/aws-sqs";

interface ProductsAppStackProps extends cdk.StackProps {
    eventsDdb: dynadb.Table
}

export class ProductsAppStack extends cdk.Stack {
    readonly productsFetchHandler: lambdaNodeJS.NodejsFunction;

    readonly productsDbd: dynadb.Table;

    readonly productsAdminHandler: lambdaNodeJS.NodejsFunction;

    constructor(scope: Construct, id: string, props: ProductsAppStackProps) {
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

        // Auth user info layer

        const authUserInfoLayerArn = ssm.StringParameter
            .valueForStringParameter(this, "AuthUserInfoLayerVersionArn")
        const authUserInfoLayer = lambda
            .LayerVersion.fromLayerVersionArn(this, "AuthUserInfoLayerVersionArn", authUserInfoLayerArn);

        // Product layer

        const productsLayerArn = ssm.StringParameter.valueForStringParameter(this, "ProductsLayerVersionArn")
        const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, "ProductsLayerVersionArn", productsLayerArn)

        // Product Events Layer

        const productEventsLayerArn = ssm.StringParameter
            .valueForStringParameter(this, "ProductEventsLayerVersionArn")
        const productEventsLayer = lambda
            .LayerVersion.fromLayerVersionArn(this, "ProductEventsLayerVersionArn", productEventsLayerArn);

        const dlq = new sqs.Queue(this, "ProductEventsDlq", {
            queueName: "productEventsDlq",
            retentionPeriod: cdk.Duration.days(10)
        });
        const productEventsHandler = new lambdaNodeJS
            .NodejsFunction(this, "ProductsEventsFunction", {
            functionName: 'ProductsEventsFunction',
            entry: "lambda/products/productEventsFunction.ts",
            handler: "handler",
            memorySize: 128,
            timeout: cdk.Duration.seconds(2),
            bundling: {
                minify: true,
                sourceMap: false,
            },
            environment: {
                EVENTS_DDB: props.eventsDdb.tableName,
            },
                layers: [productEventsLayer],
            tracing: lambda.Tracing.ACTIVE,
                deadLetterQueue: dlq,
                deadLetterQueueEnabled: true,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_135_0,
        });

        const eventsDdbPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["dynamodb:PutItem"],
            resources: [props.eventsDdb.tableArn],
            conditions: {
                ['ForAllValues:StringLike']: {
                    'dynamodb:LeadingKeys': ['#product_*']
                }
            }
        })

        productEventsHandler.addToRolePolicy(eventsDdbPolicy);

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
                },
                layers :[productsLayer],
                tracing: lambda.Tracing.ACTIVE,
                insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_135_0,
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
                    PRODUCT_EVENTS_FUNCTION_NAME: productEventsHandler.functionName,
                },
                layers: [productsLayer, productEventsLayer, authUserInfoLayer],
                tracing: lambda.Tracing.ACTIVE,
                insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_135_0,
            });
        this.productsDbd.grantWriteData(this.productsAdminHandler);
        productEventsHandler.grantInvoke(this.productsAdminHandler);
    }
}
