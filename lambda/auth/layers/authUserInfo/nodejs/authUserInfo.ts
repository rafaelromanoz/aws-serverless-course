import { APIGatewayEventDefaultAuthorizerContext } from "aws-lambda";
import { CognitoIdentityServiceProvider } from "aws-sdk";

export class AuthInfoService {
  constructor(private readonly cognitoIdentifyServiceProvider: CognitoIdentityServiceProvider) { }
  
  async getUserInfo(authorizer: APIGatewayEventDefaultAuthorizerContext): Promise<string> {
    const userPoolId = authorizer?.claims.iss.split('amazonaws.com/')[1];
    const userName = authorizer?.claims.username;

    const user = await this.cognitoIdentifyServiceProvider.adminGetUser({
      UserPoolId: userPoolId,
      Username: userName
    }).promise();

    const email = user.UserAttributes?.find(attribute => attribute.Name === 'email');
    if (email?.Value) {
      return email.Value
    } else {
      throw new Error("Email not found")
    }
  }
}