#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {EventsDdbStack} from '../lib/eventsDdb-stack';

import { ProductsAppStack } from "../lib/productsApp-stack"
import { EcommerceApiStack } from "../lib/ecommerceApi-stack";
import { ProductsAppLayersStack } from "../lib/productsAppLayers";
import {OrdersAppLayersStack} from '../lib/ordersAppLayers-stack';
import {OrdersAppStack} from "../lib/ordersApp-stack";

const app = new cdk.App();

const env: cdk.Environment = {
    account: "556469730508",
    region: "us-east-1"
}

const tags = {
    cost: "ECommerce",
    team: "RomanoCode",
};

const productsAppLayersStack = new ProductsAppLayersStack(app, "ProductsAppLayers", {
    tags,
    env,
});


const eventsDdbStack = new EventsDdbStack(app, "EventsDdb", {
    tags,
    env
});
const productsAppStack = new ProductsAppStack(app, "ProductsApp", {
    eventsDdb: eventsDdbStack.table,
    tags,
    env,
});

productsAppStack.addDependency(productsAppLayersStack);
productsAppStack.addDependency(eventsDdbStack);


const ordersAppLayerStack = new OrdersAppLayersStack(app, "OrdersAppLayers", {
    tags,
    env
});

const ordersAppStack = new OrdersAppStack(app, "OrdersApp", {
    tags,
    env,
    productsDdb: productsAppStack.productsDbd
});

ordersAppStack.addDependency(productsAppStack);
ordersAppStack.addDependency(ordersAppLayerStack);
const ecommerceApiStack = new EcommerceApiStack(app, "ECommerceApi", {
    productsFetchHandler: productsAppStack.productsFetchHandler,
    productsAdminHandler: productsAppStack.productsAdminHandler,
    ordersHandler: ordersAppStack.ordersHandler,
    tags,
    env
});

ecommerceApiStack.addDependency(productsAppStack);
ecommerceApiStack.addDependency(ordersAppStack);


