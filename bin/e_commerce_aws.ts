#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {EventsDdbStack} from '../lib/eventsDdb-stack';

import { ProductsAppStack } from "../lib/productsApp-stack"
import { EcommerceApiStack } from "../lib/ecommerceApi-stack";
import { ProductsAppLayersStack } from "../lib/productsAppLayers";
import { OrdersAppLayersStack } from '../lib/ordersAppLayers-stack';
import { OrdersAppStack } from "../lib/ordersApp-stack";
import { InvoiceWSApiStack } from "../lib/invoiceWSApi-stack";
import { InvoicesAppLayersStack } from "../lib/InvoicesAppLayers-stack";
import { AuditEventBusStack } from "../lib/auditEventBus";
import { AuthLayersStack } from "../lib/authLayers-stack";

const app = new cdk.App();

const env: cdk.Environment = {
    account: "556469730508",
    region: "us-east-1"
}

const tags = {
    cost: "ECommerce",
    team: "RomanoCode",
};

const auditEventBus = new AuditEventBusStack(app, "AuditEvents", {
    tags: {
        cost: 'Audit',
        team: 'Os brabos teams',
    },
    env
});

const authLayersStack = new AuthLayersStack(app, "AuthLayers", {
    tags,
    env
});

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
productsAppStack.addDependency(authLayersStack);
productsAppStack.addDependency(eventsDdbStack);


const ordersAppLayerStack = new OrdersAppLayersStack(app, "OrdersAppLayers", {
    tags,
    env
});

const ordersAppStack = new OrdersAppStack(app, "OrdersApp", {
    tags,
    env,
    productsDdb: productsAppStack.productsDbd,
    eventsDdb: eventsDdbStack.table,
    auditBus: auditEventBus.bus,
});

ordersAppStack.addDependency(productsAppStack);
ordersAppStack.addDependency(ordersAppLayerStack);
ordersAppStack.addDependency(eventsDdbStack);
ordersAppStack.addDependency(auditEventBus);

const ecommerceApiStack = new EcommerceApiStack(app, "ECommerceApi", {
    productsFetchHandler: productsAppStack.productsFetchHandler,
    productsAdminHandler: productsAppStack.productsAdminHandler,
    ordersHandler: ordersAppStack.ordersHandler,
    orderEventsFetchHandler: ordersAppStack.orderEventsFetchHandler,
    tags,
    env
});

ecommerceApiStack.addDependency(productsAppStack);
ecommerceApiStack.addDependency(ordersAppStack);

const invoicesAppLayersStack = new InvoicesAppLayersStack(app, "InvoicesAppLayer", {
    tags: {
        cost: "InvoiceApp",
        team: "RomanoApp"
    },
    env
})
const invoiceWSApiStack = new InvoiceWSApiStack(app, "InvoiceApi", {
    eventsDdb: eventsDdbStack.table,
    auditBus: auditEventBus.bus,
    tags: {
        cost: "InvoiceApp"
    },
    env,
});

invoiceWSApiStack.addDependency(invoicesAppLayersStack);
invoiceWSApiStack.addDependency(eventsDdbStack);
invoiceWSApiStack.addDependency(auditEventBus);


