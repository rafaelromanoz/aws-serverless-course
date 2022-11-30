import { Context, EventBridgeEvent } from "aws-lambda";

export const handler = async (event: EventBridgeEvent<string, string>, context: Context) => {
  console.log(event);
}