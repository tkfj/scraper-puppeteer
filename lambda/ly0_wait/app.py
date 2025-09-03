# register_task_token.py
import os, time, json, boto3
from botocore.exceptions import ClientError

TABLE_NAME = os.getenv("TABLE_NAME") or 'MyDynamo'
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)

def _now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

def lambda_handler(event, context):
    """
    期待される event 例:
    {
      "groupId": "orders_2025-08-28",
      "stageId": "stage2",
      "taskToken": "AAAA...long...",
      "expectedCount": 2,          # このステージで待つ出力数
      "ttlSeconds": 10800          # TTL (秒) 任意。未指定なら 7200
    }
    """
    print(f"{event=}")
    group_id = event["executionName"]
    stage_id = event["key"]
    task_token = event["taskToken"]
    expected_count = int(event.get("expectedCount", 1))
    ttl_seconds = int(event.get("ttlSeconds", 7200))

    now = int(time.time())
    expires_at = now + ttl_seconds

    item = {
        "groupId": group_id,         # PK
        "stageId": stage_id,         # SK
        "taskToken": task_token,
        "expectedCount": expected_count,
        "doneCount": 0,
        "status": "waiting",         # waiting | done | expired
        "createdAt": _now_iso(),
        "updatedAt": _now_iso(),
        "expiresAt": expires_at      # ← DDB の TTL 属性に設定
    }

    try:
        # 新規登録（同じ groupId+stageId が未登録の場合のみ）
        table.put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(groupId) AND attribute_not_exists(stageId)"
        )
        result = {"action": "created"}
    except ClientError as e:
        if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise
        # 既に waiting があるなら token を差し替え（再実行/リトライ対策）
        try:
            table.update_item(
                Key={"groupId": group_id, "stageId": stage_id},
                UpdateExpression="SET taskToken = :t, expiresAt = :x, updatedAt = :u",
                ConditionExpression="attribute_not_exists(#s) OR #s = :waiting",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={
                    ":t": task_token,
                    ":x": expires_at,
                    ":u": _now_iso(),
                    ":waiting": "waiting"
                }
            )
            result = {"action": "updated"}
        except ClientError as e2:
            # すでに done/expired の場合などは上位でハンドリング
            raise

    # waitForTaskToken パターンでは戻り値は使われませんが、ログ用に返しておきます
    return {"ok": True, **result}
