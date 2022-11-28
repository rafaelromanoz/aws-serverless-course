import { Context, SQSEvent } from 'aws-lambda';
import * as AWSXRay from 'aws-xray-sdk';

AWSXRay.captureAWS(require('aws-sdk'));

export async function handler(event: SQSEvent, context: Context): Promise<void> {
    // TODO - to be removed
    event.Records.forEach((record) => {
        console.log("-> record", record);
        const body = JSON.parse(record.body);
        console.log("-> body", body);
    });
    // return
}
