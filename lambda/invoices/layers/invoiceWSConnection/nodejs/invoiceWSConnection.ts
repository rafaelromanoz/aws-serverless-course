import {ApiGatewayManagementApi} from "aws-sdk";

export class InvoiceWSService {
    constructor(private readonly apiwManagementApi: ApiGatewayManagementApi) {}

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