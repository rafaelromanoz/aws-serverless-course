import {ApiGatewayManagementApi} from "aws-sdk";

export class InvoiceWSService {
    constructor(private readonly apiwManagementApi: ApiGatewayManagementApi) {}

    sendInvoiceStatus(transactionId: string, connectionId: string, status: string) {
        const postData = JSON.stringify({
            transactionId,
            status
        });
        return this.sendData(connectionId, postData);
    }

    async disconnectClient(connectionId: string): Promise<boolean> {
        try {
            await this.apiwManagementApi.getConnection({
                ConnectionId: connectionId
            }).promise();
            await this.apiwManagementApi.deleteConnection({
                ConnectionId: connectionId
            }).promise();
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    }

    async sendData(connectionId: string, data: string): Promise<boolean> {
        try {
            await this.apiwManagementApi.getConnection({
                ConnectionId: connectionId
            }).promise();
            await this.apiwManagementApi.postToConnection({
                ConnectionId: connectionId,
                Data: data
            }).promise();
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    }
}