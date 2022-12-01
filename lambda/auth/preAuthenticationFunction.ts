import { Callback, Context, PreAuthenticationTriggerEvent } from "aws-lambda";

export const handler = async (event: PreAuthenticationTriggerEvent, context: Context, callback: Callback) => {
  console.log(event);
  callback(null, event);
}