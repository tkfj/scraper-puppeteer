import json
import boto3
from urllib.parse import unquote_plus

def lambda_handler(event, context):
    print(f"{event=}")
    bucket = unquote_plus(event['Records'][0]['s3']['bucket']['name'])
    key = unquote_plus(event['Records'][0]['s3']['object']['key'])
    print(f"{bucket=}")
    print(f"{key=}")
    respbody = {
        "bucket": bucket,
        "key": key,
    }

    s3_client = boto3.client("s3")
    resp = s3_client.head_object(Bucket=bucket, Key=key)
    metadata=resp["Metadata"]
    if ("scrpu-execution-name" in metadata) and ("key" in metadata):
        print(f"{metadata['scrpu-execution-name']=}")
        print(f"{metadata['key']=}")
        dynamodb = boto3.resource("dynamodb")
        dynamotable = dynamodb.Table("MyDynamo")
        dynamoresp = dynamotable.get_item(
            Key={"groupId": metadata["scrpu-execution-name"], "stageId": metadata['key']},
            ConsistentRead=True,
        )
        dynamoitem = dynamoresp.get("Item")
        if not dynamoitem:
            raise LookupError(f"not found: groupId={metadata["scrpu-execution-name"]}, stageId={metadata['key']}")
        taskToken = dynamoitem["taskToken"]
        print(f"{taskToken=}")
        sfn_cli = boto3.client("stepfunctions")
        sfn_cli.send_task_success(
            taskToken=taskToken,
            output=json.dumps(respbody, ensure_ascii=False)
        )
    if ("ingest" in metadata) and ("asof" in metadata):
        print(f"{metadata['ingest']=}")
        print(f"{metadata['asof']=}")
        respbody["ingest"] = metadata["ingest"]
        respbody["asof"] = metadata["asof"]
    return {
        'statusCode': 200,
        'body': json.dumps(respbody)
    }
